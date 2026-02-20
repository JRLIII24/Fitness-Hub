-- ============================================================================
-- Migration 001: Create Profiles
-- Extends Supabase auth.users with application-specific profile data.
-- ============================================================================

-- Custom enum types for profile fields
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE fitness_goal_type AS ENUM ('lose_weight', 'build_muscle', 'maintain', 'improve_endurance');

-- Profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    height_cm NUMERIC(5, 1),
    weight_kg NUMERIC(5, 1),
    date_of_birth DATE,
    gender gender_type,
    fitness_goal fitness_goal_type,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Application profile data that extends the Supabase auth.users table.';

-- Trigger function: auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger function: auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NULL)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own profile
CREATE POLICY "Users can read own profile"
    ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Policy: users can update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
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
-- ============================================================================
-- Migration 005: Create Nutrition Tracking
-- Food database, daily nutrition goals, and food logging.
-- ============================================================================

-- Custom enum types
CREATE TYPE food_source_type AS ENUM ('openfoodfacts', 'usda', 'manual');
CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- Food items table (shared food database)
CREATE TABLE food_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode TEXT,
    name TEXT NOT NULL,
    brand TEXT,
    serving_size_g NUMERIC(7, 2),
    serving_description TEXT,
    calories_per_serving NUMERIC(7, 2),
    protein_g NUMERIC(6, 2),
    carbs_g NUMERIC(6, 2),
    fat_g NUMERIC(6, 2),
    fiber_g NUMERIC(6, 2),
    sugar_g NUMERIC(6, 2),
    sodium_mg NUMERIC(7, 2),
    source food_source_type NOT NULL DEFAULT 'manual',
    created_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE food_items IS 'Shared food database with nutritional information per serving.';

-- Index on barcode for quick scanner lookups
CREATE INDEX idx_food_items_barcode ON food_items (barcode) WHERE barcode IS NOT NULL;

-- Full-text search index on food name for type-ahead search
CREATE INDEX idx_food_items_name_search ON food_items USING gin (to_tsvector('english', name));

-- Nutrition goals table (per-user daily targets)
CREATE TABLE nutrition_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    calories_target INTEGER,
    protein_g_target NUMERIC(6, 2),
    carbs_g_target NUMERIC(6, 2),
    fat_g_target NUMERIC(6, 2),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_nutrition_goals_user_date UNIQUE (user_id, effective_from)
);

COMMENT ON TABLE nutrition_goals IS 'Daily nutrition macro targets per user, versioned by effective date.';

-- Index for finding the current goal for a user
CREATE INDEX idx_nutrition_goals_user_id ON nutrition_goals (user_id, effective_from DESC);

-- Food log table (individual meal entries)
CREATE TABLE food_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    food_item_id UUID NOT NULL REFERENCES food_items (id) ON DELETE CASCADE,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    meal_type meal_type NOT NULL,
    servings NUMERIC(5, 2) NOT NULL DEFAULT 1,
    calories_consumed NUMERIC(7, 2),
    protein_g NUMERIC(6, 2),
    carbs_g NUMERIC(6, 2),
    fat_g NUMERIC(6, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE food_log IS 'User food diary entries with computed macros at time of logging.';

-- Composite index for daily food log queries
CREATE INDEX idx_food_log_user_logged_at ON food_log (user_id, logged_at DESC);

-- Enable Row Level Security on all tables
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_log ENABLE ROW LEVEL SECURITY;

-- food_items policies: readable by all authenticated users
CREATE POLICY "Authenticated users can read food items"
    ON food_items
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create food items"
    ON food_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = auth.uid() OR created_by IS NULL
    );

CREATE POLICY "Users can update own food items"
    ON food_items
    FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own food items"
    ON food_items
    FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- nutrition_goals policies
CREATE POLICY "Users can read own nutrition goals"
    ON nutrition_goals
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own nutrition goals"
    ON nutrition_goals
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrition goals"
    ON nutrition_goals
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrition goals"
    ON nutrition_goals
    FOR DELETE
    USING (auth.uid() = user_id);

-- food_log policies
CREATE POLICY "Users can read own food log"
    ON food_log
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own food log entries"
    ON food_log
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food log entries"
    ON food_log
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own food log entries"
    ON food_log
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- Migration 006: Fix Profile RLS and Add Ensure Profile Function
-- Adds missing INSERT policy for profiles and a helper function to ensure
-- profile exists. This fixes the issue where profiles weren't being created
-- when the auto-create trigger didn't fire.
-- ============================================================================

-- Add missing INSERT policy for profiles
-- Allows authenticated users to create their own profile record
CREATE POLICY "Users can create own profile"
    ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Create a function that can be called to ensure a user profile exists
-- This is a safety net in case the auto-create trigger didn't fire
CREATE OR REPLACE FUNCTION ensure_user_profile(user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_email TEXT;
BEGIN
    -- Check if profile already exists
    IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id) THEN
        RETURN;
    END IF;

    -- Get the user's email from auth.users
    SELECT email INTO v_email FROM auth.users WHERE id = user_id;

    -- Create the profile if it doesn't exist
    INSERT INTO profiles (id, display_name, avatar_url)
    VALUES (
        user_id,
        COALESCE(
            (SELECT raw_user_meta_data ->> 'display_name' FROM auth.users WHERE id = user_id),
            (SELECT raw_user_meta_data ->> 'full_name' FROM auth.users WHERE id = user_id),
            SPLIT_PART(v_email, '@', 1)
        ),
        (SELECT raw_user_meta_data ->> 'avatar_url' FROM auth.users WHERE id = user_id)
    )
    ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- Migration 007: Harden Data Integrity and Security
-- ============================================================================

-- ============================================================================
-- Migration 007: Harden Data Integrity and Security
-- Fixes relational ownership gaps, unsafe cascades on historical data,
-- profile bootstrap auth hardening, barcode deduplication, and numeric guards.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) Prevent shared-history data loss from deletes
-- --------------------------------------------------------------------------
ALTER TABLE workout_sets
    DROP CONSTRAINT IF EXISTS workout_sets_exercise_id_fkey;

ALTER TABLE workout_sets
    ADD CONSTRAINT workout_sets_exercise_id_fkey
    FOREIGN KEY (exercise_id)
    REFERENCES exercises (id)
    ON DELETE RESTRICT;

ALTER TABLE food_log
    DROP CONSTRAINT IF EXISTS food_log_food_item_id_fkey;

ALTER TABLE food_log
    ADD CONSTRAINT food_log_food_item_id_fkey
    FOREIGN KEY (food_item_id)
    REFERENCES food_items (id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------------
-- 2) Enforce template ownership when linking to workout_sessions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_workout_session_template_owner()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.template_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM workout_templates wt
        WHERE wt.id = NEW.template_id
        AND wt.user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'template_id % does not belong to user %', NEW.template_id, NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workout_sessions_template_owner_guard ON workout_sessions;

CREATE TRIGGER workout_sessions_template_owner_guard
    BEFORE INSERT OR UPDATE ON workout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION validate_workout_session_template_owner();

DROP POLICY IF EXISTS "Users can create own sessions" ON workout_sessions;
CREATE POLICY "Users can create own sessions"
    ON workout_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND (
            template_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM workout_templates wt
                WHERE wt.id = workout_sessions.template_id
                AND wt.user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can update own sessions" ON workout_sessions;
CREATE POLICY "Users can update own sessions"
    ON workout_sessions
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
        AND (
            template_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM workout_templates wt
                WHERE wt.id = workout_sessions.template_id
                AND wt.user_id = auth.uid()
            )
        )
    );

-- --------------------------------------------------------------------------
-- 3) Enforce exercise visibility/ownership on template_exercises writes
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create own template exercises" ON template_exercises;
CREATE POLICY "Users can create own template exercises"
    ON template_exercises
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM workout_templates wt
            WHERE wt.id = template_exercises.template_id
            AND wt.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1
            FROM exercises e
            WHERE e.id = template_exercises.exercise_id
            AND (e.is_custom = false OR e.created_by = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can update own template exercises" ON template_exercises;
CREATE POLICY "Users can update own template exercises"
    ON template_exercises
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM workout_templates wt
            WHERE wt.id = template_exercises.template_id
            AND wt.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM workout_templates wt
            WHERE wt.id = template_exercises.template_id
            AND wt.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1
            FROM exercises e
            WHERE e.id = template_exercises.exercise_id
            AND (e.is_custom = false OR e.created_by = auth.uid())
        )
    );

-- --------------------------------------------------------------------------
-- 4) Harden ensure_user_profile against cross-user abuse
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_user_profile(user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT := current_setting('request.jwt.claim.role', true);
    v_email TEXT;
    v_display_name TEXT;
    v_avatar_url TEXT;
BEGIN
    IF COALESCE(v_caller_role, '') <> 'service_role'
       AND v_caller_id IS DISTINCT FROM user_id THEN
        RAISE EXCEPTION 'Not allowed to ensure profile for another user';
    END IF;

    IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id) THEN
        RETURN;
    END IF;

    SELECT
        u.email,
        COALESCE(
            u.raw_user_meta_data ->> 'display_name',
            u.raw_user_meta_data ->> 'full_name',
            SPLIT_PART(u.email, '@', 1)
        ),
        u.raw_user_meta_data ->> 'avatar_url'
    INTO v_email, v_display_name, v_avatar_url
    FROM auth.users u
    WHERE u.id = user_id;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'User not found for id %', user_id;
    END IF;

    INSERT INTO profiles (id, display_name, avatar_url)
    VALUES (user_id, v_display_name, v_avatar_url)
    ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION ensure_user_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_user_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_user_profile(UUID) TO service_role;

-- --------------------------------------------------------------------------
-- 5) Deduplicate barcode rows, then enforce uniqueness
-- --------------------------------------------------------------------------
WITH ranked AS (
    SELECT
        fi.id,
        fi.barcode,
        ROW_NUMBER() OVER (
            PARTITION BY fi.barcode
            ORDER BY fi.created_at ASC, fi.id ASC
        ) AS rn,
        FIRST_VALUE(fi.id) OVER (
            PARTITION BY fi.barcode
            ORDER BY fi.created_at ASC, fi.id ASC
        ) AS keep_id
    FROM food_items fi
    WHERE fi.barcode IS NOT NULL
),
dupes AS (
    SELECT id, keep_id
    FROM ranked
    WHERE rn > 1
)
UPDATE food_log fl
SET food_item_id = d.keep_id
FROM dupes d
WHERE fl.food_item_id = d.id;

WITH ranked AS (
    SELECT
        fi.id,
        fi.barcode,
        ROW_NUMBER() OVER (
            PARTITION BY fi.barcode
            ORDER BY fi.created_at ASC, fi.id ASC
        ) AS rn
    FROM food_items fi
    WHERE fi.barcode IS NOT NULL
)
DELETE FROM food_items fi
USING ranked r
WHERE fi.id = r.id
AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_food_items_barcode
    ON food_items (barcode)
    WHERE barcode IS NOT NULL;

-- --------------------------------------------------------------------------
-- 6) Lock critical numeric and temporal integrity invariants
-- --------------------------------------------------------------------------
UPDATE food_items
SET calories_per_serving = 0
WHERE calories_per_serving IS NULL;

ALTER TABLE food_items
    ALTER COLUMN calories_per_serving SET NOT NULL;

UPDATE food_log
SET calories_consumed = 0
WHERE calories_consumed IS NULL;

ALTER TABLE food_log
    ALTER COLUMN calories_consumed SET NOT NULL;

ALTER TABLE profiles
    ADD CONSTRAINT chk_profiles_height_cm_range
        CHECK (height_cm IS NULL OR (height_cm > 0 AND height_cm <= 300)) NOT VALID,
    ADD CONSTRAINT chk_profiles_weight_kg_range
        CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 500)) NOT VALID,
    ADD CONSTRAINT chk_profiles_date_of_birth_past
        CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE) NOT VALID;

ALTER TABLE workout_templates
    ADD CONSTRAINT chk_workout_templates_estimated_duration
        CHECK (estimated_duration_min IS NULL OR estimated_duration_min > 0) NOT VALID;

ALTER TABLE template_exercises
    ADD CONSTRAINT chk_template_exercises_sort_order_non_negative
        CHECK (sort_order >= 0) NOT VALID,
    ADD CONSTRAINT chk_template_exercises_target_sets_positive
        CHECK (target_sets IS NULL OR target_sets > 0) NOT VALID,
    ADD CONSTRAINT chk_template_exercises_target_weight_non_negative
        CHECK (target_weight_kg IS NULL OR target_weight_kg >= 0) NOT VALID,
    ADD CONSTRAINT chk_template_exercises_rest_seconds_non_negative
        CHECK (rest_seconds IS NULL OR rest_seconds >= 0) NOT VALID;

ALTER TABLE workout_sessions
    ADD CONSTRAINT chk_workout_sessions_duration_non_negative
        CHECK (duration_seconds IS NULL OR duration_seconds >= 0) NOT VALID,
    ADD CONSTRAINT chk_workout_sessions_total_volume_non_negative
        CHECK (total_volume_kg IS NULL OR total_volume_kg >= 0) NOT VALID,
    ADD CONSTRAINT chk_workout_sessions_completion_order
        CHECK (completed_at IS NULL OR completed_at >= started_at) NOT VALID;

ALTER TABLE workout_sets
    ADD CONSTRAINT chk_workout_sets_set_number_positive
        CHECK (set_number > 0) NOT VALID,
    ADD CONSTRAINT chk_workout_sets_reps_non_negative
        CHECK (reps IS NULL OR reps >= 0) NOT VALID,
    ADD CONSTRAINT chk_workout_sets_weight_non_negative
        CHECK (weight_kg IS NULL OR weight_kg >= 0) NOT VALID,
    ADD CONSTRAINT chk_workout_sets_duration_non_negative
        CHECK (duration_seconds IS NULL OR duration_seconds >= 0) NOT VALID,
    ADD CONSTRAINT chk_workout_sets_rest_non_negative
        CHECK (rest_seconds IS NULL OR rest_seconds >= 0) NOT VALID,
    ADD CONSTRAINT chk_workout_sets_sort_order_non_negative
        CHECK (sort_order >= 0) NOT VALID;

ALTER TABLE food_items
    ADD CONSTRAINT chk_food_items_serving_size_positive
        CHECK (serving_size_g IS NULL OR serving_size_g > 0) NOT VALID,
    ADD CONSTRAINT chk_food_items_calories_non_negative
        CHECK (calories_per_serving >= 0) NOT VALID,
    ADD CONSTRAINT chk_food_items_protein_non_negative
        CHECK (protein_g IS NULL OR protein_g >= 0) NOT VALID,
    ADD CONSTRAINT chk_food_items_carbs_non_negative
        CHECK (carbs_g IS NULL OR carbs_g >= 0) NOT VALID,
    ADD CONSTRAINT chk_food_items_fat_non_negative
        CHECK (fat_g IS NULL OR fat_g >= 0) NOT VALID,
    ADD CONSTRAINT chk_food_items_fiber_non_negative
        CHECK (fiber_g IS NULL OR fiber_g >= 0) NOT VALID,
    ADD CONSTRAINT chk_food_items_sugar_non_negative
        CHECK (sugar_g IS NULL OR sugar_g >= 0) NOT VALID,
    ADD CONSTRAINT chk_food_items_sodium_non_negative
        CHECK (sodium_mg IS NULL OR sodium_mg >= 0) NOT VALID;

ALTER TABLE nutrition_goals
    ADD CONSTRAINT chk_nutrition_goals_calories_positive
        CHECK (calories_target IS NULL OR calories_target > 0) NOT VALID,
    ADD CONSTRAINT chk_nutrition_goals_protein_non_negative
        CHECK (protein_g_target IS NULL OR protein_g_target >= 0) NOT VALID,
    ADD CONSTRAINT chk_nutrition_goals_carbs_non_negative
        CHECK (carbs_g_target IS NULL OR carbs_g_target >= 0) NOT VALID,
    ADD CONSTRAINT chk_nutrition_goals_fat_non_negative
        CHECK (fat_g_target IS NULL OR fat_g_target >= 0) NOT VALID;

ALTER TABLE food_log
    ADD CONSTRAINT chk_food_log_servings_positive
        CHECK (servings > 0) NOT VALID,
    ADD CONSTRAINT chk_food_log_calories_non_negative
        CHECK (calories_consumed >= 0) NOT VALID,
    ADD CONSTRAINT chk_food_log_protein_non_negative
        CHECK (protein_g IS NULL OR protein_g >= 0) NOT VALID,
    ADD CONSTRAINT chk_food_log_carbs_non_negative
        CHECK (carbs_g IS NULL OR carbs_g >= 0) NOT VALID,
    ADD CONSTRAINT chk_food_log_fat_non_negative
        CHECK (fat_g IS NULL OR fat_g >= 0) NOT VALID;


-- ============================================================================
-- Migration 013: Inbox Clear Actions
-- ============================================================================

-- ============================================================================
-- Migration 013: Inbox Clear Actions
-- Allows recipients to delete messages/items from their inbox after reading.
-- ============================================================================

-- pings: allow recipient to delete messages from own inbox
DROP POLICY IF EXISTS "Recipient can delete own pings" ON pings;
CREATE POLICY "Recipient can delete own pings"
  ON pings FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);

-- shared_items: allow recipient to delete items from own inbox
DROP POLICY IF EXISTS "Recipient can delete own shares" ON shared_items;
CREATE POLICY "Recipient can delete own shares"
  ON shared_items FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);


-- ============================================================================
-- Migration 014: Preserve Workout History When Deleting Templates
-- Ensures workout_sessions.template_id is set to NULL (not deleted) when a
-- referenced workout template is removed.
-- ============================================================================

ALTER TABLE workout_sessions
    DROP CONSTRAINT IF EXISTS workout_sessions_template_id_fkey;

ALTER TABLE workout_sessions
    ADD CONSTRAINT workout_sessions_template_id_fkey
    FOREIGN KEY (template_id)
    REFERENCES workout_templates (id)
    ON DELETE SET NULL;
