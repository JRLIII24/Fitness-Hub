-- Migration 032: Fix Last Performance Trigger Reliability
-- Ensures last-performance updates are safe on INSERT/UPDATE and idempotent.

CREATE OR REPLACE FUNCTION update_last_performance()
RETURNS TRIGGER AS $$
DECLARE
  v_exercise RECORD;
  v_best_set RECORD;
  v_total_sets INTEGER;
BEGIN
  -- Process only when session is completed:
  -- - on INSERT with completed status
  -- - on UPDATE transition into completed
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN

    FOR v_exercise IN
      SELECT DISTINCT exercise_id
      FROM workout_sets
      WHERE session_id = NEW.id
        AND completed_at IS NOT NULL
    LOOP
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

      IF v_best_set IS NOT NULL THEN
        -- Recompute total completed sets for this user+exercise across completed sessions.
        -- This keeps the metric correct even if trigger is retried.
        SELECT COUNT(*)
        INTO v_total_sets
        FROM workout_sets ws
        JOIN workout_sessions sess ON sess.id = ws.session_id
        WHERE sess.user_id = NEW.user_id
          AND sess.status = 'completed'
          AND ws.exercise_id = v_exercise.exercise_id
          AND ws.completed_at IS NOT NULL;

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
          COALESCE(NEW.completed_at, now()),
          jsonb_build_object(
            'reps', v_best_set.reps,
            'weight_kg', v_best_set.weight_kg,
            'set_type', v_best_set.set_type,
            'completed_at', v_best_set.completed_at
          ),
          COALESCE(v_total_sets, 0),
          now()
        )
        ON CONFLICT (user_id, exercise_id)
        DO UPDATE SET
          last_session_id = EXCLUDED.last_session_id,
          last_performed_at = EXCLUDED.last_performed_at,
          best_set = EXCLUDED.best_set,
          total_sets = EXCLUDED.total_sets,
          updated_at = now();
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

