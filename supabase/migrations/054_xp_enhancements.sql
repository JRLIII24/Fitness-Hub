-- Migration 054: XP System Enhancements
--
-- Changes:
-- 1. Update workout XP trigger: flat 50 → 100 + (completed_set_count × 2)
-- 2. Add XP trigger for personal records (user_exercise_last_performance updates)
-- 3. Award XP when streak milestones are newly unlocked
-- 4. Add last_level_up_at timestamp to profiles for client-side level-up detection

-- Add last_level_up_at column for detecting level ups client-side
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_level_up_at TIMESTAMPTZ DEFAULT NULL;

-- Update add_xp function to record last_level_up_at when leveling up
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

  IF did_level_up THEN
    UPDATE profiles
    SET xp = current_xp, level = current_level, last_level_up_at = now()
    WHERE id = user_id_param;
  ELSE
    UPDATE profiles
    SET xp = current_xp, level = current_level
    WHERE id = user_id_param;
  END IF;

  RETURN QUERY SELECT current_xp, current_level, did_level_up;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update workout XP trigger: award 100 + (completed_set_count × 2)
CREATE OR REPLACE FUNCTION award_workout_xp()
RETURNS TRIGGER AS $$
DECLARE
  completed_sets INTEGER;
  xp_to_award INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Count completed sets for this session
    SELECT COUNT(*) INTO completed_sets
    FROM workout_sets
    WHERE session_id = NEW.id
      AND completed_at IS NOT NULL;

    -- Formula: 100 base XP + 2 XP per completed set
    xp_to_award := 100 + (COALESCE(completed_sets, 0) * 2);
    PERFORM add_xp(NEW.user_id, xp_to_award);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists from migration 022, replace it
DROP TRIGGER IF EXISTS trg_award_workout_xp ON workout_sessions;
CREATE TRIGGER trg_award_workout_xp
  AFTER UPDATE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION award_workout_xp();

-- Award XP when a personal record is set
-- Detects when user_exercise_last_performance.best_set improves
CREATE OR REPLACE FUNCTION award_pr_xp()
RETURNS TRIGGER AS $$
DECLARE
  old_score NUMERIC;
  new_score NUMERIC;
BEGIN
  -- Score = weight_kg × reps (volume score)
  old_score := COALESCE((OLD.best_set->>'weight_kg')::NUMERIC, 0) *
               COALESCE((OLD.best_set->>'reps')::NUMERIC, 0);
  new_score := COALESCE((NEW.best_set->>'weight_kg')::NUMERIC, 0) *
               COALESCE((NEW.best_set->>'reps')::NUMERIC, 0);

  -- Only award XP if this is a genuine improvement (new PR)
  IF new_score > old_score THEN
    PERFORM add_xp(NEW.user_id, 150);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_award_pr_xp ON user_exercise_last_performance;
CREATE TRIGGER trg_award_pr_xp
  AFTER UPDATE ON user_exercise_last_performance
  FOR EACH ROW EXECUTE FUNCTION award_pr_xp();

-- Award XP on streak milestones (7, 30, 100, 365 days)
-- Fires when current_streak is updated on the profiles table
CREATE OR REPLACE FUNCTION award_streak_milestone_xp()
RETURNS TRIGGER AS $$
DECLARE
  milestone INTEGER;
  milestone_xp INTEGER := 200;
BEGIN
  -- Only process if streak actually increased
  IF NEW.current_streak <= OLD.current_streak THEN
    RETURN NEW;
  END IF;

  -- Check each milestone
  FOR milestone IN SELECT unnest(ARRAY[7, 30, 100, 365]) LOOP
    IF NEW.current_streak >= milestone
       AND NOT (milestone = ANY(COALESCE(NEW.streak_milestones_unlocked, '{}'::INTEGER[])))
    THEN
      -- Award XP (streak_milestones_unlocked is updated by check_streak_milestones separately)
      PERFORM add_xp(NEW.id, milestone_xp);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_award_streak_milestone_xp ON profiles;
CREATE TRIGGER trg_award_streak_milestone_xp
  AFTER UPDATE OF current_streak ON profiles
  FOR EACH ROW EXECUTE FUNCTION award_streak_milestone_xp();

COMMENT ON COLUMN profiles.last_level_up_at IS 'Timestamp of most recent level-up, used by client to detect and celebrate level changes';
