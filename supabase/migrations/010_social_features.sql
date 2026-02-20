-- Migration 010: Social Features
-- Adds user discovery, template sharing, presence, and pings

-- ============================================================
-- 1. profiles — add social columns (opt-in privacy)
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- ============================================================
-- 2. workout_templates — mark as shareable
-- ============================================================
ALTER TABLE workout_templates
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 3. user_follows — follow / friend connections
-- ============================================================
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_follow UNIQUE (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- ============================================================
-- 4. pings — encouragement messages
-- ============================================================
CREATE TABLE IF NOT EXISTS pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '💪 Keep it up!',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pings_recipient ON pings(recipient_id, created_at DESC);

-- ============================================================
-- 5. RLS policies
-- ============================================================

-- profiles: public profiles readable by all authenticated users
-- (Drop existing policy if it exists to avoid conflicts)
DROP POLICY IF EXISTS "Public profiles are readable" ON profiles;
CREATE POLICY "Public profiles are readable"
  ON profiles FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = id);

-- workout_templates: shared templates readable by all authenticated users
DROP POLICY IF EXISTS "Shared templates are readable" ON workout_templates;
CREATE POLICY "Shared templates are readable"
  ON workout_templates FOR SELECT TO authenticated
  USING (is_shared = true OR auth.uid() = user_id);

-- user_follows: enable RLS + policies
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read follows" ON user_follows;
CREATE POLICY "Users can read follows"
  ON user_follows FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can follow" ON user_follows;
CREATE POLICY "Users can follow"
  ON user_follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow" ON user_follows;
CREATE POLICY "Users can unfollow"
  ON user_follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- pings: enable RLS + policies
ALTER TABLE pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sender can send pings" ON pings;
CREATE POLICY "Sender can send pings"
  ON pings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can read own pings" ON pings;
CREATE POLICY "Users can read own pings"
  ON pings FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id OR auth.uid() = sender_id);

DROP POLICY IF EXISTS "Recipient can mark read" ON pings;
CREATE POLICY "Recipient can mark read"
  ON pings FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);
