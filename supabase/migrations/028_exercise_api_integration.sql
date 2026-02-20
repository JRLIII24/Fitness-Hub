-- Migration 028: Exercise API Integration
-- Adds source tracking to exercises table for ExerciseDB and Free Exercise DB integration

-- Add source tracking columns
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'library'
    CHECK (source IN ('library', 'exercisedb', 'free-exercise-db', 'custom')),
  ADD COLUMN IF NOT EXISTS source_exercise_id TEXT,
  ADD COLUMN IF NOT EXISTS gif_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN exercises.source IS 'Origin of the exercise: library (built-in 300), exercisedb (from ExerciseDB GitHub), free-exercise-db (from Free Exercise DB GitHub), or custom (user-created)';
COMMENT ON COLUMN exercises.source_exercise_id IS 'Original ID from external source (for deduplication and updates)';
COMMENT ON COLUMN exercises.gif_url IS 'URL to GIF/video demonstration (from ExerciseDB or external source)';

-- Unique constraint for deduplication (prevents duplicate exercises from same source)
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_source_dedup
  ON exercises (source, source_exercise_id)
  WHERE source != 'custom' AND source_exercise_id IS NOT NULL;

-- Fast filtering index for search queries
CREATE INDEX IF NOT EXISTS idx_exercises_source_muscle_equipment
  ON exercises (source, muscle_group, equipment);

-- Full-text search index for exercise names (Postgres GIN index)
CREATE INDEX IF NOT EXISTS idx_exercises_name_search
  ON exercises USING gin(to_tsvector('english', name));

-- Combined index for common search patterns
CREATE INDEX IF NOT EXISTS idx_exercises_search_combined
  ON exercises (muscle_group, equipment, source)
  INCLUDE (name, gif_url, image_url);
