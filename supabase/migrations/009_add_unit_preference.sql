-- ============================================================================
-- Migration 009: Add Unit Preference
-- Adds unit_preference column to profiles table for kg/lbs toggle
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN unit_preference TEXT DEFAULT 'metric' CHECK (unit_preference IN ('metric', 'imperial'));

COMMENT ON COLUMN profiles.unit_preference IS 'User preferred unit system: metric (kg, cm) or imperial (lbs, inches).';
