/**
 * Route-level test: GET /api/nutrition/barcode/[code]
 *
 * Verifies that the route handler returns HTTP 429 once rateLimit() returns
 * false (201st request). We call the exported GET function directly without
 * spinning up an HTTP server, mocking the three external dependencies:
 *   - @/lib/rate-limit   → controls whether the request is allowed
 *   - @/lib/supabase/server → provides the authenticated Supabase client
 *   - @/lib/auth-utils   → requireAuth() returns a mocked user
 *
 * Route: src/app/api/nutrition/barcode/[code]/route.ts
 * Rate limit: rateLimit(`barcode:${user.id}`, 200, 60 * 60 * 1000)
 * 429 response body: { error: "Rate limit exceeded. You may scan up to 200 barcodes per hour." }
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Module-level mocks (hoisted before imports) ────────────────────────────
const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: "user-abc-123" },
    response: null,
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────
function makeRequest(code: string): Request {
  return new Request(`http://localhost:3000/api/nutrition/barcode/${code}`, {
    method: "GET",
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("GET /api/nutrition/barcode/[code] — rate-limit enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    // Default: rate limit not exceeded
    mockRateLimit.mockResolvedValue(true);
  });

  afterEach(() => vi.clearAllMocks());

  it("returns 429 with descriptive error when rateLimit returns false", async () => {
    // Simulate the 201st call: in-memory fallback has exhausted the quota
    mockRateLimit.mockResolvedValue(false);

    const { GET } = await import(
      "@/app/api/nutrition/barcode/[code]/route"
    );

    const response = await GET(makeRequest("0737628064502"), {
      params: Promise.resolve({ code: "0737628064502" }),
    });

    expect(response.status).toBe(429);

    const body = await response.json();
    // Exact text from the route: "Rate limit exceeded. You may scan up to 200 barcodes per hour."
    expect(body.error).toMatch(/rate limit exceeded/i);
    expect(body.error).toMatch(/200/);
  });

  it("proceeds past the rate-limit guard when allowed (baseline)", async () => {
    // Rate limit passes → route reaches the OFB fetch
    // Return a 404-equivalent from OFB so we get a 404 back (NOT 429)
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const { GET } = await import(
      "@/app/api/nutrition/barcode/[code]/route"
    );

    const response = await GET(makeRequest("9999"), {
      params: Promise.resolve({ code: "9999" }),
    });

    // The important assertion: not rate-limited
    expect(response.status).not.toBe(429);
    expect(response.status).toBe(404); // OFB returned non-ok
  });

  it("returns 400 for an empty barcode code", async () => {
    const { GET } = await import(
      "@/app/api/nutrition/barcode/[code]/route"
    );

    const response = await GET(makeRequest("   "), {
      params: Promise.resolve({ code: "   " }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/barcode is required/i);
  });
});
