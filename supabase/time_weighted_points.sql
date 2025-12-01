-- Time-Weighted Points System
-- Защита от накрутки: поинты начисляются за ВРЕМЯ удержания, а не за объём операций

-- 1. Таблица снэпшотов балансов (снимается раз в час)
CREATE TABLE IF NOT EXISTS balance_snapshots (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Balances at snapshot time
  vault_usdc DECIMAL DEFAULT 0,      -- Flexible USDC in vault
  vault_eurc DECIMAL DEFAULT 0,      -- Flexible EURC in vault
  locked_usdc DECIMAL DEFAULT 0,     -- Locked USDC positions
  locked_eurc DECIMAL DEFAULT 0,     -- Locked EURC positions
  lp_balance DECIMAL DEFAULT 0,      -- LP tokens in swap pool

  -- Total USD value at snapshot
  total_usd DECIMAL DEFAULT 0,

  UNIQUE(wallet_address, snapshot_time)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_snapshots_wallet_time
ON balance_snapshots(wallet_address, snapshot_time DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_time
ON balance_snapshots(snapshot_time);

-- 2. Таблица для отслеживания LP позиций (из событий add/remove)
CREATE TABLE IF NOT EXISTS lp_positions (
  wallet_address TEXT PRIMARY KEY,
  current_balance DECIMAL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Функция расчёта time-weighted points
CREATE OR REPLACE FUNCTION recalculate_user_points_tw(p_wallet TEXT)
RETURNS DECIMAL AS $$
DECLARE
  v_bridge_volume DECIMAL := 0;
  v_swap_volume DECIMAL := 0;
  v_referral_count INT := 0;

  -- Time-weighted averages (за последние 30 дней)
  v_tw_vault DECIMAL := 0;
  v_tw_lp DECIMAL := 0;
  v_tw_locked DECIMAL := 0;

  v_total_points DECIMAL := 0;
  v_snapshot_count INT := 0;
BEGIN
  -- Bridge volume (одноразовые действия - считаем как раньше)
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_bridge_volume
  FROM bridge_transactions
  WHERE wallet_address = p_wallet;

  -- Swap volume (одноразовые действия - считаем как раньше, но с меньшим множителем)
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_swap_volume
  FROM swap_transactions
  WHERE wallet_address = p_wallet;

  -- Referrals
  SELECT COUNT(*) INTO v_referral_count
  FROM referrals
  WHERE referrer_address = p_wallet AND is_active = true;

  -- Time-weighted vault balance (average over last 30 days)
  SELECT
    COUNT(*),
    COALESCE(AVG(vault_usdc + vault_eurc), 0)
  INTO v_snapshot_count, v_tw_vault
  FROM balance_snapshots
  WHERE wallet_address = p_wallet
    AND snapshot_time > NOW() - INTERVAL '30 days';

  -- Time-weighted LP balance
  SELECT COALESCE(AVG(lp_balance), 0) INTO v_tw_lp
  FROM balance_snapshots
  WHERE wallet_address = p_wallet
    AND snapshot_time > NOW() - INTERVAL '30 days';

  -- Time-weighted locked balance (locked gets bonus)
  SELECT COALESCE(AVG(locked_usdc + locked_eurc), 0) INTO v_tw_locked
  FROM balance_snapshots
  WHERE wallet_address = p_wallet
    AND snapshot_time > NOW() - INTERVAL '30 days';

  -- Calculate points:
  -- Bridge: 1 pt per $100 (one-time)
  -- Swap: 0.25 pt per $100 (reduced from 0.5 to discourage farming)
  -- Vault TW: 1 pt per $100 average balance per 30 days
  -- LP TW: 2 pt per $100 average balance per 30 days
  -- Locked TW: 1.5 pt per $100 average balance per 30 days (bonus for commitment)
  -- Referral: 50 pts each

  v_total_points :=
    (v_bridge_volume / 100.0) +                    -- 1 pt/$100
    (v_swap_volume / 100.0 * 0.25) +               -- 0.25 pt/$100 (reduced)
    (v_tw_vault / 100.0) +                         -- 1 pt/$100 TW avg
    (v_tw_lp / 100.0 * 2.0) +                      -- 2 pt/$100 TW avg
    (v_tw_locked / 100.0 * 1.5) +                  -- 1.5 pt/$100 TW avg
    (v_referral_count * 50);

  -- Upsert into user_points
  INSERT INTO user_points (
    wallet_address,
    bridge_volume,
    vault_volume,      -- Now stores TW average
    swap_volume,
    liquidity_volume,  -- Now stores TW average
    referral_count,
    total_points,
    updated_at
  )
  VALUES (
    p_wallet,
    v_bridge_volume,
    v_tw_vault + v_tw_locked,  -- Combined vault TW
    v_swap_volume,
    v_tw_lp,                   -- LP TW
    v_referral_count,
    v_total_points,
    NOW()
  )
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

-- 4. Функция для массового пересчёта всех пользователей
CREATE OR REPLACE FUNCTION recalculate_all_points_tw()
RETURNS INT AS $$
DECLARE
  wallet_rec RECORD;
  v_count INT := 0;
BEGIN
  FOR wallet_rec IN
    SELECT DISTINCT wallet_address FROM balance_snapshots
    UNION SELECT DISTINCT wallet_address FROM bridge_transactions
    UNION SELECT DISTINCT wallet_address FROM swap_transactions
  LOOP
    PERFORM recalculate_user_points_tw(wallet_rec.wallet_address);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Обновить LP позицию при добавлении/удалении ликвидности
CREATE OR REPLACE FUNCTION update_lp_position()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.action = 'add' THEN
    INSERT INTO lp_positions (wallet_address, current_balance, last_updated)
    VALUES (NEW.wallet_address, NEW.amount_usd, NOW())
    ON CONFLICT (wallet_address) DO UPDATE SET
      current_balance = lp_positions.current_balance + EXCLUDED.current_balance,
      last_updated = NOW();
  ELSIF NEW.action = 'remove' THEN
    UPDATE lp_positions
    SET current_balance = GREATEST(0, current_balance - NEW.amount_usd),
        last_updated = NOW()
    WHERE wallet_address = NEW.wallet_address;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автообновления LP позиций
DROP TRIGGER IF EXISTS trg_update_lp_position ON liquidity_events;
CREATE TRIGGER trg_update_lp_position
  AFTER INSERT ON liquidity_events
  FOR EACH ROW EXECUTE FUNCTION update_lp_position();

SELECT 'Time-weighted points system created!' as status;
