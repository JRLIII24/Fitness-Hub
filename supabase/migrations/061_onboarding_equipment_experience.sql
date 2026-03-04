-- Add equipment + experience columns to profiles for onboarding
alter table public.profiles
  add column if not exists equipment_available text[] default '{}',
  add column if not exists experience_level text
    check (experience_level in ('beginner', 'intermediate', 'advanced'));

comment on column profiles.equipment_available is
  'Array of equipment tags selected during onboarding (barbell, dumbbell, etc.)';
comment on column profiles.experience_level is
  'Self-reported training experience level. Used for Smart Launcher template recommendations.';
