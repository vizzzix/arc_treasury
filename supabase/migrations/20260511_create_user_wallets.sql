-- User wallets mapping: links Supabase auth user to Circle wallet IDs
-- Used for JWT-based ownership verification on financial API endpoints

CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID,
  arc_wallet_id UUID,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_wallet_id ON user_wallets(wallet_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_arc_wallet_id ON user_wallets(arc_wallet_id);

ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;

-- Users can read their own wallet mapping
CREATE POLICY "users_read_own_wallets" ON user_wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (API) can do everything — no policy needed, bypasses RLS
