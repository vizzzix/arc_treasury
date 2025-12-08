-- =============================================
-- Twitter Multiplier Integration
-- Apply 1.5x multiplier to ALL points for verified Twitter users
-- Run this in Supabase SQL Editor
-- =============================================

-- Updated function to include Twitter multiplier
CREATE OR REPLACE FUNCTION recalculate_user_points(p_wallet TEXT)
RETURNS DECIMAL AS $$
DECLARE
  v_bridge_volume DECIMAL := 0;
  v_vault_volume DECIMAL := 0;
  v_swap_volume DECIMAL := 0;
  v_liquidity_volume DECIMAL := 0;
  v_referral_count INT := 0;
  v_base_points DECIMAL := 0;
  v_twitter_multiplier DECIMAL := 1.0;
  v_total_points DECIMAL := 0;
BEGIN
  -- Bridge volume
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_bridge_volume
  FROM bridge_transactions
  WHERE wallet_address = p_wallet;

  -- Vault deposits
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_vault_volume
  FROM vault_deposits
  WHERE wallet_address = p_wallet;

  -- Swaps
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_swap_volume
  FROM swap_transactions
  WHERE wallet_address = p_wallet;

  -- Liquidity (add only, not remove)
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_liquidity_volume
  FROM liquidity_events
  WHERE wallet_address = p_wallet AND action = 'add';

  -- Referrals (active)
  SELECT COUNT(*) INTO v_referral_count
  FROM referrals
  WHERE referrer_address = p_wallet AND is_active = true;

  -- Get Twitter multiplier (1.5x if verified, 1.0x otherwise)
  SELECT COALESCE(multiplier, 1.0) INTO v_twitter_multiplier
  FROM twitter_connections
  WHERE wallet_address = p_wallet AND repost_verified = true;

  -- If no Twitter connection found, default to 1.0
  IF v_twitter_multiplier IS NULL THEN
    v_twitter_multiplier := 1.0;
  END IF;

  -- Calculate base points
  v_base_points := (v_bridge_volume / 100.0) +
                   (v_vault_volume / 100.0) +
                   (v_swap_volume / 100.0 * 0.5) +
                   (v_liquidity_volume / 100.0 * 2.0) +
                   (v_referral_count * 50);

  -- Apply Twitter multiplier to ALL points
  v_total_points := v_base_points * v_twitter_multiplier;

  -- Upsert into user_points
  INSERT INTO user_points (wallet_address, bridge_volume, vault_volume, swap_volume, liquidity_volume, referral_count, total_points, points_multiplier, updated_at)
  VALUES (p_wallet, v_bridge_volume, v_vault_volume, v_swap_volume, v_liquidity_volume, v_referral_count, v_total_points, v_twitter_multiplier, NOW())
  ON CONFLICT (wallet_address) DO UPDATE SET
    bridge_volume = EXCLUDED.bridge_volume,
    vault_volume = EXCLUDED.vault_volume,
    swap_volume = EXCLUDED.swap_volume,
    liquidity_volume = EXCLUDED.liquidity_volume,
    referral_count = EXCLUDED.referral_count,
    total_points = EXCLUDED.total_points,
    points_multiplier = EXCLUDED.points_multiplier,
    updated_at = NOW();

  RETURN v_total_points;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate points when Twitter is verified
CREATE OR REPLACE FUNCTION trigger_twitter_points()
RETURNS TRIGGER AS $$
BEGIN
  -- When repost_verified changes to true, recalculate user's points
  IF NEW.repost_verified = true AND (OLD IS NULL OR OLD.repost_verified = false) THEN
    PERFORM recalculate_user_points(NEW.wallet_address);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trg_twitter_points ON twitter_connections;

-- Create trigger for twitter_connections
CREATE TRIGGER trg_twitter_points
  AFTER INSERT OR UPDATE ON twitter_connections
  FOR EACH ROW EXECUTE FUNCTION trigger_twitter_points();

-- Recalculate points for all users who already have Twitter verified
DO $$
DECLARE
  wallet_rec RECORD;
BEGIN
  FOR wallet_rec IN
    SELECT wallet_address FROM twitter_connections WHERE repost_verified = true
  LOOP
    PERFORM recalculate_user_points(wallet_rec.wallet_address);
  END LOOP;
END $$;

SELECT 'Twitter multiplier integrated! All verified users will now get 1.5x points.' as status;
