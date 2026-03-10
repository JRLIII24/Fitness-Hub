-- Migration 072: Form Coach Core — private video analysis tables + storage

-- Form videos (private, auto-expire after 90 days)
CREATE TABLE form_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_session_id uuid REFERENCES workout_sessions(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('video/mp4', 'video/quicktime', 'video/webm')),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  duration_seconds integer,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days',
  analysis_status text NOT NULL DEFAULT 'pending'
    CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  analysis_error text
);

CREATE INDEX idx_form_videos_user_uploaded ON form_videos(user_id, uploaded_at DESC);
CREATE INDEX idx_form_videos_expires ON form_videos(expires_at);

-- Form analysis reports (one per video)
CREATE TABLE form_analysis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES form_videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  selected_exercise text,
  detected_exercise text,
  exercise_confidence text CHECK (exercise_confidence IN ('low', 'medium', 'high')),
  overall_score integer CHECK (overall_score BETWEEN 0 AND 100),
  summary text NOT NULL,
  praise text[] NOT NULL DEFAULT '{}',
  recommendations text[] NOT NULL DEFAULT '{}',
  safety_notes text[] NOT NULL DEFAULT '{}',
  model text NOT NULL,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_form_report_video UNIQUE (video_id)
);

CREATE INDEX idx_form_reports_user_analyzed ON form_analysis_reports(user_id, analyzed_at DESC);

-- Form analysis issues (timestamped corrections)
CREATE TABLE form_analysis_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES form_analysis_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  body_part text NOT NULL,
  issue_type text,
  severity text NOT NULL CHECK (severity IN ('minor', 'moderate', 'major')),
  timestamp_seconds numeric(8,2),
  description text NOT NULL,
  correction text NOT NULL,
  cue text,
  confidence numeric(4,3)
);

CREATE INDEX idx_form_issues_report_sort ON form_analysis_issues(report_id, sort_order);

-- RLS: form_videos (owner-only)
ALTER TABLE form_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own form videos"
  ON form_videos FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS: form_analysis_reports (owner-only)
ALTER TABLE form_analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own form reports"
  ON form_analysis_reports FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS: form_analysis_issues (owner-only)
ALTER TABLE form_analysis_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own form issues"
  ON form_analysis_issues FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Private storage bucket for form-check videos
-- Note: bucket creation is done via Supabase CLI/dashboard, not SQL.
-- Storage RLS policies scope access to ${auth.uid()}/ prefix.
-- INSERT policy: authenticated users can upload to their own folder
-- SELECT policy: authenticated users can read their own folder
-- DELETE policy: authenticated users can delete their own files
