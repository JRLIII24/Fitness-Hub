-- Fix: use timezone-aware date comparison so food logged late at night
-- is attributed to the correct local day (not UTC day).
CREATE OR REPLACE FUNCTION get_dashboard_nutrition_summary(
  p_user_id UUID,
  p_date_str TEXT,        -- 'YYYY-MM-DD' in user's local timezone
  p_timezone TEXT DEFAULT 'UTC'
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
    AND (fl.logged_at AT TIME ZONE p_timezone)::date = p_date_str::date;
$$;
