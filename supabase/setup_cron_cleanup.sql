-- =============================================
-- Setup pg_cron for automatic database cleanup
-- Run this ONCE in Supabase SQL Editor
-- =============================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Option 1: Direct SQL cleanup (simpler, no Edge Function needed)
-- Runs daily at 3:00 AM UTC

-- Delete old sent_notifications (>7 days)
SELECT cron.schedule(
  'cleanup-sent-notifications',
  '0 3 * * *',  -- Every day at 3:00 AM UTC
  $$DELETE FROM sent_notifications WHERE sent_at < NOW() - INTERVAL '7 days'$$
);

-- Delete old balance_snapshots (>30 days)
SELECT cron.schedule(
  'cleanup-balance-snapshots',
  '5 3 * * *',  -- Every day at 3:05 AM UTC
  $$DELETE FROM balance_snapshots WHERE snapshot_time < NOW() - INTERVAL '30 days'$$
);

-- Optional: VACUUM weekly (Sundays at 4:00 AM)
SELECT cron.schedule(
  'vacuum-tables',
  '0 4 * * 0',  -- Every Sunday at 4:00 AM UTC
  $$VACUUM ANALYZE sent_notifications, balance_snapshots, bridge_transactions$$
);

-- =============================================
-- View scheduled jobs
-- =============================================
SELECT * FROM cron.job;

-- =============================================
-- To remove a scheduled job:
-- SELECT cron.unschedule('cleanup-sent-notifications');
-- =============================================
