-- Migration 093: Coach conversation persistence
-- Stores chat history between users and APEX coach

CREATE TABLE coach_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES workout_sessions(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coach_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES coach_conversations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content           TEXT NOT NULL,
  action            TEXT,
  action_data       JSONB,
  action_result     JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_conversations_user ON coach_conversations(user_id, updated_at DESC);
CREATE INDEX idx_coach_messages_conversation ON coach_messages(conversation_id, created_at ASC);

ALTER TABLE coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own conversations"
  ON coach_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own conversations"
  ON coach_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conversations"
  ON coach_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own conversations"
  ON coach_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own messages"
  ON coach_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own messages"
  ON coach_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);
