-- Migration 087: Per-set last performance RPC
-- Returns ALL completed sets from the last session per exercise (not just the top set)
-- so predictive overload can apply per-set suggestions.

CREATE OR REPLACE FUNCTION get_exercise_last_performance_per_set(
  p_user_id UUID,
  p_exercise_ids UUID[]
)
RETURNS TABLE (
  exercise_id   UUID,
  set_number    INTEGER,
  weight_kg     NUMERIC,
  reps          INTEGER,
  rir           INTEGER,
  rpe           NUMERIC,
  session_date  DATE
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
  )
  SELECT
    ws.exercise_id,
    ws.set_number,
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
  ORDER BY ws.exercise_id, ws.set_number;
$$;

GRANT EXECUTE ON FUNCTION get_exercise_last_performance_per_set(UUID, UUID[]) TO authenticated;
