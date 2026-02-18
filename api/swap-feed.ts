import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase';
import { handleCors } from './_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'activity':
        return await handleActivity(req, res);
      case 'stats':
        return await handleStats(req, res);
      case 'top':
        return await handleTop(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action. Use: activity, stats, top' });
    }
  } catch (error: any) {
    console.error('[SwapFeed API] Error:', error.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleActivity(req: VercelRequest, res: VercelResponse) {
  const limit = Math.min(Number(req.query.limit) || 10, 50);

  const [swapRes, lpRes] = await Promise.all([
    supabaseAdmin!.from('swap_transactions')
      .select('id, wallet_address, amount_usd, token_in, token_out, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin!.from('liquidity_events')
      .select('id, wallet_address, amount_usd, action, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (swapRes.error) console.error('[SwapFeed] swaps error:', swapRes.error.message);
  if (lpRes.error) console.error('[SwapFeed] lp error:', lpRes.error.message);

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({
    swaps: swapRes.data || [],
    lpEvents: lpRes.data || [],
  });
}

async function handleStats(_req: VercelRequest, res: VercelResponse) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [swapRes, lpRes] = await Promise.all([
    supabaseAdmin!.from('swap_transactions')
      .select('amount_usd')
      .gte('created_at', oneDayAgo),
    supabaseAdmin!.from('liquidity_events')
      .select('amount_usd')
      .gte('created_at', oneDayAgo),
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

async function handleTop(_req: VercelRequest, res: VercelResponse) {
  let allSwaps: { wallet_address: string; amount_usd: number }[] = [];
  let allLp: { wallet_address: string; amount_usd: number }[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin!.from('swap_transactions')
      .select('wallet_address, amount_usd')
      .range(offset, offset + pageSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    allSwaps = [...allSwaps, ...data];
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin!.from('liquidity_events')
      .select('wallet_address, amount_usd')
      .range(offset, offset + pageSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
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
