-- Migration 069: Nutrition goals range constraints
-- Prevents AI-generated or user-entered values from being physiologically impossible.
-- Covers all 5 goal columns including fiber_g_target (added in migration 008).

ALTER TABLE nutrition_goals
  ADD CONSTRAINT chk_calories_target
    CHECK (calories_target IS NULL OR (calories_target > 0 AND calories_target <= 10000)),
  ADD CONSTRAINT chk_protein_g_target
    CHECK (protein_g_target IS NULL OR (protein_g_target >= 0 AND protein_g_target <= 500)),
  ADD CONSTRAINT chk_carbs_g_target
    CHECK (carbs_g_target IS NULL OR (carbs_g_target >= 0 AND carbs_g_target <= 1500)),
  ADD CONSTRAINT chk_fat_g_target
    CHECK (fat_g_target IS NULL OR (fat_g_target >= 0 AND fat_g_target <= 500)),
  ADD CONSTRAINT chk_fiber_g_target
    CHECK (fiber_g_target IS NULL OR (fiber_g_target >= 0 AND fiber_g_target <= 200));
