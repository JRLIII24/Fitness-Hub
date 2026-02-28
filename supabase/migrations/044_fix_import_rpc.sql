-- ============================================================================
-- Migration 044: Fix import RPC + add glutes category
--
-- Changes:
--   1. Add 'glutes' to the primary_muscle_group CHECK constraint so templates
--      can be categorised as glutes and the filter pill works end-to-end.
--   2. Update import_public_template() to also copy primary_muscle_group so
--      imported templates retain their muscle-group category in the user's
--      library and display the correct badge on the templates page.
-- ============================================================================

-- ── 1. Extend primary_muscle_group CHECK constraint ─────────────────────────
-- The original constraint was created inline in migration 043 and PostgreSQL
-- auto-names it <table>_<column>_check.
ALTER TABLE workout_templates
  DROP CONSTRAINT IF EXISTS workout_templates_primary_muscle_group_check;

ALTER TABLE workout_templates
  ADD CONSTRAINT workout_templates_primary_muscle_group_check
  CHECK (primary_muscle_group IN (
    'chest', 'back', 'legs', 'arms', 'shoulders',
    'core', 'hiit', 'full body', 'cardio', 'glutes'
  ));

-- ── 2. Update import_public_template RPC ────────────────────────────────────
CREATE OR REPLACE FUNCTION import_public_template(p_template_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller        UUID := auth.uid();
  v_src           workout_templates%ROWTYPE;
  v_new_id        UUID;
  v_existing_id   UUID;
BEGIN
  -- ── 1. Verify the source template is public ──────────────────────────────
  SELECT * INTO v_src
  FROM   workout_templates
  WHERE  id        = p_template_id
    AND  is_public = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template % is not available for import', p_template_id;
  END IF;

  -- Cannot import own templates
  IF v_src.user_id = v_caller THEN
    RAISE EXCEPTION 'Cannot import your own template';
  END IF;

  -- ── 2. Idempotency: check if caller already imported this template ────────
  SELECT id INTO v_existing_id
  FROM   workout_templates
  WHERE  user_id     = v_caller
    AND  description LIKE '%[imported:' || p_template_id::TEXT || ']'
  LIMIT  1;

  IF FOUND THEN
    RETURN v_existing_id;
  END IF;

  -- ── 3. Copy template header (including category) ──────────────────────────
  INSERT INTO workout_templates (
    user_id,
    name,
    description,
    color,
    estimated_duration_min,
    primary_muscle_group,
    is_public,
    save_count
  )
  VALUES (
    v_caller,
    v_src.name,
    -- Append import fingerprint for idempotency detection (stripped in UI)
    COALESCE(v_src.description, '') ||
      CASE WHEN v_src.description IS NOT NULL THEN ' ' ELSE '' END ||
      '[imported:' || p_template_id::TEXT || ']',
    v_src.color,
    v_src.estimated_duration_min,
    v_src.primary_muscle_group,  -- preserve muscle group category
    false,  -- imported copies are private by default
    0       -- save_count resets for the personal copy
  )
  RETURNING id INTO v_new_id;

  -- ── 4. Copy template exercises ────────────────────────────────────────────
  INSERT INTO template_exercises (
    template_id,
    exercise_id,
    sort_order,
    target_sets,
    target_reps,
    target_weight_kg,
    rest_seconds,
    notes
  )
  SELECT
    v_new_id,
    te.exercise_id,
    te.sort_order,
    te.target_sets,
    te.target_reps,
    te.target_weight_kg,
    te.rest_seconds,
    te.notes
  FROM template_exercises te
  WHERE te.template_id = p_template_id
  ORDER BY te.sort_order;

  -- ── 5. Record the save (increments save_count on source via trigger) ──────
  INSERT INTO template_saves (template_id, user_id)
  VALUES (p_template_id, v_caller)
  ON CONFLICT (template_id, user_id) DO NOTHING;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION import_public_template(UUID) TO authenticated;

COMMENT ON FUNCTION import_public_template(UUID) IS
  'Atomically imports a public template into the caller''s library. Copies primary_muscle_group. Idempotent.';
