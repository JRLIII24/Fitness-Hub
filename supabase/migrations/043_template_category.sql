-- ============================================================================
-- Migration 043: Template Category / Primary Muscle Group
--
-- Adds a `primary_muscle_group` column to workout_templates so marketplace
-- templates can be filtered at the database level instead of in application code.
--
-- Valid values match the MUSCLE_FILTERS constant in muscle-colors.ts (lowercased):
--   chest | back | legs | arms | shoulders | core | hiit | full body | cardio
-- ============================================================================

ALTER TABLE workout_templates
  ADD COLUMN IF NOT EXISTS primary_muscle_group TEXT
    CHECK (primary_muscle_group IN (
      'chest', 'back', 'legs', 'arms', 'shoulders',
      'core', 'hiit', 'full body', 'cardio'
    ));

COMMENT ON COLUMN workout_templates.primary_muscle_group
  IS 'Primary muscle group / category used for marketplace filtering. Matches MUSCLE_FILTERS in muscle-colors.ts.';

-- Partial index: only public templates need fast category lookups
CREATE INDEX IF NOT EXISTS idx_workout_templates_muscle_category
  ON workout_templates (primary_muscle_group)
  WHERE is_public = true;
