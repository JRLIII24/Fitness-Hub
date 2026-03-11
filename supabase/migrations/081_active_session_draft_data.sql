-- Migration 081: Add draft_data to active_workout_sessions for crash recovery
--
-- Stores a serialized snapshot of the active workout (exercises + completed sets)
-- so that if IndexedDB is cleared (force-quit, different device), the workout
-- can be restored from the server-side record.

ALTER TABLE active_workout_sessions
  ADD COLUMN IF NOT EXISTS draft_data JSONB;

COMMENT ON COLUMN active_workout_sessions.draft_data IS
  'Serialized workout state for crash recovery. Updated after each set completion. Includes exercise list and all set data.';
