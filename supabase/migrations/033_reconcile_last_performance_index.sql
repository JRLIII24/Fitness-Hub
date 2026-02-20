-- Migration 033: Reconcile Last Performance Index
-- Rebuilds user_exercise_last_performance deterministically from historical data.

WITH latest_session AS (
  SELECT DISTINCT ON (sess.user_id, s.exercise_id)
    sess.user_id,
    s.exercise_id,
    sess.id AS session_id,
    sess.completed_at
  FROM workout_sessions sess
  JOIN workout_sets s ON s.session_id = sess.id
  WHERE sess.status = 'completed'
    AND s.completed_at IS NOT NULL
  ORDER BY sess.user_id, s.exercise_id, sess.completed_at DESC, sess.id DESC
),
best_set_in_latest AS (
  SELECT DISTINCT ON (s.session_id, s.exercise_id)
    s.session_id,
    s.exercise_id,
    s.reps,
    s.weight_kg,
    s.set_type,
    s.completed_at
  FROM workout_sets s
  WHERE s.completed_at IS NOT NULL
    AND s.reps IS NOT NULL
    AND s.weight_kg IS NOT NULL
  ORDER BY s.session_id, s.exercise_id, (s.reps * s.weight_kg) DESC, s.completed_at DESC
),
total_sets AS (
  SELECT
    sess.user_id,
    s.exercise_id,
    COUNT(*)::INTEGER AS total_sets
  FROM workout_sessions sess
  JOIN workout_sets s ON s.session_id = sess.id
  WHERE sess.status = 'completed'
    AND s.completed_at IS NOT NULL
  GROUP BY sess.user_id, s.exercise_id
),
source_rows AS (
  SELECT
    ls.user_id,
    ls.exercise_id,
    ls.session_id AS last_session_id,
    ls.completed_at AS last_performed_at,
    jsonb_build_object(
      'reps', bs.reps,
      'weight_kg', bs.weight_kg,
      'set_type', bs.set_type,
      'completed_at', bs.completed_at
    ) AS best_set,
    ts.total_sets
  FROM latest_session ls
  JOIN best_set_in_latest bs
    ON bs.session_id = ls.session_id
   AND bs.exercise_id = ls.exercise_id
  JOIN total_sets ts
    ON ts.user_id = ls.user_id
   AND ts.exercise_id = ls.exercise_id
)
INSERT INTO user_exercise_last_performance (
  user_id,
  exercise_id,
  last_session_id,
  last_performed_at,
  best_set,
  total_sets,
  updated_at
)
SELECT
  sr.user_id,
  sr.exercise_id,
  sr.last_session_id,
  sr.last_performed_at,
  sr.best_set,
  sr.total_sets,
  now()
FROM source_rows sr
ON CONFLICT (user_id, exercise_id)
DO UPDATE SET
  last_session_id = EXCLUDED.last_session_id,
  last_performed_at = EXCLUDED.last_performed_at,
  best_set = EXCLUDED.best_set,
  total_sets = EXCLUDED.total_sets,
  updated_at = now();

-- Remove stale rows that no longer have completed sets.
DELETE FROM user_exercise_last_performance p
WHERE NOT EXISTS (
  SELECT 1
  FROM workout_sessions sess
  JOIN workout_sets s ON s.session_id = sess.id
  WHERE sess.user_id = p.user_id
    AND s.exercise_id = p.exercise_id
    AND sess.status = 'completed'
    AND s.completed_at IS NOT NULL
);

