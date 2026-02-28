-- ============================================================================
-- Migration 046: Set is_public DEFAULT TRUE on workout_templates
--
-- Purpose: New templates should auto-publish to the community marketplace
-- by default. Users can opt out via the "Share to Marketplace" toggle in the
-- Save Template dialog. This is a safe no-op if the default is already set.
-- Existing rows with is_public = false are not affected.
-- ============================================================================

ALTER TABLE workout_templates
  ALTER COLUMN is_public SET DEFAULT TRUE;

COMMENT ON COLUMN workout_templates.is_public IS
  'Whether the template is visible in the community marketplace. '
  'Defaults to TRUE so new templates are auto-published; users can opt out.';
