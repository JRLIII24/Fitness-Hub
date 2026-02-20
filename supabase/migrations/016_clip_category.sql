-- Migration 016: Add category and remove duration restriction on workout clips

ALTER TABLE workout_clips
  ADD COLUMN IF NOT EXISTS clip_category TEXT
  CHECK (clip_category IN ('upper_body', 'lower_body', 'full_body', 'physique', 'posing', 'cardio', 'mobility', 'other'));

-- Remove the duration restriction (allow unlimited length videos)
ALTER TABLE workout_clips DROP CONSTRAINT IF EXISTS workout_clips_duration_seconds_check;
