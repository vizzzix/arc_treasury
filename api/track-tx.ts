import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, insertCircleTx, updateCircleTxStatus, insertSiteSwap, insertSiteLiquidity } from './_lib/supabase';
import { handleCors } from './_lib/cors';
import { checkRateLimit, getRateLimitHeaders } from './_lib/rateLimit';

const ALLOWED_ORIGINS = new Set([
  'https://arctreasury.biz',
  'https://www.arctreasury.biz',
  'http://localhost:5173',
  'http://localhost:3000',
]);

// Rate limit: 30 POST requests per IP per 60 seconds
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 60_000;

// Minimum amount for swap/liquidity tracking (filter dust/spam)
const MIN_TRACK_AMOUNT_USD = 0.01;
// Upper bound for client-tracked feed amounts. These rows are cosmetic
// (Live Activity only, never counted toward points), so this just blocks
// absurd values from polluting the feed.
const MAX_TRACK_AMOUNT_USD = 100_000_000;

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

const MIN_AMOUNT_USD = 1.0;

let feedTopCache: { data: unknown; ts: number } | null = null;
const FEED_TOP_TTL = 30 * 60 * 1000;

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.socket?.remoteAddress || 'unknown';
}

function isOriginAllowed(req: VercelRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // Allow non-browser requests only if they pass other checks
  return ALLOWED_ORIGINS.has(origin);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const { action } = req.query;

  // Rate limit and origin check for POST endpoints
  if (req.method === 'POST') {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const ip = getClientIp(req);
    const rateLimitKey = `post:${ip}`;
    if (!await checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)) {
      const headers = getRateLimitHeaders(rateLimitKey, RATE_LIMIT_MAX);
      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }
  }

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
      case 'feed-all':
        return await handleFeedAll(req, res);
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
  const amt = Number(amountUsd);
  if (!Number.isFinite(amt) || amt < MIN_TRACK_AMOUNT_USD || amt > MAX_TRACK_AMOUNT_USD) {
    return res.status(400).json({ error: `amountUsd must be between ${MIN_TRACK_AMOUNT_USD} and ${MAX_TRACK_AMOUNT_USD}` });
  }

  try {
    await insertSiteSwap({
      tx_hash: txHash.toLowerCase(),
      wallet_address: walletAddress.toLowerCase(),
      amount_usd: amt,
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
  const amt = Number(amountUsd);
  if (!Number.isFinite(amt) || amt < MIN_TRACK_AMOUNT_USD || amt > MAX_TRACK_AMOUNT_USD) {
    return res.status(400).json({ error: `amountUsd must be between ${MIN_TRACK_AMOUNT_USD} and ${MAX_TRACK_AMOUNT_USD}` });
  }

  try {
    await insertSiteLiquidity({
      tx_hash: txHash.toLowerCase(),
      wallet_address: walletAddress.toLowerCase(),
      amount_usd: amt,
      action,
    });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[handleTrackLiquidity] Insert failed:', err.message);
    return res.status(500).json({ error: err.message, action: 'track-liquidity' });
  }
}

async function handleFeedAll(req: VercelRequest, res: VercelResponse) {
  if (!supabaseAdmin) return res.status(500).json({ error: 'DB not configured' });
  const limit = Math.min(Number(req.query.limit) || 10, 50);

  const useTopCache = feedTopCache && Date.now() - feedTopCache.ts < FEED_TOP_TTL;

  // Activity list = client-tracked site_* tables (instant Live Activity feed).
  // Stats/top RPCs read the bot-populated on-chain tables (real, unforgeable volume).
  const [swapActivityRes, lpActivityRes, statsRes, topRes, topCountRes] = await Promise.all([
    supabaseAdmin.from('site_swaps')
      .select('id, wallet_address, amount_usd, token_in, token_out, created_at')
      .gte('amount_usd', MIN_AMOUNT_USD)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin.from('site_liquidity')
      .select('id, wallet_address, amount_usd, action, created_at')
      .gte('amount_usd', MIN_AMOUNT_USD)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin.rpc('get_feed_stats_24h', { min_amount: MIN_AMOUNT_USD }),
    useTopCache ? Promise.resolve(null) : supabaseAdmin.rpc('get_feed_top', { min_amount: MIN_AMOUNT_USD, top_limit: 50 }),
    useTopCache ? Promise.resolve(null) : supabaseAdmin.rpc('get_feed_top_count', { min_amount: MIN_AMOUNT_USD }),
  ]);

  const statsRow = statsRes.data?.[0] || { swap_volume: 0, swap_count: 0, lp_volume: 0, lp_count: 0 };

  let topData: unknown;
  if (useTopCache) {
    topData = feedTopCache!.data;
  } else {
    const ranked = (topRes?.data || []).map((r: any, i: number) => ({
      wallet_address: r.wallet_address,
      total_volume: Number(r.total_volume),
      rank: i + 1,
    }));
    const total = topCountRes?.data ?? ranked.length;
    topData = { ranked, total };
    feedTopCache = { data: topData, ts: Date.now() };
  }

  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
  return res.status(200).json({
    activity: {
      swaps: swapActivityRes.data || [],
      lpEvents: lpActivityRes.data || [],
    },
    stats: {
      totalSwapVolume: Number(statsRow.swap_volume),
      swapCount: Number(statsRow.swap_count),
      totalLpVolume: Number(statsRow.lp_volume),
      lpCount: Number(statsRow.lp_count),
    },
    top: topData,
  });
}

async function computeFeedTop() {
  if (!supabaseAdmin) return { ranked: [], total: 0 };

  const [topRes, countRes] = await Promise.all([
    supabaseAdmin.rpc('get_feed_top', { min_amount: MIN_AMOUNT_USD, top_limit: 50 }),
    supabaseAdmin.rpc('get_feed_top_count', { min_amount: MIN_AMOUNT_USD }),
  ]);

  const ranked = (topRes.data || []).map((r: any, i: number) => ({
    wallet_address: r.wallet_address,
    total_volume: Number(r.total_volume),
    rank: i + 1,
  }));
  const total = countRes.data ?? ranked.length;

  const result = { ranked, total };
  feedTopCache = { data: result, ts: Date.now() };
  return result;
}

async function handleFeedActivity(req: VercelRequest, res: VercelResponse) {
  if (!supabaseAdmin) return res.status(500).json({ error: 'DB not configured' });
  const limit = Math.min(Number(req.query.limit) || 10, 50);

  const [swapRes, lpRes] = await Promise.all([
    supabaseAdmin.from('site_swaps')
      .select('id, wallet_address, amount_usd, token_in, token_out, created_at')
      .gte('amount_usd', MIN_AMOUNT_USD)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin.from('site_liquidity')
      .select('id, wallet_address, amount_usd, action, created_at')
      .gte('amount_usd', MIN_AMOUNT_USD)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (swapRes.error) console.error('[FeedActivity] swap query error:', swapRes.error.message);
  if (lpRes.error) console.error('[FeedActivity] lp query error:', lpRes.error.message);

  res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
  return res.status(200).json({
    swaps: swapRes.data || [],
    lpEvents: lpRes.data || [],
  });
}

async function handleFeedStats(_req: VercelRequest, res: VercelResponse) {
  if (!supabaseAdmin) return res.status(500).json({ error: 'DB not configured' });

  const { data, error } = await supabaseAdmin.rpc('get_feed_stats_24h', { min_amount: MIN_AMOUNT_USD });
  if (error) console.error('[FeedStats] RPC error:', error.message);

  const row = data?.[0] || { swap_volume: 0, swap_count: 0, lp_volume: 0, lp_count: 0 };

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  return res.status(200).json({
    totalSwapVolume: Number(row.swap_volume),
    swapCount: Number(row.swap_count),
    totalLpVolume: Number(row.lp_volume),
    lpCount: Number(row.lp_count),
  });
}

async function handleFeedTop(_req: VercelRequest, res: VercelResponse) {
  if (!supabaseAdmin) return res.status(500).json({ error: 'DB not configured' });

  const useCache = feedTopCache && Date.now() - feedTopCache.ts < FEED_TOP_TTL;
  const result = useCache ? feedTopCache!.data : await computeFeedTop();

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).json(result);
}

async function handleDiagnose(req: VercelRequest, res: VercelResponse) {
  // Require CRON secret for diagnostic endpoint — never expose infra details publicly
  const cronSecret = process.env.CRON;
  const authHeader = req.headers.authorization;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results: Record<string, unknown> = {};
  results.supabaseInitialized = !!supabaseAdmin;

  if (!supabaseAdmin) {
    return res.status(200).json(results);
  }

  // Test SELECT from swap_transactions
  try {
    const { data, error } = await supabaseAdmin
      .from('swap_transactions')
      .select('id')
      .limit(1);
    results.selectTest = error
      ? { ok: false, error: error.message }
      : { ok: true, rowCount: data?.length ?? 0 };
  } catch (e: any) {
    results.selectTest = { ok: false, exception: e.message };
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
