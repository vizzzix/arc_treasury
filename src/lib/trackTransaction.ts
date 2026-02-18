interface TrackParams {
  txHash: string;
  txType: string;
  walletAddress: string;
  amount?: string;
  currency?: string;
  status?: string;
}

export async function trackTransaction({
  txHash,
  txType,
  walletAddress,
  amount,
  currency,
  status = 'SENT',
}: TrackParams): Promise<void> {
  try {
    await fetch('/api/track-tx?action=track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash, txType, walletAddress, amount, currency, status }),
    });
  } catch (e) {
    console.error('[trackTransaction] Failed:', e);
  }
}

export async function updateTransactionStatus(
  txHash: string,
  status: 'COMPLETE' | 'FAILED',
  errorReason?: string
): Promise<void> {
  try {
    await fetch('/api/track-tx?action=update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash, status, errorReason }),
    });
  } catch (e) {
    console.error('[updateTransactionStatus] Failed:', e);
  }
}

export async function trackSiteSwap(
  txHash: string,
  walletAddress: string,
  amountUsd: number,
  tokenIn: string,
  tokenOut: string,
): Promise<void> {
  try {
    await fetch('/api/track-tx?action=track-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash, walletAddress, amountUsd, tokenIn, tokenOut }),
    });
  } catch (e) {
    console.error('[trackSiteSwap] Failed:', e);
  }
}

export async function trackSiteLiquidity(
  txHash: string,
  walletAddress: string,
  amountUsd: number,
  action: 'add' | 'remove',
): Promise<void> {
  try {
    await fetch('/api/track-tx?action=track-liquidity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash, walletAddress, amountUsd, action }),
    });
  } catch (e) {
    console.error('[trackSiteLiquidity] Failed:', e);
  }
}
