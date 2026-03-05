-- Migration 067: Exercise Recent Performance RPC
-- Returns last N sessions worth of sets for a specific exercise.
-- Used by AI Coach for "what did I bench last week?" queries
-- and for autoregulation prescriptions.

CREATE OR REPLACE FUNCTION get_exercise_recent_performance(
  p_exercise_id UUID,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  session_id UUID,
  session_date TIMESTAMPTZ,
  session_name TEXT,
  set_number INT,
  weight_kg DOUBLE PRECISION,
  reps INT,
  set_type TEXT,
  rpe SMALLINT,
  rir SMALLINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH recent_sessions AS (
    SELECT DISTINCT ws.id, ws.started_at, ws.name
    FROM workout_sets wset
    JOIN workout_sessions ws ON ws.id = wset.session_id
    WHERE wset.exercise_id = p_exercise_id
      AND ws.user_id = auth.uid()
      AND ws.status = 'completed'
    ORDER BY ws.started_at DESC
    LIMIT p_limit
  )
  SELECT
    rs.id AS session_id,
    rs.started_at AS session_date,
    rs.name AS session_name,
    wset.set_number,
    wset.weight_kg,
    wset.reps,
    wset.set_type,
    wset.rpe::SMALLINT,
    wset.rir::SMALLINT
  FROM recent_sessions rs
  JOIN workout_sets wset ON wset.session_id = rs.id
    AND wset.exercise_id = p_exercise_id
  ORDER BY rs.started_at DESC, wset.set_number ASC;
$$;
