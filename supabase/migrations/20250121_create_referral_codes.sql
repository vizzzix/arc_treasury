-- Migration: Create referral_codes table
-- Created: 2025-01-21
-- Description: Add referral_codes table for secure referral code generation

-- Create referral_codes table
CREATE TABLE IF NOT EXISTS referral_codes (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE,
  code VARCHAR(8) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_address CHECK (address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT valid_code CHECK (code ~* '^[A-Z2-9]{8}$')
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_referral_codes_address ON referral_codes(address);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

-- Enable Row Level Security
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read referral codes" ON referral_codes;
DROP POLICY IF EXISTS "Service can insert referral codes" ON referral_codes;

-- Allow reading codes (needed for resolving)
CREATE POLICY "Anyone can read referral codes"
ON referral_codes FOR SELECT
USING (true);

-- Allow API to create codes
CREATE POLICY "Service can insert referral codes"
ON referral_codes FOR INSERT
WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE referral_codes IS 'Stores unique referral codes for user wallet addresses - 8-character alphanumeric codes (uppercase, excludes confusing chars like O, 0, I, 1)';
