-- ============================================================================
-- Migration 004: Create Workout Sessions
-- Live workout tracking with individual set logging.
-- ============================================================================

-- Custom enum types
CREATE TYPE session_status_type AS ENUM ('in_progress', 'completed', 'cancelled');
CREATE TYPE set_type AS ENUM ('warmup', 'working', 'dropset', 'failure');

-- Workout sessions table
CREATE TABLE workout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    template_id UUID REFERENCES workout_templates (id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    status session_status_type NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    notes TEXT,
    total_volume_kg NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE workout_sessions IS 'Individual workout sessions tracked by the user.';
COMMENT ON COLUMN workout_sessions.total_volume_kg IS 'Sum of (weight * reps) for all working sets in this session.';

-- Index for listing a user's sessions in reverse chronological order
CREATE INDEX idx_workout_sessions_user_id ON workout_sessions (user_id, started_at DESC);

-- Index for finding sessions based on a template
CREATE INDEX idx_workout_sessions_template_id ON workout_sessions (template_id)
    WHERE template_id IS NOT NULL;

-- Workout sets table
CREATE TABLE workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES workout_sessions (id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    set_type set_type NOT NULL DEFAULT 'working',
    reps INTEGER,
    weight_kg NUMERIC(6, 2),
    duration_seconds INTEGER,
    rpe NUMERIC(3, 1) CHECK (rpe >= 1 AND rpe <= 10),
    rest_seconds INTEGER,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE workout_sets IS 'Individual sets performed during a workout session.';
COMMENT ON COLUMN workout_sets.rpe IS 'Rate of Perceived Exertion on a 1-10 scale.';
COMMENT ON COLUMN workout_sets.sort_order IS 'Global ordering of sets within the session for display.';

-- Index on session_id for fetching all sets in a session
CREATE INDEX idx_workout_sets_session_id ON workout_sets (session_id, sort_order);

-- Index on exercise_id for exercise history queries
CREATE INDEX idx_workout_sets_exercise_id ON workout_sets (exercise_id);

-- Enable Row Level Security
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

-- Policies for workout_sessions
CREATE POLICY "Users can read own sessions"
    ON workout_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
    ON workout_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON workout_sessions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON workout_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for workout_sets: access via session ownership
CREATE POLICY "Users can read own workout sets"
    ON workout_sets
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workout_sessions ws
            WHERE ws.id = workout_sets.session_id
            AND ws.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create own workout sets"
    ON workout_sets
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workout_sessions ws
            WHERE ws.id = workout_sets.session_id
            AND ws.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own workout sets"
    ON workout_sets
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workout_sessions ws
            WHERE ws.id = workout_sets.session_id
            AND ws.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workout_sessions ws
            WHERE ws.id = workout_sets.session_id
            AND ws.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own workout sets"
    ON workout_sets
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workout_sessions ws
            WHERE ws.id = workout_sets.session_id
            AND ws.user_id = auth.uid()
        )
    );
