/**
 * RLS Integration Tests: wearable_integrations cross-user isolation
 *
 * Schema defined in: supabase/migrations/078_wearable_integrations.sql
 *
 * RLS policy:
 *   CREATE POLICY "Users manage own wearable integrations"
 *     ON wearable_integrations FOR ALL TO authenticated
 *     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
 *
 * Column-level security:
 *   REVOKE SELECT (access_token, refresh_token) ON wearable_integrations FROM authenticated;
 *   GRANT  SELECT (access_token, refresh_token) ON wearable_integrations TO service_role;
 *
 * This test verifies:
 *   1. User A's SELECT returns 0 rows for User B's data (silent RLS filter).
 *   2. User A's UPDATE on User B's row affects 0 rows.
 *   3. User A's DELETE on User B's row affects 0 rows.
 *   4. The authenticated role cannot SELECT access_token / refresh_token.
 *   5. User B can read and manage their own integration (positive check).
 *
 * Prerequisites (run once):
 *   supabase start
 *   # Create two test users and export their access JWTs:
 *   #   supabase/seed.sql or POST /auth/v1/signup via supabase-js
 *   export SUPABASE_LOCAL_URL=http://127.0.0.1:54321
 *   export SUPABASE_ANON_KEY=<from: supabase status>
 *   export SUPABASE_SERVICE_ROLE_KEY=<from: supabase status>
 *   export JWT_USER_A=<access_token for user A>
 *   export USER_A_ID=<uuid of user A>
 *   export JWT_USER_B=<access_token for user B>
 *   export USER_B_ID=<uuid of user B>
 *
 * Run:
 *   pnpm vitest --config vitest.config.node.ts run tests/integration/rls-wearable.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// ── Environment ──────────────────────────────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_USER_A = process.env.JWT_USER_A!;
const USER_A_ID = process.env.USER_A_ID!;
const JWT_USER_B = process.env.JWT_USER_B!;
const USER_B_ID = process.env.USER_B_ID!;

// Guard: skip integration tests if env vars are absent (CI without Supabase)
const SKIP = !ANON_KEY || !SERVICE_ROLE_KEY || !JWT_USER_A || !JWT_USER_B;

// ── Client factories ─────────────────────────────────────────────────────────
/**
 * Creates a Supabase client that authenticates as a specific user.
 * Uses the anon key + Authorization: Bearer <JWT> pattern, which is how
 * the PostgREST RLS evaluator reads auth.uid().
 */
function userClient(jwt: string) {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

/** Service-role client bypasses RLS — used only for test setup/teardown. */
const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const clientA = userClient(JWT_USER_A);
const clientB = userClient(JWT_USER_B);

// ── State shared across tests ────────────────────────────────────────────────
let userBIntegrationId: string;

// ── Setup ────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  if (SKIP) return;

  // Insert a Garmin integration for User B via service_role (bypasses RLS)
  // We omit access_token/refresh_token — those columns are tested separately
  const { data, error } = await admin
    .from("wearable_integrations")
    .insert({
      user_id: USER_B_ID,
      provider: "garmin",
      is_active: true,
      scopes: ["activity:read", "heartrate:read"],
      provider_user_id: "garmin-test-user-99",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `RLS test seed failed: ${error?.message ?? "no data returned"}`
    );
  }

  userBIntegrationId = data.id;
});

// ── Teardown ─────────────────────────────────────────────────────────────────
afterAll(async () => {
  if (SKIP || !userBIntegrationId) return;

  await admin
    .from("wearable_integrations")
    .delete()
    .eq("id", userBIntegrationId);
});

// ── Test cases ────────────────────────────────────────────────────────────────
const describeOrSkip = SKIP ? describe.skip : describe;

describeOrSkip("RLS: wearable_integrations cross-user isolation", () => {
  it("User A SELECT returns 0 rows for User B data (silent RLS filter)", async () => {
    const { data, error } = await clientA
      .from("wearable_integrations")
      .select("id, provider, is_active")
      .eq("user_id", USER_B_ID);

    // RLS filters rows silently — no error, just empty result set
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("User A direct-ID SELECT also returns 0 rows (RLS on primary key)", async () => {
    // Even if attacker knows the row UUID, RLS must filter it
    const { data, error } = await clientA
      .from("wearable_integrations")
      .select("*")
      .eq("id", userBIntegrationId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("User A UPDATE on User B row affects 0 rows", async () => {
    const { error } = await clientA
      .from("wearable_integrations")
      .update({ is_active: false })
      .eq("id", userBIntegrationId);

    // Supabase returns null error + 0 modified rows when RLS rejects the target
    expect(error).toBeNull();

    // Verify the row is unchanged using the service-role client
    const { data: verification } = await admin
      .from("wearable_integrations")
      .select("is_active")
      .eq("id", userBIntegrationId)
      .single();

    expect(verification?.is_active).toBe(true); // RLS blocked the update
  });

  it("User A DELETE on User B row affects 0 rows", async () => {
    const { error } = await clientA
      .from("wearable_integrations")
      .delete()
      .eq("id", userBIntegrationId);

    expect(error).toBeNull();

    // Row must still exist
    const { data } = await admin
      .from("wearable_integrations")
      .select("id")
      .eq("id", userBIntegrationId)
      .single();

    expect(data?.id).toBe(userBIntegrationId);
  });

  it("authenticated role cannot SELECT access_token or refresh_token", async () => {
    /**
     * Migration 078 executes:
     *   REVOKE SELECT (access_token, refresh_token) ON wearable_integrations FROM authenticated;
     *
     * When the authenticated role (User B accessing their own row) tries to
     * SELECT these columns, PostgREST must return a 403 / column-privilege error.
     */
    const { data, error } = await clientB
      .from("wearable_integrations")
      .select("id, access_token, refresh_token") // Revoked columns
      .eq("user_id", USER_B_ID);

    // Must get a permission error — NOT an empty result
    expect(error).toBeTruthy();
    // PostgreSQL error code 42501 = insufficient_privilege
    const isPermissionError =
      error!.code === "42501" ||
      /insufficient_privilege|permission denied/i.test(
        error!.message + (error!.details ?? "")
      );
    expect(isPermissionError).toBe(true);
  });

  it("User B can SELECT their own integration (non-sensitive columns)", async () => {
    const { data, error } = await clientB
      .from("wearable_integrations")
      .select("id, provider, is_active, scopes")
      .eq("user_id", USER_B_ID);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].provider).toBe("garmin");
    expect(data![0].is_active).toBe(true);
    expect(data![0].scopes).toContain("activity:read");
  });

  it("User B can UPDATE their own integration (positive RLS check)", async () => {
    const { error } = await clientB
      .from("wearable_integrations")
      .update({ scopes: ["activity:read"] }) // Narrow the scopes
      .eq("id", userBIntegrationId);

    expect(error).toBeNull();

    // Verify the update landed
    const { data } = await admin
      .from("wearable_integrations")
      .select("scopes")
      .eq("id", userBIntegrationId)
      .single();

    expect(data?.scopes).toEqual(["activity:read"]);
  });
});
