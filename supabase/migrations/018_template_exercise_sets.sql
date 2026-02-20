-- Migration 018: Create template_exercise_sets + fix template_exercises RLS
-- template_exercise_sets was referenced in code but never created.
-- Also updates template_exercises SELECT policy to allow reading shared templates.

-- Fix template_exercises SELECT: allow reading exercises from shared templates too
DROP POLICY IF EXISTS "Users can read own template exercises" ON template_exercises;
CREATE POLICY "Users can read own template exercises"
  ON template_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates wt
      WHERE wt.id = template_exercises.template_id
        AND (wt.user_id = auth.uid() OR wt.is_shared = true)
    )
  );

-- Create template_exercise_sets table
CREATE TABLE IF NOT EXISTS template_exercise_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_exercise_id UUID NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight_kg NUMERIC(6, 2),
  duration_seconds INTEGER,
  set_type set_type NOT NULL DEFAULT 'working',
  rest_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_exercise_sets_exercise
  ON template_exercise_sets(template_exercise_id, set_number);

-- Enable Row Level Security
ALTER TABLE template_exercise_sets ENABLE ROW LEVEL SECURITY;

-- Users can read sets for exercises in their own templates (or shared templates)
CREATE POLICY "Users can read own template exercise sets"
  ON template_exercise_sets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM template_exercises te
      JOIN workout_templates wt ON wt.id = te.template_id
      WHERE te.id = template_exercise_sets.template_exercise_id
        AND (wt.user_id = auth.uid() OR wt.is_shared = true)
    )
  );

CREATE POLICY "Users can create own template exercise sets"
  ON template_exercise_sets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM template_exercises te
      JOIN workout_templates wt ON wt.id = te.template_id
      WHERE te.id = template_exercise_sets.template_exercise_id
        AND wt.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own template exercise sets"
  ON template_exercise_sets FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM template_exercises te
      JOIN workout_templates wt ON wt.id = te.template_id
      WHERE te.id = template_exercise_sets.template_exercise_id
        AND wt.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM template_exercises te
      JOIN workout_templates wt ON wt.id = te.template_id
      WHERE te.id = template_exercise_sets.template_exercise_id
        AND wt.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own template exercise sets"
  ON template_exercise_sets FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM template_exercises te
      JOIN workout_templates wt ON wt.id = te.template_id
      WHERE te.id = template_exercise_sets.template_exercise_id
        AND wt.user_id = auth.uid()
    )
  );
