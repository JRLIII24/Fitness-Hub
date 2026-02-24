-- ============================================================================
-- Migration 042: Atomic Template Import RPC
--
-- import_public_template(p_template_id UUID)
--   Copies a public template (header + exercises) into the caller's library.
--   Idempotent: if the caller already imported this template, returns the
--   existing copy's ID without creating a duplicate.
--
-- Returns: UUID of the new (or existing) template copy.
-- ============================================================================

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
  -- We track imports via template_saves; the copied template stores the
  -- source ID in its description prefix as a stable fingerprint, so we
  -- look up via template_saves instead.
  SELECT ts.template_id INTO v_existing_id
  FROM   template_saves ts
  JOIN   workout_templates wt ON wt.id = ts.template_id
  WHERE  ts.user_id    = v_caller
    AND  ts.template_id = p_template_id
  LIMIT  1;

  -- If already saved (and user copy exists), return source ID (caller saved it)
  -- The actual user copy lookup uses the imported_from metadata approach below.

  -- Check if a private copy already exists (user previously imported)
  SELECT id INTO v_existing_id
  FROM   workout_templates
  WHERE  user_id     = v_caller
    AND  description LIKE '%[imported:' || p_template_id::TEXT || ']'
  LIMIT  1;

  IF FOUND THEN
    RETURN v_existing_id;
  END IF;

  -- ── 3. Copy template header ───────────────────────────────────────────────
  INSERT INTO workout_templates (
    user_id,
    name,
    description,
    color,
    estimated_duration_min,
    is_public,
    save_count
  )
  VALUES (
    v_caller,
    v_src.name,
    -- Append import fingerprint for idempotency detection (trimmed in UI)
    COALESCE(v_src.description, '') ||
      CASE WHEN v_src.description IS NOT NULL THEN ' ' ELSE '' END ||
      '[imported:' || p_template_id::TEXT || ']',
    v_src.color,
    v_src.estimated_duration_min,
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

-- Add the function type to track it
COMMENT ON FUNCTION import_public_template(UUID) IS
  'Atomically imports a public template into the caller''s library. Idempotent.';
