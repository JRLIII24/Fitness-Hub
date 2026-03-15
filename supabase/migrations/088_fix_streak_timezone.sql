-- Migration 088: Timezone + rest-day aware streak calculation
-- Fixes:
--   1. UTC bug — uses user's timezone for date comparison
--   2. Rest days — skips days not in preferred_workout_days
--   3. Schedule start — only applies rest-day logic from when schedule was set

-- Track when user set their training schedule
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_workout_days_set_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION update_user_streak()
RETURNS TRIGGER AS $$
DECLARE
  v_streak INTEGER := 0;
  v_day DATE;
  v_tz TEXT;
  v_dow INTEGER;
  v_workout_days INTEGER[];
  v_schedule_set_at DATE;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Get user's timezone, preferred workout days, and schedule start date
    SELECT
      COALESCE(p.timezone, 'UTC'),
      p.preferred_workout_days,
      (p.preferred_workout_days_set_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date
    INTO v_tz, v_workout_days, v_schedule_set_at
    FROM profiles p WHERE p.id = NEW.user_id;

    FOR i IN 0..59 LOOP
      v_day := (NOW() AT TIME ZONE v_tz)::date - i;
      v_dow := EXTRACT(DOW FROM v_day)::integer;  -- 0=Sun..6=Sat

      -- Check if this day is a rest day (only if schedule exists AND day is after schedule was set)
      IF v_workout_days IS NOT NULL
         AND v_schedule_set_at IS NOT NULL
         AND v_day >= v_schedule_set_at
         AND NOT (v_dow = ANY(v_workout_days))
      THEN
        -- Rest day — skip it (don't break or count)
        CONTINUE;
      END IF;

      -- Training day (or no schedule set) — check for workout
      IF EXISTS (
        SELECT 1 FROM workout_sessions
        WHERE user_id = NEW.user_id
          AND status = 'completed'
          AND (started_at AT TIME ZONE v_tz)::date = v_day
      ) THEN
        v_streak := v_streak + 1;
      ELSIF i > 0 THEN
        EXIT;
      END IF;
    END LOOP;

    UPDATE profiles SET current_streak = v_streak WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
