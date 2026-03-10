-- Migration 077: Global Public Leaderboard RPC
--
-- Introduces get_public_leaderboard() — a SECURITY DEFINER function that ranks
-- users with is_public = true by volume, consistency, or streak across configurable
-- time periods. Mirrors the pod challenge leaderboard pattern from migration 041/067.
--
-- Prerequisites confirmed:
--   profiles.is_public          (migration 010)
--   profiles.current_streak     (migration 015)
--   profiles.display_name / avatar_url (migration 001)
--   workout_sessions.total_volume_kg / status / completed_at (migration 004 + 037)
--   idx_workout_sessions_leaderboard partial index (migration 041)
--   get_week_start() helper     (migration 024)

CREATE OR REPLACE FUNCTION get_public_leaderboard(
  p_metric TEXT,        -- 'volume' | 'consistency' | 'streak'
  p_period TEXT,        -- 'weekly' | 'monthly' | 'all_time'
  p_limit  INT DEFAULT 50
)
RETURNS TABLE (
  rank           BIGINT,
  user_id        UUID,
  display_name   TEXT,
  avatar_url     TEXT,
  score          NUMERIC,
  sessions_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end   TIMESTAMPTZ := NOW();
BEGIN
  -- Input validation
  IF p_metric NOT IN ('volume', 'consistency', 'streak') THEN
    RAISE EXCEPTION 'Invalid metric: %. Must be volume, consistency, or streak.', p_metric;
  END IF;
  IF p_period NOT IN ('weekly', 'monthly', 'all_time') THEN
    RAISE EXCEPTION 'Invalid period: %. Must be weekly, monthly, or all_time.', p_period;
  END IF;
  p_limit := LEAST(GREATEST(p_limit, 1), 100);

  -- Period boundary computation
  v_start := CASE p_period
    WHEN 'weekly'  THEN get_week_start()::TIMESTAMPTZ
    WHEN 'monthly' THEN DATE_TRUNC('month', CURRENT_DATE)::TIMESTAMPTZ
    ELSE           '-infinity'::TIMESTAMPTZ
  END;

  -- -------------------------------------------------------------------------
  -- Volume: sum of total_volume_kg for completed sessions in period
  -- -------------------------------------------------------------------------
  IF p_metric = 'volume' THEN
    RETURN QUERY
    WITH ranked AS (
      SELECT
        p.id                                                      AS uid,
        p.display_name                                            AS dname,
        p.avatar_url                                              AS aurl,
        COALESCE(SUM(ws.total_volume_kg), 0)                     AS scr,
        COUNT(DISTINCT ws.id)::INT                               AS sess_count,
        DENSE_RANK() OVER (
          ORDER BY COALESCE(SUM(ws.total_volume_kg), 0) DESC
        )                                                         AS rnk
      FROM profiles p
      LEFT JOIN workout_sessions ws
        ON  ws.user_id       = p.id
        AND ws.status        = 'completed'
        AND ws.completed_at >= v_start
        AND ws.completed_at <  v_end
      WHERE p.is_public = TRUE
      GROUP BY p.id, p.display_name, p.avatar_url
    )
    SELECT rnk, uid, dname, aurl, scr, sess_count
    FROM   ranked
    ORDER  BY rnk
    LIMIT  p_limit;

  -- -------------------------------------------------------------------------
  -- Consistency: count of completed sessions in period
  -- -------------------------------------------------------------------------
  ELSIF p_metric = 'consistency' THEN
    RETURN QUERY
    WITH ranked AS (
      SELECT
        p.id                                   AS uid,
        p.display_name                         AS dname,
        p.avatar_url                           AS aurl,
        COUNT(DISTINCT ws.id)::NUMERIC         AS scr,
        COUNT(DISTINCT ws.id)::INT             AS sess_count,
        DENSE_RANK() OVER (
          ORDER BY COUNT(DISTINCT ws.id) DESC
        )                                       AS rnk
      FROM profiles p
      LEFT JOIN workout_sessions ws
        ON  ws.user_id       = p.id
        AND ws.status        = 'completed'
        AND ws.completed_at >= v_start
        AND ws.completed_at <  v_end
      WHERE p.is_public = TRUE
      GROUP BY p.id, p.display_name, p.avatar_url
    )
    SELECT rnk, uid, dname, aurl, scr, sess_count
    FROM   ranked
    ORDER  BY rnk
    LIMIT  p_limit;

  -- -------------------------------------------------------------------------
  -- Streak: current_streak from profiles (period affects sessions_count only)
  -- -------------------------------------------------------------------------
  ELSIF p_metric = 'streak' THEN
    RETURN QUERY
    WITH ranked AS (
      SELECT
        p.id                                                               AS uid,
        p.display_name                                                     AS dname,
        p.avatar_url                                                       AS aurl,
        p.current_streak::NUMERIC                                          AS scr,
        (
          SELECT COUNT(*)::INT
          FROM   workout_sessions ws2
          WHERE  ws2.user_id       = p.id
            AND  ws2.status        = 'completed'
            AND  ws2.completed_at >= v_start
        )                                                                  AS sess_count,
        DENSE_RANK() OVER (ORDER BY p.current_streak DESC)                AS rnk
      FROM profiles p
      WHERE p.is_public = TRUE
    )
    SELECT rnk, uid, dname, aurl, scr, sess_count
    FROM   ranked
    ORDER  BY rnk
    LIMIT  p_limit;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_leaderboard(TEXT, TEXT, INT) TO authenticated;

-- Scalability note: at ~10k public profiles, consider a MATERIALIZED VIEW
-- refreshed every 15 min via pg_cron. Current pod-scale (<1k users) is fast.
