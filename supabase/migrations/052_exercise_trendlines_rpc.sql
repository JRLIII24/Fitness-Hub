-- 052: RPC to fetch last 3 top-set weights per exercise for sparklines
-- Uses DENSE_RANK to correctly group all sets from the same session.

CREATE OR REPLACE FUNCTION get_exercise_trendlines(
  p_user_id UUID,
  p_exercise_ids UUID[]
)
RETURNS TABLE (
  exercise_id UUID,
  session_rank INT,        -- 1 = most recent, 2, 3
  top_set_weight_kg FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH ranked_sessions AS (
    SELECT
      ws.exercise_id,
      ws.weight_kg,
      wk.completed_at,
      DENSE_RANK() OVER (
        PARTITION BY ws.exercise_id
        ORDER BY wk.completed_at DESC
      ) AS session_rank,
      ROW_NUMBER() OVER (
        PARTITION BY ws.exercise_id, wk.completed_at
        ORDER BY ws.weight_kg DESC NULLS LAST
      ) AS weight_rank
    FROM workout_sets ws
    JOIN workout_sessions wk ON wk.id = ws.session_id
    WHERE wk.user_id = p_user_id
      AND wk.status = 'completed'
      AND ws.exercise_id = ANY(p_exercise_ids)
      AND ws.weight_kg IS NOT NULL
  )
  SELECT
    exercise_id,
    session_rank::INT,
    weight_kg AS top_set_weight_kg
  FROM ranked_sessions
  WHERE session_rank <= 3
    AND weight_rank = 1   -- top set per session only
  ORDER BY exercise_id, session_rank;
$$;
