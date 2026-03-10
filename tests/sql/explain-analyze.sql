-- =============================================================================
-- EXPLAIN ANALYZE: Index utilization verification
--
-- Migration 077_nutrition_trends_fts.sql creates:
--   idx_ws_notes_fts — GIN(to_tsvector('english', COALESCE(notes, '')))
--   idx_wt_name_fts  — GIN(to_tsvector('english', name))
--   + pg_trgm extension enabled
--
-- Migration 077_public_leaderboard.sql references:
--   idx_workout_sessions_leaderboard (partial index from migration 041)
--
-- Run against local or production DB:
--   psql "$DATABASE_URL" -f tests/sql/explain-analyze.sql 2>&1 | \
--     grep -E "(Seq Scan|Index Scan|Bitmap Index|Bitmap Heap)"
--
-- Expected output: ZERO "Seq Scan" lines on large tables.
-- =============================================================================

-- Refresh planner statistics before analyzing (prevents stale row estimates)
ANALYZE workout_sessions;
ANALYZE workout_templates;
ANALYZE food_log;
ANALYZE profiles;

-- ---------------------------------------------------------------------------
-- TEST 1: workout_sessions full-text search
-- Expected plan node: "Bitmap Index Scan on idx_ws_notes_fts"
-- Seq Scan here would mean the GIN index was not created or not picked.
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT
  id,
  user_id,
  notes,
  completed_at
FROM workout_sessions
WHERE
  to_tsvector('english', COALESCE(notes, ''))
    @@ plainto_tsquery('english', 'squat deadlift')
ORDER BY completed_at DESC
LIMIT 20;

-- ---------------------------------------------------------------------------
-- TEST 2: workout_templates full-text search on name column
-- Expected plan node: "Bitmap Index Scan on idx_wt_name_fts"
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT
  id,
  name,
  user_id,
  is_public,
  save_count
FROM workout_templates
WHERE
  is_public = TRUE
  AND to_tsvector('english', name)
    @@ plainto_tsquery('english', 'bench press')
ORDER BY save_count DESC
LIMIT 50;

-- ---------------------------------------------------------------------------
-- TEST 3: pg_trgm trigram similarity + ILIKE
--
-- Note: idx_ws_notes_fts uses to_tsvector, NOT gin_trgm_ops.
-- For similarity() / ILIKE searches to use an index, a separate trigram
-- index is required:
--   CREATE INDEX idx_wt_name_trgm
--     ON workout_templates USING GIN (name gin_trgm_ops);
--
-- If no trigram index exists, this query will Seq Scan — that is EXPECTED
-- today. Run this to baseline the cost. Once idx_wt_name_trgm is added,
-- re-run and confirm the planner switches to "Bitmap Index Scan on idx_wt_name_trgm".
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  id,
  name,
  similarity(name, 'bench') AS sim_score
FROM workout_templates
WHERE
  name % 'bench'              -- pg_trgm similarity threshold (default 0.3)
  OR name ILIKE '%bench%'     -- trigram-accelerated ILIKE
ORDER BY sim_score DESC
LIMIT 20;

-- ---------------------------------------------------------------------------
-- TEST 4: get_nutrition_trends RPC — food_log access pattern
--
-- The RPC body (077_nutrition_trends_fts.sql):
--   WHERE user_id = p_user_id
--     AND logged_at >= NOW() - (p_days || ' days')::INTERVAL
--   GROUP BY DATE(logged_at AT TIME ZONE 'UTC')
--
-- Expected: Index Scan using an index on (user_id, logged_at DESC)
-- If food_log lacks such an index, add:
--   CREATE INDEX idx_food_log_user_logged_at
--     ON food_log(user_id, logged_at DESC);
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT * FROM get_nutrition_trends(
  '00000000-0000-0000-0000-000000000001'::UUID,
  30
);

-- ---------------------------------------------------------------------------
-- TEST 5: get_public_leaderboard — window function performance
--
-- The RPC uses DENSE_RANK() OVER (ORDER BY ...) which requires sorting
-- the full set of public profiles × workout_sessions. At pod scale this is
-- fast; at 10k+ public users, a MATERIALIZED VIEW is recommended.
--
-- Expected: the partial index idx_workout_sessions_leaderboard
--   (from migration 041, WHERE status = 'completed')
-- should be used for the inner JOIN scan.
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT * FROM get_public_leaderboard('volume', 'weekly', 50);

EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT * FROM get_public_leaderboard('streak', 'all_time', 100);

-- ---------------------------------------------------------------------------
-- How to interpret the output
-- ---------------------------------------------------------------------------
-- ✅ PASS indicators:
--   "Bitmap Index Scan on idx_ws_notes_fts"   → GIN index used for FTS ✓
--   "Bitmap Index Scan on idx_wt_name_fts"    → GIN index used for templates ✓
--   "Index Scan using idx_..."                 → B-tree index used ✓
--   Window function node with fast sort        → Good at current scale ✓
--
-- ❌ FAIL indicators (action required):
--   "Seq Scan on workout_sessions"  → Missing or disabled index
--   "Seq Scan on food_log"          → Add idx_food_log_user_logged_at
--   Startup cost > 10000 on leaderboard → Time to consider MATERIALIZED VIEW
--
-- Debugging steps if Seq Scan appears on a table with >10k rows:
--   1. ANALYZE <table>;           -- Refresh statistics
--   2. \d+ <table>                -- Confirm index definition
--   3. SET enable_seqscan = OFF;  -- Force planner to use any available index
--   4. Re-run EXPLAIN ANALYZE     -- If it now uses an index → statistics issue
--                                 -- If still Seq Scan → index not suitable
-- ---------------------------------------------------------------------------
