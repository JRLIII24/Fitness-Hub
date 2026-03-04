-- Readiness daily scores
CREATE TABLE readiness_daily_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_date date NOT NULL,
  readiness_score integer NOT NULL CHECK (readiness_score BETWEEN 0 AND 100),
  training_score integer CHECK (training_score BETWEEN 0 AND 100),
  nutrition_score integer CHECK (nutrition_score BETWEEN 0 AND 100),
  recovery_score integer CHECK (recovery_score BETWEEN 0 AND 100),
  external_score integer CHECK (external_score BETWEEN 0 AND 100),
  confidence text NOT NULL CHECK (confidence IN ('low','medium','high')),
  recommendation text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, score_date)
);

ALTER TABLE readiness_daily_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own readiness" ON readiness_daily_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own readiness" ON readiness_daily_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own readiness" ON readiness_daily_scores FOR UPDATE USING (auth.uid() = user_id);

-- Health sync data (optional HealthKit/Google Fit)
CREATE TABLE health_sync_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_date date NOT NULL,
  sleep_hours numeric(4,2),
  resting_heart_rate integer,
  hrv_ms integer,
  steps integer,
  source text NOT NULL CHECK (source IN ('healthkit','google_fit','manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sync_date, source)
);

ALTER TABLE health_sync_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own health data" ON health_sync_data FOR ALL USING (auth.uid() = user_id);

-- Nutrition compliance RPC
CREATE OR REPLACE FUNCTION get_nutrition_compliance(p_user_id uuid, p_days integer DEFAULT 3)
RETURNS TABLE (
  days_tracked integer,
  avg_calorie_pct numeric,
  avg_protein_pct numeric
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cal_target numeric;
  v_protein_target numeric;
BEGIN
  -- Get latest nutrition goals
  SELECT calories_target, protein_g_target
  INTO v_cal_target, v_protein_target
  FROM nutrition_goals
  WHERE user_id = p_user_id
  ORDER BY effective_from DESC
  LIMIT 1;

  -- Default targets if none set
  v_cal_target := COALESCE(v_cal_target, 2000);
  v_protein_target := COALESCE(v_protein_target, 150);

  RETURN QUERY
  WITH daily_totals AS (
    SELECT
      (fl.logged_at::date) AS log_date,
      SUM(fl.calories_consumed) AS total_cals,
      SUM(COALESCE(fl.protein_g, 0)) AS total_protein
    FROM food_log fl
    WHERE fl.user_id = p_user_id
      AND fl.logged_at >= (CURRENT_DATE - (p_days || ' days')::interval)
    GROUP BY log_date
  )
  SELECT
    COUNT(*)::integer AS days_tracked,
    ROUND(AVG(total_cals / NULLIF(v_cal_target, 0) * 100), 1) AS avg_calorie_pct,
    ROUND(AVG(total_protein / NULLIF(v_protein_target, 0) * 100), 1) AS avg_protein_pct
  FROM daily_totals;
END;
$$;
