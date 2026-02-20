-- ============================================================================
-- Migration 014: Preserve Workout History When Deleting Templates
-- Ensures workout_sessions.template_id is set to NULL (not deleted) when a
-- referenced workout template is removed.
-- ============================================================================

ALTER TABLE workout_sessions
    DROP CONSTRAINT IF EXISTS workout_sessions_template_id_fkey;

ALTER TABLE workout_sessions
    ADD CONSTRAINT workout_sessions_template_id_fkey
    FOREIGN KEY (template_id)
    REFERENCES workout_templates (id)
    ON DELETE SET NULL;
