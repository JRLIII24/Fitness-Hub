-- Migration 066: AI Overhaul
-- - Fix SECURITY DEFINER RPCs to enforce auth.uid()
-- - Create grocery_lists table
-- - Create get_food_log_summary_for_grocery RPC

-- ============================================================
-- FIX: get_dashboard_nutrition_summary
-- Previously accepted p_user_id without verifying auth.uid()
-- Now enforces both match (backward-compatible signature)
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_nutrition_summary(
  p_user_id UUID,
  p_date_str TEXT
)
RETURNS TABLE (
  total_calories NUMERIC,
  total_protein_g NUMERIC,
  total_carbs_g NUMERIC,
  total_fat_g NUMERIC,
  total_fiber_g NUMERIC,
  total_sugar_g NUMERIC,
  total_sodium_mg NUMERIC,
  total_servings NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COALESCE(SUM(fl.calories_consumed), 0),
    COALESCE(SUM(fl.protein_g), 0),
    COALESCE(SUM(fl.carbs_g), 0),
    COALESCE(SUM(fl.fat_g), 0),
    COALESCE(SUM(COALESCE(fi.fiber_g, 0) * COALESCE(fl.servings, 1)), 0),
    COALESCE(SUM(COALESCE(fi.sugar_g, 0) * COALESCE(fl.servings, 1)), 0),
    COALESCE(SUM(COALESCE(fi.sodium_mg, 0) * COALESCE(fl.servings, 1)), 0),
    COALESCE(SUM(fl.servings), 0)
  FROM food_log fl
  LEFT JOIN food_items fi ON fi.id = fl.food_item_id
  WHERE fl.user_id = auth.uid()
    AND fl.user_id = p_user_id
    AND fl.logged_at::date = p_date_str::date;
$$;

-- ============================================================
-- FIX: get_dashboard_workout_summary
-- Same auth.uid() enforcement
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_workout_summary(
  p_user_id UUID,
  p_days_back INT DEFAULT 60
)
RETURNS TABLE (
  total_sessions BIGINT,
  sessions_7d BIGINT,
  sessions_28d BIGINT,
  avg_volume_28d NUMERIC,
  latest_id UUID,
  latest_name TEXT,
  latest_started_at TIMESTAMPTZ,
  latest_duration INT,
  latest_volume_kg NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH sessions AS (
    SELECT id, name, started_at, duration_seconds, total_volume_kg
    FROM workout_sessions
    WHERE user_id = auth.uid()
      AND user_id = p_user_id
      AND status = 'completed'
      AND started_at >= NOW() - (p_days_back || ' days')::INTERVAL
    ORDER BY started_at DESC
  ),
  latest AS (SELECT * FROM sessions LIMIT 1)
  SELECT
    (SELECT COUNT(*) FROM sessions)::BIGINT,
    (SELECT COUNT(*) FROM sessions WHERE started_at >= NOW() - INTERVAL '7 days')::BIGINT,
    (SELECT COUNT(*) FROM sessions WHERE started_at >= NOW() - INTERVAL '28 days')::BIGINT,
    (SELECT COALESCE(AVG(total_volume_kg), 0) FROM sessions WHERE started_at >= NOW() - INTERVAL '28 days'),
    (SELECT id FROM latest),
    (SELECT name FROM latest),
    (SELECT started_at FROM latest),
    (SELECT duration_seconds FROM latest),
    (SELECT total_volume_kg FROM latest);
$$;

-- ============================================================
-- NEW TABLE: grocery_lists
-- ============================================================
CREATE TABLE grocery_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Weekly Groceries',
  week_start DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(items) = 'array'),
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own grocery lists"
  ON grocery_lists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_grocery_lists_user_week
  ON grocery_lists(user_id, week_start DESC);

-- ============================================================
-- NEW RPC: get_food_log_summary_for_grocery
-- Pre-aggregates food log data for grocery list generation.
-- Uses auth.uid() internally — no user_id parameter.
-- ============================================================
CREATE OR REPLACE FUNCTION get_food_log_summary_for_grocery(
  p_days_back INT DEFAULT 14
)
RETURNS TABLE (
  food_name TEXT,
  total_servings NUMERIC,
  avg_daily_servings NUMERIC,
  serving_size_g NUMERIC,
  serving_description TEXT,
  times_logged BIGINT,
  meal_types TEXT[]
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    fi.name,
    COALESCE(SUM(fl.servings), 0),
    ROUND(COALESCE(SUM(fl.servings), 0)::NUMERIC / GREATEST(p_days_back, 1), 2),
    fi.serving_size_g,
    fi.serving_description,
    COUNT(*)::BIGINT,
    ARRAY_AGG(DISTINCT fl.meal_type)
  FROM food_log fl
  JOIN food_items fi ON fi.id = fl.food_item_id
  WHERE fl.user_id = auth.uid()
    AND fl.logged_at >= NOW() - (p_days_back || ' days')::INTERVAL
  GROUP BY fi.id, fi.name, fi.serving_size_g, fi.serving_description
  ORDER BY COUNT(*) DESC
  LIMIT 100;
$$;
