import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, insertCircleTx, updateCircleTxStatus, insertSwapTx, insertLiquidityEvent } from './_lib/supabase';
import { handleCors } from './_lib/cors';

const VALID_TX_TYPES = new Set([
  'deposit-usdc', 'deposit-eurc',
  'withdraw-usdc', 'withdraw-eurc',
  'swap-usdc-eurc', 'swap-eurc-usdc',
  'deposit-locked-usdc', 'deposit-locked-eurc',
  'add-liquidity', 'remove-liquidity',
  'withdraw-locked', 'early-withdraw-locked',
  'claim-locked-yield', 'mint-badge',
  'bridge-approve', 'bridge-burn', 'bridge-claim',
  'approve',
]);

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const { action } = req.query;

  try {
    switch (action) {
      case 'track':
        return await handleTrack(req, res);
      case 'update-status':
        return await handleUpdateStatus(req, res);
      case 'track-swap':
        return await handleTrackSwap(req, res);
      case 'track-liquidity':
        return await handleTrackLiquidity(req, res);
      case 'feed-activity':
        return await handleFeedActivity(req, res);
      case 'feed-stats':
        return await handleFeedStats(req, res);
      case 'feed-top':
        return await handleFeedTop(req, res);
      case 'diagnose':
        return await handleDiagnose(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('[TrackTx API] Error:', error.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleTrack(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { txHash, txType, walletAddress, amount, currency, status } = req.body;

  if (!txHash || !TX_HASH_REGEX.test(txHash)) {
    return res.status(400).json({ error: 'Valid txHash required' });
  }
  if (!txType || !VALID_TX_TYPES.has(txType)) {
    return res.status(400).json({ error: 'Valid txType required' });
  }
  if (!walletAddress || !ADDRESS_REGEX.test(walletAddress)) {
    return res.status(400).json({ error: 'Valid walletAddress required' });
  }

  await insertCircleTx({
    circle_tx_id: txHash.toLowerCase(),
    tx_type: txType,
    status: status || 'SENT',
    wallet_address: walletAddress.toLowerCase(),
    wallet_id: 'metamask',
    tx_hash: txHash.toLowerCase(),
    amount,
    currency,
  });

  return res.status(200).json({ ok: true });
}

async function handleTrackSwap(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { txHash, walletAddress, amountUsd, tokenIn, tokenOut } = req.body;

  if (!txHash || !TX_HASH_REGEX.test(txHash)) {
    return res.status(400).json({ error: 'Valid txHash required', received: { txHash } });
  }
  if (!walletAddress || !ADDRESS_REGEX.test(walletAddress)) {
    return res.status(400).json({ error: 'Valid walletAddress required', received: { walletAddress } });
  }

  try {
    await insertSwapTx({
      tx_hash: txHash.toLowerCase(),
      wallet_address: walletAddress.toLowerCase(),
      amount_usd: Number(amountUsd) || 0,
      token_in: tokenIn || 'USDC',
      token_out: tokenOut || 'EURC',
    });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[handleTrackSwap] Insert failed:', err.message);
    return res.status(500).json({ error: err.message, action: 'track-swap' });
  }
}

async function handleTrackLiquidity(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { txHash, walletAddress, amountUsd, action } = req.body;

  if (!txHash || !TX_HASH_REGEX.test(txHash)) {
    return res.status(400).json({ error: 'Valid txHash required', received: { txHash } });
  }
  if (!walletAddress || !ADDRESS_REGEX.test(walletAddress)) {
    return res.status(400).json({ error: 'Valid walletAddress required', received: { walletAddress } });
  }
  if (!action || !['add', 'remove'].includes(action)) {
    return res.status(400).json({ error: 'action must be add or remove' });
  }

  try {
    await insertLiquidityEvent({
      tx_hash: txHash.toLowerCase(),
      wallet_address: walletAddress.toLowerCase(),
      amount_usd: Number(amountUsd) || 0,
      action,
    });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[handleTrackLiquidity] Insert failed:', err.message);
    return res.status(500).json({ error: err.message, action: 'track-liquidity' });
  }
}

async function handleFeedActivity(req: VercelRequest, res: VercelResponse) {
  if (!supabaseAdmin) return res.status(500).json({ error: 'DB not configured' });
  const limit = Math.min(Number(req.query.limit) || 10, 50);

  const [swapRes, lpRes] = await Promise.all([
    supabaseAdmin.from('swap_transactions')
      .select('id, wallet_address, amount_usd, token_in, token_out, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin.from('liquidity_events')
      .select('id, wallet_address, amount_usd, action, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (swapRes.error) console.error('[FeedActivity] swap query error:', swapRes.error.message);
  if (lpRes.error) console.error('[FeedActivity] lp query error:', lpRes.error.message);

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({
    swaps: swapRes.data || [],
    lpEvents: lpRes.data || [],
  });
}

async function handleFeedStats(_req: VercelRequest, res: VercelResponse) {
  if (!supabaseAdmin) return res.status(500).json({ error: 'DB not configured' });
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [swapRes, lpRes] = await Promise.all([
    supabaseAdmin.from('swap_transactions').select('amount_usd').gte('created_at', oneDayAgo),
    supabaseAdmin.from('liquidity_events').select('amount_usd').gte('created_at', oneDayAgo),
  ]);

  const swapVolume = swapRes.data?.reduce((sum, s) => sum + Number(s.amount_usd || 0), 0) || 0;
  const lpVolume = lpRes.data?.reduce((sum, e) => sum + Number(e.amount_usd || 0), 0) || 0;

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({
    totalSwapVolume: swapVolume,
    swapCount: swapRes.data?.length || 0,
    totalLpVolume: lpVolume,
    lpCount: lpRes.data?.length || 0,
  });
}

async function handleFeedTop(_req: VercelRequest, res: VercelResponse) {
  if (!supabaseAdmin) return res.status(500).json({ error: 'DB not configured' });

  let allSwaps: { wallet_address: string; amount_usd: number }[] = [];
  let allLp: { wallet_address: string; amount_usd: number }[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.from('swap_transactions')
      .select('wallet_address, amount_usd').range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    allSwaps = [...allSwaps, ...data];
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin.from('liquidity_events')
      .select('wallet_address, amount_usd').range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    allLp = [...allLp, ...data];
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  const volumeByWallet: Record<string, number> = {};
  allSwaps.forEach(tx => {
    const addr = tx.wallet_address.toLowerCase();
    volumeByWallet[addr] = (volumeByWallet[addr] || 0) + Number(tx.amount_usd || 0);
  });
  allLp.forEach(tx => {
    const addr = tx.wallet_address.toLowerCase();
    volumeByWallet[addr] = (volumeByWallet[addr] || 0) + Number(tx.amount_usd || 0);
  });

  const ranked = Object.entries(volumeByWallet)
    .map(([wallet_address, total_volume]) => ({ wallet_address, total_volume }))
    .sort((a, b) => b.total_volume - a.total_volume)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({ ranked });
}

async function handleDiagnose(_req: VercelRequest, res: VercelResponse) {
  const results: Record<string, unknown> = {};

  // 1. Check supabaseAdmin initialization
  results.supabaseInitialized = !!supabaseAdmin;
  results.supabaseUrl = process.env.SUPABASE_URL
    ? `${process.env.SUPABASE_URL.substring(0, 30)}...`
    : process.env.VITE_SUPABASE_URL
      ? `VITE: ${process.env.VITE_SUPABASE_URL.substring(0, 30)}...`
      : 'NOT SET';
  results.keyType = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? 'service_role'
    : process.env.SUPABASE_KEY
      ? 'SUPABASE_KEY (may be anon)'
      : 'NOT SET';

  if (!supabaseAdmin) {
    return res.status(200).json(results);
  }

  // 2. Test SELECT from swap_transactions
  try {
    const { data, error } = await supabaseAdmin
      .from('swap_transactions')
      .select('id, tx_hash')
      .limit(1);
    results.selectTest = error
      ? { ok: false, error: error.message, code: error.code, details: error.details }
      : { ok: true, rowCount: data?.length ?? 0 };
  } catch (e: any) {
    results.selectTest = { ok: false, exception: e.message };
  }

  // 3. Test INSERT into swap_transactions
  const testHash = `0x_diag_test_${Date.now()}`;
  try {
    const { error } = await supabaseAdmin.from('swap_transactions').insert({
      tx_hash: testHash,
      wallet_address: '0x0000000000000000000000000000000000000000',
      amount_usd: 0,
      token_in: 'TEST',
      token_out: 'TEST',
      created_at: new Date().toISOString(),
    });
    results.insertTest = error
      ? { ok: false, error: error.message, code: error.code, details: error.details, hint: error.hint }
      : { ok: true };
  } catch (e: any) {
    results.insertTest = { ok: false, exception: e.message };
  }

  // 4. Clean up test record
  try {
    await supabaseAdmin.from('swap_transactions').delete().eq('tx_hash', testHash);
    results.deleteTest = { ok: true };
  } catch (e: any) {
    results.deleteTest = { ok: false, exception: e.message };
  }

  // 5. Check triggers on swap_transactions
  try {
    const { data, error } = await supabaseAdmin.rpc('get_triggers_info', {});
    results.triggersRpc = error
      ? { ok: false, error: error.message }
      : { ok: true, data };
  } catch {
    results.triggersRpc = { ok: false, note: 'RPC not available (expected)' };
  }

  return res.status(200).json(results);
}

async function handleUpdateStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { txHash, status, errorReason } = req.body;

  if (!txHash || !TX_HASH_REGEX.test(txHash)) {
    return res.status(400).json({ error: 'Valid txHash required' });
  }
  if (!status || !['COMPLETE', 'FAILED'].includes(status)) {
    return res.status(400).json({ error: 'status must be COMPLETE or FAILED' });
  }

  await updateCircleTxStatus(txHash.toLowerCase(), status, undefined, errorReason);

  return res.status(200).json({ ok: true });
}
