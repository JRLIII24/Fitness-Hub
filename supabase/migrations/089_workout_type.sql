-- Add workout_type column to workout_sessions
ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS workout_type TEXT DEFAULT NULL;

-- Index for filtering by workout type
CREATE INDEX IF NOT EXISTS idx_workout_sessions_workout_type
  ON workout_sessions (user_id, workout_type)
  WHERE workout_type IS NOT NULL;
