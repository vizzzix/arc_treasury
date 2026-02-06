import { useState, useCallback } from 'react';
import { toast } from 'sonner';

type BridgePhase = 'idle' | 'approving' | 'waiting-approve' | 'burning' | 'waiting-burn' | 'attestation' | 'claiming' | 'complete' | 'error';

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
    const MAX_ATTEMPTS = 60; // 60 * 2s = 2 minutes

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
  const waitForAttestation = async (burnTxHash: string): Promise<void> => {
    let attempts = 0;
    const MAX_ATTEMPTS = 150; // 5 minutes
    let toastId: string | number | undefined;

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
        const res = await fetch(`/api/circle?action=messages&domain=0&transactionHash=${burnTxHash}`);
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

  // Main bridge function
  const bridge = useCallback(async (walletId: string, amount: string, recipientAddress: string) => {
    setState({ phase: 'approving', error: null, burnTxHash: null, claimTxHash: null });

    try {
      // Step 1: Approve
      toast.info('Approving USDC...');
      const approveRes = await fetch('/api/bridge?action=approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, amount }),
      });
      const approveData = await approveRes.json();
      if (!approveRes.ok) throw new Error(approveData.error || 'Approve failed');

      console.log('[ServerBridge] Approve submitted:', approveData.transactionId);

      // Wait for approve tx to confirm
      setState(s => ({ ...s, phase: 'waiting-approve' }));
      toast.info('Waiting for approval confirmation...');
      await waitForTx(approveData.transactionId, 'Approve');
      console.log('[ServerBridge] Approve confirmed');

      // Step 2: Burn (bridge)
      setState(s => ({ ...s, phase: 'burning' }));
      toast.info('Bridging USDC to Arc...');
      const burnRes = await fetch('/api/bridge?action=burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, amount, recipientAddress }),
      });
      const burnData = await burnRes.json();
      if (!burnRes.ok) throw new Error(burnData.error || 'Bridge failed');

      console.log('[ServerBridge] Burn submitted:', burnData.transactionId);

      // Wait for burn tx to confirm
      setState(s => ({ ...s, phase: 'waiting-burn' }));
      toast.info('Waiting for bridge transaction...');
      const { txHash: burnTxHash } = await waitForTx(burnData.transactionId, 'Bridge');
      console.log('[ServerBridge] Burn confirmed, txHash:', burnTxHash);

      setState(s => ({ ...s, burnTxHash, phase: 'attestation' }));

      // Step 3: Wait for attestation
      await waitForAttestation(burnTxHash);
      console.log('[ServerBridge] Attestation received');

      // Step 4: Claim on Arc (backend relayer)
      setState(s => ({ ...s, phase: 'claiming' }));
      toast.info('Claiming USDC on Arc Testnet...');
      const claimRes = await fetch('/api/bridge?action=claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ burnTxHash }),
      });
      const claimData = await claimRes.json();

      if (claimData.status === 'pending') {
        // Attestation not ready yet on backend side - retry once after delay
        await new Promise(r => setTimeout(r, 3000));
        const retryRes = await fetch('/api/bridge?action=claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ burnTxHash }),
        });
        const retryData = await retryRes.json();
        if (retryData.status !== 'complete') {
          throw new Error(retryData.error || 'Claim failed after retry');
        }
        setState(s => ({ ...s, phase: 'complete', claimTxHash: retryData.claimTxHash }));
      } else if (!claimRes.ok) {
        throw new Error(claimData.error || 'Claim failed');
      } else {
        setState(s => ({ ...s, phase: 'complete', claimTxHash: claimData.claimTxHash }));
      }

      toast.success('Bridge complete!', { description: 'USDC arrived on Arc Testnet' });

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
