-- =============================================
-- RLS for Points System Tables
-- =============================================
-- These tables are populated by server-side bots (service_role key)
-- and read by the frontend via anon/authenticated key.
-- service_role bypasses RLS, so no explicit write policies needed.

-- 1. user_points — read-only for frontend
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select from anon" ON user_points
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow select from authenticated" ON user_points
  FOR SELECT TO authenticated USING (true);

-- 2. vault_deposits — read-only for frontend
ALTER TABLE vault_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select from anon" ON vault_deposits
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow select from authenticated" ON vault_deposits
  FOR SELECT TO authenticated USING (true);

-- 3. swap_transactions — read-only for frontend
ALTER TABLE swap_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select from anon" ON swap_transactions
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow select from authenticated" ON swap_transactions
  FOR SELECT TO authenticated USING (true);

-- 4. liquidity_events — read-only for frontend
ALTER TABLE liquidity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select from anon" ON liquidity_events
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow select from authenticated" ON liquidity_events
  FOR SELECT TO authenticated USING (true);

-- 5. referrals — read-only for frontend
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select from anon" ON referrals
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow select from authenticated" ON referrals
  FOR SELECT TO authenticated USING (true);

-- 6. referral_codes — read for resolve, insert for generate (via service_role API)
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select from anon" ON referral_codes
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow select from authenticated" ON referral_codes
  FOR SELECT TO authenticated USING (true);

-- 7. circle_transactions — harden existing RLS
-- Remove INSERT/UPDATE for anon — all writes go through server-side API (service_role)
DROP POLICY IF EXISTS "Allow insert from anon" ON circle_transactions;
DROP POLICY IF EXISTS "Allow insert from authenticated" ON circle_transactions;
DROP POLICY IF EXISTS "Allow update from anon" ON circle_transactions;
DROP POLICY IF EXISTS "Allow update from authenticated" ON circle_transactions;
