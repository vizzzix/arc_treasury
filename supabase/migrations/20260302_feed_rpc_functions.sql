-- =============================================
-- RPC Functions for Feed Aggregation
-- =============================================
-- Replaces heavy JS-side pagination loops with efficient SQL GROUP BY.
-- Called via supabaseAdmin.rpc() from serverless functions.

-- 1. Top swappers by total volume (swap + liquidity combined)
CREATE OR REPLACE FUNCTION get_feed_top(
  min_amount numeric DEFAULT 1.0,
  top_limit integer DEFAULT 50
)
RETURNS TABLE(wallet_address text, total_volume numeric, rank bigint) AS $$
  SELECT
    sub.wallet_address,
    sub.total_volume,
    ROW_NUMBER() OVER (ORDER BY sub.total_volume DESC) AS rank
  FROM (
    SELECT
      LOWER(combined.wallet_address) AS wallet_address,
      SUM(combined.amount_usd) AS total_volume
    FROM (
      SELECT wallet_address, amount_usd
      FROM swap_transactions
      WHERE amount_usd >= min_amount
      UNION ALL
      SELECT wallet_address, amount_usd
      FROM liquidity_events
      WHERE amount_usd >= min_amount
    ) combined
    GROUP BY LOWER(combined.wallet_address)
    ORDER BY total_volume DESC
    LIMIT top_limit
  ) sub;
$$ LANGUAGE sql STABLE;

-- 2. Total count of unique qualifying wallets
CREATE OR REPLACE FUNCTION get_feed_top_count(
  min_amount numeric DEFAULT 1.0
)
RETURNS integer AS $$
  SELECT COUNT(DISTINCT LOWER(wallet_address))::integer
  FROM (
    SELECT wallet_address FROM swap_transactions WHERE amount_usd >= min_amount
    UNION ALL
    SELECT wallet_address FROM liquidity_events WHERE amount_usd >= min_amount
  ) all_wallets;
$$ LANGUAGE sql STABLE;

-- 3. 24-hour feed stats (volume + count for swaps and liquidity)
CREATE OR REPLACE FUNCTION get_feed_stats_24h(
  min_amount numeric DEFAULT 1.0
)
RETURNS TABLE(swap_volume numeric, swap_count integer, lp_volume numeric, lp_count integer) AS $$
  SELECT
    COALESCE(s.vol, 0) AS swap_volume,
    COALESCE(s.cnt, 0) AS swap_count,
    COALESCE(l.vol, 0) AS lp_volume,
    COALESCE(l.cnt, 0) AS lp_count
  FROM
    (SELECT SUM(amount_usd) AS vol, COUNT(*)::integer AS cnt
     FROM swap_transactions
     WHERE created_at >= NOW() - INTERVAL '24 hours'
       AND amount_usd >= min_amount) s,
    (SELECT SUM(amount_usd) AS vol, COUNT(*)::integer AS cnt
     FROM liquidity_events
     WHERE created_at >= NOW() - INTERVAL '24 hours'
       AND amount_usd >= min_amount) l;
$$ LANGUAGE sql STABLE;
