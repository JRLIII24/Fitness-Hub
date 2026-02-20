-- Migration 015: Sets (workout video clips) + Template Favorites + Streak

-- Streak (denormalized for fast reads)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0;

-- Template social proof
ALTER TABLE workout_templates ADD COLUMN IF NOT EXISTS save_count INTEGER NOT NULL DEFAULT 0;

-- Workout clips ("Sets")
CREATE TABLE IF NOT EXISTS workout_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT CHECK (char_length(caption) <= 120),
  duration_seconds INTEGER CHECK (duration_seconds BETWEEN 5 AND 20),
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clips_user ON workout_clips(user_id, created_at DESC);

-- Clip likes
CREATE TABLE IF NOT EXISTS clip_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID NOT NULL REFERENCES workout_clips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_clip_like UNIQUE (clip_id, user_id)
);

-- Clip comments (mutual followers only enforced by RLS)
CREATE TABLE IF NOT EXISTS clip_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID NOT NULL REFERENCES workout_clips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_clip ON clip_comments(clip_id, created_at);

-- Template favorites
CREATE TABLE IF NOT EXISTS template_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_template_fav UNIQUE (user_id, template_id)
);

-- Streak trigger
CREATE OR REPLACE FUNCTION update_user_streak()
RETURNS TRIGGER AS $$
DECLARE
  v_streak INTEGER := 0;
  v_day DATE;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    FOR i IN 0..59 LOOP
      v_day := CURRENT_DATE - i;
      IF EXISTS (
        SELECT 1 FROM workout_sessions
        WHERE user_id = NEW.user_id
          AND status = 'completed'
          AND started_at::date = v_day
      ) THEN
        v_streak := v_streak + 1;
      ELSIF i > 0 THEN
        EXIT;
      END IF;
    END LOOP;
    UPDATE profiles SET current_streak = v_streak WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_streak ON workout_sessions;
CREATE TRIGGER trg_update_streak
  AFTER UPDATE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_user_streak();

-- RLS: workout_clips
ALTER TABLE workout_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clips viewable by followers or public profiles"
  ON workout_clips FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_follows WHERE follower_id = auth.uid() AND following_id = workout_clips.user_id)
    OR EXISTS (SELECT 1 FROM profiles WHERE id = workout_clips.user_id AND is_public = true)
  );

CREATE POLICY "Users can post clips"
  ON workout_clips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clips"
  ON workout_clips FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- RLS: clip_likes
ALTER TABLE clip_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes"
  ON clip_likes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can like"
  ON clip_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
  ON clip_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- RLS: clip_comments (mutual follow check)
ALTER TABLE clip_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mutual followers can comment"
  ON clip_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM user_follows
        WHERE follower_id = auth.uid()
          AND following_id = (SELECT user_id FROM workout_clips WHERE id = clip_comments.clip_id)
      )
      AND EXISTS (
        SELECT 1 FROM user_follows
        WHERE follower_id = (SELECT user_id FROM workout_clips WHERE id = clip_comments.clip_id)
          AND following_id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can read comments"
  ON clip_comments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can delete own comments"
  ON clip_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- RLS: template_favorites
ALTER TABLE template_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites"
  ON template_favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read favorites"
  ON template_favorites FOR SELECT TO authenticated
  USING (true);
