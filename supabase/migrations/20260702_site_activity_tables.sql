-- =============================================
-- Site activity tables for swap / liquidity feed
-- =============================================
-- SECURITY: The client-side tracking endpoints (/api/track-tx?action=track-swap,
-- track-liquidity) previously wrote directly into swap_transactions /
-- liquidity_events — the SAME tables the points functions sum. That let anyone
-- forge points by POSTing fake amounts.
--
-- These tables mirror the site_bridges pattern: the client-tracked feed is kept
-- SEPARATE from the on-chain tables the bot populates and points read. Points now
-- only ever see bot-verified rows in swap_transactions / liquidity_events.
--
-- Writes/reads go through the server API (service_role, which bypasses RLS).
-- RLS is enabled with NO anon policies, so the public anon key cannot touch them.

CREATE TABLE IF NOT EXISTS site_swaps (
  id BIGSERIAL PRIMARY KEY,
  tx_hash TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_usd NUMERIC(20, 6) NOT NULL DEFAULT 0,
  token_in TEXT NOT NULL DEFAULT 'USDC',
  token_out TEXT NOT NULL DEFAULT 'EURC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_swaps_created ON site_swaps (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_swaps_wallet ON site_swaps (wallet_address);

CREATE TABLE IF NOT EXISTS site_liquidity (
  id BIGSERIAL PRIMARY KEY,
  tx_hash TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_usd NUMERIC(20, 6) NOT NULL DEFAULT 0,
  action TEXT NOT NULL CHECK (action IN ('add', 'remove')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_liquidity_created ON site_liquidity (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_liquidity_wallet ON site_liquidity (wallet_address);

-- Lock out the public anon key entirely; only the server (service_role) writes/reads.
ALTER TABLE site_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_liquidity ENABLE ROW LEVEL SECURITY;
