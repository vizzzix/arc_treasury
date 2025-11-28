-- Arc Treasury Database Schema
-- This file contains the database schema for the referral system

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

-- Table: referrals
-- Stores referral relationships between users
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_address VARCHAR(42) NOT NULL,
  referee_address VARCHAR(42) NOT NULL UNIQUE,
  first_deposit_at TIMESTAMP WITH TIME ZONE,
  total_points_earned BIGINT DEFAULT 0,
  referrer_bonus_earned BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_referrer_address CHECK (referrer_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT valid_referee_address CHECK (referee_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT no_self_referral CHECK (referrer_address != referee_address)
);

-- Index for fast lookup by referrer
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_address);

-- Index for fast lookup by referee
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_address);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE referral_codes IS 'Stores unique referral codes for user wallet addresses';
COMMENT ON TABLE referrals IS 'Stores referral relationships and earnings tracking';
COMMENT ON COLUMN referral_codes.code IS '8-character alphanumeric code (uppercase, excludes confusing chars like O, 0, I, 1)';
COMMENT ON COLUMN referrals.referee_address IS 'The user who was referred (can only be referred once)';
COMMENT ON COLUMN referrals.referrer_address IS 'The user who referred the referee';
COMMENT ON COLUMN referrals.is_active IS 'Whether the referee is still actively using the platform';
