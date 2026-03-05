-- Migration 068: Data integrity constraints
--   1. Profiles: range checks on weight/height fields (nullable-safe)
--   2. Pod members: DB-level limit of 8 active members per pod (BEFORE INSERT trigger)

-- 1. Profiles numeric range constraints
ALTER TABLE profiles
  ADD CONSTRAINT chk_height_cm
    CHECK (height_cm IS NULL OR (height_cm > 0 AND height_cm < 300)),
  ADD CONSTRAINT chk_current_weight_kg
    CHECK (current_weight_kg IS NULL OR (current_weight_kg > 0 AND current_weight_kg < 700)),
  ADD CONSTRAINT chk_goal_weight_kg
    CHECK (goal_weight_kg IS NULL OR (goal_weight_kg > 0 AND goal_weight_kg < 700));

-- 2. Pod member limit trigger
-- Catches both direct inserts and the invite-acceptance trigger (handle_pod_invite_accepted)
-- which also INSERTs into pod_members.
CREATE OR REPLACE FUNCTION check_pod_member_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pod_members
  WHERE pod_id = NEW.pod_id AND status = 'active';

  IF v_count >= 8 THEN
    RAISE EXCEPTION 'Pod is full (max 8 members)';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pod_member_limit
  BEFORE INSERT ON pod_members
  FOR EACH ROW WHEN (NEW.status = 'active')
  EXECUTE FUNCTION check_pod_member_limit();
