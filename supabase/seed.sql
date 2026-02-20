```sql
-- ============================================================================
-- Fit-Hub Complete Test Data Seed
-- Creates 2 test users with full data across all features
-- ============================================================================

-- IMPORTANT: Run this AFTER clearing the database with the delete commands
-- Test Accounts Created:
-- 1. Email: mason@fithub.demo | Password: Test123!
-- 2. Email: riley@fithub.demo | Password: Test123!

BEGIN;

-- ============================================================================
-- 0. Extensions (needed for crypt/gen_salt in many Supabase setups)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. Create Test Users in Auth
-- ============================================================================

-- User 1: Mason (Main test account - fully populated)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'mason@fithub.demo',
  crypt('Test123!', gen_salt('bf')), -- Password: Test123!
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  now(),
  now(),
  '{"display_name": "Mason Brooks"}'::jsonb,
  false
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

DELETE FROM auth.identities
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND provider = 'email';

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '11111111-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  format(
    '{"sub":"%s","email":"%s","email_verified":true}',
    '00000000-0000-0000-0000-000000000001',
    'mason@fithub.demo'
  )::jsonb,
  'email',
  '00000000-0000-0000-0000-000000000001',
  now(),
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  identity_data = EXCLUDED.identity_data,
  provider = EXCLUDED.provider,
  provider_id = EXCLUDED.provider_id,
  last_sign_in_at = EXCLUDED.last_sign_in_at,
  updated_at = now();

-- User 2: Riley (Friend account for social features)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'riley@fithub.demo',
  crypt('Test123!', gen_salt('bf')), -- Password: Test123!
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  now(),
  now(),
  '{"display_name": "Riley Carter"}'::jsonb,
  false
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

DELETE FROM auth.identities
WHERE user_id = '00000000-0000-0000-0000-000000000002'::uuid
  AND provider = 'email';

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '11111111-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  format(
    '{"sub":"%s","email":"%s","email_verified":true}',
    '00000000-0000-0000-0000-000000000002',
    'riley@fithub.demo'
  )::jsonb,
  'email',
  '00000000-0000-0000-0000-000000000002',
  now(),
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  identity_data = EXCLUDED.identity_data,
  provider = EXCLUDED.provider,
  provider_id = EXCLUDED.provider_id,
  last_sign_in_at = EXCLUDED.last_sign_in_at,
  updated_at = now();

-- ============================================================================
-- 2. Create Profiles (Complete Onboarding Data)
-- ============================================================================

-- Mason's Profile (Male, Building Muscle, 25yo, 6'0", 180lbs → 190lbs goal)
INSERT INTO profiles (
  id,
  display_name,
  username,
  bio,
  fitness_goal,
  height_cm,
  current_weight_kg,
  goal_weight_kg,
  date_of_birth,
  gender,
  show_weight,
  onboarding_completed,
  is_public,
  current_streak,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Mason Brooks',
  'mason_fit',
  '💪 Powerlifter | 🎯 Chasing the 1000lb club | 🏋️ Training 5x/week',
  'build_muscle',
  182.88, -- 6'0"
  81.65, -- 180 lbs
  86.18, -- 190 lbs
  '1999-03-15',
  'male',
  true,
  true,
  true,
  7, -- 7-day streak
  now() - interval '30 days',
  now()
) ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  username = EXCLUDED.username,
  bio = EXCLUDED.bio,
  fitness_goal = EXCLUDED.fitness_goal,
  height_cm = EXCLUDED.height_cm,
  current_weight_kg = EXCLUDED.current_weight_kg,
  goal_weight_kg = EXCLUDED.goal_weight_kg,
  date_of_birth = EXCLUDED.date_of_birth,
  gender = EXCLUDED.gender,
  show_weight = EXCLUDED.show_weight,
  onboarding_completed = EXCLUDED.onboarding_completed,
  is_public = EXCLUDED.is_public,
  current_streak = EXCLUDED.current_streak,
  updated_at = EXCLUDED.updated_at;

-- Riley's Profile (Female, Lose Weight, 28yo, 5'6", 160lbs → 145lbs goal)
INSERT INTO profiles (
  id,
  display_name,
  username,
  bio,
  fitness_goal,
  height_cm,
  current_weight_kg,
  goal_weight_kg,
  date_of_birth,
  gender,
  show_weight,
  onboarding_completed,
  is_public,
  current_streak,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Riley Carter',
  'riley_strong',
  '🏃‍♀️ Marathon runner | 🥗 Plant-based athlete | 📈 Progress over perfection',
  'lose_weight',
  167.64, -- 5'6"
  72.57, -- 160 lbs
  65.77, -- 145 lbs
  '1996-07-22',
  'female',
  true,
  true,
  true,
  14, -- 14-day streak
  now() - interval '60 days',
  now()
) ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  username = EXCLUDED.username,
  bio = EXCLUDED.bio,
  fitness_goal = EXCLUDED.fitness_goal,
  height_cm = EXCLUDED.height_cm,
  current_weight_kg = EXCLUDED.current_weight_kg,
  goal_weight_kg = EXCLUDED.goal_weight_kg,
  date_of_birth = EXCLUDED.date_of_birth,
  gender = EXCLUDED.gender,
  show_weight = EXCLUDED.show_weight,
  onboarding_completed = EXCLUDED.onboarding_completed,
  is_public = EXCLUDED.is_public,
  current_streak = EXCLUDED.current_streak,
  updated_at = EXCLUDED.updated_at;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'theme_preference'
  ) THEN
    UPDATE profiles
    SET theme_preference = 'blue'
    WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

    UPDATE profiles
    SET theme_preference = 'pink'
    WHERE id = '00000000-0000-0000-0000-000000000002'::uuid;
  END IF;
END $$;

-- ============================================================================
-- 3. Social Connections
-- ============================================================================

-- Mason follows Riley
INSERT INTO user_follows (follower_id, following_id, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  now() - interval '20 days'
);

-- Riley follows Mason (mutual)
INSERT INTO user_follows (follower_id, following_id, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  now() - interval '19 days'
);

-- Pings
INSERT INTO pings (sender_id, recipient_id, message, read_at, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '💪 Great PR on bench today!',
    now() - interval '2 hours',
    now() - interval '5 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    '🔥 Keep crushing those runs!',
    NULL, -- Unread
    now() - interval '1 hour'
  );

-- ============================================================================
-- 4. Exercise Library Bootstrap (required for template/workout foreign keys)
-- ============================================================================

-- Ensure the exact exercises referenced later in this seed exist.
-- We key on slug so this remains idempotent across reruns.
INSERT INTO exercises (
  name,
  slug,
  muscle_group,
  equipment,
  category,
  is_custom,
  created_at
)
VALUES
  ('Bench Press (Barbell)', 'bench-press-barbell', 'chest', 'barbell', 'compound', false, now() - interval '120 days'),
  ('Shoulder Press (Dumbbell)', 'shoulder-press-dumbbell', 'shoulders', 'dumbbell', 'compound', false, now() - interval '120 days'),
  ('Incline Bench Press (Dumbbell)', 'incline-bench-press-dumbbell', 'chest', 'dumbbell', 'compound', false, now() - interval '120 days'),
  ('Tricep Pushdown', 'tricep-pushdown', 'arms', 'cable', 'isolation', false, now() - interval '120 days'),
  ('Lateral Raise (Dumbbell)', 'lateral-raise-dumbbell', 'shoulders', 'dumbbell', 'isolation', false, now() - interval '120 days'),
  ('Deadlift (Barbell)', 'deadlift-barbell', 'back', 'barbell', 'compound', false, now() - interval '120 days'),
  ('Pull Up', 'pull-up', 'back', 'bodyweight', 'compound', false, now() - interval '120 days'),
  ('Barbell Row', 'barbell-row', 'back', 'barbell', 'compound', false, now() - interval '120 days'),
  ('Bicep Curl (Dumbbell)', 'bicep-curl-dumbbell', 'arms', 'dumbbell', 'isolation', false, now() - interval '120 days'),
  ('Squat (Barbell)', 'squat-barbell', 'legs', 'barbell', 'compound', false, now() - interval '120 days'),
  ('Leg Press', 'leg-press', 'legs', 'machine', 'compound', false, now() - interval '120 days'),
  ('Leg Extension', 'leg-extension', 'legs', 'machine', 'isolation', false, now() - interval '120 days'),
  ('Calf Raise', 'calf-raise', 'legs', 'machine', 'isolation', false, now() - interval '120 days')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  muscle_group = EXCLUDED.muscle_group,
  equipment = EXCLUDED.equipment,
  category = EXCLUDED.category,
  is_custom = false;

-- ============================================================================
-- 5. Workout Templates (Mason's templates)
-- ============================================================================

-- Template 1: Push Day A (Shared publicly)
INSERT INTO workout_templates (
  id,
  user_id,
  name,
  description,
  is_shared,
  save_count,
  created_at,
  updated_at
) VALUES (
  '10000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Push Day A - Heavy',
  'Chest, shoulders, and triceps focus. Heavy compound movements.',
  true,
  12,
  now() - interval '25 days',
  now() - interval '25 days'
) ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_shared = EXCLUDED.is_shared,
  save_count = EXCLUDED.save_count,
  updated_at = now();

INSERT INTO template_exercises (template_id, exercise_id, sort_order, target_sets, target_reps, rest_seconds)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'bench-press-barbell' LIMIT 1), 0, 4, '6-8', 180),
  ('10000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'shoulder-press-dumbbell' LIMIT 1), 1, 3, '8-10', 120),
  ('10000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'incline-bench-press-dumbbell' LIMIT 1), 2, 3, '10-12', 90),
  ('10000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'tricep-pushdown' LIMIT 1), 3, 3, '12-15', 60),
  ('10000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'lateral-raise-dumbbell' LIMIT 1), 4, 3, '15-20', 60)
ON CONFLICT DO NOTHING;

-- Template 2: Pull Day A (Private)
INSERT INTO workout_templates (
  id,
  user_id,
  name,
  description,
  is_shared,
  save_count,
  created_at,
  updated_at
) VALUES (
  '10000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Pull Day A - Volume',
  'Back and biceps with high volume.',
  false,
  0,
  now() - interval '25 days',
  now() - interval '25 days'
) ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_shared = EXCLUDED.is_shared,
  save_count = EXCLUDED.save_count,
  updated_at = now();

INSERT INTO template_exercises (template_id, exercise_id, sort_order, target_sets, target_reps, rest_seconds)
VALUES
  ('10000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM exercises WHERE slug = 'deadlift-barbell' LIMIT 1), 0, 4, '5-8', 240),
  ('10000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM exercises WHERE slug = 'pull-up' LIMIT 1), 1, 3, '8-12', 120),
  ('10000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM exercises WHERE slug = 'barbell-row' LIMIT 1), 2, 3, '8-10', 90),
  ('10000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM exercises WHERE slug = 'bicep-curl-dumbbell' LIMIT 1), 3, 3, '12-15', 60)
ON CONFLICT DO NOTHING;

-- Template 3: Leg Day (Shared publicly)
INSERT INTO workout_templates (
  id,
  user_id,
  name,
  description,
  is_shared,
  save_count,
  created_at,
  updated_at
) VALUES (
  '10000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Leg Day - Quad Focus',
  'Heavy squats and accessory work for massive quads.',
  true,
  8,
  now() - interval '20 days',
  now() - interval '20 days'
) ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_shared = EXCLUDED.is_shared,
  save_count = EXCLUDED.save_count,
  updated_at = now();

INSERT INTO template_exercises (template_id, exercise_id, sort_order, target_sets, target_reps, rest_seconds)
VALUES
  ('10000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM exercises WHERE slug = 'squat-barbell' LIMIT 1), 0, 5, '5-8', 240),
  ('10000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM exercises WHERE slug = 'leg-press' LIMIT 1), 1, 3, '10-12', 120),
  ('10000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM exercises WHERE slug = 'leg-extension' LIMIT 1), 2, 3, '15-20', 60),
  ('10000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM exercises WHERE slug = 'calf-raise' LIMIT 1), 3, 4, '20-25', 45)
ON CONFLICT DO NOTHING;

-- Riley favorites Mason's Push Day template
INSERT INTO template_favorites (user_id, template_id, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  now() - interval '15 days'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. Workout Sessions & Sets (Last 7 days of Mason's workouts)
-- ============================================================================

INSERT INTO workout_sessions (
  id,
  user_id,
  template_id,
  name,
  status,
  started_at,
  completed_at,
  duration_seconds,
  total_volume_kg
) VALUES (
  '20000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Push Day A - Heavy',
  'completed',
  now() - interval '7 days' - interval '2 hours',
  now() - interval '7 days' - interval '45 minutes',
  4500,
  5400.00
) ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  template_id = EXCLUDED.template_id,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  started_at = EXCLUDED.started_at,
  completed_at = EXCLUDED.completed_at,
  duration_seconds = EXCLUDED.duration_seconds,
  total_volume_kg = EXCLUDED.total_volume_kg;

INSERT INTO workout_sets (session_id, exercise_id, set_number, reps, weight_kg, sort_order, completed_at)
VALUES
  ('20000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'bench-press-barbell' LIMIT 1), 1, 8, 100, 0, now() - interval '7 days'),
  ('20000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'bench-press-barbell' LIMIT 1), 2, 7, 100, 1, now() - interval '7 days'),
  ('20000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'bench-press-barbell' LIMIT 1), 3, 6, 100, 2, now() - interval '7 days'),
  ('20000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'bench-press-barbell' LIMIT 1), 4, 6, 100, 3, now() - interval '7 days'),
  ('20000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'shoulder-press-dumbbell' LIMIT 1), 1, 10, 30, 4, now() - interval '7 days'),
  ('20000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'shoulder-press-dumbbell' LIMIT 1), 2, 9, 30, 5, now() - interval '7 days'),
  ('20000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM exercises WHERE slug = 'shoulder-press-dumbbell' LIMIT 1), 3, 8, 30, 6, now() - interval '7 days')
ON CONFLICT DO NOTHING;

INSERT INTO workout_sessions (
  id,
  user_id,
  template_id,
  name,
  status,
  started_at,
  completed_at,
  duration_seconds,
  total_volume_kg
) VALUES (
  '20000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid,
  'Pull Day A - Volume',
  'completed',
  now() - interval '6 days' - interval '1.5 hours',
  now() - interval '6 days' - interval '30 minutes',
  3600,
  6800.00
) ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  template_id = EXCLUDED.template_id,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  started_at = EXCLUDED.started_at,
  completed_at = EXCLUDED.completed_at,
  duration_seconds = EXCLUDED.duration_seconds,
  total_volume_kg = EXCLUDED.total_volume_kg;

INSERT INTO workout_sets (session_id, exercise_id, set_number, reps, weight_kg, sort_order, completed_at)
VALUES
  ('20000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM exercises WHERE slug = 'deadlift-barbell' LIMIT 1), 1, 8, 140, 0, now() - interval '6 days'),
  ('20000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM exercises WHERE slug = 'deadlift-barbell' LIMIT 1), 2, 7, 140, 1, now() - interval '6 days'),
  ('20000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM exercises WHERE slug = 'deadlift-barbell' LIMIT 1), 3, 6, 140, 2, now() - interval '6 days'),
  ('20000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM exercises WHERE slug = 'deadlift-barbell' LIMIT 1), 4, 5, 140, 3, now() - interval '6 days')
ON CONFLICT DO NOTHING;

INSERT INTO workout_sessions (
  id,
  user_id,
  template_id,
  name,
  status,
  started_at,
  completed_at,
  duration_seconds,
  total_volume_kg
) VALUES (
  '20000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000003'::uuid,
  'Leg Day - Quad Focus',
  'completed',
  now() - interval '5 days' - interval '2 hours',
  now() - interval '5 days' - interval '50 minutes',
  4200,
  7200.00
) ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  template_id = EXCLUDED.template_id,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  started_at = EXCLUDED.started_at,
  completed_at = EXCLUDED.completed_at,
  duration_seconds = EXCLUDED.duration_seconds,
  total_volume_kg = EXCLUDED.total_volume_kg;

INSERT INTO workout_sets (session_id, exercise_id, set_number, reps, weight_kg, sort_order, completed_at)
VALUES
  ('20000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM exercises WHERE slug = 'squat-barbell' LIMIT 1), 1, 8, 120, 0, now() - interval '5 days'),
  ('20000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM exercises WHERE slug = 'squat-barbell' LIMIT 1), 2, 7, 120, 1, now() - interval '5 days'),
  ('20000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM exercises WHERE slug = 'squat-barbell' LIMIT 1), 3, 7, 120, 2, now() - interval '5 days'),
  ('20000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM exercises WHERE slug = 'squat-barbell' LIMIT 1), 4, 6, 120, 3, now() - interval '5 days'),
  ('20000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM exercises WHERE slug = 'squat-barbell' LIMIT 1), 5, 5, 120, 4, now() - interval '5 days')
ON CONFLICT DO NOTHING;

INSERT INTO workout_sessions (user_id, name, status, started_at, completed_at, duration_seconds, total_volume_kg)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Push Day', 'completed', now() - interval '4 days', now() - interval '4 days' + interval '1 hour', 3600, 5200),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Pull Day', 'completed', now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 3900, 6500),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Leg Day', 'completed', now() - interval '2 days', now() - interval '2 days' + interval '1.2 hours', 4320, 7000),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Upper Body', 'completed', now() - interval '1 day', now() - interval '1 day' + interval '55 minutes', 3300, 4800);

-- ============================================================================
-- 7. Nutrition Goals & Food Log
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nutrition_goals'
      AND column_name = 'fiber_g_target'
  ) THEN
    EXECUTE $q$
      INSERT INTO nutrition_goals (
        user_id,
        calories_target,
        protein_g_target,
        carbs_g_target,
        fat_g_target,
        fiber_g_target,
        effective_from
      ) VALUES
      (
        '00000000-0000-0000-0000-000000000001'::uuid,
        3200,
        180,
        400,
        90,
        35,
        CURRENT_DATE - interval '30 days'
      ),
      (
        '00000000-0000-0000-0000-000000000002'::uuid,
        1800,
        130,
        180,
        55,
        30,
        CURRENT_DATE - interval '60 days'
      )
      ON CONFLICT (user_id, effective_from) DO UPDATE SET
        calories_target = EXCLUDED.calories_target,
        protein_g_target = EXCLUDED.protein_g_target,
        carbs_g_target = EXCLUDED.carbs_g_target,
        fat_g_target = EXCLUDED.fat_g_target,
        fiber_g_target = EXCLUDED.fiber_g_target;
    $q$;
  ELSE
    EXECUTE $q$
      INSERT INTO nutrition_goals (
        user_id,
        calories_target,
        protein_g_target,
        carbs_g_target,
        fat_g_target,
        effective_from
      ) VALUES
      (
        '00000000-0000-0000-0000-000000000001'::uuid,
        3200,
        180,
        400,
        90,
        CURRENT_DATE - interval '30 days'
      ),
      (
        '00000000-0000-0000-0000-000000000002'::uuid,
        1800,
        130,
        180,
        55,
        CURRENT_DATE - interval '60 days'
      )
      ON CONFLICT (user_id, effective_from) DO UPDATE SET
        calories_target = EXCLUDED.calories_target,
        protein_g_target = EXCLUDED.protein_g_target,
        carbs_g_target = EXCLUDED.carbs_g_target,
        fat_g_target = EXCLUDED.fat_g_target;
    $q$;
  END IF;
END $$;

-- Sample food items (FIXED: idempotent via UPSERT)
INSERT INTO food_items (
  id, name, brand, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g,
  serving_size_g, serving_description, source
)
VALUES
  ('30000000-0000-0000-0000-000000000001'::uuid, 'Chicken Breast', 'Generic', 165, 31, 0, 3.6, 0, 100, '100g', 'manual'),
  ('30000000-0000-0000-0000-000000000002'::uuid, 'Brown Rice', 'Generic', 112, 2.6, 24, 0.9, 1.8, 100, '100g cooked', 'manual'),
  ('30000000-0000-0000-0000-000000000003'::uuid, 'Broccoli', 'Generic', 34, 2.8, 7, 0.4, 2.6, 100, '100g', 'manual'),
  ('30000000-0000-0000-0000-000000000004'::uuid, 'Greek Yogurt', 'Fage Total 0%', 97, 18, 6.5, 0.4, 0, 170, '1 container', 'manual'),
  ('30000000-0000-0000-0000-000000000005'::uuid, 'Oatmeal', 'Quaker', 150, 5, 27, 3, 4, 40, '1/2 cup dry', 'manual'),
  ('30000000-0000-0000-0000-000000000006'::uuid, 'Eggs', 'Generic', 155, 13, 1.1, 11, 0, 100, '2 large eggs', 'manual'),
  ('30000000-0000-0000-0000-000000000007'::uuid, 'Banana', 'Generic', 105, 1.3, 27, 0.4, 3.1, 118, '1 medium', 'manual'),
  ('30000000-0000-0000-0000-000000000008'::uuid, 'Protein Shake', 'Optimum Nutrition Gold Standard', 120, 24, 3, 1, 1, 30, '1 scoop', 'manual')
ON CONFLICT ON CONSTRAINT food_items_pkey DO UPDATE SET
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  calories_per_serving = EXCLUDED.calories_per_serving,
  protein_g = EXCLUDED.protein_g,
  carbs_g = EXCLUDED.carbs_g,
  fat_g = EXCLUDED.fat_g,
  fiber_g = EXCLUDED.fiber_g,
  serving_size_g = EXCLUDED.serving_size_g,
  serving_description = EXCLUDED.serving_description,
  source = EXCLUDED.source;

-- Mason's food log for today
INSERT INTO food_log (user_id, food_item_id, logged_at, meal_type, servings, calories_consumed, protein_g, carbs_g, fat_g)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000005'::uuid, CURRENT_DATE + interval '7 hours', 'breakfast', 1.5, 225, 7.5, 40.5, 4.5),
  ('00000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000006'::uuid, CURRENT_DATE + interval '7 hours', 'breakfast', 1, 155, 13, 1.1, 11),
  ('00000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000007'::uuid, CURRENT_DATE + interval '7 hours', 'breakfast', 1, 105, 1.3, 27, 0.4),
  ('00000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, CURRENT_DATE + interval '12 hours', 'lunch', 2, 330, 62, 0, 7.2),
  ('00000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, CURRENT_DATE + interval '12 hours', 'lunch', 2, 224, 5.2, 48, 1.8),
  ('00000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, CURRENT_DATE + interval '12 hours', 'lunch', 1, 34, 2.8, 7, 0.4),
  ('00000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000004'::uuid, CURRENT_DATE + interval '15 hours', 'snack', 1, 97, 18, 6.5, 0.4),
  ('00000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000007'::uuid, CURRENT_DATE + interval '15 hours', 'snack', 1, 105, 1.3, 27, 0.4);

-- ============================================================================
-- 8. Workout Clips (Sets) & Social Engagement
-- ============================================================================

INSERT INTO workout_clips (
  id,
  user_id,
  video_url,
  thumbnail_url,
  caption,
  duration_seconds,
  like_count,
  comment_count,
  clip_category,
  created_at
) VALUES
  (
    '40000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'https://storage.example.com/clips/mason-deadlift-pr.mp4',
    'https://storage.example.com/clips/mason-deadlift-pr-thumb.jpg',
    '315lbs x 5 deadlift PR! 🔥 New max baby!',
    12,
    24,
    3,
    'lower_body',
    now() - interval '6 days'
  ),
  (
    '40000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'https://storage.example.com/clips/mason-bench.mp4',
    'https://storage.example.com/clips/mason-bench-thumb.jpg',
    '225lbs bench looking smooth 💪',
    10,
    18,
    2,
    'upper_body',
    now() - interval '4 days'
  ),
  (
    '40000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    'https://storage.example.com/clips/riley-run.mp4',
    'https://storage.example.com/clips/riley-run-thumb.jpg',
    'Morning 10K done! ☀️ Feeling strong',
    15,
    31,
    5,
    'cardio',
    now() - interval '2 days'
  )
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  video_url = EXCLUDED.video_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  caption = EXCLUDED.caption,
  duration_seconds = EXCLUDED.duration_seconds,
  like_count = EXCLUDED.like_count,
  comment_count = EXCLUDED.comment_count,
  clip_category = EXCLUDED.clip_category,
  created_at = EXCLUDED.created_at;

INSERT INTO clip_likes (clip_id, user_id, created_at)
VALUES
  ('40000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, now() - interval '6 days'),
  ('40000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, now() - interval '2 days')
ON CONFLICT DO NOTHING;

INSERT INTO clip_comments (clip_id, user_id, content, created_at)
VALUES
  ('40000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Beast mode! That form was perfect 👌', now() - interval '5 days'),
  ('40000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Crushing it! What was your pace?', now() - interval '2 days')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. Accountability Pods
-- ============================================================================

INSERT INTO accountability_pods (
  id,
  name,
  description,
  creator_id,
  created_at,
  updated_at
) VALUES (
  '50000000-0000-0000-0000-000000000001'::uuid,
  'Morning Grind Crew',
  '5am workout squad. No excuses, just results.',
  '00000000-0000-0000-0000-000000000001'::uuid,
  now() - interval '15 days',
  now() - interval '1 day'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  creator_id = EXCLUDED.creator_id,
  updated_at = EXCLUDED.updated_at;

INSERT INTO pod_members (pod_id, user_id, status, joined_at)
VALUES (
  '50000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'active',
  now() - interval '14 days'
) ON CONFLICT DO NOTHING;

INSERT INTO pod_commitments (pod_id, user_id, workouts_per_week, week_start_date)
VALUES
  ('50000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 5, date_trunc('week', CURRENT_DATE)::date),
  ('50000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 4, date_trunc('week', CURRENT_DATE)::date)
ON CONFLICT DO NOTHING;

INSERT INTO pod_messages (pod_id, sender_id, recipient_id, message, created_at)
VALUES
  ('50000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, NULL, $$Who's hitting the gym at 5am tomorrow? 💪$$, now() - interval '1 day'),
  ('50000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, NULL, $$I'll be there! Leg day 🦵$$, now() - interval '20 hours')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. Shared Items
-- ============================================================================

INSERT INTO shared_items (
  sender_id,
  recipient_id,
  item_type,
  template_id,
  item_snapshot,
  message,
  read_at,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'template',
  '10000000-0000-0000-0000-000000000001'::uuid,
  '{"name": "Push Day A - Heavy", "exercises": [{"name": "Bench Press", "sets": 4, "reps": "6-8"}]}'::jsonb,
  'Try this push day - helped me add 20lbs to my bench!',
  now() - interval '10 days',
  now() - interval '12 days'
) ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- SEED COMPLETE!
-- ============================================================================
-- You can now log in with:
--   Email: mason@fithub.demo
--   Password: Test123!
--
-- Riley:
--   Email: riley@fithub.demo
--   Password: Test123!
-- ============================================================================
```
