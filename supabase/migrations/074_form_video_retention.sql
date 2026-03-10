-- Migration 074: Form video retention RPC
-- Returns expired video storage paths for cron to delete via Storage API,
-- then deletes the DB rows (reports/issues cascade from form_videos FK).

CREATE OR REPLACE FUNCTION delete_expired_form_videos(batch_size integer DEFAULT 200)
RETURNS TABLE (deleted_count integer, storage_paths text[])
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_paths text[];
  v_count integer;
BEGIN
  -- Collect expired video paths
  SELECT array_agg(fv.storage_path), count(*)
  INTO v_paths, v_count
  FROM (
    SELECT storage_path, id
    FROM form_videos
    WHERE expires_at < now()
    ORDER BY expires_at
    LIMIT batch_size
  ) fv;

  -- Delete DB rows (cascade deletes reports + issues)
  IF v_count > 0 THEN
    DELETE FROM form_videos
    WHERE id IN (
      SELECT id FROM form_videos
      WHERE expires_at < now()
      ORDER BY expires_at
      LIMIT batch_size
    );
  END IF;

  deleted_count := COALESCE(v_count, 0);
  storage_paths := COALESCE(v_paths, '{}');
  RETURN NEXT;
END;
$$;
