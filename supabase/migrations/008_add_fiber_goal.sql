-- ============================================================================
-- Migration 008: Add Fiber Goal Support
-- Adds fiber_g_target column to nutrition_goals table
-- ============================================================================

ALTER TABLE nutrition_goals
ADD COLUMN fiber_g_target NUMERIC(6, 2);

COMMENT ON COLUMN nutrition_goals.fiber_g_target IS 'Target daily fiber intake in grams (e.g., 25-38g per day for adults).';
