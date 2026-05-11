import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getAuthHeaders } from '@/lib/authHeaders';
import type { User } from '@supabase/supabase-js';

interface CircleWalletState {
  user: User | null;
  walletId: string | null;
  arcWalletId: string | null;
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
}

interface CircleWalletContextType extends CircleWalletState {
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const CircleWalletContext = createContext<CircleWalletContextType | null>(null);

const WALLET_STORAGE_KEY = 'circle_wallet';

export function CircleWalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CircleWalletState>({
    user: null,
    walletId: null,
    arcWalletId: null,
    address: null,
    isConnected: false,
    isLoading: true,
  });

  // Restore wallet from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(WALLET_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState(prev => ({ ...prev, ...parsed, isLoading: false }));
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Listen for Supabase auth changes
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await ensureWallet(session.user);
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem(WALLET_STORAGE_KEY);
        setState({
          user: null,
          walletId: null,
          arcWalletId: null,
          address: null,
          isConnected: false,
          isLoading: false,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const ensureWallet = useCallback(async (user: User) => {
    setState(prev => ({ ...prev, isLoading: true, user }));

    // Check if we already have a wallet for this user
    const stored = localStorage.getItem(WALLET_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.user?.id === user.id && parsed.address) {
        setState(prev => ({ ...prev, ...parsed, user, isLoading: false }));
        return;
      }
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/wallet?action=create', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error('Failed to create wallet');

      const data = await res.json();
      const newState: CircleWalletState = {
        user,
        walletId: data.walletId,
        arcWalletId: data.arcWalletId || null,
        address: data.address,
        isConnected: true,
        isLoading: false,
      };

      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(newState));
      setState(newState);
    } catch {
      // User is authenticated via Supabase but wallet creation failed
      // This happens in local dev (no Vercel API routes) - will work on Vercel deploy
      const pendingState: CircleWalletState = {
        user,
        walletId: null,
        arcWalletId: null,
        address: null,
        isConnected: false,
        isLoading: false,
      };
      setState(pendingState);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/app' },
    });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    localStorage.removeItem(WALLET_STORAGE_KEY);
    setState({
      user: null,
      walletId: null,
      arcWalletId: null,
      address: null,
      isConnected: false,
      isLoading: false,
    });
  }, []);

  return (
    <CircleWalletContext.Provider value={{
      ...state,
      signInWithGoogle,
      signInWithEmail,
      verifyOtp,
      signOut,
    }}>
      {children}
    </CircleWalletContext.Provider>
  );
}

export function useCircleWallet() {
  const ctx = useContext(CircleWalletContext);
  if (!ctx) throw new Error('useCircleWallet must be used within CircleWalletProvider');
  return ctx;
}
