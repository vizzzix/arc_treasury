import { supabase } from '@/lib/supabase';

const DEBUG = false;
export const debug = (...args: any[]) => { if (DEBUG) console.log('[useBridgeCCTP]', ...args); };

export const safeStringify = (obj: any, space?: number): string => {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , space);
};

export const trackSiteBridge = async (txHash: string, walletAddress: string, amount: string, direction: 'to_arc' | 'to_sepolia') => {
  if (!supabase) return;
  try {
    await supabase.from('site_bridges').upsert({
      tx_hash: txHash.toLowerCase(),
      wallet_address: walletAddress.toLowerCase(),
      amount_usd: parseFloat(amount),
      direction,
      created_at: new Date().toISOString(),
    }, { onConflict: 'tx_hash' });
    debug('Tracked site bridge:', txHash);
  } catch (e) {
    console.error('[useBridgeCCTP] Failed to track site bridge:', e);
  }
};
