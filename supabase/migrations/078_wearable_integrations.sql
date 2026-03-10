-- Migration 078: Wearable Integrations + Health Events
--
-- Introduces two tables:
--
--   wearable_integrations  — OAuth token storage for Garmin, Apple Health,
--                            Google Fit. Tokens encrypted via pgcrypto
--                            (pgp_sym_encrypt) with app-side ENCRYPTION_KEY.
--                            Column-level REVOKE prevents the `authenticated`
--                            role from reading ciphertext; only `service_role`
--                            can SELECT access_token / refresh_token.
--
--   health_events          — Granular biometric event log (per-event, not
--                            per-day). Counterpart to the daily-aggregate
--                            health_sync_data table (migration 064). A future
--                            cron will roll health_events up into
--                            health_sync_data to feed the readiness engine
--                            (src/lib/readiness/) without code changes there.
--
-- Security model:
--   - RLS (owner-only FOR ALL) on both tables.
--   - Tokens additionally encrypted at rest; pgcrypto symmetric key lives
--     in ENCRYPTION_KEY env var, never stored in the database.
--   - Service role bypasses RLS to read/write tokens in API routes.

-- ---------------------------------------------------------------------------
-- Enable pgcrypto (idempotent; bundled with all Supabase Postgres instances)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- wearable_integrations — OAuth provider credentials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wearable_integrations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         TEXT        NOT NULL CHECK (provider IN ('garmin', 'apple_health', 'google_fit')),
  -- Stored as pgp_sym_encrypt(plaintext_token, ENCRYPTION_KEY)::TEXT
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes           TEXT[],
  provider_user_id TEXT,       -- provider's internal user ID for deduplication
  last_sync_at     TIMESTAMPTZ,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)   -- one integration per provider per user
);

CREATE INDEX IF NOT EXISTS idx_wearable_integrations_user
  ON wearable_integrations(user_id);

CREATE INDEX IF NOT EXISTS idx_wearable_integrations_active
  ON wearable_integrations(user_id, provider)
  WHERE is_active = TRUE;

ALTER TABLE wearable_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wearable integrations"
  ON wearable_integrations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Token columns are inaccessible to the authenticated role.
-- Decryption happens only in server-side routes using the service_role key.
REVOKE SELECT (access_token, refresh_token) ON wearable_integrations FROM authenticated;
GRANT  SELECT (access_token, refresh_token) ON wearable_integrations TO service_role;

-- Auto-update updated_at (reuses function from migration 001)
CREATE TRIGGER wearable_integrations_updated_at
  BEFORE UPDATE ON wearable_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- health_events — granular biometric event log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_events (
  id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID              NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source            TEXT              NOT NULL CHECK (source IN ('garmin', 'healthkit', 'google_fit', 'manual')),
  event_type        TEXT              NOT NULL CHECK (event_type IN (
                      'sleep', 'heart_rate', 'hrv', 'steps', 'activity',
                      'calories_burned', 'vo2max', 'spo2', 'stress'
                    )),
  event_ts          TIMESTAMPTZ       NOT NULL,  -- when the biological event occurred
  duration_seconds  INT,                          -- for sleep / activity events; NULL for point metrics
  value_numeric     DOUBLE PRECISION,             -- HR (bpm), HRV (ms), VO2max (ml/kg/min), etc.
  value_json        JSONB,                        -- complex events: sleep stages, activity breakdown
  unit              TEXT,                         -- 'bpm', 'ms', 'steps', 'hours', 'kcal', 'ml/kg/min', '%'
  provider_event_id TEXT,                         -- Garmin activity ID, HealthKit UUID; NULL OK for manual
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  -- Idempotent ingest: duplicate provider events are silently skipped.
  -- NULL provider_event_ids are exempt (Postgres NULLs are never equal).
  UNIQUE (user_id, source, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_health_events_user_type_ts
  ON health_events(user_id, event_type, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_health_events_user_ts
  ON health_events(user_id, event_ts DESC);

ALTER TABLE health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own health events"
  ON health_events FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
