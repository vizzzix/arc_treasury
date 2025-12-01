-- Индексы для оптимизации запросов
-- Выполнить в Supabase SQL Editor

-- bridge_transactions
CREATE INDEX IF NOT EXISTS idx_bridge_wallet ON bridge_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_bridge_created ON bridge_transactions(created_at DESC);

-- vault_deposits
CREATE INDEX IF NOT EXISTS idx_vault_wallet ON vault_deposits(wallet_address);
CREATE INDEX IF NOT EXISTS idx_vault_txhash ON vault_deposits(tx_hash);

-- swap_transactions
CREATE INDEX IF NOT EXISTS idx_swap_wallet ON swap_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_swap_txhash ON swap_transactions(tx_hash);

-- liquidity_events
CREATE INDEX IF NOT EXISTS idx_liquidity_wallet ON liquidity_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_liquidity_txhash ON liquidity_events(tx_hash);

-- referrals
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_address);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_address);

-- user_points
CREATE INDEX IF NOT EXISTS idx_user_points_wallet ON user_points(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_points_total ON user_points(total_points DESC);

-- Для ускорения агрегации по wallet
CREATE INDEX IF NOT EXISTS idx_bridge_wallet_amount ON bridge_transactions(wallet_address, amount_usd);
CREATE INDEX IF NOT EXISTS idx_vault_wallet_amount ON vault_deposits(wallet_address, amount_usd);
CREATE INDEX IF NOT EXISTS idx_swap_wallet_amount ON swap_transactions(wallet_address, amount_usd);
CREATE INDEX IF NOT EXISTS idx_liquidity_wallet_amount ON liquidity_events(wallet_address, amount_usd);
