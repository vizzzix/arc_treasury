-- =============================================
-- Database Cleanup Script for Supabase Free Tier
-- Run this to free up space (target: <500 MB)
-- =============================================

-- 1. DELETE old sent_notifications (older than 7 days)
-- These are only needed for deduplication in real-time
DELETE FROM sent_notifications
WHERE sent_at < NOW() - INTERVAL '7 days';

-- 2. DELETE old balance_snapshots (older than 30 days)
-- Time-weighted points only use last 30 days
DELETE FROM balance_snapshots
WHERE snapshot_time < NOW() - INTERVAL '30 days';

-- 3. DELETE old bridge_transactions (older than 90 days)
-- Keep 90 days for live feed history, but can reduce to 30 if needed
DELETE FROM bridge_transactions
WHERE created_at < NOW() - INTERVAL '90 days';

-- 4. TRUNCATE ponder_sync tables (if Ponder indexer is not used)
-- Uncomment these lines if you're not using the Ponder indexer:
-- TRUNCATE TABLE ponder_sync.logs;
-- TRUNCATE TABLE ponder_sync.blocks;
-- Or drop the schema entirely:
-- DROP SCHEMA IF EXISTS ponder_sync CASCADE;

-- 5. VACUUM to reclaim space (run after deletes)
-- Note: VACUUM FULL requires exclusive lock, use with caution
VACUUM ANALYZE sent_notifications;
VACUUM ANALYZE balance_snapshots;
VACUUM ANALYZE bridge_transactions;

-- =============================================
-- Check current table sizes after cleanup
-- =============================================
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size,
    pg_total_relation_size(schemaname || '.' || tablename) as size_bytes
FROM pg_tables
WHERE schemaname IN ('public', 'ponder_sync')
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 20;
