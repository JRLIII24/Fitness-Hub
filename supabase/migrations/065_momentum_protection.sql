-- Push device tokens for FCM
CREATE TABLE push_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE push_device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tokens" ON push_device_tokens FOR ALL USING (auth.uid() = user_id);

-- Streak risk alerts (dedup tracking)
CREATE TABLE streak_risk_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_date date NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('warning', 'critical')),
  streak_count integer NOT NULL,
  notified_pod_member_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, alert_date, risk_level)
);

ALTER TABLE streak_risk_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own alerts" ON streak_risk_alerts FOR SELECT USING (auth.uid() = user_id);

-- Notification preferences
CREATE TABLE notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  streak_alerts_enabled boolean NOT NULL DEFAULT true,
  pod_pings_enabled boolean NOT NULL DEFAULT true,
  workout_reminders_enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start integer CHECK (quiet_hours_start BETWEEN 0 AND 23),
  quiet_hours_end integer CHECK (quiet_hours_end BETWEEN 0 AND 23),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON notification_preferences FOR ALL USING (auth.uid() = user_id);

-- Streak risk detection RPC
CREATE OR REPLACE FUNCTION detect_streak_risk_users()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  current_streak integer,
  hours_since_last_workout numeric,
  risk_level text,
  pod_ids uuid[]
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH last_workout AS (
    SELECT
      ws.user_id,
      MAX(ws.completed_at) AS last_completed
    FROM workout_sessions ws
    WHERE ws.status = 'completed'
      AND ws.completed_at >= NOW() - INTERVAL '7 days'
    GROUP BY ws.user_id
  ),
  at_risk AS (
    SELECT
      p.id AS uid,
      p.display_name,
      p.current_streak,
      EXTRACT(EPOCH FROM (NOW() - lw.last_completed)) / 3600.0 AS hrs_since,
      CASE
        WHEN EXTRACT(EPOCH FROM (NOW() - lw.last_completed)) / 3600.0 >= 44 THEN 'critical'
        WHEN EXTRACT(EPOCH FROM (NOW() - lw.last_completed)) / 3600.0 >= 36 THEN 'warning'
      END AS rl
    FROM profiles p
    JOIN last_workout lw ON lw.user_id = p.id
    WHERE p.current_streak >= 2
      AND EXTRACT(EPOCH FROM (NOW() - lw.last_completed)) / 3600.0 >= 36
  )
  SELECT
    ar.uid,
    ar.display_name,
    ar.current_streak,
    ROUND(ar.hrs_since, 1),
    ar.rl,
    ARRAY(
      SELECT pm.pod_id
      FROM pod_members pm
      WHERE pm.user_id = ar.uid
    ) AS pod_ids
  FROM at_risk ar
  WHERE ar.rl IS NOT NULL;
END;
$$;
