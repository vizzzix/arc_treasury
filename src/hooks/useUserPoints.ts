import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { useUnifiedWallet } from './useUnifiedWallet';

export interface PointsBreakdown {
  bridgePoints: number;
  swapPoints: number;
  liquidityPoints: number;
  vaultPoints: number;
  referralPoints: number;
  totalPoints: number;
}

export interface UserPointsData {
  wallet_address: string;
  bridge_volume: number;
  swap_volume: number;
  liquidity_volume: number;
  vault_volume: number;
  referral_count: number;
  total_points: number;
}

const POLL_INTERVAL = 300_000;

export const useUserPoints = () => {
  const account = useAccount();
  const unifiedWallet = useUnifiedWallet();
  const address = account?.address || unifiedWallet.address;
  const isConnected = (account?.isConnected ?? false) || unifiedWallet.isConnected;

  const [pointsData, setPointsData] = useState<UserPointsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPoints = useCallback(async () => {
    if (!supabase || !address) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('user_points')
        .select('wallet_address, bridge_volume, swap_volume, liquidity_volume, vault_volume, referral_count, total_points')
        .eq('wallet_address', address.toLowerCase())
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }
      setPointsData(data || null);
    } catch (e: any) {
      console.error('Failed to fetch user points:', e);
      setError(e.message);
    }
  }, [address]);

  useEffect(() => {
    if (!isConnected || !address) {
      setPointsData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    fetchPoints().finally(() => setIsLoading(false));

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchPoints, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchPoints();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [address, isConnected, fetchPoints]);

  const pointsBreakdown: PointsBreakdown | null = pointsData ? {
    bridgePoints: (pointsData.bridge_volume / 100) * 1.0,
    swapPoints: (pointsData.swap_volume / 100) * 0.5,
    liquidityPoints: (pointsData.liquidity_volume / 100) * 2.0,
    vaultPoints: (pointsData.vault_volume / 100) * 1.0,
    referralPoints: pointsData.referral_count * 50,
    totalPoints: pointsData.total_points,
  } : null;

  const pointsValue = pointsData?.total_points || 0;
  const formattedPoints = pointsValue.toLocaleString('en-US', { maximumFractionDigits: 0 });

  return {
    points: pointsValue,
    formattedPoints,
    breakdown: pointsBreakdown,
    volumes: pointsData ? {
      bridge: pointsData.bridge_volume,
      swap: pointsData.swap_volume,
      liquidity: pointsData.liquidity_volume,
      vault: pointsData.vault_volume,
      referrals: pointsData.referral_count,
    } : null,
    isLoading,
    error,
  };
};
