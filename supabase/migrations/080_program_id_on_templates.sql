-- Migration 080: Tag program-generated templates with their source program
--
-- Adds a nullable program_id FK to workout_templates so program-generated
-- templates can be filtered out of the user's personal template list.
-- ON DELETE SET NULL keeps templates intact if the program is deleted.

ALTER TABLE workout_templates
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES training_programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workout_templates_program_id
  ON workout_templates(program_id);

COMMENT ON COLUMN workout_templates.program_id IS
  'If set, this template was auto-generated when a training program was started. NULL = user-created template.';
