-- Migration 021: Active Workout Tracking
-- Track live workout sessions for "currently working out" indicators on profiles

-- Create table for active workout sessions
CREATE TABLE IF NOT EXISTS active_workout_sessions (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exercise_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE active_workout_sessions ENABLE ROW LEVEL SECURITY;

-- Allow reading active sessions for public profiles
CREATE POLICY "Public users active workouts are readable"
  ON active_workout_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = active_workout_sessions.user_id
        AND profiles.is_public = true
    )
  );

-- Allow users to manage their own active session
CREATE POLICY "Users can manage own active session"
  ON active_workout_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-cleanup function: Remove stale sessions (>4 hours old)
CREATE OR REPLACE FUNCTION cleanup_stale_workouts()
RETURNS void AS $$
BEGIN
  DELETE FROM active_workout_sessions
  WHERE started_at < now() - INTERVAL '4 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE active_workout_sessions IS 'Tracks users currently in active workout sessions for live status indicators';
COMMENT ON FUNCTION cleanup_stale_workouts() IS 'Removes active sessions older than 4 hours to prevent stuck states from app crashes';
