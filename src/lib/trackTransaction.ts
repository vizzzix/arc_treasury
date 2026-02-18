import { supabase } from '@/lib/supabase';

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
  if (!supabase) return;
  try {
    await supabase.from('swap_transactions').upsert({
      wallet_address: walletAddress.toLowerCase(),
      amount_usd: amountUsd,
      token_in: tokenIn,
      token_out: tokenOut,
      tx_hash: txHash.toLowerCase(),
      created_at: new Date().toISOString(),
    }, { onConflict: 'tx_hash' });
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
  if (!supabase) return;
  try {
    await supabase.from('liquidity_events').upsert({
      wallet_address: walletAddress.toLowerCase(),
      amount_usd: amountUsd,
      action,
      tx_hash: txHash.toLowerCase(),
      created_at: new Date().toISOString(),
    }, { onConflict: 'tx_hash' });
  } catch (e) {
    console.error('[trackSiteLiquidity] Failed:', e);
  }
}
