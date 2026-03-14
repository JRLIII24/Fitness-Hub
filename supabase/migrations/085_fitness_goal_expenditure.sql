-- Migration 085: Add bulk/cut values to fitness_goal_type enum
-- Existing values: lose_weight, build_muscle, maintain, improve_endurance
-- Adding: bulk, cut (explicit surplus/deficit goals for expenditure sync)

ALTER TYPE fitness_goal_type ADD VALUE IF NOT EXISTS 'bulk';
ALTER TYPE fitness_goal_type ADD VALUE IF NOT EXISTS 'cut';
