-- Migration 027: Persist custom accent color in user profile

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS accent_color TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_profiles_accent_color_hex'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT chk_profiles_accent_color_hex
      CHECK (
        accent_color IS NULL
        OR accent_color ~ '^#[0-9A-Fa-f]{6}$'
      );
  END IF;
END $$;

COMMENT ON COLUMN profiles.accent_color IS 'Optional user-selected custom accent color in #RRGGBB format.';
