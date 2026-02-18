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
