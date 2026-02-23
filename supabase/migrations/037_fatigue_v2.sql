-- 037_fatigue_v2.sql

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT;
COMMENT ON COLUMN profiles.timezone IS 'IANA timezone string (e.g., America/Los_Angeles) for daily boundaries';

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS session_rpe NUMERIC(3,1)
  CHECK (session_rpe >= 0 AND session_rpe <= 10);
COMMENT ON COLUMN workout_sessions.session_rpe IS 'Session RPE (0-10), used with duration to estimate internal load';

ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS rir SMALLINT
  CHECK (rir >= 0 AND rir <= 10);
COMMENT ON COLUMN workout_sets.rir IS 'Reps in reserve (optional), for effort-adjusted performance trend';

CREATE TABLE IF NOT EXISTS fatigue_daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  timezone TEXT NOT NULL,
  sleep_quality SMALLINT NOT NULL CHECK (sleep_quality BETWEEN 0 AND 10),
  soreness SMALLINT NOT NULL CHECK (soreness BETWEEN 0 AND 10),
  stress SMALLINT NOT NULL CHECK (stress BETWEEN 0 AND 10),
  motivation SMALLINT NOT NULL CHECK (motivation BETWEEN 0 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fatigue_daily_checkins_user_day UNIQUE(user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_fatigue_daily_checkins_user_day
  ON fatigue_daily_checkins(user_id, checkin_date DESC);

ALTER TABLE fatigue_daily_checkins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fatigue_daily_checkins' AND policyname = 'Users read own fatigue checkins'
  ) THEN
    CREATE POLICY "Users read own fatigue checkins"
      ON fatigue_daily_checkins FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fatigue_daily_checkins' AND policyname = 'Users insert own fatigue checkins'
  ) THEN
    CREATE POLICY "Users insert own fatigue checkins"
      ON fatigue_daily_checkins FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fatigue_daily_checkins' AND policyname = 'Users update own fatigue checkins'
  ) THEN
    CREATE POLICY "Users update own fatigue checkins"
      ON fatigue_daily_checkins FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS fatigue_daily_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score_date DATE NOT NULL,
  timezone TEXT NOT NULL,
  fatigue_score SMALLINT NOT NULL CHECK (fatigue_score BETWEEN 0 AND 100),
  load_subscore SMALLINT NOT NULL CHECK (load_subscore BETWEEN 0 AND 100),
  recovery_subscore SMALLINT NOT NULL CHECK (recovery_subscore BETWEEN 0 AND 100),
  performance_subscore SMALLINT NOT NULL CHECK (performance_subscore BETWEEN 0 AND 100),
  strain NUMERIC(8,4),
  session_load_today NUMERIC(10,2),
  avg_load_7d NUMERIC(10,2),
  avg_load_28d NUMERIC(10,2),
  performance_delta NUMERIC(8,4),
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('low','medium','high')),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fatigue_daily_scores_user_day UNIQUE(user_id, score_date)
);

CREATE INDEX IF NOT EXISTS idx_fatigue_daily_scores_user_day
  ON fatigue_daily_scores(user_id, score_date DESC);

ALTER TABLE fatigue_daily_scores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fatigue_daily_scores' AND policyname = 'Users read own fatigue scores'
  ) THEN
    CREATE POLICY "Users read own fatigue scores"
      ON fatigue_daily_scores FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fatigue_daily_scores' AND policyname = 'Service insert fatigue scores'
  ) THEN
    CREATE POLICY "Service insert fatigue scores"
      ON fatigue_daily_scores FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fatigue_daily_scores' AND policyname = 'Service update fatigue scores'
  ) THEN
    CREATE POLICY "Service update fatigue scores"
      ON fatigue_daily_scores FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_fatigue_checkin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fatigue_checkin_updated_at ON fatigue_daily_checkins;
CREATE TRIGGER trg_fatigue_checkin_updated_at
BEFORE UPDATE ON fatigue_daily_checkins
FOR EACH ROW
EXECUTE FUNCTION set_fatigue_checkin_updated_at();
