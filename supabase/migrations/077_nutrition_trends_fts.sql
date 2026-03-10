-- ──────────────────────────────────────────────────────────────────────────────
-- Migration 077: Nutrition Trends RPC + Full-Text Search Indexes
-- ──────────────────────────────────────────────────────────────────────────────

-- Full-text search support via pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on workout_sessions.notes for full-text search
CREATE INDEX IF NOT EXISTS idx_ws_notes_fts
  ON workout_sessions
  USING GIN (to_tsvector('english', COALESCE(notes, '')));

-- GIN index on workout_templates.name for full-text search
CREATE INDEX IF NOT EXISTS idx_wt_name_fts
  ON workout_templates
  USING GIN (to_tsvector('english', name));

-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: get_nutrition_trends
-- Aggregates food_log entries into per-day buckets for the past p_days days.
-- Returns one row per day that has at least one log entry.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_nutrition_trends(
  p_user_id UUID,
  p_days    INT DEFAULT 30
)
RETURNS TABLE (
  day         DATE,
  calories    NUMERIC,
  protein_g   NUMERIC,
  carbs_g     NUMERIC,
  fat_g       NUMERIC,
  entry_count INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    DATE(logged_at AT TIME ZONE 'UTC')  AS day,
    COALESCE(SUM(calories_consumed), 0) AS calories,
    COALESCE(SUM(protein_g), 0)         AS protein_g,
    COALESCE(SUM(carbs_g), 0)           AS carbs_g,
    COALESCE(SUM(fat_g), 0)             AS fat_g,
    COUNT(*)::INT                        AS entry_count
  FROM food_log
  WHERE
    user_id  = p_user_id
    AND logged_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(logged_at AT TIME ZONE 'UTC')
  ORDER BY day;
$$;

GRANT EXECUTE ON FUNCTION get_nutrition_trends(UUID, INT) TO authenticated;
