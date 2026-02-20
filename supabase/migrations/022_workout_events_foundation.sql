-- ============================================================================
-- Migration 022: Workout Events Foundation + Phase 1 Infrastructure
-- Unified event system for adaptive intelligence features
-- ============================================================================

-- =============================================================================
-- 1. WORKOUT EVENTS TABLE (Shared Event System)
-- =============================================================================

CREATE TABLE IF NOT EXISTS workout_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id UUID REFERENCES workout_sessions(id) ON DELETE SET NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX idx_workout_events_user_time ON workout_events(user_id, event_timestamp DESC);
CREATE INDEX idx_workout_events_type ON workout_events(event_type);
CREATE INDEX idx_workout_events_session ON workout_events(session_id) WHERE session_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE workout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own events"
  ON workout_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
  ON workout_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE workout_events IS 'Unified event log for adaptive intelligence features (launcher, adaptive workouts, pods, relapse detection)';
COMMENT ON COLUMN workout_events.event_type IS 'Event type: workout_launched, workout_started, workout_completed, workout_cancelled, exercise_swapped, pattern_break, comeback_started, pod_commitment_made, etc.';
COMMENT ON COLUMN workout_events.event_data IS 'JSONB payload with event-specific properties';

-- =============================================================================
-- 2. LAUNCHER METADATA (Smart Workout Launcher)
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_workout_days INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS typical_session_duration_mins INTEGER,
  ADD COLUMN IF NOT EXISTS last_launcher_used_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.preferred_workout_days IS 'Array of days (0-6, Sunday=0) user typically works out';
COMMENT ON COLUMN profiles.typical_session_duration_mins IS 'Average workout duration for smart launcher time estimates';
COMMENT ON COLUMN profiles.last_launcher_used_at IS 'Last time user used smart launcher (for engagement tracking)';

-- =============================================================================
-- 3. ADAPTIVE WORKOUT CACHE
-- =============================================================================

CREATE TABLE IF NOT EXISTS adaptive_workout_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,
  workout_data JSONB NOT NULL,
  generation_reason TEXT,
  accepted BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adaptive_cache_user ON adaptive_workout_cache(user_id, generated_at DESC);
CREATE INDEX idx_adaptive_cache_valid ON adaptive_workout_cache(user_id, valid_until) WHERE accepted IS NULL;

ALTER TABLE adaptive_workout_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own adaptive workouts"
  ON adaptive_workout_cache FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own adaptive workouts"
  ON adaptive_workout_cache FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own adaptive workouts"
  ON adaptive_workout_cache FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE adaptive_workout_cache IS 'Cache for AI-generated daily workouts (valid for 6 hours)';
COMMENT ON COLUMN adaptive_workout_cache.workout_data IS 'Generated workout exercises, sets, reps, rationale';
COMMENT ON COLUMN adaptive_workout_cache.accepted IS 'Whether user accepted the generated workout';

-- =============================================================================
-- 4. ACCOUNTABILITY PODS
-- =============================================================================

CREATE TABLE IF NOT EXISTS accountability_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  max_members INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pod_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES accountability_pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_pod_member UNIQUE (pod_id, user_id)
);

CREATE TABLE IF NOT EXISTS pod_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES accountability_pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  target_sessions INTEGER NOT NULL,
  actual_sessions INTEGER NOT NULL DEFAULT 0,
  commitment_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pod_commitment UNIQUE (pod_id, user_id, week_start_date)
);

CREATE INDEX idx_pod_members_pod ON pod_members(pod_id) WHERE is_active = true;
CREATE INDEX idx_pod_members_user ON pod_members(user_id) WHERE is_active = true;
CREATE INDEX idx_pod_commitments_week ON pod_commitments(pod_id, week_start_date);

ALTER TABLE accountability_pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_commitments ENABLE ROW LEVEL SECURITY;

-- Pod members can read pod data
CREATE POLICY "Pod members can read pod"
  ON accountability_pods FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = accountability_pods.id
        AND pod_members.user_id = auth.uid()
        AND pod_members.is_active = true
    )
  );

CREATE POLICY "Users can create pods"
  ON accountability_pods FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Pod members can read members"
  ON pod_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pod_members pm
      WHERE pm.pod_id = pod_members.pod_id
        AND pm.user_id = auth.uid()
        AND pm.is_active = true
    )
  );

CREATE POLICY "Pod creators can manage members"
  ON pod_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accountability_pods
      WHERE accountability_pods.id = pod_members.pod_id
        AND accountability_pods.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can join pods"
  ON pod_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Pod members can read commitments"
  ON pod_commitments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = pod_commitments.pod_id
        AND pod_members.user_id = auth.uid()
        AND pod_members.is_active = true
    )
  );

CREATE POLICY "Users can manage own commitments"
  ON pod_commitments FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE accountability_pods IS 'Small accountability groups (3-5 members) for retention';
COMMENT ON TABLE pod_members IS 'Pod membership tracking with active/inactive status';
COMMENT ON TABLE pod_commitments IS 'Weekly workout commitments per pod member';

-- =============================================================================
-- 5. RELAPSE DETECTION
-- =============================================================================

CREATE TABLE IF NOT EXISTS relapse_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  days_inactive INTEGER NOT NULL,
  intervention_type TEXT NOT NULL CHECK (intervention_type IN ('reminder', 'plan', 'pod_notify')),
  severity TEXT NOT NULL CHECK (severity IN ('early', 'moderate', 'severe')),
  accepted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  comeback_plan_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_relapse_user ON relapse_interventions(user_id, detected_at DESC);
CREATE INDEX idx_relapse_pending ON relapse_interventions(user_id) WHERE accepted_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE relapse_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own interventions"
  ON relapse_interventions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert interventions"
  ON relapse_interventions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interventions"
  ON relapse_interventions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE relapse_interventions IS 'Tracks detected workout lapses and intervention attempts';
COMMENT ON COLUMN relapse_interventions.intervention_type IS 'reminder (day 3), plan (day 5-7), pod_notify (day 7+)';
COMMENT ON COLUMN relapse_interventions.severity IS 'early (missed usual day), moderate (7 days), severe (14+ days)';

-- =============================================================================
-- 6. HELPER FUNCTIONS
-- =============================================================================

-- Function to get Monday of current week (for pod commitments)
CREATE OR REPLACE FUNCTION get_week_start_date()
RETURNS DATE AS $$
BEGIN
  RETURN CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + 6) % 7;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_week_start_date() IS 'Returns Monday of current week (for pod weekly commitments)';

-- =============================================================================
-- 7. FEATURE FLAGS (via profiles table)
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}';

COMMENT ON COLUMN profiles.feature_flags IS 'User-specific feature flags for gradual rollouts (launcher_enabled, adaptive_enabled, pods_enabled, relapse_detection_enabled)';

-- =============================================================================
-- END OF MIGRATION 022
-- =============================================================================
