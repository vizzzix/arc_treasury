-- Триггеры для автоматического пересчёта user_points
-- Выполнить в Supabase SQL Editor

-- Функция пересчёта поинтов (упрощённая, без referrals)
CREATE OR REPLACE FUNCTION recalculate_user_points(p_wallet TEXT)
RETURNS DECIMAL AS $$
DECLARE
  v_bridge_volume DECIMAL := 0;
  v_vault_volume DECIMAL := 0;
  v_swap_volume DECIMAL := 0;
  v_liquidity_volume DECIMAL := 0;
  v_referral_count INT := 0;
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

  -- Referrals (активные)
  SELECT COUNT(*) INTO v_referral_count
  FROM referrals
  WHERE referrer_address = p_wallet AND is_active = true;

  -- Calculate points: bridge 1pt/$100, vault 1pt/$100, swap 0.5pt/$100, liquidity 2pt/$100, referral 50pts
  v_total_points := (v_bridge_volume / 100.0) +
                    (v_vault_volume / 100.0) +
                    (v_swap_volume / 100.0 * 0.5) +
                    (v_liquidity_volume / 100.0 * 2.0) +
                    (v_referral_count * 50);

  -- Upsert into user_points
  INSERT INTO user_points (wallet_address, bridge_volume, vault_volume, swap_volume, liquidity_volume, referral_count, total_points, updated_at)
  VALUES (p_wallet, v_bridge_volume, v_vault_volume, v_swap_volume, v_liquidity_volume, v_referral_count, v_total_points, NOW())
  ON CONFLICT (wallet_address) DO UPDATE SET
    bridge_volume = EXCLUDED.bridge_volume,
    vault_volume = EXCLUDED.vault_volume,
    swap_volume = EXCLUDED.swap_volume,
    liquidity_volume = EXCLUDED.liquidity_volume,
    referral_count = EXCLUDED.referral_count,
    total_points = EXCLUDED.total_points,
    updated_at = NOW();

  RETURN v_total_points;
END;
$$ LANGUAGE plpgsql;

-- Триггерная функция для bridge_transactions
CREATE OR REPLACE FUNCTION trigger_bridge_points()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_user_points(NEW.wallet_address);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггерная функция для vault_deposits
CREATE OR REPLACE FUNCTION trigger_vault_points()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_user_points(NEW.wallet_address);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггерная функция для swap_transactions
CREATE OR REPLACE FUNCTION trigger_swap_points()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_user_points(NEW.wallet_address);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггерная функция для liquidity_events
CREATE OR REPLACE FUNCTION trigger_liquidity_points()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_user_points(NEW.wallet_address);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггерная функция для referrals
CREATE OR REPLACE FUNCTION trigger_referral_points()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_user_points(NEW.referrer_address);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Удалить старые триггеры (если есть)
DROP TRIGGER IF EXISTS trg_bridge_points ON bridge_transactions;
DROP TRIGGER IF EXISTS trg_vault_points ON vault_deposits;
DROP TRIGGER IF EXISTS trg_swap_points ON swap_transactions;
DROP TRIGGER IF EXISTS trg_liquidity_points ON liquidity_events;
DROP TRIGGER IF EXISTS trg_referral_points ON referrals;

-- Создать новые триггеры
CREATE TRIGGER trg_bridge_points
  AFTER INSERT ON bridge_transactions
  FOR EACH ROW EXECUTE FUNCTION trigger_bridge_points();

CREATE TRIGGER trg_vault_points
  AFTER INSERT ON vault_deposits
  FOR EACH ROW EXECUTE FUNCTION trigger_vault_points();

CREATE TRIGGER trg_swap_points
  AFTER INSERT ON swap_transactions
  FOR EACH ROW EXECUTE FUNCTION trigger_swap_points();

CREATE TRIGGER trg_liquidity_points
  AFTER INSERT ON liquidity_events
  FOR EACH ROW EXECUTE FUNCTION trigger_liquidity_points();

CREATE TRIGGER trg_referral_points
  AFTER INSERT OR UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION trigger_referral_points();

-- Пересчитать все поинты для существующих пользователей
DO $$
DECLARE
  wallet_rec RECORD;
BEGIN
  FOR wallet_rec IN
    SELECT DISTINCT wallet_address FROM bridge_transactions
    UNION SELECT DISTINCT wallet_address FROM vault_deposits
    UNION SELECT DISTINCT wallet_address FROM swap_transactions
    UNION SELECT DISTINCT wallet_address FROM liquidity_events
  LOOP
    PERFORM recalculate_user_points(wallet_rec.wallet_address);
  END LOOP;
END $$;

SELECT 'Triggers created and points recalculated!' as status;
