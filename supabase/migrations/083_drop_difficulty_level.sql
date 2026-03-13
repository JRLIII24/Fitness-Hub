-- Remove difficulty_level from workout_templates
-- The check constraint (warm_up, grind, beast_mode) caused failures
-- when the AI coach generated invalid values. Feature removed entirely.

DROP INDEX IF EXISTS idx_templates_difficulty;

ALTER TABLE public.workout_templates DROP COLUMN IF EXISTS difficulty_level;
