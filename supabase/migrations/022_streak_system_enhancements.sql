-- Streak System Enhancements
-- Adds freeze mechanic (1x/month) and milestone tracking

-- Add streak freeze columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_freeze_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_freeze_reset_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS streak_milestones_unlocked INTEGER[] DEFAULT '{}';

-- Add XP and leveling columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;

-- Function to reset streak freeze monthly
CREATE OR REPLACE FUNCTION reset_monthly_streak_freeze()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    streak_freeze_available = true,
    last_freeze_reset_at = now()
  WHERE
    last_freeze_reset_at < (now() - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to use streak freeze
CREATE OR REPLACE FUNCTION use_streak_freeze(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  freeze_available BOOLEAN;
BEGIN
  SELECT streak_freeze_available INTO freeze_available
  FROM profiles
  WHERE id = user_id_param;

  IF freeze_available THEN
    UPDATE profiles
    SET streak_freeze_available = false
    WHERE id = user_id_param;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and award streak milestones
CREATE OR REPLACE FUNCTION check_streak_milestones(user_id_param UUID)
RETURNS INTEGER[] AS $$
DECLARE
  current_streak INTEGER;
  unlocked_milestones INTEGER[];
  new_milestones INTEGER[] := '{}';
  milestone INTEGER;
BEGIN
  SELECT current_streak, streak_milestones_unlocked
  INTO current_streak, unlocked_milestones
  FROM profiles
  WHERE id = user_id_param;

  -- Check each milestone (7, 30, 100, 365)
  FOR milestone IN SELECT unnest(ARRAY[7, 30, 100, 365]) LOOP
    IF current_streak >= milestone AND NOT (milestone = ANY(unlocked_milestones)) THEN
      unlocked_milestones := array_append(unlocked_milestones, milestone);
      new_milestones := array_append(new_milestones, milestone);
    END IF;
  END LOOP;

  -- Update profile with new milestones
  IF array_length(new_milestones, 1) > 0 THEN
    UPDATE profiles
    SET streak_milestones_unlocked = unlocked_milestones
    WHERE id = user_id_param;
  END IF;

  RETURN new_milestones;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add XP and check for level up
CREATE OR REPLACE FUNCTION add_xp(user_id_param UUID, xp_amount INTEGER)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER, leveled_up BOOLEAN) AS $$
DECLARE
  current_xp INTEGER;
  current_level INTEGER;
  xp_needed INTEGER;
  did_level_up BOOLEAN := false;
BEGIN
  SELECT xp, level INTO current_xp, current_level
  FROM profiles
  WHERE id = user_id_param;

  current_xp := current_xp + xp_amount;

  -- Level curve: each level requires level * 100 XP
  -- Level 1→2 = 100 XP, Level 2→3 = 200 XP, etc.
  LOOP
    xp_needed := current_level * 100;
    IF current_xp >= xp_needed THEN
      current_xp := current_xp - xp_needed;
      current_level := current_level + 1;
      did_level_up := true;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  UPDATE profiles
  SET xp = current_xp, level = current_level
  WHERE id = user_id_param;

  RETURN QUERY SELECT current_xp, current_level, did_level_up;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to award XP on workout completion
CREATE OR REPLACE FUNCTION award_workout_xp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Award 50 XP for completing a workout
    PERFORM add_xp(NEW.user_id, 50);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_award_workout_xp
  AFTER UPDATE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION award_workout_xp();

-- Comment for context
COMMENT ON COLUMN profiles.streak_freeze_available IS 'Whether user has a streak freeze available (resets monthly)';
COMMENT ON COLUMN profiles.last_freeze_reset_at IS 'Last time the streak freeze was reset (monthly)';
COMMENT ON COLUMN profiles.streak_milestones_unlocked IS 'Array of streak milestones unlocked (7, 30, 100, 365 days)';
COMMENT ON COLUMN profiles.xp IS 'Experience points earned from activities';
COMMENT ON COLUMN profiles.level IS 'User level based on XP';
