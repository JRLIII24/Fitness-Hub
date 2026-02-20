-- Migration 012: Add theme_preference to profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'default'
  CHECK (theme_preference IN ('default', 'pink', 'blue'));
