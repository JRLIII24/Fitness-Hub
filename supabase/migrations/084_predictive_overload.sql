-- Migration 084: Predictive Overload RPC
-- Returns last session's top set (by weight×reps) per exercise for progressive overload

CREATE OR REPLACE FUNCTION get_exercise_last_performance(
  p_user_id UUID,
  p_exercise_ids UUID[]
)
RETURNS TABLE (
  exercise_id   UUID,
  weight_kg     NUMERIC,
  reps          INTEGER,
  rir           INTEGER,
  rpe           NUMERIC,
  session_date  DATE,
  set_count     INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH last_session_per_exercise AS (
    SELECT DISTINCT ON (ws.exercise_id)
      ws.exercise_id,
      ws.session_id,
      DATE(s.started_at AT TIME ZONE 'UTC') AS session_date
    FROM workout_sets ws
    JOIN workout_sessions s ON s.id = ws.session_id
    WHERE s.user_id = p_user_id
      AND s.status = 'completed'
      AND ws.exercise_id = ANY(p_exercise_ids)
      AND ws.completed_at IS NOT NULL
    ORDER BY ws.exercise_id, s.started_at DESC
  ),
  top_set AS (
    SELECT DISTINCT ON (ws.exercise_id)
      ws.exercise_id,
      ws.weight_kg,
      ws.reps,
      ws.rir,
      ws.rpe,
      lsp.session_date
    FROM workout_sets ws
    JOIN last_session_per_exercise lsp
      ON ws.exercise_id = lsp.exercise_id
      AND ws.session_id = lsp.session_id
    WHERE ws.completed_at IS NOT NULL
      AND ws.weight_kg IS NOT NULL
      AND ws.reps IS NOT NULL
    ORDER BY ws.exercise_id, (ws.weight_kg * ws.reps) DESC
  ),
  set_counts AS (
    SELECT ws.exercise_id, COUNT(*)::INTEGER AS set_count
    FROM workout_sets ws
    JOIN last_session_per_exercise lsp
      ON ws.exercise_id = lsp.exercise_id
      AND ws.session_id = lsp.session_id
    WHERE ws.completed_at IS NOT NULL
    GROUP BY ws.exercise_id
  )
  SELECT
    ts.exercise_id,
    ts.weight_kg,
    ts.reps,
    ts.rir,
    ts.rpe,
    ts.session_date,
    COALESCE(sc.set_count, 1) AS set_count
  FROM top_set ts
  LEFT JOIN set_counts sc ON sc.exercise_id = ts.exercise_id;
$$;

GRANT EXECUTE ON FUNCTION get_exercise_last_performance(UUID, UUID[]) TO authenticated;
