-- =============================================
-- Indexes for bridge_transactions table
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Index for sorting by date (main query for live feed)
CREATE INDEX IF NOT EXISTS idx_bridge_transactions_created_at
ON bridge_transactions(created_at DESC);

-- 2. Index for 24h stats query (filtering by date range)
CREATE INDEX IF NOT EXISTS idx_bridge_transactions_stats
ON bridge_transactions(created_at, wallet_address, amount_usd);

-- 3. Index for wallet history lookups
CREATE INDEX IF NOT EXISTS idx_bridge_transactions_wallet
ON bridge_transactions(wallet_address);

-- 4. Unique index on tx_hash (for upsert operations)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bridge_transactions_tx_hash
ON bridge_transactions(tx_hash);

-- =============================================
-- Optional: Auto-cleanup function for old records
-- Keeps only last 90 days of data
-- =============================================

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_bridge_transactions()
RETURNS void AS $$
BEGIN
  DELETE FROM bridge_transactions
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- To run cleanup manually:
-- SELECT cleanup_old_bridge_transactions();

-- To schedule with pg_cron (if enabled):
-- SELECT cron.schedule('cleanup-old-bridges', '0 3 * * *', 'SELECT cleanup_old_bridge_transactions()');
