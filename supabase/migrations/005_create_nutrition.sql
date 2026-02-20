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
