-- ============================================================================
-- Migration 003: Create Workout Templates
-- Reusable workout templates with ordered exercises and target parameters.
-- ============================================================================

-- Workout templates table
CREATE TABLE workout_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    estimated_duration_min INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE workout_templates IS 'User-created workout templates that define a planned workout structure.';
COMMENT ON COLUMN workout_templates.color IS 'Hex color code used to visually distinguish templates in the UI.';

-- Auto-update updated_at on template changes
CREATE TRIGGER workout_templates_updated_at
    BEFORE UPDATE ON workout_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Index for quick lookup of a user's templates
CREATE INDEX idx_workout_templates_user_id ON workout_templates (user_id);

-- Template exercises junction table (ordered exercises within a template)
CREATE TABLE template_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES workout_templates (id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    target_sets INTEGER,
    target_reps TEXT,
    target_weight_kg NUMERIC(6, 2),
    rest_seconds INTEGER DEFAULT 90,
    notes TEXT
);

COMMENT ON TABLE template_exercises IS 'Exercises belonging to a workout template with target parameters.';
COMMENT ON COLUMN template_exercises.target_reps IS 'Rep target as text to support ranges like "8-12".';
COMMENT ON COLUMN template_exercises.sort_order IS 'Display order of the exercise within the template.';

-- Index for fetching exercises belonging to a template in order
CREATE INDEX idx_template_exercises_template_id ON template_exercises (template_id, sort_order);

-- Enable Row Level Security
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;

-- Policies for workout_templates: users can only CRUD their own
CREATE POLICY "Users can read own templates"
    ON workout_templates
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own templates"
    ON workout_templates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
    ON workout_templates
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
    ON workout_templates
    FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for template_exercises: access via template ownership
CREATE POLICY "Users can read own template exercises"
    ON template_exercises
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workout_templates wt
            WHERE wt.id = template_exercises.template_id
            AND wt.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create own template exercises"
    ON template_exercises
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workout_templates wt
            WHERE wt.id = template_exercises.template_id
            AND wt.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own template exercises"
    ON template_exercises
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workout_templates wt
            WHERE wt.id = template_exercises.template_id
            AND wt.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workout_templates wt
            WHERE wt.id = template_exercises.template_id
            AND wt.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own template exercises"
    ON template_exercises
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workout_templates wt
            WHERE wt.id = template_exercises.template_id
            AND wt.user_id = auth.uid()
        )
    );
