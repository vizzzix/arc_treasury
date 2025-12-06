-- =============================================
-- Migration: Add points_earned to transaction tables
-- This makes points PERMANENT and CUMULATIVE
-- =============================================

-- 1. Add points_earned column to bridge_transactions
ALTER TABLE bridge_transactions
ADD COLUMN IF NOT EXISTS points_earned DECIMAL(20,6) DEFAULT 0;

-- 2. Add points_earned column to swap_transactions
ALTER TABLE swap_transactions
ADD COLUMN IF NOT EXISTS points_earned DECIMAL(20,6) DEFAULT 0;

-- 3. Add points_earned column to vault_deposits
ALTER TABLE vault_deposits
ADD COLUMN IF NOT EXISTS points_earned DECIMAL(20,6) DEFAULT 0;

-- 4. Add points_earned column to liquidity_events
ALTER TABLE liquidity_events
ADD COLUMN IF NOT EXISTS points_earned DECIMAL(20,6) DEFAULT 0;

-- =============================================
-- Migrate existing transactions (calculate historical points)
-- Base rates: bridge=1pt/$100, swap=0.5pt/$100
-- =============================================

-- Bridge: 1 point per $100
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

-- Liquidity: 2 points per $100 (only 'add' actions)
UPDATE liquidity_events
SET points_earned = CASE
  WHEN action = 'add' THEN (amount_usd / 100) * 2.0
  ELSE 0
END
WHERE points_earned = 0 OR points_earned IS NULL;

-- =============================================
-- Update recalculate function to SUM points_earned
-- =============================================

CREATE OR REPLACE FUNCTION recalculate_user_points(p_wallet TEXT)
RETURNS DECIMAL AS $$
DECLARE
  v_bridge_points DECIMAL;
  v_swap_points DECIMAL;
  v_liquidity_points DECIMAL;
  v_vault_points DECIMAL;
  v_referrals INTEGER;
  v_bridge_volume DECIMAL;
  v_swap_volume DECIMAL;
  v_liquidity_volume DECIMAL;
  v_vault_volume DECIMAL;
  v_total DECIMAL;
BEGIN
  -- Sum points_earned from each table (PERMANENT - never decreases)
  SELECT COALESCE(SUM(points_earned), 0), COALESCE(SUM(amount_usd), 0)
  INTO v_bridge_points, v_bridge_volume
  FROM bridge_transactions WHERE LOWER(wallet_address) = LOWER(p_wallet);

  SELECT COALESCE(SUM(points_earned), 0), COALESCE(SUM(amount_usd), 0)
  INTO v_swap_points, v_swap_volume
  FROM swap_transactions WHERE LOWER(wallet_address) = LOWER(p_wallet);

  SELECT COALESCE(SUM(points_earned), 0), COALESCE(SUM(amount_usd), 0)
  INTO v_liquidity_points, v_liquidity_volume
  FROM liquidity_events WHERE LOWER(wallet_address) = LOWER(p_wallet) AND action = 'add';

  SELECT COALESCE(SUM(points_earned), 0), COALESCE(SUM(amount_usd), 0)
  INTO v_vault_points, v_vault_volume
  FROM vault_deposits WHERE LOWER(wallet_address) = LOWER(p_wallet);

  -- Get referral count (only activated)
  SELECT COUNT(*) INTO v_referrals
  FROM referrals WHERE LOWER(referrer_address) = LOWER(p_wallet) AND is_active = TRUE;

  -- Total = sum of all permanent points + referral bonus
  v_total := v_bridge_points + v_swap_points + v_liquidity_points + v_vault_points + (v_referrals * 50);

  -- Upsert user_points
  INSERT INTO user_points (wallet_address, bridge_volume, swap_volume, liquidity_volume, vault_volume, referral_count, total_points, updated_at)
  VALUES (LOWER(p_wallet), v_bridge_volume, v_swap_volume, v_liquidity_volume, v_vault_volume, v_referrals, v_total, NOW())
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    bridge_volume = v_bridge_volume,
    swap_volume = v_swap_volume,
    liquidity_volume = v_liquidity_volume,
    vault_volume = v_vault_volume,
    referral_count = v_referrals,
    total_points = v_total,
    updated_at = NOW();

  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Recalculate all existing users
-- =============================================

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

-- =============================================
-- Verify migration
-- =============================================
-- SELECT wallet_address, total_points FROM user_points ORDER BY total_points DESC LIMIT 10;
