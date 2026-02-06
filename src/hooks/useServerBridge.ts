import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { trackSiteBridge } from './bridge/utils';

type BridgePhase = 'idle' | 'approving' | 'waiting-approve' | 'burning' | 'waiting-burn' | 'attestation' | 'claiming' | 'complete' | 'error';
type BridgeDirection = 'sepolia-to-arc' | 'arc-to-sepolia';

interface ServerBridgeState {
  phase: BridgePhase;
  error: string | null;
  burnTxHash: string | null;
  claimTxHash: string | null;
}

export const useServerBridge = () => {
  const [state, setState] = useState<ServerBridgeState>({
    phase: 'idle',
    error: null,
    burnTxHash: null,
    claimTxHash: null,
  });

  const reset = useCallback(() => {
    setState({ phase: 'idle', error: null, burnTxHash: null, claimTxHash: null });
  }, []);

  // Poll Circle transaction status until COMPLETE or FAILED
  const waitForTx = async (txId: string, label: string): Promise<{ txHash: string }> => {
    let attempts = 0;
    const MAX_ATTEMPTS = 60;

    while (attempts < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      try {
        const res = await fetch(`/api/bridge?action=tx-status&txId=${txId}`);
        const data = await res.json();

        console.log(`[ServerBridge] ${label} status (${attempts}):`, data.state);

        if (data.state === 'COMPLETE' || data.state === 'CONFIRMED') {
          return { txHash: data.txHash };
        }
        if (data.state === 'FAILED' || data.state === 'CANCELLED') {
          throw new Error(`${label} failed: ${data.errorReason || data.state}`);
        }
      } catch (e: any) {
        if (e.message?.includes('failed')) throw e;
        console.warn(`[ServerBridge] Status poll error:`, e);
      }
    }
    throw new Error(`${label} timeout after ${MAX_ATTEMPTS * 2}s`);
  };

  // Poll attestation until ready
  const waitForAttestation = async (burnTxHash: string, direction: BridgeDirection): Promise<void> => {
    let attempts = 0;
    const MAX_ATTEMPTS = 150;
    let toastId: string | number | undefined;
    const domain = direction === 'arc-to-sepolia' ? 26 : 0;

    while (attempts < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;
      const seconds = attempts * 2;

      if (toastId) {
        toast.loading(`Waiting for attestation... (${seconds}s)`, { id: toastId });
      } else {
        toastId = toast.loading(`Waiting for attestation... (${seconds}s)`, { duration: Infinity });
      }

      try {
        const res = await fetch(`/api/circle?action=messages&domain=${domain}&transactionHash=${burnTxHash}`);
        if (!res.ok) continue;
        const data = await res.json();
        const msg = data.messages?.[0];

        if (msg?.attestation && msg.attestation !== 'PENDING') {
          if (toastId) toast.dismiss(toastId);
          return;
        }
      } catch {
        // Continue polling
      }
    }

    if (toastId) toast.dismiss(toastId);
    throw new Error('Attestation timeout');
  };

  // Main bridge function — supports both directions
  const bridge = useCallback(async (walletId: string, amount: string, recipientAddress: string, direction: BridgeDirection = 'sepolia-to-arc', destWalletId?: string) => {
    setState({ phase: 'approving', error: null, burnTxHash: null, claimTxHash: null });
    const isArcToSepolia = direction === 'arc-to-sepolia';
    const destName = isArcToSepolia ? 'Sepolia' : 'Arc Testnet';

    try {
      // Step 1: Approve
      toast.info('Approving USDC...');
      const approveRes = await fetch('/api/bridge?action=approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, amount, direction }),
      });
      const approveData = await approveRes.json();
      if (!approveRes.ok) throw new Error(approveData.error || 'Approve failed');

      console.log('[ServerBridge] Approve submitted:', approveData.transactionId);

      setState(s => ({ ...s, phase: 'waiting-approve' }));
      toast.info('Waiting for approval confirmation...');
      await waitForTx(approveData.transactionId, 'Approve');
      console.log('[ServerBridge] Approve confirmed');

      // Step 2: Burn (bridge)
      setState(s => ({ ...s, phase: 'burning' }));
      toast.info(`Bridging USDC to ${destName}...`);
      const burnRes = await fetch('/api/bridge?action=burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, amount, recipientAddress, direction }),
      });
      const burnData = await burnRes.json();
      if (!burnRes.ok) throw new Error(burnData.error || 'Bridge failed');

      console.log('[ServerBridge] Burn submitted:', burnData.transactionId);

      setState(s => ({ ...s, phase: 'waiting-burn' }));
      toast.info('Waiting for bridge transaction...');
      const { txHash: burnTxHash } = await waitForTx(burnData.transactionId, 'Bridge');
      console.log('[ServerBridge] Burn confirmed, txHash:', burnTxHash);

      // Track in site_bridges for Live Activity
      const feedDirection = isArcToSepolia ? 'to_sepolia' : 'to_arc';
      trackSiteBridge(burnTxHash, recipientAddress, amount, feedDirection as any);

      setState(s => ({ ...s, burnTxHash, phase: 'attestation' }));

      // Step 3: Wait for attestation
      await waitForAttestation(burnTxHash, direction);
      console.log('[ServerBridge] Attestation received');

      // Step 4: Claim on destination chain (via Circle API)
      setState(s => ({ ...s, phase: 'claiming' }));
      toast.info(`Claiming USDC on ${destName}...`);
      const claimRes = await fetch('/api/bridge?action=claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ burnTxHash, direction, destWalletId }),
      });
      const claimData = await claimRes.json();

      if (claimData.status === 'pending') {
        // Attestation not ready yet — retry after delay
        await new Promise(r => setTimeout(r, 3000));
        const retryRes = await fetch('/api/bridge?action=claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ burnTxHash, direction, destWalletId }),
        });
        const retryData = await retryRes.json();
        if (retryData.status !== 'submitted' && retryData.status !== 'complete') {
          throw new Error(retryData.error || 'Claim failed after retry');
        }
        if (retryData.transactionId) {
          const { txHash: claimTxHash } = await waitForTx(retryData.transactionId, 'Claim');
          setState(s => ({ ...s, phase: 'complete', claimTxHash }));
        }
      } else if (!claimRes.ok) {
        throw new Error(claimData.error || 'Claim failed');
      } else if (claimData.transactionId) {
        // Poll Circle tx until confirmed
        const { txHash: claimTxHash } = await waitForTx(claimData.transactionId, 'Claim');
        setState(s => ({ ...s, phase: 'complete', claimTxHash }));
      } else {
        setState(s => ({ ...s, phase: 'complete', claimTxHash: claimData.claimTxHash }));
      }

      toast.success('Bridge complete!', { description: `USDC arrived on ${destName}` });

    } catch (error: any) {
      console.error('[ServerBridge] Error:', error);
      const msg = error.message || 'Bridge failed';
      setState(s => ({ ...s, phase: 'error', error: msg }));
      toast.error('Bridge failed', { description: msg });
    }
  }, []);

  return {
    ...state,
    isBridging: state.phase !== 'idle' && state.phase !== 'complete' && state.phase !== 'error',
    isComplete: state.phase === 'complete',
    bridge,
    reset,
  };
};
