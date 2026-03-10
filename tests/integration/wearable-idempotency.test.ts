/**
 * Idempotency Integration Tests: health_events UNIQUE constraint
 *
 * Schema defined in: supabase/migrations/078_wearable_integrations.sql
 *
 * Relevant constraint:
 *   UNIQUE (user_id, source, provider_event_id)
 *   -- "Idempotent ingest: duplicate provider events are silently skipped.
 *   --  NULL provider_event_ids are exempt (Postgres NULLs are never equal)."
 *
 * The ingest pipeline in the sync route (currently stubbed as 501) uses:
 *   supabase.from('health_events').upsert(events, {
 *     onConflict: 'user_id,source,provider_event_id',
 *     ignoreDuplicates: true
 *   })
 *
 * This test exercises the DB-level constraint directly, which is the correct
 * layer to test since the idempotency guarantee lives in the schema.
 *
 * When the sync pipeline is implemented (OAuth credentials added), extend
 * these tests with route-level assertions:
 *   POST /api/wearable/sync/garmin (twice, same payload) → health_events count = 1
 *
 * Prerequisites:
 *   supabase start
 *   export SUPABASE_LOCAL_URL=http://127.0.0.1:54321
 *   export SUPABASE_SERVICE_ROLE_KEY=<from: supabase status>
 *   export TEST_USER_ID=<uuid of a user in auth.users>
 *
 * Run:
 *   pnpm vitest --config vitest.config.node.ts run tests/integration/wearable-idempotency.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// ── Environment ──────────────────────────────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_USER_ID =
  process.env.TEST_USER_ID ?? "00000000-0000-0000-0000-000000000001";

const SKIP = !SERVICE_ROLE_KEY;

/** Service-role admin client — bypasses RLS for direct DB testing */
const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * A realistic Garmin activity event as normalized to our health_events schema.
 * provider_event_id mimics Garmin Connect's stable activity UUID format.
 */
const GARMIN_ACTIVITY: Database["public"]["Tables"]["health_events"]["Insert"] =
  {
    user_id: TEST_USER_ID,
    source: "garmin",
    event_type: "activity",
    event_ts: "2026-03-09T08:30:00Z",
    duration_seconds: 3600,
    value_numeric: 480, // kcal burned
    value_json: {
      activity_type: "strength_training",
      activity_name: "Morning Lift",
      avg_heart_rate_bpm: 142,
    },
    unit: "kcal",
    provider_event_id: "garmin-act-test-abc123xyz", // stable Garmin activity ID
  };

/** A different event for the same user (should coexist with the first) */
const GARMIN_HRV_EVENT: Database["public"]["Tables"]["health_events"]["Insert"] =
  {
    user_id: TEST_USER_ID,
    source: "garmin",
    event_type: "hrv",
    event_ts: "2026-03-09T07:00:00Z",
    value_numeric: 52, // HRV in ms
    unit: "ms",
    provider_event_id: "garmin-hrv-test-def456uvw",
  };

// ── Cleanup helpers ───────────────────────────────────────────────────────────
async function deleteTestEvents() {
  await admin
    .from("health_events")
    .delete()
    .eq("user_id", TEST_USER_ID)
    .in("provider_event_id", [
      GARMIN_ACTIVITY.provider_event_id!,
      GARMIN_HRV_EVENT.provider_event_id!,
    ]);

  // Also clean manual (NULL provider_event_id) test rows
  await admin
    .from("health_events")
    .delete()
    .eq("user_id", TEST_USER_ID)
    .eq("source", "manual")
    .is("provider_event_id", null);
}

beforeAll(async () => {
  if (SKIP) return;
  await deleteTestEvents();
});

afterAll(async () => {
  if (SKIP) return;
  await deleteTestEvents();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
const describeOrSkip = SKIP ? describe.skip : describe;

describeOrSkip(
  "health_events idempotent ingest — UNIQUE(user_id, source, provider_event_id)",
  () => {
    it("inserts a Garmin activity event on the first upsert", async () => {
      const { data, error } = await admin
        .from("health_events")
        .upsert(GARMIN_ACTIVITY, {
          onConflict: "user_id,source,provider_event_id",
          ignoreDuplicates: true,
        })
        .select("id, provider_event_id, event_type");

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].provider_event_id).toBe(
        GARMIN_ACTIVITY.provider_event_id
      );
      expect(data![0].event_type).toBe("activity");
    });

    it("silently skips the duplicate on the second upsert (idempotent)", async () => {
      // Exact same payload — must not create a second row
      const { error } = await admin
        .from("health_events")
        .upsert(GARMIN_ACTIVITY, {
          onConflict: "user_id,source,provider_event_id",
          ignoreDuplicates: true,
        });

      expect(error).toBeNull();

      // Verify exactly one row exists for this provider_event_id
      const { count, error: countErr } = await admin
        .from("health_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", TEST_USER_ID)
        .eq("provider_event_id", GARMIN_ACTIVITY.provider_event_id!);

      expect(countErr).toBeNull();
      expect(count).toBe(1); // ← Key assertion: no duplicate
    });

    it("a third upsert (webhook retry) also produces no duplicate", async () => {
      // Simulates Garmin resending the same webhook after a timeout
      const { error } = await admin
        .from("health_events")
        .upsert(GARMIN_ACTIVITY, {
          onConflict: "user_id,source,provider_event_id",
          ignoreDuplicates: true,
        });

      expect(error).toBeNull();

      const { count } = await admin
        .from("health_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", TEST_USER_ID)
        .eq("provider_event_id", GARMIN_ACTIVITY.provider_event_id!);

      expect(count).toBe(1); // Still just one row
    });

    it("allows a different event_id to coexist alongside the existing row", async () => {
      const { error } = await admin
        .from("health_events")
        .upsert(GARMIN_HRV_EVENT, {
          onConflict: "user_id,source,provider_event_id",
          ignoreDuplicates: true,
        });

      expect(error).toBeNull();

      const { count } = await admin
        .from("health_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", TEST_USER_ID)
        .in("provider_event_id", [
          GARMIN_ACTIVITY.provider_event_id!,
          GARMIN_HRV_EVENT.provider_event_id!,
        ]);

      expect(count).toBe(2); // Two distinct events, neither a duplicate
    });

    it("NULL provider_event_ids are NOT deduplicated (Postgres NULL ≠ NULL)", async () => {
      /**
       * Migration comment: "NULL provider_event_ids are exempt
       * (Postgres NULLs are never equal)."
       *
       * Manual entries entered directly by the user have no provider_event_id.
       * Two manual step entries on the same day should both persist.
       * Without this behavior, manual corrections would silently fail.
       */
      const MANUAL_STEPS_AM = {
        user_id: TEST_USER_ID,
        source: "manual" as const,
        event_type: "steps" as const,
        event_ts: "2026-03-09T12:00:00Z",
        value_numeric: 5000,
        unit: "steps",
        provider_event_id: null, // Manual — no provider ID
      };

      const MANUAL_STEPS_PM = {
        ...MANUAL_STEPS_AM,
        event_ts: "2026-03-09T18:00:00Z",
        value_numeric: 8500,
      };

      await admin.from("health_events").upsert(MANUAL_STEPS_AM, {
        onConflict: "user_id,source,provider_event_id",
        ignoreDuplicates: true,
      });

      await admin.from("health_events").upsert(MANUAL_STEPS_PM, {
        onConflict: "user_id,source,provider_event_id",
        ignoreDuplicates: true,
      });

      const { count } = await admin
        .from("health_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", TEST_USER_ID)
        .eq("source", "manual")
        .is("provider_event_id", null);

      // Both NULL-ID rows must exist — Postgres UNIQUE ignores NULLs
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("direct INSERT with same provider_event_id raises a unique-violation error", async () => {
      /**
       * This test verifies the UNIQUE constraint at the raw Postgres level
       * (bypassing PostgREST upsert). It simulates a naive INSERT without
       * ON CONFLICT — which is what a broken ingest pipeline would do.
       */
      const { error } = await admin
        .from("health_events")
        .insert(GARMIN_ACTIVITY); // No upsert / ignoreDuplicates

      // Must get a unique-violation error (PostgreSQL code 23505)
      expect(error).toBeTruthy();
      expect(
        error!.code === "23505" ||
          /unique.*(violation|constraint)/i.test(
            error!.message + (error!.details ?? "")
          )
      ).toBe(true);
    });
  }
);
