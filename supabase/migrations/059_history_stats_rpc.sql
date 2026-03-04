-- Migration 059: Server-side history stats aggregation
-- Replaces client-side fetch-all-sessions-and-aggregate pattern

CREATE OR REPLACE FUNCTION get_history_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH session_agg AS (
    -- Core aggregates
    SELECT
      COUNT(*)::int AS total_sessions,
      COALESCE(SUM(total_volume_kg), 0)::numeric AS total_volume_kg,
      COALESCE(SUM(duration_seconds), 0)::bigint AS total_duration_seconds
    FROM workout_sessions
    WHERE user_id = p_user_id AND status = 'completed'
  ),
  streak_calc AS (
    -- Longest consecutive-day streak
    SELECT COALESCE(MAX(streak_len), 0)::int AS longest_streak
    FROM (
      SELECT COUNT(*)::int AS streak_len
      FROM (
        SELECT
          d,
          d - (ROW_NUMBER() OVER (ORDER BY d))::int * INTERVAL '1 day' AS grp
        FROM (
          SELECT DISTINCT (started_at AT TIME ZONE 'UTC')::date AS d
          FROM workout_sessions
          WHERE user_id = p_user_id AND status = 'completed'
        ) dates
      ) grouped
      GROUP BY grp
    ) streaks
  ),
  muscle_groups AS (
    -- Top 5 muscle groups by set count
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) AS groups
    FROM (
      SELECT e.muscle_group, COUNT(*)::int AS set_count
      FROM workout_sets ws
      JOIN exercises e ON e.id = ws.exercise_id
      JOIN workout_sessions wsess ON wsess.id = ws.session_id
      WHERE wsess.user_id = p_user_id AND wsess.status = 'completed'
      GROUP BY e.muscle_group
      ORDER BY COUNT(*) DESC
      LIMIT 5
    ) t
  ),
  monthly AS (
    -- Monthly breakdown (last 6 months)
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.month_key), '[]'::json) AS months
    FROM (
      SELECT
        to_char(date_trunc('month', started_at), 'YYYY-MM') AS month_key,
        COUNT(*)::int AS sessions,
        COALESCE(SUM(total_volume_kg), 0)::numeric AS volume_kg
      FROM workout_sessions
      WHERE user_id = p_user_id
        AND status = 'completed'
        AND started_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
      GROUP BY date_trunc('month', started_at)
    ) t
  )
  SELECT json_build_object(
    'total_sessions', sa.total_sessions,
    'total_volume_kg', sa.total_volume_kg,
    'total_duration_seconds', sa.total_duration_seconds,
    'avg_duration_seconds', CASE
      WHEN sa.total_sessions > 0
      THEN sa.total_duration_seconds / sa.total_sessions
      ELSE 0
    END,
    'longest_streak', sc.longest_streak,
    'top_muscle_groups', mg.groups,
    'monthly_breakdown', mb.months
  ) INTO result
  FROM session_agg sa
  CROSS JOIN streak_calc sc
  CROSS JOIN muscle_groups mg
  CROSS JOIN monthly mb;

  RETURN result;
END;
$$;
