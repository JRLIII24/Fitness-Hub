-- RPC: get_dashboard_nutrition_summary
-- Returns aggregated nutrition data for a specific date
CREATE OR REPLACE FUNCTION get_dashboard_nutrition_summary(
  p_user_id UUID,
  p_date_str TEXT  -- 'YYYY-MM-DD' format
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
  WHERE fl.user_id = p_user_id
    AND fl.logged_at::date = p_date_str::date;
$$;

-- RPC: get_dashboard_workout_summary
-- Returns aggregated workout data from a since date
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
    WHERE user_id = p_user_id
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
