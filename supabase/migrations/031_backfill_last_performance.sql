/**
 * Migration 031: Backfill Last Performance Data
 *
 * Populates user_exercise_last_performance with historical data from
 * completed workout sessions.
 *
 * This runs once to seed the table with existing data. Future updates
 * will be handled by the trigger from migration 030.
 *
 * Strategy:
 * 1. Find all completed workout sessions
 * 2. For each (user, exercise) pair, find the most recent session
 * 3. Find the best set from that session
 * 4. Insert into last_performance table
 */

-- Backfill last performance data
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
  ws.user_id,
  ws.exercise_id,
  ws.id AS last_session_id,
  ws.completed_at AS last_performed_at,
  jsonb_build_object(
    'reps', best.reps,
    'weight_kg', best.weight_kg,
    'set_type', best.set_type,
    'completed_at', best.completed_at
  ) AS best_set,
  set_counts.total AS total_sets,
  now() AS updated_at
FROM (
  -- Get the most recent completed session for each (user, exercise) pair
  SELECT DISTINCT ON (ws.user_id, wse.exercise_id)
    ws.id,
    ws.user_id,
    wse.exercise_id,
    ws.completed_at
  FROM workout_sessions ws
  JOIN workout_sets wse ON wse.session_id = ws.id
  WHERE ws.status = 'completed'
    AND wse.completed_at IS NOT NULL
  ORDER BY ws.user_id, wse.exercise_id, ws.completed_at DESC
) ws
JOIN (
  -- For each session, find the best set (highest weight * reps)
  SELECT DISTINCT ON (session_id, exercise_id)
    session_id,
    exercise_id,
    reps,
    weight_kg,
    set_type,
    completed_at
  FROM workout_sets
  WHERE completed_at IS NOT NULL
    AND reps IS NOT NULL
    AND weight_kg IS NOT NULL
  ORDER BY session_id, exercise_id, (reps * weight_kg) DESC, completed_at DESC
) best ON best.session_id = ws.id AND best.exercise_id = ws.exercise_id
JOIN (
  -- Count total sets per session per exercise
  SELECT
    session_id,
    exercise_id,
    COUNT(*) AS total
  FROM workout_sets
  WHERE completed_at IS NOT NULL
  GROUP BY session_id, exercise_id
) set_counts ON set_counts.session_id = ws.id AND set_counts.exercise_id = ws.exercise_id
ON CONFLICT (user_id, exercise_id) DO NOTHING; -- Skip if already exists (idempotent)

-- Log the backfill result
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_exercise_last_performance;
  RAISE NOTICE 'Backfilled % user-exercise last performance records', v_count;
END $$;
