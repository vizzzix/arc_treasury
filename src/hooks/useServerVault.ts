import { useState, useCallback } from 'react';
import { toast } from 'sonner';

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

  const reset = useCallback(() => {
    setState({ phase: 'idle', error: null, txHash: null });
  }, []);

  const waitForTx = async (txId: string, label: string): Promise<string> => {
    let attempts = 0;
    const MAX_ATTEMPTS = 60;

    while (attempts < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      try {
        const res = await fetch(`/api/vault?action=tx-status&txId=${txId}`);
        const data = await res.json();

        if (data.state === 'COMPLETE' || data.state === 'CONFIRMED') {
          return data.txHash || '';
        }
        if (data.state === 'FAILED' || data.state === 'CANCELLED') {
          throw new Error(`${label} failed: ${data.errorReason || data.state}`);
        }
      } catch (e: any) {
        if (e.message?.includes('failed')) throw e;
      }
    }
    throw new Error(`${label} timeout`);
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

  const deposit = useCallback(async (walletId: string, amount: string, currency: 'USDC' | 'EURC' = 'USDC') => {
    const action = currency === 'EURC' ? 'deposit-eurc' : 'deposit-usdc';
    return executeAction(action, { walletId, amount }, `Deposit ${currency}`);
  }, [executeAction]);

  const withdraw = useCallback(async (walletId: string, shares: string, currency: 'USDC' | 'EURC' = 'USDC') => {
    const action = currency === 'EURC' ? 'withdraw-eurc' : 'withdraw-usdc';
    return executeAction(action, { walletId, shares }, `Withdraw ${currency}`);
  }, [executeAction]);

  const swapUsdcForEurc = useCallback(async (walletId: string, amount: string, minOutput?: string) => {
    return executeAction('swap-usdc-eurc', { walletId, amount, minOutput }, 'Swap USDC → EURC');
  }, [executeAction]);

  const swapEurcForUsdc = useCallback(async (walletId: string, amount: string, minOutput?: string) => {
    return executeAction('swap-eurc-usdc', { walletId, amount, minOutput }, 'Swap EURC → USDC');
  }, [executeAction]);

  const depositLocked = useCallback(async (walletId: string, amount: string, currency: 'USDC' | 'EURC', lockPeriodMonths: number) => {
    const action = currency === 'EURC' ? 'deposit-locked-eurc' : 'deposit-locked-usdc';
    return executeAction(action, { walletId, amount, lockPeriodMonths }, `Lock ${currency} (${lockPeriodMonths}m)`);
  }, [executeAction]);

  const addLiquidity = useCallback(async (walletId: string, usdcAmount: string, eurcAmount: string) => {
    return executeAction('add-liquidity', { walletId, usdcAmount, eurcAmount }, 'Add Liquidity');
  }, [executeAction]);

  const removeLiquidity = useCallback(async (walletId: string, lpAmount: string) => {
    return executeAction('remove-liquidity', { walletId, lpAmount }, 'Remove Liquidity');
  }, [executeAction]);

  const withdrawLocked = useCallback(async (walletId: string, positionIndex: number) => {
    return executeAction('withdraw-locked', { walletId, positionIndex }, 'Withdraw Locked');
  }, [executeAction]);

  const earlyWithdrawLocked = useCallback(async (walletId: string, positionIndex: number) => {
    return executeAction('early-withdraw-locked', { walletId, positionIndex }, 'Early Withdraw');
  }, [executeAction]);

  const claimLockedYield = useCallback(async (walletId: string, positionIndex: number) => {
    return executeAction('claim-locked-yield', { walletId, positionIndex }, 'Claim Yield');
  }, [executeAction]);

  const mintBadge = useCallback(async (walletId: string) => {
    return executeAction('mint-badge', { walletId }, 'Mint Badge');
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
