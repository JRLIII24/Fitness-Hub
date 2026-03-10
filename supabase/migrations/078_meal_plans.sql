-- ============================================================================
-- 078: Meal Plans
-- Weekly meal plan containers + per-day-per-slot food entries.
-- ============================================================================

CREATE TABLE meal_plans (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  week_start date        NOT NULL,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_meal_plan_user_week UNIQUE (user_id, week_start)
);

CREATE INDEX idx_meal_plans_user_week ON meal_plans(user_id, week_start DESC);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meal plans"
  ON meal_plans FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Meal Plan Days ───────────────────────────────────────────────────────────

CREATE TABLE meal_plan_days (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid        NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week  smallint    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  meal_type    text        NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  food_item_id uuid        REFERENCES food_items(id) ON DELETE SET NULL,
  custom_name  text,
  servings     numeric(6,2) NOT NULL DEFAULT 1 CHECK (servings > 0),
  calories     numeric(8,2),
  protein_g    numeric(8,2),
  carbs_g      numeric(8,2),
  fat_g        numeric(8,2),
  sort_order   smallint    NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mpd_plan_day ON meal_plan_days(plan_id, day_of_week, meal_type, sort_order);

ALTER TABLE meal_plan_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meal plan days"
  ON meal_plan_days FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_days.plan_id
        AND mp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_days.plan_id
        AND mp.user_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_meal_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meal_plans_updated_at
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_meal_plans_updated_at();
