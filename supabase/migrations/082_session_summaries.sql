-- Session Summaries: AI-generated "Coach's Notes" for each completed workout.
-- Used by the Apex coach for episodic memory across conversations.

CREATE TABLE session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_observations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id)
);

CREATE INDEX idx_session_summaries_user ON session_summaries(user_id, created_at DESC);

ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own summaries"
  ON session_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own summaries"
  ON session_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
