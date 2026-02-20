-- Migration 034: Retention Events Logger
-- Dedicated analytics stream for retention mechanics (momentum, freeze, micro-wins).

CREATE TABLE IF NOT EXISTS retention_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_screen TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_events_user_time
  ON retention_events(user_id, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_retention_events_type_time
  ON retention_events(event_type, event_timestamp DESC);

ALTER TABLE retention_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own retention events" ON retention_events;
CREATE POLICY "Users can read own retention events"
  ON retention_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own retention events" ON retention_events;
CREATE POLICY "Users can insert own retention events"
  ON retention_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE retention_events IS 'Event log for retention mechanics and behavioral feedback loops';
COMMENT ON COLUMN retention_events.event_type IS 'Examples: momentum_protection_shown, streak_freeze_used, streak_freeze_failed, micro_win_shown';
COMMENT ON COLUMN retention_events.metadata IS 'Event-specific JSON payload';

