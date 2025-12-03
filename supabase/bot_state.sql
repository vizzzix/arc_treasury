-- Bot State Persistence Table
-- Stores lastBlockChecked for each chain to survive bot restarts

CREATE TABLE IF NOT EXISTS bot_state (
  key TEXT PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default values
INSERT INTO bot_state (key, value) VALUES
  ('last_arc_block', 0),
  ('last_sepolia_block', 0),
  ('last_badge_block', 0),
  ('last_swap_block', 0),
  ('last_bridge_arc_block', 0)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE bot_state ENABLE ROW LEVEL SECURITY;

-- Allow select/update from anon (bot uses anon key)
CREATE POLICY "Allow select from anon" ON bot_state
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow update from anon" ON bot_state
  FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow insert from anon" ON bot_state
  FOR INSERT TO anon WITH CHECK (true);

-- Function to get and update block atomically
CREATE OR REPLACE FUNCTION get_and_update_block(p_key TEXT, p_new_value BIGINT)
RETURNS BIGINT AS $$
DECLARE
  v_old_value BIGINT;
BEGIN
  SELECT value INTO v_old_value FROM bot_state WHERE key = p_key;

  IF v_old_value IS NULL THEN
    INSERT INTO bot_state (key, value, updated_at) VALUES (p_key, p_new_value, NOW());
    RETURN 0;
  END IF;

  UPDATE bot_state SET value = p_new_value, updated_at = NOW() WHERE key = p_key;
  RETURN v_old_value;
END;
$$ LANGUAGE plpgsql;
