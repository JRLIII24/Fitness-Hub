-- ============================================================================
-- Migration 058: Extend primary_muscle_group CHECK constraint
--
-- The app now supports "push" and "pull" categories, and allows comma-separated
-- multi-category values (e.g. "push,chest"). Drop the strict IN-list constraint
-- and replace with a permissive text check.
-- ============================================================================

-- Drop the existing strict constraint
ALTER TABLE workout_templates
  DROP CONSTRAINT IF EXISTS workout_templates_primary_muscle_group_check;

-- Add a relaxed constraint: each comma-separated token must be a known category.
-- Using a regex check against the full set of allowed values.
ALTER TABLE workout_templates
  ADD CONSTRAINT workout_templates_primary_muscle_group_check
  CHECK (
    primary_muscle_group IS NULL
    OR primary_muscle_group ~ '^(chest|back|legs|arms|shoulders|core|hiit|full body|cardio|glutes|push|pull)(,(chest|back|legs|arms|shoulders|core|hiit|full body|cardio|glutes|push|pull))*$'
  );
