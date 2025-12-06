-- =============================================
-- Backfill points_earned for existing transactions
-- This runs ONCE to fill historical data
-- =============================================

-- Bridge: 1 point per $100 (no boost for historical - just base rate)
UPDATE bridge_transactions
SET points_earned = (amount_usd / 100) * 1.0
WHERE points_earned = 0 OR points_earned IS NULL;

-- Swap: 0.5 points per $100
UPDATE swap_transactions
SET points_earned = (amount_usd / 100) * 0.5
WHERE points_earned = 0 OR points_earned IS NULL;

-- Vault: 1 point per $100
UPDATE vault_deposits
SET points_earned = (amount_usd / 100) * 1.0
WHERE points_earned = 0 OR points_earned IS NULL;

-- Liquidity: 2 points per $100 (only 'add')
UPDATE liquidity_events
SET points_earned = CASE
  WHEN action = 'add' THEN (amount_usd / 100) * 2.0
  ELSE 0
END
WHERE points_earned = 0 OR points_earned IS NULL;

-- Recalculate all user totals
DO $$
DECLARE
  wallet TEXT;
BEGIN
  FOR wallet IN
    SELECT DISTINCT LOWER(wallet_address) FROM bridge_transactions
    UNION SELECT DISTINCT LOWER(wallet_address) FROM swap_transactions
    UNION SELECT DISTINCT LOWER(wallet_address) FROM vault_deposits
    UNION SELECT DISTINCT LOWER(wallet_address) FROM liquidity_events
  LOOP
    PERFORM recalculate_user_points(wallet);
  END LOOP;
END $$;

-- Verify
SELECT 'bridge_transactions' as table_name, COUNT(*) as total, SUM(points_earned) as total_points FROM bridge_transactions
UNION ALL
SELECT 'swap_transactions', COUNT(*), SUM(points_earned) FROM swap_transactions
UNION ALL
SELECT 'vault_deposits', COUNT(*), SUM(points_earned) FROM vault_deposits
UNION ALL
SELECT 'liquidity_events', COUNT(*), SUM(points_earned) FROM liquidity_events;
