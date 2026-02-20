-- Migration 035: Growth Intents + Conversion Impressions
-- Additive analytics tables for retention and monetization experiments.

CREATE TABLE IF NOT EXISTS user_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  intent_type TEXT NOT NULL,
  intent_payload JSONB NOT NULL DEFAULT '{}',
  intent_for_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dismissed', 'expired')),
  source_screen TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_intents_user_status_date
  ON user_intents(user_id, status, intent_for_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_intents_type
  ON user_intents(intent_type, created_at DESC);

ALTER TABLE user_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own intents" ON user_intents;
CREATE POLICY "Users can read own intents"
  ON user_intents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own intents" ON user_intents;
CREATE POLICY "Users can create own intents"
  ON user_intents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own intents" ON user_intents;
CREATE POLICY "Users can update own intents"
  ON user_intents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS conversion_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  placement TEXT NOT NULL,
  impression_type TEXT NOT NULL,
  variant TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acted_at TIMESTAMPTZ,
  action_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversion_impressions_user_time
  ON conversion_impressions(user_id, shown_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversion_impressions_placement
  ON conversion_impressions(placement, shown_at DESC);

ALTER TABLE conversion_impressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own conversion impressions" ON conversion_impressions;
CREATE POLICY "Users can read own conversion impressions"
  ON conversion_impressions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversion impressions" ON conversion_impressions;
CREATE POLICY "Users can insert own conversion impressions"
  ON conversion_impressions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversion impressions" ON conversion_impressions;
CREATE POLICY "Users can update own conversion impressions"
  ON conversion_impressions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE user_intents IS 'User commitments and intent records used by retention loops.';
COMMENT ON TABLE conversion_impressions IS 'Upsell and feature-gate impression telemetry for conversion optimization.';
