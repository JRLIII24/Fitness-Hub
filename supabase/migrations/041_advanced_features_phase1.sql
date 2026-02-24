-- ============================================================================
-- Migration 041: Advanced Features Phase 1 – Data Layer & Platform Foundations
-- Covers:
--   1.1  Schema enhancements: template marketplace + pod challenges
--   1.2  Security & access control (RLS)
--   1.3  Aggregation & leaderboard logic (PostgreSQL RPC)
-- ============================================================================

-- ============================================================================
-- 1.1  SCHEMA ENHANCEMENTS
-- ============================================================================

-- ── workout_templates: add marketplace columns ─────────────────────────────
ALTER TABLE workout_templates
  ADD COLUMN IF NOT EXISTS is_public   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS save_count  INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN workout_templates.is_public  IS 'Whether this template is published to the community marketplace.';
COMMENT ON COLUMN workout_templates.save_count IS 'Denormalised count of saves; maintained by trg_template_save_count trigger.';

-- Index: fast marketplace browsing (top templates by popularity)
CREATE INDEX IF NOT EXISTS idx_workout_templates_marketplace
  ON workout_templates (save_count DESC)
  WHERE is_public = true;

-- ── template_saves: tracks which user saved which public template ───────────
CREATE TABLE IF NOT EXISTS template_saves (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID        NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id)           ON DELETE CASCADE,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_template_save UNIQUE (template_id, user_id)
);

COMMENT ON TABLE template_saves IS 'Records each user''s saved/imported public templates for trending and personalisation.';

CREATE INDEX IF NOT EXISTS idx_template_saves_user     ON template_saves (user_id,     saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_saves_template ON template_saves (template_id, saved_at DESC);

-- ── pod_challenges: weekly competitive challenges within a pod ─────────────
CREATE TABLE IF NOT EXISTS pod_challenges (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id         UUID          NOT NULL REFERENCES accountability_pods(id) ON DELETE CASCADE,
  name           TEXT          NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  challenge_type TEXT          NOT NULL CHECK (challenge_type IN ('volume', 'consistency', 'distance')),
  start_date     DATE          NOT NULL,
  end_date       DATE          NOT NULL,
  -- Optional goal (e.g. 10 000 kg, 5 sessions, 50 km); NULL = open-ended
  target_value   NUMERIC(10,2),
  created_by     UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT chk_challenge_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE  pod_challenges                    IS 'Time-boxed competitive challenges within an accountability pod.';
COMMENT ON COLUMN pod_challenges.challenge_type     IS 'volume = kg lifted | consistency = session count | distance = km run.';
COMMENT ON COLUMN pod_challenges.target_value       IS 'Optional per-member goal. Unit depends on challenge_type.';

-- Indexes: active challenges per pod + historic lookup
CREATE INDEX IF NOT EXISTS idx_pod_challenges_pod_end
  ON pod_challenges (pod_id, end_date DESC);

-- Index for listing challenges by pod ordered by start date
CREATE INDEX IF NOT EXISTS idx_pod_challenges_active
  ON pod_challenges (pod_id, start_date);


-- ============================================================================
-- 1.1 TRIGGER: maintain save_count on template_saves inserts / deletes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_template_save_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE workout_templates
       SET save_count = save_count + 1
     WHERE id = NEW.template_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE workout_templates
       SET save_count = GREATEST(save_count - 1, 0)
     WHERE id = OLD.template_id;
  END IF;

  RETURN NULL; -- AFTER trigger; return value ignored for row triggers
END;
$$;

DROP TRIGGER IF EXISTS trg_template_save_count ON template_saves;
CREATE TRIGGER trg_template_save_count
  AFTER INSERT OR DELETE ON template_saves
  FOR EACH ROW EXECUTE FUNCTION update_template_save_count();


-- ============================================================================
-- 1.2  SECURITY & ACCESS CONTROL (RLS)
-- ============================================================================

-- ── workout_templates: extend read policy for marketplace ─────────────────
-- Replace the existing owner-only SELECT policy with one that also exposes
-- public templates to all authenticated users.

DROP POLICY IF EXISTS "Users can read own templates" ON workout_templates;

CREATE POLICY "Users can read own or public templates"
  ON workout_templates FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id   -- owner: always visible
    OR is_public = true    -- marketplace: visible to everyone
  );

-- Existing INSERT / UPDATE / DELETE policies on workout_templates are unchanged:
--   owners retain full CRUD on their own rows, including toggling is_public.

-- ── template_exercises: extend read policy to cover public templates ───────
DROP POLICY IF EXISTS "Users can read own template exercises" ON template_exercises;

CREATE POLICY "Users can read own or public template exercises"
  ON template_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   workout_templates wt
      WHERE  wt.id = template_exercises.template_id
        AND  (wt.user_id = auth.uid() OR wt.is_public = true)
    )
  );

-- ── template_saves: RLS ────────────────────────────────────────────────────
ALTER TABLE template_saves ENABLE ROW LEVEL SECURITY;

-- Users see only their own saves
CREATE POLICY "Users can read own template saves"
  ON template_saves FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can save only public templates they don't own
CREATE POLICY "Users can save public templates"
  ON template_saves FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM   workout_templates wt
      WHERE  wt.id = template_saves.template_id
        AND  wt.is_public = true
        AND  wt.user_id  <> auth.uid()   -- cannot save own templates
    )
  );

-- Users can unsave any template they previously saved
CREATE POLICY "Users can unsave templates"
  ON template_saves FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── pod_challenges: RLS ────────────────────────────────────────────────────
ALTER TABLE pod_challenges ENABLE ROW LEVEL SECURITY;

-- Active pod members can read challenges in their pods
CREATE POLICY "Pod members can read challenges"
  ON pod_challenges FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   pod_members pm
      WHERE  pm.pod_id  = pod_challenges.pod_id
        AND  pm.user_id = auth.uid()
        AND  pm.status  = 'active'
    )
  );

-- Any active pod member can create a challenge (creator is recorded)
CREATE POLICY "Pod members can create challenges"
  ON pod_challenges FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM   pod_members pm
      WHERE  pm.pod_id  = pod_challenges.pod_id
        AND  pm.user_id = auth.uid()
        AND  pm.status  = 'active'
    )
  );

-- Only the creator can edit the challenge definition
CREATE POLICY "Challenge creators can update challenges"
  ON pod_challenges FOR UPDATE TO authenticated
  USING  (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Only the creator can delete
CREATE POLICY "Challenge creators can delete challenges"
  ON pod_challenges FOR DELETE TO authenticated
  USING (auth.uid() = created_by);


-- ============================================================================
-- 1.3  AGGREGATION & LEADERBOARD LOGIC
-- ============================================================================

-- ── Supporting indexes ──────────────────────────────────────────────────────
-- Partial indexes on completed rows dramatically reduce scan cost for
-- leaderboard aggregations bounded by a date range.

CREATE INDEX IF NOT EXISTS idx_workout_sessions_leaderboard
  ON workout_sessions (user_id, completed_at, total_volume_kg)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_run_sessions_leaderboard
  ON run_sessions (user_id, completed_at, distance_meters)
  WHERE status = 'completed';

-- ── RPC: get_pod_challenge_leaderboard ─────────────────────────────────────
--
-- Returns ranked member scores for a given pod challenge.
--
-- Score units:
--   volume      → kg  (NUMERIC, 2 dp)
--   consistency → session count (NUMERIC whole)
--   distance    → km  (NUMERIC, 2 dp)
--
-- Performance profile (pod size ≤ 8, typical challenge window ≤ 14 days):
--   • Partial index scan on (user_id, completed_at) ≈ sub-millisecond per member
--   • RANK() window function over ≤ 8 rows is negligible
--   • Total expected execution: < 5 ms at current pod sizes
--
-- Scalability note: if pod size grows beyond 20 or challenge windows exceed
-- 90 days, consider a MATERIALIZED VIEW refreshed via pg_cron every 15 min:
--   CREATE MATERIALIZED VIEW mv_challenge_scores AS <aggregation>;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_challenge_scores;

CREATE OR REPLACE FUNCTION get_pod_challenge_leaderboard(p_challenge_id UUID)
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  avatar_url   TEXT,
  score        NUMERIC,
  rank         BIGINT,
  workouts_cnt INTEGER,
  runs_cnt     INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pod_id UUID;
  v_type   TEXT;
  v_start  TIMESTAMPTZ;
  v_end    TIMESTAMPTZ; -- exclusive upper bound (end_date + 1 day)
BEGIN
  -- ── 1. Load challenge metadata ───────────────────────────────────────────
  SELECT
    c.pod_id,
    c.challenge_type,
    c.start_date::TIMESTAMPTZ,
    (c.end_date + INTERVAL '1 day')::TIMESTAMPTZ
  INTO v_pod_id, v_type, v_start, v_end
  FROM pod_challenges c
  WHERE c.id = p_challenge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge % not found', p_challenge_id;
  END IF;

  -- ── 2. Authorization: caller must be an active member of the pod ─────────
  IF NOT EXISTS (
    SELECT 1
    FROM   pod_members pm
    WHERE  pm.pod_id  = v_pod_id
      AND  pm.user_id = auth.uid()
      AND  pm.status  = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not an active member of pod %', v_pod_id;
  END IF;

  -- ── 3. Branch by challenge type ──────────────────────────────────────────

  -- VOLUME: total kg lifted in completed workout sessions
  IF v_type = 'volume' THEN
    RETURN QUERY
    SELECT
      pm.user_id,
      p.display_name,
      p.avatar_url,
      ROUND(COALESCE(SUM(ws.total_volume_kg), 0), 2)                       AS score,
      RANK() OVER (ORDER BY COALESCE(SUM(ws.total_volume_kg), 0) DESC)     AS rank,
      COUNT(DISTINCT ws.id)::INTEGER                                        AS workouts_cnt,
      0::INTEGER                                                            AS runs_cnt
    FROM   pod_members pm
    JOIN   profiles p ON p.id = pm.user_id
    LEFT   JOIN workout_sessions ws
      ON   ws.user_id      = pm.user_id
      AND  ws.status       = 'completed'
      AND  ws.completed_at >= v_start
      AND  ws.completed_at <  v_end
    WHERE  pm.pod_id = v_pod_id AND pm.status = 'active'
    GROUP  BY pm.user_id, p.display_name, p.avatar_url
    ORDER  BY rank;

  -- CONSISTENCY: total sessions completed (workouts + runs combined)
  ELSIF v_type = 'consistency' THEN
    RETURN QUERY
    WITH member_ids AS (
      SELECT pm2.user_id
      FROM   pod_members pm2
      WHERE  pm2.pod_id = v_pod_id AND pm2.status = 'active'
    ),
    workout_counts AS (
      SELECT ws.user_id, COUNT(*)::INTEGER AS cnt
      FROM   workout_sessions ws
      JOIN   member_ids m ON m.user_id = ws.user_id
      WHERE  ws.status       = 'completed'
        AND  ws.completed_at >= v_start
        AND  ws.completed_at <  v_end
      GROUP  BY ws.user_id
    ),
    run_counts AS (
      SELECT rs.user_id, COUNT(*)::INTEGER AS cnt
      FROM   run_sessions rs
      JOIN   member_ids m ON m.user_id = rs.user_id
      WHERE  rs.status       = 'completed'
        AND  rs.completed_at >= v_start
        AND  rs.completed_at <  v_end
      GROUP  BY rs.user_id
    )
    SELECT
      pm.user_id,
      p.display_name,
      p.avatar_url,
      (COALESCE(w.cnt, 0) + COALESCE(r.cnt, 0))::NUMERIC                  AS score,
      RANK() OVER (ORDER BY (COALESCE(w.cnt, 0) + COALESCE(r.cnt, 0)) DESC) AS rank,
      COALESCE(w.cnt, 0)                                                    AS workouts_cnt,
      COALESCE(r.cnt, 0)                                                    AS runs_cnt
    FROM   pod_members pm
    JOIN   profiles p   ON p.id = pm.user_id
    LEFT   JOIN workout_counts w ON w.user_id = pm.user_id
    LEFT   JOIN run_counts     r ON r.user_id = pm.user_id
    WHERE  pm.pod_id = v_pod_id AND pm.status = 'active'
    ORDER  BY rank;

  -- DISTANCE: total kilometres covered in completed run sessions
  ELSIF v_type = 'distance' THEN
    RETURN QUERY
    SELECT
      pm.user_id,
      p.display_name,
      p.avatar_url,
      ROUND(COALESCE(SUM(rs.distance_meters), 0) / 1000.0, 2)              AS score,
      RANK() OVER (ORDER BY COALESCE(SUM(rs.distance_meters), 0) DESC)     AS rank,
      0::INTEGER                                                            AS workouts_cnt,
      COUNT(DISTINCT rs.id)::INTEGER                                        AS runs_cnt
    FROM   pod_members pm
    JOIN   profiles p ON p.id = pm.user_id
    LEFT   JOIN run_sessions rs
      ON   rs.user_id      = pm.user_id
      AND  rs.status       = 'completed'
      AND  rs.completed_at >= v_start
      AND  rs.completed_at <  v_end
    WHERE  pm.pod_id = v_pod_id AND pm.status = 'active'
    GROUP  BY pm.user_id, p.display_name, p.avatar_url
    ORDER  BY rank;

  ELSE
    RAISE EXCEPTION 'Unknown challenge_type "%". Valid values: volume, consistency, distance', v_type;
  END IF;
END;
$$;

-- Grant execute to authenticated role; SECURITY DEFINER handles internal auth
GRANT EXECUTE ON FUNCTION get_pod_challenge_leaderboard(UUID) TO authenticated;
