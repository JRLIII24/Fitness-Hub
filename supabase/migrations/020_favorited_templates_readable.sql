-- Migration 020: Allow reading favorited templates on public profiles
-- When viewing someone's profile, you should be able to see which templates
-- they've favorited, even if those templates aren't marked as shared.

-- Add a new policy to allow reading templates that are favorited by public profiles
CREATE POLICY "Public users favorited templates are readable"
  ON workout_templates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM template_favorites tf
      JOIN profiles p ON p.id = tf.user_id
      WHERE tf.template_id = workout_templates.id
        AND p.is_public = true
    )
  );
