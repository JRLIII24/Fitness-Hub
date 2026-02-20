-- Migration 036: Onboarding User Metrics
-- Adds body metrics and onboarding completion tracking to profiles table

-- Add onboarding-related columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS current_weight_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS goal_weight_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS show_weight BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Ensure RLS is enabled (should already be enabled from migration 001)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON COLUMN profiles.height_cm IS 'User height in centimeters (converted from ft/in during onboarding)';
COMMENT ON COLUMN profiles.current_weight_kg IS 'Current weight in kilograms (for tracking progress)';
COMMENT ON COLUMN profiles.goal_weight_kg IS 'Target weight goal in kilograms';
COMMENT ON COLUMN profiles.date_of_birth IS 'User date of birth for age-related analytics';
COMMENT ON COLUMN profiles.gender IS 'User gender (male, female, prefer_not_to_say)';
COMMENT ON COLUMN profiles.show_weight IS 'Privacy toggle - if false, weight is hidden from public profile';
COMMENT ON COLUMN profiles.onboarding_completed IS 'Set to true after user completes initial onboarding flow';
