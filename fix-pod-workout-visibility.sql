-- Fix: Allow pod members to see each other's completed workouts

-- Create helper function to check if two users share an active pod
CREATE OR REPLACE FUNCTION users_share_pod(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM pod_members pm1
    INNER JOIN pod_members pm2 ON pm1.pod_id = pm2.pod_id
    WHERE pm1.user_id = user1_id
      AND pm2.user_id = user2_id
      AND pm1.status = 'active'
      AND pm2.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add policy to allow pod members to see each other's completed workouts
CREATE POLICY "Pod members can see each other's completed workouts"
  ON workout_sessions FOR SELECT TO authenticated
  USING (
    status = 'completed'
    AND users_share_pod(auth.uid(), user_id)
  );

-- Also allow pod members to see each other's workout exercises
CREATE POLICY "Pod members can see each other's workout exercises"
  ON workout_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = workout_exercises.session_id
        AND ws.status = 'completed'
        AND users_share_pod(auth.uid(), ws.user_id)
    )
  );

-- Allow pod members to see each other's exercise sets
CREATE POLICY "Pod members can see each other's exercise sets"
  ON exercise_sets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workout_exercises we
      INNER JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE we.id = exercise_sets.workout_exercise_id
        AND ws.status = 'completed'
        AND users_share_pod(auth.uid(), ws.user_id)
    )
  );
