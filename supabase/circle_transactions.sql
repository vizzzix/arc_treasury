-- Table to track all Circle wallet transactions
-- Replaces client-side polling with server-side persistence + Realtime

CREATE TABLE IF NOT EXISTS circle_transactions (
  id SERIAL PRIMARY KEY,
  circle_tx_id TEXT UNIQUE NOT NULL,
  tx_type TEXT NOT NULL CHECK (tx_type IN (
    'deposit-usdc', 'deposit-eurc',
    'withdraw-usdc', 'withdraw-eurc',
    'swap-usdc-eurc', 'swap-eurc-usdc',
    'deposit-locked-usdc', 'deposit-locked-eurc',
    'add-liquidity', 'remove-liquidity',
    'withdraw-locked', 'early-withdraw-locked',
    'claim-locked-yield', 'mint-badge',
    'bridge-approve', 'bridge-burn', 'bridge-claim',
    'approve'
  )),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'QUEUED', 'SENT', 'CONFIRMED', 'COMPLETE', 'FAILED', 'CANCELLED'
  )),
  wallet_address TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  tx_hash TEXT,
  amount TEXT,
  currency TEXT,
  error_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by wallet address (history page)
CREATE INDEX IF NOT EXISTS idx_circle_tx_wallet_time
ON circle_transactions (wallet_address, created_at DESC);

-- Index for Circle tx ID lookups (webhook updates)
CREATE INDEX IF NOT EXISTS idx_circle_tx_circle_id
ON circle_transactions (circle_tx_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_circle_tx_status
ON circle_transactions (status) WHERE status NOT IN ('COMPLETE', 'FAILED', 'CANCELLED');

-- Enable RLS
ALTER TABLE circle_transactions ENABLE ROW LEVEL SECURITY;

-- Allow insert from service_role (API endpoints)
CREATE POLICY "Allow insert from anon" ON circle_transactions
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow insert from authenticated" ON circle_transactions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow select (frontend reads for history + realtime)
CREATE POLICY "Allow select from anon" ON circle_transactions
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow select from authenticated" ON circle_transactions
  FOR SELECT TO authenticated
  USING (true);

-- Allow update (webhook status updates)
CREATE POLICY "Allow update from anon" ON circle_transactions
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow update from authenticated" ON circle_transactions
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE circle_transactions;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_circle_tx_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER circle_tx_updated_at
  BEFORE UPDATE ON circle_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_circle_tx_updated_at();
