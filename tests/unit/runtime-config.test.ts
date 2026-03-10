/**
 * Auth guard test: GET /api/runtime-config
 *
 * The route requires authentication to prevent unauthenticated clients from
 * probing which features are enabled or disabled. When requireAuth() detects
 * no valid session, it returns a { user: null, response: NextResponse<401> }
 * and the route immediately returns that response.
 *
 * Route: src/app/api/runtime-config/route.ts
 * Returns: { maintenanceMode: boolean, disabledFeatures: string[] }
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Module mocks (hoisted) ──────────────────────────────────────────────────
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth-utils", () => ({
  requireAuth: mockRequireAuth,
}));

// ── Tests ──────────────────────────────────────────────────────────────────
describe("GET /api/runtime-config — auth guard", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();

    // Default: unauthenticated request
    mockRequireAuth.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore env overrides
    Object.keys(process.env).forEach((k) => {
      if (!(k in savedEnv)) delete process.env[k];
    });
    Object.assign(process.env, savedEnv);
  });

  it("returns 401 when request has no valid session", async () => {
    const { GET } = await import("@/app/api/runtime-config/route");

    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 200 with maintenanceMode and disabledFeatures when authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce({
      user: { id: "user-authed-uuid" },
      response: null,
    });

    process.env.DISABLED_FEATURES = "feature_a,feature_b";
    process.env.MAINTENANCE_MODE = "false";

    const { GET } = await import("@/app/api/runtime-config/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("maintenanceMode");
    expect(body).toHaveProperty("disabledFeatures");
    expect(Array.isArray(body.disabledFeatures)).toBe(true);
  });

  it("does not expose config to an unauthenticated OPTIONS preflight probe", async () => {
    // Even if a CORS preflight somehow reaches the GET handler, it should 401
    const { GET } = await import("@/app/api/runtime-config/route");
    const response = await GET();

    // Auth gate must fire before any config is read
    expect(response.status).toBe(401);
  });
});
