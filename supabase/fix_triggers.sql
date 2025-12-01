-- Fix triggers for vault_deposits and swap_transactions
-- Run this in Supabase SQL Editor

-- Option 1: Drop problematic triggers (recommended for now)
DROP TRIGGER IF EXISTS trg_vault_points ON vault_deposits;
DROP TRIGGER IF EXISTS trg_swap_points ON swap_transactions;
DROP TRIGGER IF EXISTS trg_liquidity_points ON liquidity_events;

-- Option 2: Create referrals table if missing
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  user_address TEXT UNIQUE NOT NULL,
  referrer_address TEXT NOT NULL,
  referral_code TEXT,
  is_activated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Re-enable triggers after referrals table exists
-- (uncomment if you want triggers back)
-- CREATE TRIGGER trg_vault_points
--   AFTER INSERT ON vault_deposits
--   FOR EACH ROW EXECUTE FUNCTION trigger_update_points();
--
-- CREATE TRIGGER trg_swap_points
--   AFTER INSERT ON swap_transactions
--   FOR EACH ROW EXECUTE FUNCTION trigger_update_points();
