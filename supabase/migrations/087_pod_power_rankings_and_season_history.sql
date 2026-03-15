-- ============================================================================
-- Migration 087: Pod Power Rankings + Season History
-- ============================================================================

-- ── Power Rankings (ELO-style weekly ratings) ──────────────────────────────

CREATE TABLE IF NOT EXISTS pod_power_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES accountability_pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1000,
  delta INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pod_id, user_id, week_start)
);

-- RLS
ALTER TABLE pod_power_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pod_power_ratings_read"
  ON pod_power_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = pod_power_ratings.pod_id
        AND pod_members.user_id = auth.uid()
        AND pod_members.status = 'active'
    )
  );

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_pod_power_ratings_pod_week
  ON pod_power_ratings(pod_id, week_start DESC);


-- ── Season History (archived completed seasons) ────────────────────────────

CREATE TABLE IF NOT EXISTS pod_season_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES accountability_pods(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL DEFAULT 1,
  season_start DATE NOT NULL,
  season_end DATE NOT NULL,
  final_tier TEXT NOT NULL,
  final_score INTEGER NOT NULL DEFAULT 0,
  mvp_user_id UUID REFERENCES profiles(id),
  total_workouts INTEGER NOT NULL DEFAULT 0,
  total_members INTEGER NOT NULL DEFAULT 0,
  highlights JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE pod_season_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pod_season_history_read"
  ON pod_season_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = pod_season_history.pod_id
        AND pod_members.user_id = auth.uid()
        AND pod_members.status = 'active'
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_pod_season_history_pod
  ON pod_season_history(pod_id, season_end DESC);


-- ── RPC: Calculate and store weekly power ratings ──────────────────────────

CREATE OR REPLACE FUNCTION calculate_pod_power_ratings(p_pod_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_week_start DATE;
  v_member RECORD;
  v_prev_rating INTEGER;
  v_delta INTEGER;
  v_commitment INTEGER;
  v_completed INTEGER;
  v_streak INTEGER;
BEGIN
  -- Current week start (Monday)
  v_week_start := date_trunc('week', CURRENT_DATE)::date;

  FOR v_member IN
    SELECT pm.user_id
    FROM pod_members pm
    WHERE pm.pod_id = p_pod_id AND pm.status = 'active'
  LOOP
    -- Get previous rating (default 1000)
    SELECT COALESCE(
      (SELECT rating FROM pod_power_ratings
       WHERE pod_id = p_pod_id AND user_id = v_member.user_id
       ORDER BY week_start DESC LIMIT 1),
      1000
    ) INTO v_prev_rating;

    -- Get commitment for this week
    SELECT COALESCE(workouts_per_week, 0) INTO v_commitment
    FROM pod_commitments
    WHERE pod_id = p_pod_id
      AND user_id = v_member.user_id
      AND week_start_date = v_week_start;

    -- Count completed workouts this week
    SELECT COUNT(*) INTO v_completed
    FROM workout_sessions
    WHERE user_id = v_member.user_id
      AND status = 'completed'
      AND started_at >= v_week_start
      AND started_at < v_week_start + interval '7 days';

    -- Calculate delta
    v_delta := 0;

    IF v_commitment > 0 AND v_completed >= v_commitment THEN
      v_delta := v_delta + 15; -- Met commitment
    ELSIF v_completed = 0 THEN
      v_delta := v_delta - 20; -- Zero workouts
    END IF;

    -- Streak bonus (simplified: check if they met last week too)
    IF EXISTS (
      SELECT 1 FROM pod_power_ratings
      WHERE pod_id = p_pod_id
        AND user_id = v_member.user_id
        AND week_start = v_week_start - interval '7 days'
        AND delta > 0
    ) THEN
      v_delta := v_delta + 5;
    END IF;

    -- Insert or update
    INSERT INTO pod_power_ratings (pod_id, user_id, week_start, rating, delta)
    VALUES (p_pod_id, v_member.user_id, v_week_start, v_prev_rating + v_delta, v_delta)
    ON CONFLICT (pod_id, user_id, week_start)
    DO UPDATE SET rating = v_prev_rating + v_delta, delta = v_delta;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_pod_power_ratings(UUID) TO service_role;
