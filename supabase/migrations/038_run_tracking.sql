-- ============================================================================
-- Migration 038: Hybrid Run Tracking System
-- Tracks GPS runs with splits, intensity zones, and fatigue integration.
-- All distances stored in meters (canonical). Pace stored in seconds/km.
-- ============================================================================

-- Run tag/type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_tag') THEN
    CREATE TYPE run_tag AS ENUM (
      'recovery',
      'conditioning',
      'hiit',
      'speed_work',
      'game_prep',
      'long_run',
      'tempo',
      'easy'
    );
  END IF;
END $$;

-- Intensity zone enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_intensity_zone') THEN
    CREATE TYPE run_intensity_zone AS ENUM (
      'zone1_active_recovery',
      'zone2_aerobic',
      'zone3_tempo',
      'zone4_threshold',
      'zone5_anaerobic'
    );
  END IF;
END $$;

-- Run session status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status') THEN
    CREATE TYPE run_status AS ENUM ('in_progress', 'paused', 'completed', 'cancelled');
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: run_sessions
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS run_sessions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  name                      TEXT NOT NULL,
  status                    run_status NOT NULL DEFAULT 'in_progress',
  tag                       run_tag,
  notes                     TEXT,

  started_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at              TIMESTAMPTZ,
  duration_seconds          INTEGER,
  moving_duration_seconds   INTEGER,

  distance_meters           NUMERIC(10, 2),
  avg_pace_sec_per_km       NUMERIC(8, 2),
  best_pace_sec_per_km      NUMERIC(8, 2),

  elevation_gain_m          NUMERIC(8, 2),
  elevation_loss_m          NUMERIC(8, 2),

  avg_cadence_spm           NUMERIC(6, 2),

  estimated_calories        INTEGER,
  session_rpe               NUMERIC(3, 1) CHECK (session_rpe >= 0 AND session_rpe <= 10),
  estimated_vo2max          NUMERIC(6, 3),

  session_load              NUMERIC(10, 2),

  zone_breakdown            JSONB NOT NULL DEFAULT '{}'::jsonb,
  primary_zone              run_intensity_zone,

  route_polyline            TEXT,
  is_treadmill              BOOLEAN NOT NULL DEFAULT false,
  map_bbox                  JSONB,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_run_sessions_user_started
  ON run_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_run_sessions_user_status
  ON run_sessions(user_id, status);

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: run_splits
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS run_splits (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_session_id            UUID NOT NULL REFERENCES run_sessions(id) ON DELETE CASCADE,
  user_id                   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  split_number              SMALLINT NOT NULL,
  split_distance_meters     NUMERIC(8, 2) NOT NULL,

  duration_seconds          INTEGER NOT NULL,
  pace_sec_per_km           NUMERIC(8, 2) NOT NULL,

  elevation_gain_m          NUMERIC(8, 2),
  elevation_loss_m          NUMERIC(8, 2),

  zone                      run_intensity_zone,

  lat                       DOUBLE PRECISION,
  lng                       DOUBLE PRECISION,

  started_at                TIMESTAMPTZ NOT NULL,
  completed_at              TIMESTAMPTZ NOT NULL,

  CONSTRAINT uq_run_splits_session_number UNIQUE(run_session_id, split_number)
);

CREATE INDEX IF NOT EXISTS idx_run_splits_session
  ON run_splits(run_session_id, split_number);

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: run_metrics (weekly rollup)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS run_metrics (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  week_start_date           DATE NOT NULL,

  total_distance_meters     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_duration_seconds    INTEGER NOT NULL DEFAULT 0,
  total_runs                SMALLINT NOT NULL DEFAULT 0,

  run_load_this_week        NUMERIC(10, 2),
  lift_load_this_week       NUMERIC(10, 2),
  combined_load             NUMERIC(10, 2),

  estimated_vo2max          NUMERIC(6, 3),

  computed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_run_metrics_user_week UNIQUE(user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_run_metrics_user_week
  ON run_metrics(user_id, week_start_date DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- Extend active_workout_sessions with run_session_id
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE active_workout_sessions
  ADD COLUMN IF NOT EXISTS run_session_id UUID REFERENCES run_sessions(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS: run_sessions
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE run_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'run_sessions'
    AND policyname = 'Users read own run sessions'
  ) THEN
    CREATE POLICY "Users read own run sessions"
      ON run_sessions FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'run_sessions'
    AND policyname = 'Users insert own run sessions'
  ) THEN
    CREATE POLICY "Users insert own run sessions"
      ON run_sessions FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'run_sessions'
    AND policyname = 'Users update own run sessions'
  ) THEN
    CREATE POLICY "Users update own run sessions"
      ON run_sessions FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'run_sessions'
    AND policyname = 'Users delete own run sessions'
  ) THEN
    CREATE POLICY "Users delete own run sessions"
      ON run_sessions FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS: run_splits
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE run_splits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'run_splits'
    AND policyname = 'Users read own run splits'
  ) THEN
    CREATE POLICY "Users read own run splits"
      ON run_splits FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'run_splits'
    AND policyname = 'Users insert own run splits'
  ) THEN
    CREATE POLICY "Users insert own run splits"
      ON run_splits FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'run_splits'
    AND policyname = 'Users update own run splits'
  ) THEN
    CREATE POLICY "Users update own run splits"
      ON run_splits FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'run_splits'
    AND policyname = 'Users delete own run splits'
  ) THEN
    CREATE POLICY "Users delete own run splits"
      ON run_splits FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS: run_metrics
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE run_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'run_metrics'
    AND policyname = 'Users manage own run metrics'
  ) THEN
    CREATE POLICY "Users manage own run metrics"
      ON run_metrics FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
