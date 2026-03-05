-- Migration 067: Remove distance challenge type + simplify leaderboard RPC
-- The run feature was fully removed in March 2026. This cleans up:
--   1. pod_challenges CHECK constraint (drop 'distance')
--   2. idx_run_sessions_leaderboard index (references deleted run_sessions)
--   3. get_pod_challenge_leaderboard RPC (remove distance branch, simplify consistency)

-- 1. Backfill any stale 'distance' rows (safety net)
UPDATE pod_challenges SET challenge_type = 'volume' WHERE challenge_type = 'distance';

-- 2. Drop old CHECK and re-add with only volume | consistency
ALTER TABLE pod_challenges
  DROP CONSTRAINT IF EXISTS pod_challenges_challenge_type_check;

ALTER TABLE pod_challenges
  ADD CONSTRAINT pod_challenges_challenge_type_check
    CHECK (challenge_type IN ('volume', 'consistency'));

-- 3. Drop stale index that referenced run_sessions
DROP INDEX IF EXISTS idx_run_sessions_leaderboard;

-- 4. Update column comment
COMMENT ON COLUMN pod_challenges.challenge_type IS
  'Type of challenge: volume = total kg lifted | consistency = workout count';

-- 5. Replace leaderboard RPC — distance branch removed, consistency simplified to workout-only
CREATE OR REPLACE FUNCTION get_pod_challenge_leaderboard(p_challenge_id UUID)
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  avatar_url   TEXT,
  score        NUMERIC,
  rank         BIGINT,
  workouts_cnt INTEGER,
  runs_cnt     INTEGER  -- kept for API compat, always 0
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pod_id UUID;
  v_type   TEXT;
  v_start  TIMESTAMPTZ;
  v_end    TIMESTAMPTZ;
BEGIN
  SELECT c.pod_id, c.challenge_type,
         c.start_date::TIMESTAMPTZ,
         (c.end_date + INTERVAL '1 day')::TIMESTAMPTZ
  INTO v_pod_id, v_type, v_start, v_end
  FROM pod_challenges c WHERE c.id = p_challenge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge % not found', p_challenge_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pod_members pm
    WHERE pm.pod_id = v_pod_id AND pm.user_id = auth.uid() AND pm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not an active member of pod %', v_pod_id;
  END IF;

  IF v_type = 'volume' THEN
    RETURN QUERY
    SELECT pm.user_id, p.display_name, p.avatar_url,
      ROUND(COALESCE(SUM(ws.total_volume_kg), 0), 2)                    AS score,
      RANK() OVER (ORDER BY COALESCE(SUM(ws.total_volume_kg), 0) DESC)  AS rank,
      COUNT(DISTINCT ws.id)::INTEGER                                     AS workouts_cnt,
      0::INTEGER                                                         AS runs_cnt
    FROM pod_members pm
    JOIN profiles p ON p.id = pm.user_id
    LEFT JOIN workout_sessions ws
      ON ws.user_id = pm.user_id AND ws.status = 'completed'
      AND ws.completed_at >= v_start AND ws.completed_at < v_end
    WHERE pm.pod_id = v_pod_id AND pm.status = 'active'
    GROUP BY pm.user_id, p.display_name, p.avatar_url
    ORDER BY rank;

  ELSIF v_type = 'consistency' THEN
    RETURN QUERY
    SELECT pm.user_id, p.display_name, p.avatar_url,
      COALESCE(COUNT(DISTINCT ws.id), 0)::NUMERIC                       AS score,
      RANK() OVER (ORDER BY COALESCE(COUNT(DISTINCT ws.id), 0) DESC)    AS rank,
      COALESCE(COUNT(DISTINCT ws.id), 0)::INTEGER                       AS workouts_cnt,
      0::INTEGER                                                         AS runs_cnt
    FROM pod_members pm
    JOIN profiles p ON p.id = pm.user_id
    LEFT JOIN workout_sessions ws
      ON ws.user_id = pm.user_id AND ws.status = 'completed'
      AND ws.completed_at >= v_start AND ws.completed_at < v_end
    WHERE pm.pod_id = v_pod_id AND pm.status = 'active'
    GROUP BY pm.user_id, p.display_name, p.avatar_url
    ORDER BY rank;

  ELSE
    RAISE EXCEPTION 'Unknown challenge_type "%". Valid values: volume, consistency', v_type;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pod_challenge_leaderboard(UUID) TO authenticated;
