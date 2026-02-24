-- Migration 039: Schedule stale workout cleanup + grant RPC execute
--
-- Two-layer safety net for ghost "currently working out" sessions:
--
-- Layer 1 (preferred): pg_cron job runs cleanup_stale_workouts() every hour.
--   Available on Supabase Pro plans with the pg_cron extension enabled.
--   The DO block below silently skips if pg_cron is not installed.
--
-- Layer 2 (fallback): dashboard/page.tsx calls supabase.rpc('cleanup_stale_workouts')
--   as a fire-and-forget RSC side-effect on every dashboard visit.
--   Requires EXECUTE permission granted below.
--
-- Both layers are safe to run concurrently — the DELETE is idempotent.

-- ── Layer 1: pg_cron schedule ──────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- cron.schedule is idempotent: updates the existing job if name matches.
    PERFORM cron.schedule(
      'cleanup-stale-workouts',
      '0 * * * *',
      'SELECT cleanup_stale_workouts()'
    );
  END IF;
EXCEPTION
  -- pg_cron schema or function not available (Free plan without extension).
  WHEN undefined_table  THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN others           THEN NULL;
END $$;

-- ── Layer 2: grant RPC execute to authenticated role ─────────────────────
-- cleanup_stale_workouts() is SECURITY DEFINER so it runs as its owner
-- (postgres/supabase_admin) regardless of the caller's role. The GRANT
-- below allows the dashboard server-side Supabase client (anon key + user
-- session = authenticated role) to invoke it via supabase.rpc().
GRANT EXECUTE ON FUNCTION cleanup_stale_workouts() TO authenticated;
