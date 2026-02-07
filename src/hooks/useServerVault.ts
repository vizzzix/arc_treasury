import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

type VaultPhase = 'idle' | 'executing' | 'polling' | 'complete' | 'error';

interface ServerVaultState {
  phase: VaultPhase;
  error: string | null;
  txHash: string | null;
}

export const useServerVault = () => {
  const [state, setState] = useState<ServerVaultState>({
    phase: 'idle',
    error: null,
    txHash: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ phase: 'idle', error: null, txHash: null });
  }, []);

  // Hybrid wait: Supabase Realtime + polling fallback
  const waitForTx = async (txId: string, label: string): Promise<string> => {
    const controller = new AbortController();
    abortRef.current = controller;

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      let realtimeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

      const cleanup = () => {
        settled = true;
        controller.abort();
        if (realtimeChannel && supabase) {
          supabase.removeChannel(realtimeChannel);
        }
      };

      const onComplete = (txHash: string) => {
        if (settled) return;
        cleanup();
        resolve(txHash);
      };

      const onError = (error: Error) => {
        if (settled) return;
        cleanup();
        reject(error);
      };

      // Path 1: Supabase Realtime subscription
      if (supabase) {
        realtimeChannel = supabase
          .channel(`tx-${txId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'circle_transactions',
              filter: `circle_tx_id=eq.${txId}`,
            },
            (payload) => {
              const row = payload.new as { status: string; tx_hash?: string; error_reason?: string };
              if (row.status === 'COMPLETE' || row.status === 'CONFIRMED') {
                onComplete(row.tx_hash || '');
              } else if (row.status === 'FAILED' || row.status === 'CANCELLED') {
                onError(new Error(`${label} failed: ${row.error_reason || row.status}`));
              }
            }
          )
          .subscribe();
      }

      // Path 2: Polling fallback (slower interval since Realtime is primary)
      const POLL_INTERVAL = supabase ? 8000 : 2000;
      const MAX_ATTEMPTS = supabase ? 30 : 60;
      let attempts = 0;

      const poll = async () => {
        if (settled || controller.signal.aborted) return;
        attempts++;

        try {
          const res = await fetch(`/api/vault?action=tx-status&txId=${txId}`);
          const data = await res.json();

          if (data.state === 'COMPLETE' || data.state === 'CONFIRMED') {
            onComplete(data.txHash || '');
            return;
          }
          if (data.state === 'FAILED' || data.state === 'CANCELLED') {
            onError(new Error(`${label} failed: ${data.errorReason || data.state}`));
            return;
          }
        } catch (e: any) {
          if (e.message?.includes('failed')) {
            onError(e);
            return;
          }
        }

        if (attempts >= MAX_ATTEMPTS) {
          onError(new Error(`${label} timeout`));
          return;
        }

        if (!settled) {
          setTimeout(poll, POLL_INTERVAL);
        }
      };

      // Start polling after initial delay
      setTimeout(poll, POLL_INTERVAL);
    });
  };

  const executeAction = useCallback(async (
    action: string,
    body: Record<string, unknown>,
    label: string
  ): Promise<string | null> => {
    setState({ phase: 'executing', error: null, txHash: null });
    toast.info(`${label}...`);

    try {
      const res = await fetch(`/api/vault?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${label} failed`);

      const txId = data.transactionId;
      if (!txId) throw new Error('No transaction ID returned');

      setState(s => ({ ...s, phase: 'polling' }));
      toast.info('Waiting for confirmation...');

      const txHash = await waitForTx(txId, label);

      setState({ phase: 'complete', error: null, txHash });
      toast.success(`${label} complete!`);
      return txHash;
    } catch (error: any) {
      const msg = error.message || `${label} failed`;
      setState({ phase: 'error', error: msg, txHash: null });
      toast.error(label, { description: msg });
      return null;
    }
  }, []);

  const deposit = useCallback(async (walletId: string, amount: string, currency: 'USDC' | 'EURC' = 'USDC', walletAddress?: string) => {
    const action = currency === 'EURC' ? 'deposit-eurc' : 'deposit-usdc';
    return executeAction(action, { walletId, amount, walletAddress }, `Deposit ${currency}`);
  }, [executeAction]);

  const withdraw = useCallback(async (walletId: string, shares: string, currency: 'USDC' | 'EURC' = 'USDC', walletAddress?: string) => {
    const action = currency === 'EURC' ? 'withdraw-eurc' : 'withdraw-usdc';
    return executeAction(action, { walletId, shares, walletAddress }, `Withdraw ${currency}`);
  }, [executeAction]);

  const swapUsdcForEurc = useCallback(async (walletId: string, amount: string, minOutput?: string, walletAddress?: string) => {
    return executeAction('swap-usdc-eurc', { walletId, amount, minOutput, walletAddress }, 'Swap USDC → EURC');
  }, [executeAction]);

  const swapEurcForUsdc = useCallback(async (walletId: string, amount: string, minOutput?: string, walletAddress?: string) => {
    return executeAction('swap-eurc-usdc', { walletId, amount, minOutput, walletAddress }, 'Swap EURC → USDC');
  }, [executeAction]);

  const depositLocked = useCallback(async (walletId: string, amount: string, currency: 'USDC' | 'EURC', lockPeriodMonths: number, walletAddress?: string) => {
    const action = currency === 'EURC' ? 'deposit-locked-eurc' : 'deposit-locked-usdc';
    return executeAction(action, { walletId, amount, lockPeriodMonths, walletAddress }, `Lock ${currency} (${lockPeriodMonths}m)`);
  }, [executeAction]);

  const addLiquidity = useCallback(async (walletId: string, usdcAmount: string, eurcAmount: string, walletAddress?: string) => {
    return executeAction('add-liquidity', { walletId, usdcAmount, eurcAmount, walletAddress }, 'Add Liquidity');
  }, [executeAction]);

  const removeLiquidity = useCallback(async (walletId: string, lpAmount: string, walletAddress?: string) => {
    return executeAction('remove-liquidity', { walletId, lpAmount, walletAddress }, 'Remove Liquidity');
  }, [executeAction]);

  const withdrawLocked = useCallback(async (walletId: string, positionIndex: number, walletAddress?: string) => {
    return executeAction('withdraw-locked', { walletId, positionIndex, walletAddress }, 'Withdraw Locked');
  }, [executeAction]);

  const earlyWithdrawLocked = useCallback(async (walletId: string, positionIndex: number, walletAddress?: string) => {
    return executeAction('early-withdraw-locked', { walletId, positionIndex, walletAddress }, 'Early Withdraw');
  }, [executeAction]);

  const claimLockedYield = useCallback(async (walletId: string, positionIndex: number, walletAddress?: string) => {
    return executeAction('claim-locked-yield', { walletId, positionIndex, walletAddress }, 'Claim Yield');
  }, [executeAction]);

  const mintBadge = useCallback(async (walletId: string, walletAddress?: string) => {
    return executeAction('mint-badge', { walletId, walletAddress }, 'Mint Badge');
  }, [executeAction]);

  return {
    ...state,
    isProcessing: state.phase !== 'idle' && state.phase !== 'complete' && state.phase !== 'error',
    isComplete: state.phase === 'complete',
    deposit,
    withdraw,
    swapUsdcForEurc,
    swapEurcForUsdc,
    depositLocked,
    addLiquidity,
    removeLiquidity,
    withdrawLocked,
    earlyWithdrawLocked,
    claimLockedYield,
    mintBadge,
    reset,
  };
};
