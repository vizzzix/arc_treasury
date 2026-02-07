import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

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

export async function insertCircleTx(tx: CircleTransaction): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from('circle_transactions').upsert({
      ...tx,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'circle_tx_id' });
  } catch (e) {
    console.error('[Supabase] Failed to insert circle_tx:', e);
  }
}

export async function updateCircleTxStatus(
  circleTxId: string,
  status: string,
  txHash?: string,
  errorReason?: string
): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const update: Record<string, unknown> = { status };
    if (txHash) update.tx_hash = txHash;
    if (errorReason) update.error_reason = errorReason;

    await supabaseAdmin
      .from('circle_transactions')
      .update(update)
      .eq('circle_tx_id', circleTxId);
  } catch (e) {
    console.error('[Supabase] Failed to update circle_tx status:', e);
  }
}
