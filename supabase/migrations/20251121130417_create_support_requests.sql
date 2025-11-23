-- Migration: Create support_requests table
-- Created: 2025-01-21
-- Description: Add support_requests table for user support inquiries

-- Create support_requests table
CREATE TABLE IF NOT EXISTS support_requests (
  id BIGSERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL CHECK (category IN ('general', 'technical', 'partnership', 'bug', 'feature')),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  wallet_address VARCHAR(42),
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_wallet_address CHECK (wallet_address IS NULL OR wallet_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT valid_email CHECK (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_support_requests_email ON support_requests(email);
CREATE INDEX IF NOT EXISTS idx_support_requests_wallet ON support_requests(wallet_address);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_requests_category ON support_requests(category);
CREATE INDEX IF NOT EXISTS idx_support_requests_created ON support_requests(created_at DESC);

-- Enable Row Level Security
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can submit support requests" ON support_requests;
DROP POLICY IF EXISTS "Users can read their own support requests" ON support_requests;

-- Allow anyone to submit support requests
CREATE POLICY "Anyone can submit support requests"
ON support_requests FOR INSERT
WITH CHECK (true);

-- Allow users to read their own support requests (by email or wallet)
CREATE POLICY "Users can read their own support requests"
ON support_requests FOR SELECT
USING (
  email = current_setting('request.jwt.claims', true)::json->>'email' OR
  wallet_address = lower(current_setting('request.jwt.claims', true)::json->>'address')
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_support_requests_updated_at_trigger ON support_requests;
CREATE TRIGGER update_support_requests_updated_at_trigger
  BEFORE UPDATE ON support_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_support_requests_updated_at();

-- Comment for documentation
COMMENT ON TABLE support_requests IS 'Stores user support requests and inquiries';
COMMENT ON COLUMN support_requests.category IS 'Type of support request: general, technical, partnership, bug, feature';
COMMENT ON COLUMN support_requests.status IS 'Current status: open, in_progress, resolved, closed';
COMMENT ON COLUMN support_requests.wallet_address IS 'Optional wallet address of the user';
