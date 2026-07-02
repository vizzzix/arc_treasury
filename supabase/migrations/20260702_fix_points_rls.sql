-- =============================================
-- Fix over-permissive RLS policies on points-source tables
-- =============================================
-- Audit found these tables writable by the PUBLIC anon key (which ships in the
-- frontend bundle), letting anyone forge points directly via the Supabase REST
-- API, bypassing the server API entirely:
--
--   twitter_connections : policy "ALL to public" -> anyone could set
--                         repost_verified=true + a large multiplier -> multiply
--                         ALL of their points. (Worst: amplifies everything.)
--   bridge_transactions : "INSERT to public" -> forge bridge rows -> bridge points.
--   bot_state           : anon INSERT/UPDATE -> corrupt the bot's lastBlock cursor.
--
-- All legitimate writers (bot, api/twitter.ts) use the service_role/secret key,
-- which BYPASSES RLS — so removing these anon/public write policies does not
-- affect them. Anon SELECT is preserved where the frontend needs to read.

-- twitter_connections: writes are server-only (service_role). Frontend does not
-- read this table directly, so lock it down entirely (RLS on, no policies).
DROP POLICY IF EXISTS "Service role full access to twitter_connections" ON twitter_connections;

-- bridge_transactions: keep public read (feed/leaderboard), drop public insert.
DROP POLICY IF EXISTS "Allow public insert" ON bridge_transactions;

-- bot_state: bot writes via service_role; keep anon read, drop anon writes.
DROP POLICY IF EXISTS "Allow insert from anon" ON bot_state;
DROP POLICY IF EXISTS "Allow update from anon" ON bot_state;
