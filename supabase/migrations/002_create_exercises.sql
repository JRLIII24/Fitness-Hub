-- ============================================================================
-- Migration 002: Create Exercises
-- Exercise library with support for both built-in and user-created exercises.
-- ============================================================================

-- Custom enum types for exercise classification
CREATE TYPE muscle_group_type AS ENUM (
    'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body'
);

CREATE TYPE equipment_type AS ENUM (
    'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'band'
);

CREATE TYPE exercise_category_type AS ENUM (
    'compound', 'isolation', 'cardio', 'stretch'
);

-- Exercises table
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    muscle_group muscle_group_type NOT NULL,
    equipment equipment_type NOT NULL,
    category exercise_category_type NOT NULL,
    instructions TEXT,
    form_tips TEXT[] DEFAULT '{}',
    image_url TEXT,
    is_custom BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE exercises IS 'Library of exercises, both built-in and user-created.';
COMMENT ON COLUMN exercises.slug IS 'URL-friendly unique identifier for the exercise.';
COMMENT ON COLUMN exercises.form_tips IS 'Array of short-form tips for proper exercise execution.';

-- Index for faster lookups by muscle group
CREATE INDEX idx_exercises_muscle_group ON exercises (muscle_group);

-- Index for custom exercise lookups by creator
CREATE INDEX idx_exercises_created_by ON exercises (created_by) WHERE is_custom = true;

-- Enable Row Level Security
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Policy: all authenticated users can read all exercises
CREATE POLICY "Authenticated users can read exercises"
    ON exercises
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: authenticated users can create custom exercises
CREATE POLICY "Users can create custom exercises"
    ON exercises
    FOR INSERT
    TO authenticated
    WITH CHECK (
        is_custom = true
        AND created_by = auth.uid()
    );

-- Policy: only the creator can update their own custom exercises
CREATE POLICY "Users can update own custom exercises"
    ON exercises
    FOR UPDATE
    TO authenticated
    USING (
        is_custom = true
        AND created_by = auth.uid()
    )
    WITH CHECK (
        is_custom = true
        AND created_by = auth.uid()
    );

-- Policy: only the creator can delete their own custom exercises
CREATE POLICY "Users can delete own custom exercises"
    ON exercises
    FOR DELETE
    TO authenticated
    USING (
        is_custom = true
        AND created_by = auth.uid()
    );
