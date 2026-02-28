-- ============================================================================
-- FIT-HUB TEST SEED
-- ============================================================================
-- Run in: Supabase Studio → SQL Editor (runs as postgres / service role)
--
-- Test login  : testuser@fithub.dev  /  TestUser123!
-- Buddy logins: alex@fithub.dev      /  BuddyTest1!
--               sam@fithub.dev       /  BuddyTest2!
--               jordan@fithub.dev    /  BuddyTest3!
--
-- Features exercised by this data:
--   ✅ Workout templates — 5 templates, 2 training blocks, 2 stale badges
--   ✅ Progressive overload ghost rows (last Upper Power session Feb 24)
--   ✅ Exercise sparkline trendlines (4 sessions × 4 exercises, upward slope)
--   ✅ Exercise swap sheet (exercises exist in templates)
--   ✅ Run sessions — 5 runs with km splits
--   ✅ Nutrition — goals, food items, food log (today + yesterday)
--   ✅ Fatigue — 7 days of daily checkins + computed scores
--   ✅ Accountability pod — 4 members, commitments, messages
--   ✅ Pod challenges — 1 active (volume, this week) + 1 past (consistency)
--   ✅ Pod leaderboard — test user + buddies have volume data this week
--   ✅ Marketplace — 1 public template, saves, 4★ and 5★ reviews
--   ✅ Social — follows, pings
-- ============================================================================

DO $$
DECLARE
  -- ── User UUIDs ─────────────────────────────────────────────────────────────
  u_me     UUID := 'a0a0a0a0-0000-0000-0000-000000000001';
  u_alex   UUID := 'b1b1b1b1-0000-0000-0000-000000000001';
  u_sam    UUID := 'b2b2b2b2-0000-0000-0000-000000000002';
  u_jordan UUID := 'b3b3b3b3-0000-0000-0000-000000000003';

  -- ── Exercise UUIDs (fetched from DB or created as fallbacks) ───────────────
  ex_bench    UUID;
  ex_squat    UUID;
  ex_deadlift UUID;
  ex_ohp      UUID;
  ex_row      UUID;
  ex_pullup   UUID;
  ex_curl     UUID;
  ex_rdl      UUID;
  ex_incline  UUID;
  ex_legpress UUID;

  -- ── Template UUIDs ─────────────────────────────────────────────────────────
  t_upper UUID := 'c1c1c1c1-0000-0000-0000-000000000001'; -- "Upper Power"       block A  fresh
  t_lower UUID := 'c2c2c2c2-0000-0000-0000-000000000002'; -- "Lower Hypertrophy" block A  fresh
  t_push  UUID := 'c3c3c3c3-0000-0000-0000-000000000003'; -- "Push Day"          block B  STALE
  t_fb    UUID := 'c4c4c4c4-0000-0000-0000-000000000004'; -- "Full Body"         (Other)  STALE
  t_pub   UUID := 'c5c5c5c5-0000-0000-0000-000000000005'; -- "Community Push"    public, marketplace

  -- ── Workout session UUIDs ──────────────────────────────────────────────────
  ws1  UUID := 'd1000000-0000-0000-0000-000000000001'; -- Upper Power  Jan 06
  ws2  UUID := 'd1000000-0000-0000-0000-000000000002'; -- Upper Power  Jan 20
  ws3  UUID := 'd1000000-0000-0000-0000-000000000003'; -- Lower Hyp    Jan 22
  ws4  UUID := 'd1000000-0000-0000-0000-000000000004'; -- Upper Power  Feb 03
  ws5  UUID := 'd1000000-0000-0000-0000-000000000005'; -- Lower Hyp    Feb 05
  ws6  UUID := 'd1000000-0000-0000-0000-000000000006'; -- Push Day     Feb 12  (makes t_push stale)
  ws7  UUID := 'd1000000-0000-0000-0000-000000000007'; -- Full Body    Feb 01  (makes t_fb stale)
  ws8  UUID := 'd1000000-0000-0000-0000-000000000008'; -- Lower Hyp    Feb 19
  ws9  UUID := 'd1000000-0000-0000-0000-000000000009'; -- Upper Power  Feb 24  ← ghost data source
  -- Buddy sessions for pod volume challenge (Feb 23-27 window)
  ws_alex   UUID := 'd2000000-0000-0000-0000-000000000001'; -- Alex Feb 25
  ws_sam    UUID := 'd2000000-0000-0000-0000-000000000002'; -- Sam  Feb 23

  -- ── Run session UUIDs ──────────────────────────────────────────────────────

  -- ── Pod & challenge UUIDs ──────────────────────────────────────────────────
  v_pod_id  UUID := 'e0e0e0e0-0000-0000-0000-000000000001';
  ch_vol_id UUID := 'f1f1f1f1-0000-0000-0000-000000000001'; -- active volume challenge
  ch_con_id UUID := 'f2f2f2f2-0000-0000-0000-000000000002'; -- past consistency challenge

  -- ── Food item UUIDs ────────────────────────────────────────────────────────
  fd_eggs    UUID := 'fd000000-0000-0000-0000-000000000001';
  fd_oats    UUID := 'fd000000-0000-0000-0000-000000000002';
  fd_chicken UUID := 'fd000000-0000-0000-0000-000000000003';
  fd_rice    UUID := 'fd000000-0000-0000-0000-000000000004';
  fd_banana  UUID := 'fd000000-0000-0000-0000-000000000005';
  fd_whey    UUID := 'fd000000-0000-0000-0000-000000000006';
  fd_salmon  UUID := 'fd000000-0000-0000-0000-000000000007';
  fd_broccoli UUID := 'fd000000-0000-0000-0000-000000000008';

BEGIN

-- ============================================================================
-- 1.  AUTH USERS
-- ============================================================================
INSERT INTO auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  ('00000000-0000-0000-0000-000000000000', u_me,     'authenticated', 'authenticated',
   'testuser@fithub.dev', crypt('TestUser123!', gen_salt('bf', 10)), NOW(),
   '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB,
   NOW() - INTERVAL '60 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', u_alex,   'authenticated', 'authenticated',
   'alex@fithub.dev',     crypt('BuddyTest1!',  gen_salt('bf', 10)), NOW(),
   '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB,
   NOW() - INTERVAL '60 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', u_sam,    'authenticated', 'authenticated',
   'sam@fithub.dev',      crypt('BuddyTest2!',  gen_salt('bf', 10)), NOW(),
   '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB,
   NOW() - INTERVAL '60 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', u_jordan, 'authenticated', 'authenticated',
   'jordan@fithub.dev',   crypt('BuddyTest3!',  gen_salt('bf', 10)), NOW(),
   '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB,
   NOW() - INTERVAL '60 days', NOW(), '', '', '', '')
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  confirmation_token = EXCLUDED.confirmation_token,
  email_change = EXCLUDED.email_change,
  email_change_token_new = EXCLUDED.email_change_token_new,
  recovery_token = EXCLUDED.recovery_token,
  updated_at         = NOW();

-- Auth identities (needed for password login)
BEGIN
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at)
  VALUES
    (gen_random_uuid(), u_me,     jsonb_build_object('sub', u_me::TEXT,     'email', 'testuser@fithub.dev'), 'email', 'testuser@fithub.dev', NOW(), NOW(), NOW()),
    (gen_random_uuid(), u_alex,   jsonb_build_object('sub', u_alex::TEXT,   'email', 'alex@fithub.dev'),     'email', 'alex@fithub.dev',     NOW(), NOW(), NOW()),
    (gen_random_uuid(), u_sam,    jsonb_build_object('sub', u_sam::TEXT,    'email', 'sam@fithub.dev'),      'email', 'sam@fithub.dev',      NOW(), NOW(), NOW()),
    (gen_random_uuid(), u_jordan, jsonb_build_object('sub', u_jordan::TEXT, 'email', 'jordan@fithub.dev'),   'email', 'jordan@fithub.dev',   NOW(), NOW(), NOW())
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'auth.identities insert skipped (may already exist): %', SQLERRM;
END;

-- ============================================================================
-- 2.  PROFILES
-- ============================================================================
INSERT INTO profiles (id, display_name, username, bio, is_public, height_cm, weight_kg, date_of_birth, gender, fitness_goal, timezone)
VALUES
  (u_me,     'Test User',       'testuser',    'Building strength and chasing PRs 🏋️', true, 178, 82.0, '1995-06-15', 'male',   'build_muscle',      'America/New_York'),
  (u_alex,   'Alex Rivera',     'alexrivera',  'Powerlifter & weekend runner',          true, 183, 95.0, '1992-03-22', 'male',   'build_muscle',      'America/Los_Angeles'),
  (u_sam,    'Sam Chen',        'samchen',     'Half marathon training cycle',           true, 163, 61.0, '1997-09-10', 'female', 'improve_endurance', 'America/Chicago'),
  (u_jordan, 'Jordan Williams', 'jordan_w',    'Staying consistent one rep at a time',  true, 180, 78.0, '1991-12-05', 'other',  'maintain',          'America/New_York')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  username     = EXCLUDED.username,
  bio          = EXCLUDED.bio,
  updated_at   = NOW();

-- ============================================================================
-- 3.  EXERCISE LOOKUP  (fetch from DB first; create seed fallbacks if missing)
-- ============================================================================
SELECT id INTO ex_bench    FROM exercises WHERE LOWER(name) LIKE '%bench press%'             AND NOT is_custom LIMIT 1;
SELECT id INTO ex_squat    FROM exercises WHERE LOWER(name) LIKE '%squat%'                   AND NOT is_custom LIMIT 1;
SELECT id INTO ex_deadlift FROM exercises WHERE LOWER(name) LIKE '%deadlift%'                AND NOT is_custom LIMIT 1;
SELECT id INTO ex_ohp      FROM exercises WHERE LOWER(name) LIKE '%overhead press%'          AND NOT is_custom LIMIT 1;
IF ex_ohp IS NULL THEN
  SELECT id INTO ex_ohp    FROM exercises WHERE LOWER(name) LIKE '%shoulder press%'          AND NOT is_custom LIMIT 1;
END IF;
SELECT id INTO ex_row      FROM exercises WHERE LOWER(name) LIKE '%barbell row%'             AND NOT is_custom LIMIT 1;
IF ex_row IS NULL THEN
  SELECT id INTO ex_row    FROM exercises WHERE LOWER(name) LIKE '%bent%row%'                AND NOT is_custom LIMIT 1;
END IF;
SELECT id INTO ex_pullup   FROM exercises WHERE LOWER(name) LIKE '%pull%up%'                 AND NOT is_custom LIMIT 1;
SELECT id INTO ex_curl     FROM exercises WHERE LOWER(name) LIKE '%bicep%curl%'              AND NOT is_custom LIMIT 1;
IF ex_curl IS NULL THEN
  SELECT id INTO ex_curl   FROM exercises WHERE LOWER(name) LIKE '%barbell curl%'            AND NOT is_custom LIMIT 1;
END IF;
SELECT id INTO ex_rdl      FROM exercises WHERE LOWER(name) LIKE '%romanian%'                AND NOT is_custom LIMIT 1;
IF ex_rdl IS NULL THEN
  SELECT id INTO ex_rdl    FROM exercises WHERE LOWER(name) LIKE '%rdl%'                     AND NOT is_custom LIMIT 1;
END IF;
SELECT id INTO ex_incline  FROM exercises WHERE LOWER(name) LIKE '%incline%press%'           AND NOT is_custom LIMIT 1;
SELECT id INTO ex_legpress FROM exercises WHERE LOWER(name) LIKE '%leg press%'               AND NOT is_custom LIMIT 1;

-- Fallback: create seed exercises for any that couldn't be found
IF ex_bench IS NULL THEN
  ex_bench := 'ee100000-0000-0000-0000-000000000001'::UUID;
  INSERT INTO exercises (id, name, slug, muscle_group, equipment, category, is_custom)
  VALUES (ex_bench, 'Barbell Bench Press', 'seed-barbell-bench-press', 'chest', 'barbell', 'compound', false)
  ON CONFLICT (id) DO NOTHING;
END IF;
IF ex_squat IS NULL THEN
  ex_squat := 'ee100000-0000-0000-0000-000000000002'::UUID;
  INSERT INTO exercises (id, name, slug, muscle_group, equipment, category, is_custom)
  VALUES (ex_squat, 'Barbell Back Squat', 'seed-barbell-back-squat', 'legs', 'barbell', 'compound', false)
  ON CONFLICT (id) DO NOTHING;
END IF;
IF ex_deadlift IS NULL THEN
  ex_deadlift := 'ee100000-0000-0000-0000-000000000003'::UUID;
  INSERT INTO exercises (id, name, slug, muscle_group, equipment, category, is_custom)
  VALUES (ex_deadlift, 'Conventional Deadlift', 'seed-conventional-deadlift', 'back', 'barbell', 'compound', false)
  ON CONFLICT (id) DO NOTHING;
END IF;
IF ex_ohp IS NULL THEN
  ex_ohp := 'ee100000-0000-0000-0000-000000000004'::UUID;
  INSERT INTO exercises (id, name, slug, muscle_group, equipment, category, is_custom)
  VALUES (ex_ohp, 'Barbell Overhead Press', 'seed-barbell-ohp', 'shoulders', 'barbell', 'compound', false)
  ON CONFLICT (id) DO NOTHING;
END IF;
IF ex_row IS NULL THEN
  ex_row := 'ee100000-0000-0000-0000-000000000005'::UUID;
  INSERT INTO exercises (id, name, slug, muscle_group, equipment, category, is_custom)
  VALUES (ex_row, 'Barbell Bent-Over Row', 'seed-barbell-row', 'back', 'barbell', 'compound', false)
  ON CONFLICT (id) DO NOTHING;
END IF;
IF ex_pullup IS NULL THEN
  ex_pullup := 'ee100000-0000-0000-0000-000000000006'::UUID;
  INSERT INTO exercises (id, name, slug, muscle_group, equipment, category, is_custom)
  VALUES (ex_pullup, 'Pull-Up', 'seed-pull-up', 'back', 'bodyweight', 'compound', false)
  ON CONFLICT (id) DO NOTHING;
END IF;
IF ex_curl IS NULL THEN
  ex_curl := 'ee100000-0000-0000-0000-000000000007'::UUID;
  INSERT INTO exercises (id, name, slug, muscle_group, equipment, category, is_custom)
  VALUES (ex_curl, 'Barbell Bicep Curl', 'seed-barbell-curl', 'arms', 'barbell', 'isolation', false)
  ON CONFLICT (id) DO NOTHING;
END IF;
IF ex_rdl IS NULL THEN
  ex_rdl := 'ee100000-0000-0000-0000-000000000008'::UUID;
  INSERT INTO exercises (id, name, slug, muscle_group, equipment, category, is_custom)
  VALUES (ex_rdl, 'Romanian Deadlift', 'seed-romanian-deadlift', 'legs', 'barbell', 'compound', false)
  ON CONFLICT (id) DO NOTHING;
END IF;
IF ex_incline IS NULL THEN
  ex_incline := 'ee100000-0000-0000-0000-000000000009'::UUID;
  INSERT INTO exercises (id, name, slug, muscle_group, equipment, category, is_custom)
  VALUES (ex_incline, 'Incline Barbell Press', 'seed-incline-bench-press', 'chest', 'barbell', 'compound', false)
  ON CONFLICT (id) DO NOTHING;
END IF;
IF ex_legpress IS NULL THEN
  ex_legpress := 'ee100000-0000-0000-0000-000000000010'::UUID;
  INSERT INTO exercises (id, name, slug, muscle_group, equipment, category, is_custom)
  VALUES (ex_legpress, 'Leg Press', 'seed-leg-press', 'legs', 'machine', 'compound', false)
  ON CONFLICT (id) DO NOTHING;
END IF;

-- ============================================================================
-- 4.  NUTRITION GOALS
-- ============================================================================
INSERT INTO nutrition_goals (id, user_id, calories_target, protein_g_target, carbs_g_target, fat_g_target, effective_from)
VALUES ('09000000-0000-0000-0000-000000000001', u_me, 2800, 190, 340, 80, '2026-01-01')
ON CONFLICT (id) DO NOTHING;

-- fiber_g_target was added in migration 008 — only update if that column exists
DO $fiber$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'nutrition_goals' AND column_name = 'fiber_g_target'
  ) THEN
    UPDATE nutrition_goals SET fiber_g_target = 32
    WHERE id = '09000000-0000-0000-0000-000000000001';
  END IF;
END $fiber$;

-- ============================================================================
-- 5.  FOOD ITEMS
-- ============================================================================
INSERT INTO food_items (id, name, brand, serving_size_g, serving_description, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g, source)
VALUES
  (fd_eggs,     'Whole Eggs',               NULL,          50,  '1 large egg',         78,  6.3,  0.6,  5.3, 0.0, 'usda'),
  (fd_oats,     'Rolled Oats',              NULL,          40,  '½ cup dry',           148, 5.0,  27.0, 2.5, 4.0, 'usda'),
  (fd_chicken,  'Chicken Breast',           NULL,          100, '100 g cooked',        165, 31.0, 0.0,  3.6, 0.0, 'usda'),
  (fd_rice,     'White Rice',               NULL,          185, '1 cup cooked',        242, 4.4,  53.4, 0.4, 0.6, 'usda'),
  (fd_banana,   'Banana',                   NULL,          118, '1 medium',            105, 1.3,  27.0, 0.4, 3.1, 'usda'),
  (fd_whey,     'Whey Protein Concentrate', 'Generic',     30,  '1 scoop (30 g)',       120, 24.0, 3.0,  2.0, 0.0, 'manual'),
  (fd_salmon,   'Atlantic Salmon',          NULL,          100, '100 g cooked',        208, 20.4, 0.0,  13.4, 0.0, 'usda'),
  (fd_broccoli, 'Broccoli',                 NULL,          91,  '1 cup chopped',        31,  2.6,  6.0,  0.3, 2.4, 'usda')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6.  FOOD LOG — Yesterday (full day) + Today (partial, mid-day)
-- ============================================================================
INSERT INTO food_log (id, user_id, food_item_id, logged_at, meal_type, servings, calories_consumed, protein_g, carbs_g, fat_g)
VALUES
  -- Yesterday (2026-02-26) — full day logged
  ('f1000001-0000-0000-0000-000000000001', u_me, fd_oats,     '2026-02-26 07:15:00+00', 'breakfast', 1.5, 222,  7.5, 40.5,  3.8),
  ('f1000001-0000-0000-0000-000000000002', u_me, fd_eggs,     '2026-02-26 07:15:00+00', 'breakfast', 4.0, 312, 25.2,  2.4, 21.2),
  ('f1000001-0000-0000-0000-000000000003', u_me, fd_whey,     '2026-02-26 07:30:00+00', 'breakfast', 1.0, 120, 24.0,  3.0,  2.0),
  ('f1000001-0000-0000-0000-000000000004', u_me, fd_chicken,  '2026-02-26 12:30:00+00', 'lunch',     2.0, 330, 62.0,  0.0,  7.2),
  ('f1000001-0000-0000-0000-000000000005', u_me, fd_rice,     '2026-02-26 12:30:00+00', 'lunch',     1.0, 242,  4.4, 53.4,  0.4),
  ('f1000001-0000-0000-0000-000000000006', u_me, fd_broccoli, '2026-02-26 12:30:00+00', 'lunch',     1.5,  47,  3.9,  9.0,  0.5),
  ('f1000001-0000-0000-0000-000000000007', u_me, fd_banana,   '2026-02-26 15:45:00+00', 'snack',     1.0, 105,  1.3, 27.0,  0.4),
  ('f1000001-0000-0000-0000-000000000008', u_me, fd_whey,     '2026-02-26 16:00:00+00', 'snack',     1.0, 120, 24.0,  3.0,  2.0),
  ('f1000001-0000-0000-0000-000000000009', u_me, fd_salmon,   '2026-02-26 19:00:00+00', 'dinner',    1.5, 312, 30.6,  0.0, 20.1),
  ('f1000001-0000-0000-0000-000000000010', u_me, fd_rice,     '2026-02-26 19:00:00+00', 'dinner',    0.5, 121,  2.2, 26.7,  0.2),
  ('f1000001-0000-0000-0000-000000000011', u_me, fd_broccoli, '2026-02-26 19:00:00+00', 'dinner',    2.0,  62,  5.2, 12.0,  4.8),
  -- Today (2026-02-27) — partial day shows in-progress tracking on dashboard
  ('f1000001-0000-0000-0000-000000000012', u_me, fd_oats,     '2026-02-27 07:15:00+00', 'breakfast', 1.5, 222,  7.5, 40.5,  3.8),
  ('f1000001-0000-0000-0000-000000000013', u_me, fd_eggs,     '2026-02-27 07:15:00+00', 'breakfast', 3.0, 234, 18.9,  1.8, 15.9),
  ('f1000001-0000-0000-0000-000000000014', u_me, fd_whey,     '2026-02-27 07:30:00+00', 'breakfast', 1.0, 120, 24.0,  3.0,  2.0),
  ('f1000001-0000-0000-0000-000000000015', u_me, fd_chicken,  '2026-02-27 12:00:00+00', 'lunch',     1.5, 248, 46.5,  0.0,  5.4),
  ('f1000001-0000-0000-0000-000000000016', u_me, fd_rice,     '2026-02-27 12:00:00+00', 'lunch',     1.0, 242,  4.4, 53.4,  0.4)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7.  WORKOUT TEMPLATES
-- ============================================================================
INSERT INTO workout_templates (id, user_id, name, description, color, estimated_duration_min, is_public, training_block, primary_muscle_group)
VALUES
  (t_upper, u_me, 'Upper Power',          '4×5 compound upper body strength. Bench, OHP, row, curls.',     '#6366f1', 60,  false, 'Powerbuilding Block A', 'chest'),
  (t_lower, u_me, 'Lower Hypertrophy',    '3\u00d78 squat-focused lower body volume block.',                    '#8b5cf6', 65,  false, 'Powerbuilding Block A', 'legs'),
  (t_push,  u_me, 'Push Day',             'PPL push session — bench, OHP, incline variations.',             '#ec4899', 55,  false, 'PPL Block',             'chest'),
  (t_fb,    u_me, 'Full Body Conditioning','Total body session mixing strength and conditioning circuits.',  '#f59e0b', 50,  false, NULL,                    'full body'),
  (t_pub,   u_me, 'Community Push Starter','Beginner-friendly push session shared with the community. 3-day/wk compatible.', '#22c55e', 45, true, NULL, 'chest')
ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  training_block = EXCLUDED.training_block,
  updated_at     = NOW();

-- Template exercises
-- Upper Power (t_upper): bench, ohp, row, curl
INSERT INTO template_exercises (id, template_id, exercise_id, sort_order, target_sets, target_reps, target_weight_kg, rest_seconds)
VALUES
  ('0e100000-0000-0000-0000-000000000001', t_upper, ex_bench, 1, 4, '5',    80.0, 180),
  ('0e100000-0000-0000-0000-000000000002', t_upper, ex_ohp,   2, 3, '8',    60.0, 120),
  ('0e100000-0000-0000-0000-000000000003', t_upper, ex_row,   3, 4, '8-10', 80.0, 120),
  ('0e100000-0000-0000-0000-000000000004', t_upper, ex_curl,  4, 3, '10-12',40.0,  90)
ON CONFLICT (id) DO NOTHING;

-- Lower Hypertrophy (t_lower): squat, rdl, leg press
INSERT INTO template_exercises (id, template_id, exercise_id, sort_order, target_sets, target_reps, target_weight_kg, rest_seconds)
VALUES
  ('0e200000-0000-0000-0000-000000000001', t_lower, ex_squat,   1, 4, '8',    100.0, 180),
  ('0e200000-0000-0000-0000-000000000002', t_lower, ex_rdl,     2, 4, '10',    82.5, 120),
  ('0e200000-0000-0000-0000-000000000003', t_lower, ex_legpress, 3, 3, '12',  120.0,  90)
ON CONFLICT (id) DO NOTHING;

-- Push Day (t_push): bench, ohp, incline
INSERT INTO template_exercises (id, template_id, exercise_id, sort_order, target_sets, target_reps, target_weight_kg, rest_seconds)
VALUES
  ('0e300000-0000-0000-0000-000000000001', t_push, ex_bench,   1, 4, '5',    85.0, 180),
  ('0e300000-0000-0000-0000-000000000002', t_push, ex_ohp,     2, 3, '8',    60.0, 120),
  ('0e300000-0000-0000-0000-000000000003', t_push, ex_incline, 3, 3, '10',   70.0, 120)
ON CONFLICT (id) DO NOTHING;

-- Full Body (t_fb): squat, bench, deadlift, row
INSERT INTO template_exercises (id, template_id, exercise_id, sort_order, target_sets, target_reps, target_weight_kg, rest_seconds)
VALUES
  ('0e400000-0000-0000-0000-000000000001', t_fb, ex_squat,    1, 3, '5',   100.0, 180),
  ('0e400000-0000-0000-0000-000000000002', t_fb, ex_bench,    2, 3, '5',    85.0, 180),
  ('0e400000-0000-0000-0000-000000000003', t_fb, ex_deadlift, 3, 3, '3',   120.0, 210),
  ('0e400000-0000-0000-0000-000000000004', t_fb, ex_row,      4, 3, '8',    80.0, 120)
ON CONFLICT (id) DO NOTHING;

-- Community Push (t_pub): bench, ohp, incline, pull-up
INSERT INTO template_exercises (id, template_id, exercise_id, sort_order, target_sets, target_reps, target_weight_kg, rest_seconds)
VALUES
  ('0e500000-0000-0000-0000-000000000001', t_pub, ex_bench,   1, 3, '8-10', 60.0, 120),
  ('0e500000-0000-0000-0000-000000000002', t_pub, ex_ohp,     2, 3, '10',   40.0,  90),
  ('0e500000-0000-0000-0000-000000000003', t_pub, ex_incline, 3, 3, '10-12',50.0,  90),
  ('0e500000-0000-0000-0000-000000000004', t_pub, ex_pullup,  4, 3, 'AMRAP', NULL,  90)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8.  WORKOUT SESSIONS  (6 weeks of history, progressively heavier)
-- ============================================================================
INSERT INTO workout_sessions (id, user_id, template_id, name, status, started_at, completed_at, duration_seconds, session_rpe, total_volume_kg)
VALUES
  -- Upper Power history (trendline: bench 80→82.5→85→87.5)
  (ws1, u_me, t_upper, 'Upper Power',      'completed', '2026-01-06 09:00:00+00', '2026-01-06 10:05:00+00', 3900, 7.5, 7390.0),
  (ws2, u_me, t_upper, 'Upper Power',      'completed', '2026-01-20 09:00:00+00', '2026-01-20 10:08:00+00', 3900, 7.5, 7567.5),
  (ws4, u_me, t_upper, 'Upper Power',      'completed', '2026-02-03 09:00:00+00', '2026-02-03 10:10:00+00', 3900, 8.0, 7755.0),
  (ws9, u_me, t_upper, 'Upper Power',      'completed', '2026-02-24 09:00:00+00', '2026-02-24 10:12:00+00', 3900, 8.0, 7942.5),
  -- Lower Hyp history (trendline: squat 100→102.5→105)
  (ws3, u_me, t_lower, 'Lower Hypertrophy','completed', '2026-01-22 09:00:00+00', '2026-01-22 10:15:00+00', 4500, 7.0, 10720.0),
  (ws5, u_me, t_lower, 'Lower Hypertrophy','completed', '2026-02-05 09:00:00+00', '2026-02-05 10:18:00+00', 4500, 7.5, 10900.0),
  (ws8, u_me, t_lower, 'Lower Hypertrophy','completed', '2026-02-19 09:00:00+00', '2026-02-19 10:20:00+00', 4500, 8.0, 11260.0),
  -- Push Day — last done Feb 12 → 15 days ago → STALE badge ✓
  (ws6, u_me, t_push,  'Push Day',         'completed', '2026-02-12 09:00:00+00', '2026-02-12 10:00:00+00', 3600, 7.5, 4815.0),
  -- Full Body — last done Feb 01 → 26 days ago → STALE badge ✓
  (ws7, u_me, t_fb,    'Full Body Conditioning','completed','2026-02-01 09:00:00+00','2026-02-01 09:55:00+00',3300, 7.0, 5775.0)
ON CONFLICT (id) DO NOTHING;

-- Buddy sessions for pod volume challenge (Feb 23–Mar 01 window)
INSERT INTO workout_sessions (id, user_id, template_id, name, status, started_at, completed_at, duration_seconds, session_rpe, total_volume_kg)
VALUES
  (ws_alex,  u_alex,   NULL, 'Monday Push', 'completed', '2026-02-25 08:00:00+00', '2026-02-25 09:05:00+00', 3900, 8.5, 8240.0),
  (ws_sam,   u_sam,    NULL, 'Full Body',   'completed', '2026-02-23 07:30:00+00', '2026-02-23 08:25:00+00', 3300, 7.0, 5540.0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9.  WORKOUT SETS  (full set-level detail for all sessions)
--     Ghost overlay = ws9 (most recent Upper Power, Feb 24)
--     Trendlines: bench 80→82.5→85→87.5  ohp 55→57.5→60→62.5
--                 row  75→77.5→80→82.5   squat 100→102.5→105
--     Set IDs use prefix bb0{session} with sequential suffix.
-- ============================================================================

-- ws1 — Upper Power Jan 06 ─────────────────────────────────────────────────
INSERT INTO workout_sets (id, session_id, exercise_id, set_number, set_type, reps, weight_kg, rpe, rest_seconds, completed_at, sort_order)
VALUES
  ('bb010000-0000-0000-0000-000000000001', ws1, ex_bench, 1,'warmup',  8, 60.0, 5.0, 60,  '2026-01-06 09:05:00+00', 1),
  ('bb010000-0000-0000-0000-000000000002', ws1, ex_bench, 2,'working', 5, 80.0, 7.0, 180, '2026-01-06 09:12:00+00', 2),
  ('bb010000-0000-0000-0000-000000000003', ws1, ex_bench, 3,'working', 5, 80.0, 7.5, 180, '2026-01-06 09:16:00+00', 3),
  ('bb010000-0000-0000-0000-000000000004', ws1, ex_bench, 4,'working', 5, 80.0, 8.0, 180, '2026-01-06 09:20:00+00', 4),
  ('bb010000-0000-0000-0000-000000000005', ws1, ex_ohp,   1,'working', 8, 55.0, 7.0, 120, '2026-01-06 09:27:00+00', 5),
  ('bb010000-0000-0000-0000-000000000006', ws1, ex_ohp,   2,'working', 8, 55.0, 7.5, 120, '2026-01-06 09:30:00+00', 6),
  ('bb010000-0000-0000-0000-000000000007', ws1, ex_ohp,   3,'working', 7, 55.0, 8.0, 120, '2026-01-06 09:33:00+00', 7),
  ('bb010000-0000-0000-0000-000000000008', ws1, ex_row,   1,'working',10, 75.0, 7.0, 120, '2026-01-06 09:40:00+00', 8),
  ('bb010000-0000-0000-0000-000000000009', ws1, ex_row,   2,'working',10, 75.0, 7.5, 120, '2026-01-06 09:43:00+00', 9),
  ('bb010000-0000-0000-0000-00000000000a', ws1, ex_row,   3,'working',10, 75.0, 7.5, 120, '2026-01-06 09:46:00+00',10),
  ('bb010000-0000-0000-0000-00000000000b', ws1, ex_row,   4,'working', 9, 75.0, 8.0, 120, '2026-01-06 09:49:00+00',11),
  ('bb010000-0000-0000-0000-00000000000c', ws1, ex_curl,  1,'working',12, 35.0, 6.5,  90, '2026-01-06 09:55:00+00',12),
  ('bb010000-0000-0000-0000-00000000000d', ws1, ex_curl,  2,'working',12, 35.0, 7.0,  90, '2026-01-06 09:58:00+00',13),
  ('bb010000-0000-0000-0000-00000000000e', ws1, ex_curl,  3,'working',10, 35.0, 7.5,  90, '2026-01-06 10:01:00+00',14)
ON CONFLICT (id) DO NOTHING;

-- ws2 — Upper Power Jan 20 ─────────────────────────────────────────────────
INSERT INTO workout_sets (id, session_id, exercise_id, set_number, set_type, reps, weight_kg, rpe, rest_seconds, completed_at, sort_order)
VALUES
  ('bb020000-0000-0000-0000-000000000001', ws2, ex_bench, 1,'warmup',  8, 62.5, 5.0,  60, '2026-01-20 09:05:00+00', 1),
  ('bb020000-0000-0000-0000-000000000002', ws2, ex_bench, 2,'working', 5, 82.5, 7.5, 180, '2026-01-20 09:12:00+00', 2),
  ('bb020000-0000-0000-0000-000000000003', ws2, ex_bench, 3,'working', 5, 82.5, 8.0, 180, '2026-01-20 09:16:00+00', 3),
  ('bb020000-0000-0000-0000-000000000004', ws2, ex_bench, 4,'working', 5, 82.5, 8.5, 180, '2026-01-20 09:20:00+00', 4),
  ('bb020000-0000-0000-0000-000000000005', ws2, ex_ohp,   1,'working', 8, 57.5, 7.5, 120, '2026-01-20 09:27:00+00', 5),
  ('bb020000-0000-0000-0000-000000000006', ws2, ex_ohp,   2,'working', 8, 57.5, 8.0, 120, '2026-01-20 09:30:00+00', 6),
  ('bb020000-0000-0000-0000-000000000007', ws2, ex_ohp,   3,'working', 7, 57.5, 8.5, 120, '2026-01-20 09:33:00+00', 7),
  ('bb020000-0000-0000-0000-000000000008', ws2, ex_row,   1,'working',10, 77.5, 7.5, 120, '2026-01-20 09:40:00+00', 8),
  ('bb020000-0000-0000-0000-000000000009', ws2, ex_row,   2,'working',10, 77.5, 7.5, 120, '2026-01-20 09:43:00+00', 9),
  ('bb020000-0000-0000-0000-00000000000a', ws2, ex_row,   3,'working',10, 77.5, 8.0, 120, '2026-01-20 09:46:00+00',10),
  ('bb020000-0000-0000-0000-00000000000b', ws2, ex_row,   4,'working', 9, 77.5, 8.5, 120, '2026-01-20 09:49:00+00',11),
  ('bb020000-0000-0000-0000-00000000000c', ws2, ex_curl,  1,'working',12, 37.5, 7.0,  90, '2026-01-20 09:55:00+00',12),
  ('bb020000-0000-0000-0000-00000000000d', ws2, ex_curl,  2,'working',12, 37.5, 7.5,  90, '2026-01-20 09:58:00+00',13),
  ('bb020000-0000-0000-0000-00000000000e', ws2, ex_curl,  3,'working',10, 37.5, 8.0,  90, '2026-01-20 10:01:00+00',14)
ON CONFLICT (id) DO NOTHING;

-- ws3 — Lower Hyp Jan 22 ───────────────────────────────────────────────────
INSERT INTO workout_sets (id, session_id, exercise_id, set_number, set_type, reps, weight_kg, rpe, rest_seconds, completed_at, sort_order)
VALUES
  ('bb030000-0000-0000-0000-000000000001', ws3, ex_squat,   1,'warmup',  5, 80.0, 5.0, 90,  '2026-01-22 09:06:00+00', 1),
  ('bb030000-0000-0000-0000-000000000002', ws3, ex_squat,   2,'working', 8,100.0, 7.5,180,  '2026-01-22 09:14:00+00', 2),
  ('bb030000-0000-0000-0000-000000000003', ws3, ex_squat,   3,'working', 8,100.0, 8.0,180,  '2026-01-22 09:18:00+00', 3),
  ('bb030000-0000-0000-0000-000000000004', ws3, ex_squat,   4,'working', 8,100.0, 8.5,180,  '2026-01-22 09:22:00+00', 4),
  ('bb030000-0000-0000-0000-000000000005', ws3, ex_rdl,     1,'working',10, 80.0, 7.5,120,  '2026-01-22 09:32:00+00', 5),
  ('bb030000-0000-0000-0000-000000000006', ws3, ex_rdl,     2,'working',10, 80.0, 8.0,120,  '2026-01-22 09:36:00+00', 6),
  ('bb030000-0000-0000-0000-000000000007', ws3, ex_rdl,     3,'working',10, 80.0, 8.0,120,  '2026-01-22 09:40:00+00', 7),
  ('bb030000-0000-0000-0000-000000000008', ws3, ex_rdl,     4,'working', 9, 80.0, 8.5,120,  '2026-01-22 09:44:00+00', 8),
  ('bb030000-0000-0000-0000-000000000009', ws3, ex_legpress,1,'working',12,120.0, 7.0, 90,  '2026-01-22 09:52:00+00', 9),
  ('bb030000-0000-0000-0000-00000000000a', ws3, ex_legpress,2,'working',12,120.0, 7.5, 90,  '2026-01-22 09:56:00+00',10),
  ('bb030000-0000-0000-0000-00000000000b', ws3, ex_legpress,3,'working',10,120.0, 8.0, 90,  '2026-01-22 10:00:00+00',11)
ON CONFLICT (id) DO NOTHING;

-- ws4 — Upper Power Feb 03 ─────────────────────────────────────────────────
INSERT INTO workout_sets (id, session_id, exercise_id, set_number, set_type, reps, weight_kg, rpe, rest_seconds, completed_at, sort_order)
VALUES
  ('bb040000-0000-0000-0000-000000000001', ws4, ex_bench, 1,'warmup',  8, 65.0, 5.0,  60, '2026-02-03 09:05:00+00', 1),
  ('bb040000-0000-0000-0000-000000000002', ws4, ex_bench, 2,'working', 5, 85.0, 8.0, 180, '2026-02-03 09:12:00+00', 2),
  ('bb040000-0000-0000-0000-000000000003', ws4, ex_bench, 3,'working', 5, 85.0, 8.5, 180, '2026-02-03 09:16:00+00', 3),
  ('bb040000-0000-0000-0000-000000000004', ws4, ex_bench, 4,'working', 4, 85.0, 9.0, 180, '2026-02-03 09:20:00+00', 4),
  ('bb040000-0000-0000-0000-000000000005', ws4, ex_ohp,   1,'working', 8, 60.0, 7.5, 120, '2026-02-03 09:27:00+00', 5),
  ('bb040000-0000-0000-0000-000000000006', ws4, ex_ohp,   2,'working', 8, 60.0, 8.0, 120, '2026-02-03 09:30:00+00', 6),
  ('bb040000-0000-0000-0000-000000000007', ws4, ex_ohp,   3,'working', 7, 60.0, 8.5, 120, '2026-02-03 09:33:00+00', 7),
  ('bb040000-0000-0000-0000-000000000008', ws4, ex_row,   1,'working',10, 80.0, 7.5, 120, '2026-02-03 09:40:00+00', 8),
  ('bb040000-0000-0000-0000-000000000009', ws4, ex_row,   2,'working',10, 80.0, 8.0, 120, '2026-02-03 09:43:00+00', 9),
  ('bb040000-0000-0000-0000-00000000000a', ws4, ex_row,   3,'working',10, 80.0, 8.0, 120, '2026-02-03 09:46:00+00',10),
  ('bb040000-0000-0000-0000-00000000000b', ws4, ex_row,   4,'working', 9, 80.0, 8.5, 120, '2026-02-03 09:49:00+00',11),
  ('bb040000-0000-0000-0000-00000000000c', ws4, ex_curl,  1,'working',12, 40.0, 7.0,  90, '2026-02-03 09:55:00+00',12),
  ('bb040000-0000-0000-0000-00000000000d', ws4, ex_curl,  2,'working',12, 40.0, 7.5,  90, '2026-02-03 09:58:00+00',13),
  ('bb040000-0000-0000-0000-00000000000e', ws4, ex_curl,  3,'working',10, 40.0, 8.0,  90, '2026-02-03 10:01:00+00',14)
ON CONFLICT (id) DO NOTHING;

-- ws5 — Lower Hyp Feb 05 ───────────────────────────────────────────────────
INSERT INTO workout_sets (id, session_id, exercise_id, set_number, set_type, reps, weight_kg, rpe, rest_seconds, completed_at, sort_order)
VALUES
  ('bb050000-0000-0000-0000-000000000001', ws5, ex_squat,   1,'warmup',  5, 82.5, 5.0, 90, '2026-02-05 09:06:00+00', 1),
  ('bb050000-0000-0000-0000-000000000002', ws5, ex_squat,   2,'working', 8,102.5, 7.5,180, '2026-02-05 09:14:00+00', 2),
  ('bb050000-0000-0000-0000-000000000003', ws5, ex_squat,   3,'working', 8,102.5, 8.0,180, '2026-02-05 09:18:00+00', 3),
  ('bb050000-0000-0000-0000-000000000004', ws5, ex_squat,   4,'working', 7,102.5, 8.5,180, '2026-02-05 09:22:00+00', 4),
  ('bb050000-0000-0000-0000-000000000005', ws5, ex_rdl,     1,'working',10, 82.5, 7.5,120, '2026-02-05 09:32:00+00', 5),
  ('bb050000-0000-0000-0000-000000000006', ws5, ex_rdl,     2,'working',10, 82.5, 8.0,120, '2026-02-05 09:36:00+00', 6),
  ('bb050000-0000-0000-0000-000000000007', ws5, ex_rdl,     3,'working',10, 82.5, 8.0,120, '2026-02-05 09:40:00+00', 7),
  ('bb050000-0000-0000-0000-000000000008', ws5, ex_rdl,     4,'working', 8, 82.5, 8.5,120, '2026-02-05 09:44:00+00', 8),
  ('bb050000-0000-0000-0000-000000000009', ws5, ex_legpress,1,'working',12,120.0, 7.5, 90, '2026-02-05 09:52:00+00', 9),
  ('bb050000-0000-0000-0000-00000000000a', ws5, ex_legpress,2,'working',12,120.0, 8.0, 90, '2026-02-05 09:56:00+00',10),
  ('bb050000-0000-0000-0000-00000000000b', ws5, ex_legpress,3,'working',10,120.0, 8.5, 90, '2026-02-05 10:00:00+00',11)
ON CONFLICT (id) DO NOTHING;

-- ws6 — Push Day Feb 12 (STALE template: >14 days ago) ────────────────────
INSERT INTO workout_sets (id, session_id, exercise_id, set_number, set_type, reps, weight_kg, rpe, rest_seconds, completed_at, sort_order)
VALUES
  ('bb060000-0000-0000-0000-000000000001', ws6, ex_bench,   1,'warmup',  8, 65.0, 5.0,  60, '2026-02-12 09:05:00+00', 1),
  ('bb060000-0000-0000-0000-000000000002', ws6, ex_bench,   2,'working', 5, 85.0, 8.0, 180, '2026-02-12 09:12:00+00', 2),
  ('bb060000-0000-0000-0000-000000000003', ws6, ex_bench,   3,'working', 5, 85.0, 8.5, 180, '2026-02-12 09:16:00+00', 3),
  ('bb060000-0000-0000-0000-000000000004', ws6, ex_bench,   4,'working', 4, 85.0, 9.0, 180, '2026-02-12 09:20:00+00', 4),
  ('bb060000-0000-0000-0000-000000000005', ws6, ex_ohp,     1,'working', 8, 60.0, 7.5, 120, '2026-02-12 09:27:00+00', 5),
  ('bb060000-0000-0000-0000-000000000006', ws6, ex_ohp,     2,'working', 8, 60.0, 8.0, 120, '2026-02-12 09:30:00+00', 6),
  ('bb060000-0000-0000-0000-000000000007', ws6, ex_ohp,     3,'working', 7, 60.0, 8.5, 120, '2026-02-12 09:33:00+00', 7),
  ('bb060000-0000-0000-0000-000000000008', ws6, ex_incline, 1,'working',10, 70.0, 7.5, 120, '2026-02-12 09:40:00+00', 8),
  ('bb060000-0000-0000-0000-000000000009', ws6, ex_incline, 2,'working',10, 70.0, 8.0, 120, '2026-02-12 09:44:00+00', 9),
  ('bb060000-0000-0000-0000-00000000000a', ws6, ex_incline, 3,'working', 8, 70.0, 8.5, 120, '2026-02-12 09:48:00+00',10)
ON CONFLICT (id) DO NOTHING;

-- ws7 — Full Body Feb 01 (STALE template: 26 days ago) ────────────────────
INSERT INTO workout_sets (id, session_id, exercise_id, set_number, set_type, reps, weight_kg, rpe, rest_seconds, completed_at, sort_order)
VALUES
  ('bb070000-0000-0000-0000-000000000001', ws7, ex_squat,   1,'warmup',  5, 80.0, 5.0,  90, '2026-02-01 09:05:00+00', 1),
  ('bb070000-0000-0000-0000-000000000002', ws7, ex_squat,   2,'working', 5,100.0, 7.5, 180, '2026-02-01 09:12:00+00', 2),
  ('bb070000-0000-0000-0000-000000000003', ws7, ex_squat,   3,'working', 5,100.0, 8.0, 180, '2026-02-01 09:16:00+00', 3),
  ('bb070000-0000-0000-0000-000000000004', ws7, ex_bench,   1,'working', 5, 85.0, 8.0, 180, '2026-02-01 09:25:00+00', 4),
  ('bb070000-0000-0000-0000-000000000005', ws7, ex_bench,   2,'working', 5, 85.0, 8.0, 180, '2026-02-01 09:29:00+00', 5),
  ('bb070000-0000-0000-0000-000000000006', ws7, ex_bench,   3,'working', 4, 85.0, 9.0, 180, '2026-02-01 09:33:00+00', 6),
  ('bb070000-0000-0000-0000-000000000007', ws7, ex_deadlift,1,'working', 3,120.0, 7.5, 210, '2026-02-01 09:42:00+00', 7),
  ('bb070000-0000-0000-0000-000000000008', ws7, ex_deadlift,2,'working', 3,120.0, 8.0, 210, '2026-02-01 09:46:00+00', 8),
  ('bb070000-0000-0000-0000-000000000009', ws7, ex_deadlift,3,'working', 3,120.0, 8.5, 210, '2026-02-01 09:50:00+00', 9),
  ('bb070000-0000-0000-0000-00000000000a', ws7, ex_row,     1,'working', 8, 80.0, 7.5, 120, '2026-02-01 09:58:00+00',10),
  ('bb070000-0000-0000-0000-00000000000b', ws7, ex_row,     2,'working', 8, 80.0, 8.0, 120, '2026-02-01 10:02:00+00',11),
  ('bb070000-0000-0000-0000-00000000000c', ws7, ex_row,     3,'working', 8, 80.0, 8.5, 120, '2026-02-01 10:06:00+00',12)
ON CONFLICT (id) DO NOTHING;

-- ws8 — Lower Hyp Feb 19 ───────────────────────────────────────────────────
INSERT INTO workout_sets (id, session_id, exercise_id, set_number, set_type, reps, weight_kg, rpe, rest_seconds, completed_at, sort_order)
VALUES
  ('bb080000-0000-0000-0000-000000000001', ws8, ex_squat,   1,'warmup',  5, 85.0, 5.0,  90, '2026-02-19 09:06:00+00', 1),
  ('bb080000-0000-0000-0000-000000000002', ws8, ex_squat,   2,'working', 8,105.0, 8.0, 180, '2026-02-19 09:14:00+00', 2),
  ('bb080000-0000-0000-0000-000000000003', ws8, ex_squat,   3,'working', 8,105.0, 8.5, 180, '2026-02-19 09:18:00+00', 3),
  ('bb080000-0000-0000-0000-000000000004', ws8, ex_squat,   4,'working', 7,105.0, 9.0, 180, '2026-02-19 09:22:00+00', 4),
  ('bb080000-0000-0000-0000-000000000005', ws8, ex_rdl,     1,'working',10, 85.0, 7.5, 120, '2026-02-19 09:32:00+00', 5),
  ('bb080000-0000-0000-0000-000000000006', ws8, ex_rdl,     2,'working',10, 85.0, 8.0, 120, '2026-02-19 09:36:00+00', 6),
  ('bb080000-0000-0000-0000-000000000007', ws8, ex_rdl,     3,'working',10, 85.0, 8.0, 120, '2026-02-19 09:40:00+00', 7),
  ('bb080000-0000-0000-0000-000000000008', ws8, ex_rdl,     4,'working', 9, 85.0, 8.5, 120, '2026-02-19 09:44:00+00', 8),
  ('bb080000-0000-0000-0000-000000000009', ws8, ex_legpress,1,'working',12,125.0, 7.5,  90, '2026-02-19 09:52:00+00', 9),
  ('bb080000-0000-0000-0000-00000000000a', ws8, ex_legpress,2,'working',12,125.0, 8.0,  90, '2026-02-19 09:56:00+00',10),
  ('bb080000-0000-0000-0000-00000000000b', ws8, ex_legpress,3,'working',10,125.0, 8.5,  90, '2026-02-19 10:00:00+00',11)
ON CONFLICT (id) DO NOTHING;

-- ws9 — Upper Power Feb 24 ← GHOST DATA SOURCE for next Upper Power session
--   bench 87.5kg → suggested 90kg  |  ohp 62.5kg → suggested 65kg
--   row  82.5kg  → suggested 85kg  |  curl 42.5kg → suggested 45kg
INSERT INTO workout_sets (id, session_id, exercise_id, set_number, set_type, reps, weight_kg, rpe, rest_seconds, completed_at, sort_order)
VALUES
  ('bb090000-0000-0000-0000-000000000001', ws9, ex_bench, 1,'warmup',  8, 67.5, 5.0,  60, '2026-02-24 09:05:00+00', 1),
  ('bb090000-0000-0000-0000-000000000002', ws9, ex_bench, 2,'working', 5, 87.5, 8.0, 180, '2026-02-24 09:12:00+00', 2),
  ('bb090000-0000-0000-0000-000000000003', ws9, ex_bench, 3,'working', 5, 87.5, 8.5, 180, '2026-02-24 09:16:00+00', 3),
  ('bb090000-0000-0000-0000-000000000004', ws9, ex_bench, 4,'working', 4, 87.5, 9.0, 180, '2026-02-24 09:20:00+00', 4),
  ('bb090000-0000-0000-0000-000000000005', ws9, ex_ohp,   1,'working', 8, 62.5, 8.0, 120, '2026-02-24 09:27:00+00', 5),
  ('bb090000-0000-0000-0000-000000000006', ws9, ex_ohp,   2,'working', 8, 62.5, 8.5, 120, '2026-02-24 09:30:00+00', 6),
  ('bb090000-0000-0000-0000-000000000007', ws9, ex_ohp,   3,'working', 7, 62.5, 9.0, 120, '2026-02-24 09:33:00+00', 7),
  ('bb090000-0000-0000-0000-000000000008', ws9, ex_row,   1,'working',10, 82.5, 7.5, 120, '2026-02-24 09:40:00+00', 8),
  ('bb090000-0000-0000-0000-000000000009', ws9, ex_row,   2,'working',10, 82.5, 8.0, 120, '2026-02-24 09:43:00+00', 9),
  ('bb090000-0000-0000-0000-00000000000a', ws9, ex_row,   3,'working',10, 82.5, 8.0, 120, '2026-02-24 09:46:00+00',10),
  ('bb090000-0000-0000-0000-00000000000b', ws9, ex_row,   4,'working', 9, 82.5, 8.5, 120, '2026-02-24 09:49:00+00',11),
  ('bb090000-0000-0000-0000-00000000000c', ws9, ex_curl,  1,'working',12, 42.5, 7.0,  90, '2026-02-24 09:55:00+00',12),
  ('bb090000-0000-0000-0000-00000000000d', ws9, ex_curl,  2,'working',12, 42.5, 7.5,  90, '2026-02-24 09:58:00+00',13),
  ('bb090000-0000-0000-0000-00000000000e', ws9, ex_curl,  3,'working',10, 42.5, 8.0,  90, '2026-02-24 10:01:00+00',14)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 11. FATIGUE — Daily checkins + computed scores (last 7 days)
-- ============================================================================
INSERT INTO fatigue_daily_checkins (id, user_id, checkin_date, timezone, sleep_quality, soreness, stress, motivation, notes)
VALUES
  ('fc000001-0000-0000-0000-000000000001', u_me, '2026-02-21', 'America/New_York', 7, 5, 4, 7, 'Legs still sore from squat day'),
  ('fc000001-0000-0000-0000-000000000002', u_me, '2026-02-22', 'America/New_York', 8, 4, 3, 8, NULL),
  ('fc000001-0000-0000-0000-000000000003', u_me, '2026-02-23', 'America/New_York', 9, 2, 3, 9, 'Great sleep, feeling fresh'),
  ('fc000001-0000-0000-0000-000000000004', u_me, '2026-02-24', 'America/New_York', 7, 4, 4, 8, 'Long run + upper — big day'),
  ('fc000001-0000-0000-0000-000000000005', u_me, '2026-02-25', 'America/New_York', 6, 6, 3, 7, NULL),
  ('fc000001-0000-0000-0000-000000000006', u_me, '2026-02-26', 'America/New_York', 8, 5, 2, 8, NULL),
  ('fc000001-0000-0000-0000-000000000007', u_me, '2026-02-27', 'America/New_York', 8, 3, 3, 9, 'Ready to train')
ON CONFLICT (user_id, checkin_date) DO UPDATE SET
  sleep_quality = EXCLUDED.sleep_quality,
  soreness      = EXCLUDED.soreness,
  motivation    = EXCLUDED.motivation,
  notes         = EXCLUDED.notes;

INSERT INTO fatigue_daily_scores (id, user_id, score_date, timezone, fatigue_score, load_subscore, recovery_subscore, performance_subscore, strain, session_load_today, avg_load_7d, avg_load_28d, performance_delta, inputs, recommendation, confidence, computed_at)
VALUES
  ('f5000001-0000-0000-0000-000000000001', u_me, '2026-02-21','America/New_York', 63, 68, 62, 60, 85.0,  95.0, 175.0, 152.0, -0.04, '{"sleep_quality":7,"soreness":5,"stress":4,"motivation":7}'::JSONB, 'light',    'medium', '2026-02-21 23:30:00+00'),
  ('f5000001-0000-0000-0000-000000000002', u_me, '2026-02-22','America/New_York', 72, 62, 74, 78, 0.0,   0.0,  165.0, 151.0,  0.02, '{"sleep_quality":8,"soreness":4,"stress":3,"motivation":8}'::JSONB, 'moderate', 'high',   '2026-02-22 23:30:00+00'),
  ('f5000001-0000-0000-0000-000000000003', u_me, '2026-02-23','America/New_York', 78, 55, 80, 82, 0.0,   0.0,  155.0, 150.0,  0.05, '{"sleep_quality":9,"soreness":2,"stress":3,"motivation":9}'::JSONB, 'train',    'high',   '2026-02-23 23:30:00+00'),
  ('f5000001-0000-0000-0000-000000000004', u_me, '2026-02-24','America/New_York', 68, 78, 66, 72, 305.0, 305.0,165.0, 152.0,  0.01, '{"sleep_quality":7,"soreness":4,"stress":4,"motivation":8}'::JSONB, 'moderate', 'high',   '2026-02-24 23:30:00+00'),
  ('f5000001-0000-0000-0000-000000000005', u_me, '2026-02-25','America/New_York', 65, 80, 60, 68, 120.0, 120.0,178.0, 155.0, -0.03, '{"sleep_quality":6,"soreness":6,"stress":3,"motivation":7}'::JSONB, 'light',    'medium', '2026-02-25 23:30:00+00'),
  ('f5000001-0000-0000-0000-000000000006', u_me, '2026-02-26','America/New_York', 71, 72, 70, 74, 0.0,   0.0,  172.0, 154.0,  0.01, '{"sleep_quality":8,"soreness":5,"stress":2,"motivation":8}'::JSONB, 'moderate', 'high',   '2026-02-26 23:30:00+00'),
  ('f5000001-0000-0000-0000-000000000007', u_me, '2026-02-27','America/New_York', 75, 65, 78, 80, 0.0,   0.0,  168.0, 153.0,  0.03, '{"sleep_quality":8,"soreness":3,"stress":3,"motivation":9}'::JSONB, 'train',    'high',   '2026-02-27 12:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 12. ACCOUNTABILITY POD
--     Trigger auto-adds creator (u_me) as first member, so only add buddies.
-- ============================================================================
INSERT INTO accountability_pods (id, creator_id, name, description)
VALUES (v_pod_id, u_me, 'Iron Circle', 'Small crew keeping each other accountable. No rest days… well, maybe one.')
ON CONFLICT (id) DO NOTHING;

-- Add buddy members (creator already added by trigger)
INSERT INTO pod_members (id, pod_id, user_id, status, joined_at)
VALUES
  ('d4000001-0000-0000-0000-000000000001', v_pod_id, u_alex,   'active', NOW() - INTERVAL '45 days'),
  ('d4000001-0000-0000-0000-000000000002', v_pod_id, u_sam,    'active', NOW() - INTERVAL '40 days'),
  ('d4000001-0000-0000-0000-000000000003', v_pod_id, u_jordan, 'active', NOW() - INTERVAL '38 days')
ON CONFLICT (pod_id, user_id) DO NOTHING;

-- Weekly commitments (this week: Feb 23)
INSERT INTO pod_commitments (id, pod_id, user_id, workouts_per_week, week_start_date)
VALUES
  ('d5000001-0000-0000-0000-000000000001', v_pod_id, u_me,     4, get_week_start()),
  ('d5000001-0000-0000-0000-000000000002', v_pod_id, u_alex,   5, get_week_start()),
  ('d5000001-0000-0000-0000-000000000003', v_pod_id, u_sam,    3, get_week_start()),
  ('d5000001-0000-0000-0000-000000000004', v_pod_id, u_jordan, 3, get_week_start())
ON CONFLICT (pod_id, user_id, week_start_date) DO NOTHING;

-- Pod messages (encouragement)
INSERT INTO pod_messages (id, pod_id, sender_id, recipient_id, message, created_at)
VALUES
  ('d6000001-0000-0000-0000-000000000001', v_pod_id, u_alex,   NULL,    '🔥 Great volume week everyone — lets keep the streak going!', NOW() - INTERVAL '2 days'),
  ('d6000001-0000-0000-0000-000000000002', v_pod_id, u_me,     NULL,    'Long run done ✅ 12km at 5:57/km. Legs are feeling it but worth it.', NOW() - INTERVAL '3 days'),
  ('d6000001-0000-0000-0000-000000000003', v_pod_id, u_sam,    u_me,    'That long run was insane 👏 how is your knee holding up?', NOW() - INTERVAL '3 days' + INTERVAL '20 min'),
  ('d6000001-0000-0000-0000-000000000004', v_pod_id, u_me,     u_sam,   'Knee is good! Took it nice and slow in z2 the whole way.', NOW() - INTERVAL '3 days' + INTERVAL '35 min'),
  ('d6000001-0000-0000-0000-000000000005', v_pod_id, u_jordan, NULL,    'Missed Tuesday but hitting it tonight — extra set for penance 💪', NOW() - INTERVAL '1 day'),
  ('d6000001-0000-0000-0000-000000000006', v_pod_id, u_alex,   u_jordan,'Extra set AND post-workout protein or it doesn''t count 😂', NOW() - INTERVAL '23 hours')
ON CONFLICT (id) DO NOTHING;

-- Pod challenges
-- Active: Volume challenge (this week, Feb 23–Mar 01)
INSERT INTO pod_challenges (id, pod_id, name, challenge_type, start_date, end_date, target_value, created_by)
VALUES
  (ch_vol_id, v_pod_id, 'Weekly Volume Kings', 'volume', '2026-02-23', '2026-03-01', 50000, u_alex),
  (ch_con_id, v_pod_id, 'February Consistency', 'consistency', '2026-02-02', '2026-02-08', 4, u_me)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 13. MARKETPLACE — template saves + reviews on public template (t_pub)
-- ============================================================================
INSERT INTO template_saves (id, template_id, user_id, saved_at)
VALUES
  ('e5000001-0000-0000-0000-000000000001', t_pub, u_alex,   NOW() - INTERVAL '5 days'),
  ('e5000001-0000-0000-0000-000000000002', t_pub, u_sam,    NOW() - INTERVAL '3 days'),
  ('e5000001-0000-0000-0000-000000000003', t_pub, u_jordan, NOW() - INTERVAL '1 day')
ON CONFLICT (template_id, user_id) DO NOTHING;

-- Reviews on the public template (reviewer_id = auth.users.id per migration 047)
INSERT INTO template_reviews (id, template_id, reviewer_id, rating, comment, created_at)
VALUES
  ('f0000001-0000-0000-0000-000000000001', t_pub, u_alex,   5, 'Perfect starter push session. Ran this 3× / week for 6 weeks and benched 10 kg more. Highly recommend!', NOW() - INTERVAL '4 days'),
  ('f0000001-0000-0000-0000-000000000002', t_pub, u_sam,    4, 'Great layout, rep targets are sensible. I subbed incline DB for incline barbell — worked fine.', NOW() - INTERVAL '2 days'),
  ('f0000001-0000-0000-0000-000000000003', t_pub, u_jordan, 4, 'Solid beginner template. Would add a warm-up set row for balance but otherwise great.', NOW() - INTERVAL '12 hours')
ON CONFLICT (template_id, reviewer_id) DO NOTHING;

-- ============================================================================
-- 14. SOCIAL — follows + pings
-- ============================================================================
INSERT INTO user_follows (id, follower_id, following_id)
VALUES
  ('fa000001-0000-0000-0000-000000000001', u_me,     u_alex),
  ('fa000001-0000-0000-0000-000000000002', u_me,     u_sam),
  ('fa000001-0000-0000-0000-000000000003', u_me,     u_jordan),
  ('fa000001-0000-0000-0000-000000000004', u_alex,   u_me),
  ('fa000001-0000-0000-0000-000000000005', u_sam,    u_me),
  ('fa000001-0000-0000-0000-000000000006', u_jordan, u_me)
ON CONFLICT (follower_id, following_id) DO NOTHING;

INSERT INTO pings (id, sender_id, recipient_id, message, created_at)
VALUES
  ('fb000001-0000-0000-0000-000000000001', u_alex,   u_me, '💪 Keep it up!',                     NOW() - INTERVAL '6 hours'),
  ('fb000001-0000-0000-0000-000000000002', u_sam,    u_me, '🏃 Great run yesterday!',             NOW() - INTERVAL '3 hours'),
  ('fb000001-0000-0000-0000-000000000003', u_jordan, u_me, 'Your Upper Power numbers are wild 🔥',NOW() - INTERVAL '1 hour'),
  ('fb000001-0000-0000-0000-000000000004', u_me,     u_alex, '💪 Keep it up!',                   NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

RAISE NOTICE '✅ FIT-HUB TEST SEED COMPLETE';
RAISE NOTICE '   Login: testuser@fithub.dev / TestUser123!';
RAISE NOTICE '   4 users | 5 templates (2 training blocks, 2 stale) | 9 sessions | 5 runs';
RAISE NOTICE '   Pod: Iron Circle (4 members, 2 challenges) | Marketplace: 3 saves + 3 reviews';

END $$;
