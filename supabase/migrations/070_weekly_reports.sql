-- ============================================================================
-- Migration 070: Weekly Reports
-- AI-generated weekly training summaries with aggregation RPC.
-- ============================================================================

-- Weekly reports table
CREATE TABLE weekly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  report_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_weekly_reports_user ON weekly_reports(user_id, week_start DESC);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reports"
  ON weekly_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert policy for server (cron uses service role, but also allow authenticated for future manual triggers)
CREATE POLICY "Users can insert own reports"
  ON weekly_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RPC: Aggregate weekly training data
CREATE OR REPLACE FUNCTION get_weekly_training_summary(
  p_user_id UUID,
  p_week_start DATE,
  p_week_end DATE
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Enforce auth
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'total_sessions', (
      SELECT COUNT(*) FROM workout_sessions
      WHERE user_id = p_user_id AND status = 'completed'
        AND completed_at >= p_week_start::timestamptz
        AND completed_at < p_week_end::timestamptz
    ),
    'total_volume_kg', (
      SELECT COALESCE(SUM(total_volume_kg), 0) FROM workout_sessions
      WHERE user_id = p_user_id AND status = 'completed'
        AND completed_at >= p_week_start::timestamptz
        AND completed_at < p_week_end::timestamptz
    ),
    'total_duration_seconds', (
      SELECT COALESCE(SUM(duration_seconds), 0) FROM workout_sessions
      WHERE user_id = p_user_id AND status = 'completed'
        AND completed_at >= p_week_start::timestamptz
        AND completed_at < p_week_end::timestamptz
    ),
    'muscle_groups', (
      SELECT COALESCE(json_agg(sub), '[]'::json)
      FROM (
        SELECT e.muscle_group::text AS muscle_group, COUNT(*) AS sets
        FROM workout_sets ws
        JOIN workout_sessions s ON ws.session_id = s.id
        JOIN exercises e ON ws.exercise_id = e.id
        WHERE s.user_id = p_user_id AND s.status = 'completed'
          AND s.completed_at >= p_week_start::timestamptz
          AND s.completed_at < p_week_end::timestamptz
          AND ws.completed_at IS NOT NULL
        GROUP BY e.muscle_group
        ORDER BY COUNT(*) DESC
      ) sub
    ),
    'prs', (
      SELECT COALESCE(json_agg(sub), '[]'::json)
      FROM (
        SELECT DISTINCT ON (ws.exercise_id)
          e.name AS exercise, ws.weight_kg, ws.reps
        FROM workout_sets ws
        JOIN workout_sessions s ON ws.session_id = s.id
        JOIN exercises e ON ws.exercise_id = e.id
        WHERE s.user_id = p_user_id AND s.status = 'completed'
          AND s.completed_at >= p_week_start::timestamptz
          AND s.completed_at < p_week_end::timestamptz
          AND ws.completed_at IS NOT NULL
          AND ws.weight_kg IS NOT NULL AND ws.reps IS NOT NULL
          AND (ws.weight_kg * ws.reps) = (
            SELECT MAX(ws2.weight_kg * ws2.reps)
            FROM workout_sets ws2
            JOIN workout_sessions s2 ON ws2.session_id = s2.id
            WHERE s2.user_id = p_user_id AND ws2.exercise_id = ws.exercise_id
              AND s2.status = 'completed'
          )
        ORDER BY ws.exercise_id, ws.weight_kg DESC
        LIMIT 5
      ) sub
    ),
    'prev_week_volume', (
      SELECT COALESCE(SUM(total_volume_kg), 0) FROM workout_sessions
      WHERE user_id = p_user_id AND status = 'completed'
        AND completed_at >= (p_week_start - INTERVAL '7 days')::timestamptz
        AND completed_at < p_week_start::timestamptz
    ),
    'prev_week_sessions', (
      SELECT COUNT(*) FROM workout_sessions
      WHERE user_id = p_user_id AND status = 'completed'
        AND completed_at >= (p_week_start - INTERVAL '7 days')::timestamptz
        AND completed_at < p_week_start::timestamptz
    )
  ) INTO result;

  RETURN result;
END;
$$;
