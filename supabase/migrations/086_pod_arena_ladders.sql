-- Migration 086: Pod Arena Ladders

-- Add arena scoring columns to pods
ALTER TABLE accountability_pods
  ADD COLUMN IF NOT EXISTS arena_level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS season_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_start_date DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_pods_arena_score
  ON accountability_pods(season_score DESC);

-- Arena tier helper (Bronze: 0-99, Silver: 100-299, Gold: 300-599, Platinum: 600+)
CREATE OR REPLACE FUNCTION get_arena_tier(score INTEGER)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN score >= 600 THEN 'platinum'
    WHEN score >= 300 THEN 'gold'
    WHEN score >= 100 THEN 'silver'
    ELSE 'bronze'
  END;
$$;

-- Award points to a pod
CREATE OR REPLACE FUNCTION award_pod_season_points(
  p_pod_id UUID,
  p_points INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE accountability_pods
  SET
    season_score = season_score + p_points,
    arena_level = CASE
      WHEN season_score + p_points >= 600 THEN 4
      WHEN season_score + p_points >= 300 THEN 3
      WHEN season_score + p_points >= 100 THEN 2
      ELSE 1
    END,
    updated_at = NOW()
  WHERE id = p_pod_id;
$$;

GRANT EXECUTE ON FUNCTION award_pod_season_points(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_arena_tier(INTEGER) TO authenticated;

-- Pod season recaps table
CREATE TABLE IF NOT EXISTS pod_season_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES accountability_pods(id) ON DELETE CASCADE,
  recap_date DATE NOT NULL,
  summary TEXT NOT NULL,
  mvp_user_id UUID REFERENCES profiles(id),
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pod_id, recap_date)
);

ALTER TABLE pod_season_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pod members can read recaps"
  ON pod_season_recaps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pod_members pm
      WHERE pm.pod_id = pod_season_recaps.pod_id
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
    )
  );

-- Auto-scoring trigger: award points when workout sessions complete
CREATE OR REPLACE FUNCTION handle_workout_session_for_arena()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pod_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    -- 5 points per completed session to each pod
    FOR v_pod_id IN
      SELECT pm.pod_id FROM pod_members pm
      WHERE pm.user_id = NEW.user_id AND pm.status = 'active'
    LOOP
      PERFORM award_pod_season_points(v_pod_id, 5, 'workout_completed');
    END LOOP;

    -- Bonus 20 points for streak saves (critical alert today + session completed)
    IF EXISTS (
      SELECT 1 FROM streak_risk_alerts sra
      WHERE sra.user_id = NEW.user_id
        AND sra.risk_level = 'critical'
        AND sra.alert_date = CURRENT_DATE
    ) THEN
      FOR v_pod_id IN
        SELECT pm.pod_id FROM pod_members pm
        WHERE pm.user_id = NEW.user_id AND pm.status = 'active'
      LOOP
        PERFORM award_pod_season_points(v_pod_id, 20, 'streak_save_bonus');
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workout_arena_scoring ON workout_sessions;
CREATE TRIGGER trg_workout_arena_scoring
  AFTER INSERT OR UPDATE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION handle_workout_session_for_arena();
