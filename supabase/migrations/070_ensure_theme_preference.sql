-- Migration 070: Ensure all onboarding-related columns exist on profiles (idempotent)
-- Covers migrations 009, 012, 027, 036, 061, 066 in case any were not applied.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS unit_preference TEXT DEFAULT 'metric'
    CHECK (unit_preference IN ('metric', 'imperial')),
  ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'default'
    CHECK (theme_preference IN ('default', 'pink', 'blue')),
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS current_weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS goal_weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS show_weight BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS equipment_available TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS experience_level TEXT
    CHECK (experience_level IS NULL OR experience_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS activity_level TEXT;
