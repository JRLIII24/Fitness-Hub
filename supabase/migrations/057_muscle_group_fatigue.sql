-- RPC: Get per-muscle-group training recency and volume for recovery tracking
CREATE OR REPLACE FUNCTION get_muscle_group_recovery(
  p_user_id UUID,
  p_lookback_days INT DEFAULT 14
)
RETURNS TABLE (
  muscle_group TEXT,
  last_trained_at TIMESTAMPTZ,
  hours_since_trained NUMERIC,
  total_sets INT,
  total_volume_kg NUMERIC,
  avg_rpe NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH recent_sets AS (
    SELECT
      e.muscle_group,
      ws.completed_at,
      COALESCE(ws.weight_kg, 0) AS weight_kg,
      COALESCE(ws.reps, 0) AS reps,
      ws.rpe
    FROM workout_sets ws
    JOIN workout_sessions s ON s.id = ws.session_id
    JOIN exercises e ON e.id = ws.exercise_id
    WHERE s.user_id = p_user_id
      AND s.status = 'completed'
      AND ws.completed_at IS NOT NULL
      AND ws.completed_at >= NOW() - (p_lookback_days || ' days')::INTERVAL
  )
  SELECT
    rs.muscle_group,
    MAX(rs.completed_at) AS last_trained_at,
    EXTRACT(EPOCH FROM (NOW() - MAX(rs.completed_at))) / 3600 AS hours_since_trained,
    COUNT(*)::INT AS total_sets,
    COALESCE(SUM(rs.weight_kg * rs.reps), 0) AS total_volume_kg,
    AVG(rs.rpe) AS avg_rpe
  FROM recent_sets rs
  GROUP BY rs.muscle_group
  ORDER BY rs.muscle_group;
$$;
