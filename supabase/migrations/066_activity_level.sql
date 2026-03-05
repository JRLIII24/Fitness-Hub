-- Add activity_level column to profiles for TDEE calculation
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_level text;
