-- Table to track bridges initiated from arctreasury.biz/bridge
-- Used to filter Telegram notifications to only our users

CREATE TABLE IF NOT EXISTS site_bridges (
  id SERIAL PRIMARY KEY,
  tx_hash TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_usd NUMERIC(20, 6) NOT NULL DEFAULT 0,
  direction TEXT NOT NULL CHECK (direction IN ('to_arc', 'to_sepolia')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by wallet + direction + time
CREATE INDEX IF NOT EXISTS idx_site_bridges_wallet_direction_time
ON site_bridges (wallet_address, direction, created_at DESC);

-- Index for tx_hash lookups
CREATE INDEX IF NOT EXISTS idx_site_bridges_tx_hash
ON site_bridges (tx_hash);

-- Enable RLS
ALTER TABLE site_bridges ENABLE ROW LEVEL SECURITY;

-- Allow insert from anon (frontend)
CREATE POLICY "Allow insert from anon" ON site_bridges
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow select from anon (bot)
CREATE POLICY "Allow select from anon" ON site_bridges
  FOR SELECT TO anon
  USING (true);
