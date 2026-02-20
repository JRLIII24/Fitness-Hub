/**
 * Migration 029: User Exercise Last Performance Index
 *
 * Problem: The workout page currently queries workout_sessions JOIN workout_sets
 * to find a user's last performance for each exercise. This is O(n) and slow.
 *
 * Solution: Create a denormalized table that stores the last performance for
 * each (user_id, exercise_id) pair. This enables O(1) lookups.
 *
 * The table will be auto-updated via trigger when workout sets are completed.
 */

-- Create the last performance index table
CREATE TABLE IF NOT EXISTS user_exercise_last_performance (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  last_session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  last_performed_at TIMESTAMPTZ NOT NULL,
  best_set JSONB NOT NULL, -- { reps, weight_kg, set_type, completed_at }
  total_sets INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id)
);

-- Index for efficient lookups by user
CREATE INDEX IF NOT EXISTS idx_last_performance_user
  ON user_exercise_last_performance(user_id);

-- Index for session lookups (for cleanup on session deletion)
CREATE INDEX IF NOT EXISTS idx_last_performance_session
  ON user_exercise_last_performance(last_session_id);

-- RLS: Users can only read their own last performance data
ALTER TABLE user_exercise_last_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own last performance"
  ON user_exercise_last_performance FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON TABLE user_exercise_last_performance IS
  'Denormalized index storing the last performance for each user-exercise pair. Auto-updated via trigger.';

COMMENT ON COLUMN user_exercise_last_performance.best_set IS
  'JSONB object containing the best set from the last session: { reps: number, weight_kg: number, set_type: string, completed_at: string }';

COMMENT ON COLUMN user_exercise_last_performance.total_sets IS
  'Total number of sets completed for this exercise across all sessions (for stats/analytics)';
