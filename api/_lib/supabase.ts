import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

export const supabaseAdmin = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export interface CircleTransaction {
  circle_tx_id: string;
  tx_type: string;
  status: string;
  wallet_address: string;
  wallet_id: string;
  tx_hash?: string;
  amount?: string;
  currency?: string;
  error_reason?: string;
  metadata?: Record<string, unknown>;
}

const VALID_STATUSES = new Set(['PENDING', 'QUEUED', 'SENT', 'CONFIRMED', 'COMPLETE', 'FAILED', 'CANCELLED']);

function sanitizeStatus(status: string): string {
  return VALID_STATUSES.has(status) ? status : 'PENDING';
}

export async function insertCircleTx(tx: CircleTransaction): Promise<void> {
  if (!supabaseAdmin) {
    console.warn('[Supabase] Client not initialized, skipping insert');
    return;
  }
  const { error } = await supabaseAdmin.from('circle_transactions').upsert({
    ...tx,
    status: sanitizeStatus(tx.status),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'circle_tx_id' });
  if (error) {
    console.error('[Supabase] insertCircleTx error:', error.message, error.details, error.hint);
  }
}

export async function updateCircleTxStatus(
  circleTxId: string,
  status: string,
  txHash?: string,
  errorReason?: string
): Promise<void> {
  if (!supabaseAdmin) {
    console.warn('[Supabase] Client not initialized, skipping update');
    return;
  }
  const update: Record<string, unknown> = { status: sanitizeStatus(status) };
  if (txHash) update.tx_hash = txHash;
  if (errorReason) update.error_reason = errorReason;

  const { error } = await supabaseAdmin
    .from('circle_transactions')
    .update(update)
    .eq('circle_tx_id', circleTxId);
  if (error) {
    console.error('[Supabase] updateCircleTxStatus error:', error.message, error.details, error.hint);
  }
}

export async function insertSwapTx(params: {
  tx_hash: string;
  wallet_address: string;
  amount_usd: number;
  token_in: string;
  token_out: string;
}): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from('swap_transactions').upsert({
    ...params,
    created_at: new Date().toISOString(),
  }, { onConflict: 'tx_hash' });
  if (error) {
    console.error('[Supabase] insertSwapTx error:', error.message, error.details);
  }
}

export async function insertLiquidityEvent(params: {
  tx_hash: string;
  wallet_address: string;
  amount_usd: number;
  action: 'add' | 'remove';
}): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from('liquidity_events').upsert({
    ...params,
    created_at: new Date().toISOString(),
  }, { onConflict: 'tx_hash' });
  if (error) {
    console.error('[Supabase] insertLiquidityEvent error:', error.message, error.details);
  }
}

export async function trackTx(
  result: any,
  txType: string,
  walletId: string,
  walletAddress?: string,
  amount?: string,
  currency?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const txId = result?.id || result?.transactionId;
    if (!txId) return;
    await insertCircleTx({
      circle_tx_id: txId,
      tx_type: txType,
      status: result?.state || 'PENDING',
      wallet_address: (walletAddress || '').toLowerCase(),
      wallet_id: walletId,
      amount,
      currency,
      metadata,
    });
  } catch (e: any) {
    console.warn('[Supabase] trackTx failed:', e.message);
  }
}
