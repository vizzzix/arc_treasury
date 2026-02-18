import { supabase } from './supabase';

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
  if (!supabase) return;
  try {
    await supabase.from('circle_transactions').upsert(
      {
        circle_tx_id: txHash.toLowerCase(),
        tx_type: txType,
        status,
        wallet_address: walletAddress.toLowerCase(),
        wallet_id: 'metamask',
        tx_hash: txHash.toLowerCase(),
        amount,
        currency,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'circle_tx_id' }
    );
  } catch (e) {
    console.error('[trackTransaction] Failed:', e);
  }
}

export async function updateTransactionStatus(
  txHash: string,
  status: 'COMPLETE' | 'FAILED',
  errorReason?: string
): Promise<void> {
  if (!supabase) return;
  try {
    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (errorReason) update.error_reason = errorReason;

    await supabase
      .from('circle_transactions')
      .update(update)
      .eq('circle_tx_id', txHash.toLowerCase());
  } catch (e) {
    console.error('[updateTransactionStatus] Failed:', e);
  }
}
