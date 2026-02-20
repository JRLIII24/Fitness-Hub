/**
 * Migration 030: Auto-Update Trigger for Last Performance
 *
 * This trigger automatically updates user_exercise_last_performance
 * whenever a workout session is completed.
 *
 * Trigger fires on:
 * - UPDATE workout_sessions: when status changes to 'completed'
 * - Finds all exercises in the session with completed sets
 * - Upserts last_performance with the best set (highest weight * reps)
 */

CREATE OR REPLACE FUNCTION update_last_performance()
RETURNS TRIGGER AS $$
DECLARE
  v_exercise RECORD;
  v_best_set RECORD;
BEGIN
  -- Only process when session is marked as completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

    -- For each exercise in this session
    FOR v_exercise IN
      SELECT DISTINCT exercise_id
      FROM workout_sets
      WHERE session_id = NEW.id
        AND completed_at IS NOT NULL
    LOOP

      -- Find the best set (highest weight * reps product)
      SELECT
        reps,
        weight_kg,
        set_type,
        completed_at
      INTO v_best_set
      FROM workout_sets
      WHERE session_id = NEW.id
        AND exercise_id = v_exercise.exercise_id
        AND completed_at IS NOT NULL
        AND reps IS NOT NULL
        AND weight_kg IS NOT NULL
      ORDER BY (reps * weight_kg) DESC, completed_at DESC
      LIMIT 1;

      -- If we found a best set, upsert into last_performance
      IF v_best_set IS NOT NULL THEN
        INSERT INTO user_exercise_last_performance (
          user_id,
          exercise_id,
          last_session_id,
          last_performed_at,
          best_set,
          total_sets,
          updated_at
        )
        VALUES (
          NEW.user_id,
          v_exercise.exercise_id,
          NEW.id,
          NEW.completed_at,
          jsonb_build_object(
            'reps', v_best_set.reps,
            'weight_kg', v_best_set.weight_kg,
            'set_type', v_best_set.set_type,
            'completed_at', v_best_set.completed_at
          ),
          (
            SELECT COUNT(*)
            FROM workout_sets
            WHERE session_id = NEW.id
              AND exercise_id = v_exercise.exercise_id
              AND completed_at IS NOT NULL
          ),
          now()
        )
        ON CONFLICT (user_id, exercise_id)
        DO UPDATE SET
          last_session_id = EXCLUDED.last_session_id,
          last_performed_at = EXCLUDED.last_performed_at,
          best_set = EXCLUDED.best_set,
          total_sets = user_exercise_last_performance.total_sets + EXCLUDED.total_sets,
          updated_at = now();
      END IF;

    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_update_last_performance ON workout_sessions;

CREATE TRIGGER trg_update_last_performance
  AFTER INSERT OR UPDATE ON workout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_last_performance();

-- Comment for documentation
COMMENT ON FUNCTION update_last_performance() IS
  'Auto-updates user_exercise_last_performance when a workout session is completed. Finds the best set (highest weight * reps) for each exercise.';
