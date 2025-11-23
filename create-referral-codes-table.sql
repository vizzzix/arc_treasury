-- Create referral_codes table only
-- This is the minimal SQL needed to add the missing table

-- Table: referral_codes
-- Stores unique referral codes for each user address
CREATE TABLE IF NOT EXISTS referral_codes (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE,
  code VARCHAR(8) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_address CHECK (address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT valid_code CHECK (code ~* '^[A-Z2-9]{8}$')
);

-- Index for fast lookup by address
CREATE INDEX IF NOT EXISTS idx_referral_codes_address ON referral_codes(address);

-- Index for fast lookup by code
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

-- Enable Row Level Security
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read codes (needed for resolving codes to addresses)
CREATE POLICY "Anyone can read referral codes"
ON referral_codes FOR SELECT
USING (true);

-- Allow API service to create new codes
CREATE POLICY "Service can insert referral codes"
ON referral_codes FOR INSERT
WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE referral_codes IS 'Stores unique referral codes for user wallet addresses - 8-character alphanumeric codes (uppercase, excludes confusing chars like O, 0, I, 1)';
