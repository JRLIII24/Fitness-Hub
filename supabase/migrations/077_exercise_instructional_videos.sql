-- ============================================================================
-- 077: Exercise Instructional Videos
-- Admin-uploaded tutorial content linked to exercises.
-- Authenticated users: read-only. service_role: full access.
-- ============================================================================

-- Storage bucket for instructional videos (private, 50 MB per file)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-videos',
  'exercise-videos',
  false,
  52428800,
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can read
CREATE POLICY "Authenticated users read exercise videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exercise-videos');

-- Storage RLS: service role manages all (for admin uploads)
CREATE POLICY "Service role manages exercise videos"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'exercise-videos')
  WITH CHECK (bucket_id = 'exercise-videos');

-- DB table linking exercises to instructional video paths
CREATE TABLE exercise_instructional_videos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id      uuid        NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  storage_path     text        NOT NULL,
  title            text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description      text,
  duration_seconds integer     CHECK (duration_seconds > 0),
  difficulty       text        CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  sort_order       smallint    NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_eiv_exercise_id
  ON exercise_instructional_videos(exercise_id, sort_order);

ALTER TABLE exercise_instructional_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read instructional videos"
  ON exercise_instructional_videos FOR SELECT TO authenticated
  USING (true);
