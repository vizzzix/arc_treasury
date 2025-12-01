-- =============================================
-- Arc Treasury Points System Schema
-- =============================================

-- 1. User Points (aggregated stats)
CREATE TABLE IF NOT EXISTS user_points (
  wallet_address TEXT PRIMARY KEY,
  bridge_volume DECIMAL(20,2) DEFAULT 0,
  swap_volume DECIMAL(20,2) DEFAULT 0,
  liquidity_volume DECIMAL(20,2) DEFAULT 0,
  vault_volume DECIMAL(20,2) DEFAULT 0,
  referral_count INTEGER DEFAULT 0,
  total_points DECIMAL(20,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Vault Deposits (from bot monitoring)
CREATE TABLE IF NOT EXISTS vault_deposits (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  amount_usd DECIMAL(20,6) NOT NULL,
  token TEXT NOT NULL, -- 'USDC' or 'EURC'
  lock_period INTEGER DEFAULT 0, -- 0=flex, 1,3,12 months
  tx_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Swap Transactions (from bot monitoring)
CREATE TABLE IF NOT EXISTS swap_transactions (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  amount_usd DECIMAL(20,6) NOT NULL,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Liquidity Events (from bot monitoring)
CREATE TABLE IF NOT EXISTS liquidity_events (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  amount_usd DECIMAL(20,6) NOT NULL,
  action TEXT NOT NULL, -- 'add' or 'remove'
  tx_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  user_address TEXT UNIQUE NOT NULL,
  referrer_address TEXT NOT NULL,
  referral_code TEXT,
  is_activated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Indexes for performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_user_points_total ON user_points(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_vault_deposits_wallet ON vault_deposits(wallet_address);
CREATE INDEX IF NOT EXISTS idx_vault_deposits_created ON vault_deposits(created_at);
CREATE INDEX IF NOT EXISTS idx_swap_transactions_wallet ON swap_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_swap_transactions_created ON swap_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_liquidity_events_wallet ON liquidity_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_address);

-- =============================================
-- Function to recalculate user points
-- =============================================

CREATE OR REPLACE FUNCTION recalculate_user_points(p_wallet TEXT)
RETURNS DECIMAL AS $$
DECLARE
  v_bridge DECIMAL;
  v_swap DECIMAL;
  v_liquidity DECIMAL;
  v_vault DECIMAL;
  v_referrals INTEGER;
  v_total DECIMAL;
BEGIN
  -- Get bridge volume
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_bridge
  FROM bridge_transactions WHERE LOWER(wallet_address) = LOWER(p_wallet);

  -- Get swap volume
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_swap
  FROM swap_transactions WHERE LOWER(wallet_address) = LOWER(p_wallet);

  -- Get liquidity volume (only 'add' actions count)
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_liquidity
  FROM liquidity_events WHERE LOWER(wallet_address) = LOWER(p_wallet) AND action = 'add';

  -- Get vault volume
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_vault
  FROM vault_deposits WHERE LOWER(wallet_address) = LOWER(p_wallet);

  -- Get referral count (only activated)
  SELECT COUNT(*) INTO v_referrals
  FROM referrals WHERE LOWER(referrer_address) = LOWER(p_wallet) AND is_activated = TRUE;

  -- Calculate total points
  -- Bridge: 1 pt per $100
  -- Swap: 0.5 pt per $100
  -- Liquidity: 2 pt per $100
  -- Vault: 1 pt per $100
  -- Referral: 50 pts each
  v_total := (v_bridge / 100) * 1.0 +
             (v_swap / 100) * 0.5 +
             (v_liquidity / 100) * 2.0 +
             (v_vault / 100) * 1.0 +
             (v_referrals * 50);

  -- Upsert user_points
  INSERT INTO user_points (wallet_address, bridge_volume, swap_volume, liquidity_volume, vault_volume, referral_count, total_points, updated_at)
  VALUES (LOWER(p_wallet), v_bridge, v_swap, v_liquidity, v_vault, v_referrals, v_total, NOW())
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    bridge_volume = v_bridge,
    swap_volume = v_swap,
    liquidity_volume = v_liquidity,
    vault_volume = v_vault,
    referral_count = v_referrals,
    total_points = v_total,
    updated_at = NOW();

  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Trigger to auto-update points on new transactions
-- =============================================

CREATE OR REPLACE FUNCTION trigger_update_points()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_user_points(NEW.wallet_address);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for each table
DROP TRIGGER IF EXISTS trg_bridge_points ON bridge_transactions;
CREATE TRIGGER trg_bridge_points
  AFTER INSERT ON bridge_transactions
  FOR EACH ROW EXECUTE FUNCTION trigger_update_points();

DROP TRIGGER IF EXISTS trg_swap_points ON swap_transactions;
CREATE TRIGGER trg_swap_points
  AFTER INSERT ON swap_transactions
  FOR EACH ROW EXECUTE FUNCTION trigger_update_points();

DROP TRIGGER IF EXISTS trg_liquidity_points ON liquidity_events;
CREATE TRIGGER trg_liquidity_points
  AFTER INSERT ON liquidity_events
  FOR EACH ROW EXECUTE FUNCTION trigger_update_points();

DROP TRIGGER IF EXISTS trg_vault_points ON vault_deposits;
CREATE TRIGGER trg_vault_points
  AFTER INSERT ON vault_deposits
  FOR EACH ROW EXECUTE FUNCTION trigger_update_points();
