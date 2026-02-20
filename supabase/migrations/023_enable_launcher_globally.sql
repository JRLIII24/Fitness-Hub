-- Migration 023: Enable Smart Launcher Globally
-- Enable launcher feature flag by default for new users and activate for existing users

-- Step 1: Set default value for new users
-- New signups will automatically have launcher_enabled = true
ALTER TABLE profiles
  ALTER COLUMN feature_flags
  SET DEFAULT '{"launcher_enabled": true}'::jsonb;

-- Step 2: Enable launcher for all existing users
-- Only updates users who don't already have the flag set to true
UPDATE profiles
SET feature_flags = jsonb_set(
  COALESCE(feature_flags, '{}'::jsonb),
  '{launcher_enabled}',
  'true'
)
WHERE feature_flags IS NULL
   OR feature_flags->>'launcher_enabled' IS DISTINCT FROM 'true';

-- Verify the changes
-- This comment block shows what to expect:
-- SELECT
--   COUNT(*) as total_users,
--   COUNT(*) FILTER (WHERE feature_flags->>'launcher_enabled' = 'true') as launcher_enabled_users
-- FROM profiles;
-- Expected: total_users = launcher_enabled_users (100% enabled)
