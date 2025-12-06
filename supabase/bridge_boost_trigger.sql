-- =============================================
-- Bridge Boost Trigger
-- Applies 24h leaderboard boost at transaction time
-- Points are PERMANENT - boost is "locked in" when tx is recorded
-- =============================================

-- Function to calculate user's rank in 24h bridge leaderboard
CREATE OR REPLACE FUNCTION get_bridge_rank_24h(p_wallet TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_rank INTEGER;
BEGIN
  -- Get user's rank by 24h bridge volume
  WITH ranked_users AS (
    SELECT
      wallet_address,
      SUM(amount_usd) as volume_24h,
      ROW_NUMBER() OVER (ORDER BY SUM(amount_usd) DESC) as rank
    FROM bridge_transactions
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY wallet_address
  )
  SELECT rank INTO v_rank
  FROM ranked_users
  WHERE LOWER(wallet_address) = LOWER(p_wallet);

  RETURN COALESCE(v_rank, 999); -- Return 999 if not in leaderboard
END;
$$ LANGUAGE plpgsql;

-- Function to get boost multiplier based on rank
CREATE OR REPLACE FUNCTION get_boost_multiplier(p_rank INTEGER)
RETURNS DECIMAL AS $$
BEGIN
  RETURN CASE
    WHEN p_rank = 1 THEN 3.0
    WHEN p_rank = 2 THEN 2.5
    WHEN p_rank = 3 THEN 2.0
    WHEN p_rank <= 5 THEN 1.5
    WHEN p_rank <= 10 THEN 1.25
    ELSE 1.0
  END;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for bridge_transactions
-- Calculates points_earned with boost at INSERT time
CREATE OR REPLACE FUNCTION calculate_bridge_points_earned()
RETURNS TRIGGER AS $$
DECLARE
  v_rank INTEGER;
  v_boost DECIMAL;
  v_base_points DECIMAL;
BEGIN
  -- Get user's current rank (BEFORE this transaction counts)
  v_rank := get_bridge_rank_24h(NEW.wallet_address);

  -- Get boost multiplier
  v_boost := get_boost_multiplier(v_rank);

  -- Calculate base points: 1 point per $100
  v_base_points := (NEW.amount_usd / 100) * 1.0;

  -- Apply boost and store permanently
  NEW.points_earned := v_base_points * v_boost;

  -- Log for debugging (optional)
  RAISE NOTICE 'Bridge points: wallet=%, amount=$%, rank=%, boost=%x, points=%',
    NEW.wallet_address, NEW.amount_usd, v_rank, v_boost, NEW.points_earned;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trg_calculate_bridge_points ON bridge_transactions;

-- Create BEFORE INSERT trigger (so we can modify NEW.points_earned)
CREATE TRIGGER trg_calculate_bridge_points
  BEFORE INSERT ON bridge_transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_bridge_points_earned();

-- =============================================
-- Similar triggers for other transaction types
-- (without boost - just base rate)
-- =============================================

-- Swap transactions: 0.5 points per $100
CREATE OR REPLACE FUNCTION calculate_swap_points_earned()
RETURNS TRIGGER AS $$
BEGIN
  NEW.points_earned := (NEW.amount_usd / 100) * 0.5;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_swap_points ON swap_transactions;
CREATE TRIGGER trg_calculate_swap_points
  BEFORE INSERT ON swap_transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_swap_points_earned();

-- Vault deposits: 1 point per $100
CREATE OR REPLACE FUNCTION calculate_vault_points_earned()
RETURNS TRIGGER AS $$
BEGIN
  NEW.points_earned := (NEW.amount_usd / 100) * 1.0;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_vault_points ON vault_deposits;
CREATE TRIGGER trg_calculate_vault_points
  BEFORE INSERT ON vault_deposits
  FOR EACH ROW
  EXECUTE FUNCTION calculate_vault_points_earned();

-- Liquidity events: 2 points per $100 (only for 'add')
CREATE OR REPLACE FUNCTION calculate_liquidity_points_earned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.action = 'add' THEN
    NEW.points_earned := (NEW.amount_usd / 100) * 2.0;
  ELSE
    NEW.points_earned := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_liquidity_points ON liquidity_events;
CREATE TRIGGER trg_calculate_liquidity_points
  BEFORE INSERT ON liquidity_events
  FOR EACH ROW
  EXECUTE FUNCTION calculate_liquidity_points_earned();

-- =============================================
-- Test the boost calculation
-- =============================================
-- SELECT get_bridge_rank_24h('0x36f96c51ff953c81c7b9a1e7b3c895671bb66f32');
-- SELECT get_boost_multiplier(1); -- Should return 3.0
-- SELECT get_boost_multiplier(5); -- Should return 1.5
-- SELECT get_boost_multiplier(15); -- Should return 1.0
