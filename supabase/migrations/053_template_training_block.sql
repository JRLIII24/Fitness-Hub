-- 053: Add training_block column to workout_templates + template_last_performed view

-- 1. New column
ALTER TABLE workout_templates
  ADD COLUMN IF NOT EXISTS training_block TEXT DEFAULT NULL;

COMMENT ON COLUMN workout_templates.training_block IS
  'Optional training block label (e.g. "6-Week Powerbuilding"). Used for UI grouping on /templates.';

-- 2. Server-side aggregation view — aggregates MAX(completed_at) in Postgres,
--    returns exactly one row per template_id. Zero raw session rows hit the client.
CREATE OR REPLACE VIEW template_last_performed AS
SELECT
  template_id,
  MAX(completed_at) AS last_performed_at
FROM workout_sessions
WHERE status = 'completed'
  AND template_id IS NOT NULL
GROUP BY template_id;

-- Allow authenticated users to read the view.
-- RLS on the underlying workout_sessions table enforces row-level access.
GRANT SELECT ON template_last_performed TO authenticated;
