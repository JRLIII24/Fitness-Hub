/**
 * Rate-limiter in-memory fallback tests.
 *
 * Strategy: stub env vars so getLimiter() returns a Redis-backed Ratelimit,
 * but mock @upstash/ratelimit to throw on every .limit() call. This forces
 * the catch → inMemoryRateLimit() fallback path every time.
 *
 * We then import rate-limit.ts FRESH (vi.resetModules ensures the
 * module-level memoryStore Map is empty) and drive 200 requests through,
 * asserting the 201st returns false.
 *
 * Key implementation facts (src/lib/rate-limit.ts):
 *   - memoryStore: Map<string, MemoryEntry> — module-level singleton
 *   - Fixed window: count resets only after windowMs elapses
 *   - Redis failure path: catch(err) → inMemoryRateLimit(key, limit, windowMs)
 *   - Barcode route uses: rateLimit(`barcode:${user.id}`, 200, 60 * 60 * 1000)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Top-level mocks (hoisted by Vitest before any import) ──────────────────
// mockLimit is defined at module scope so beforeEach can reconfigure its
// rejection without needing to re-import or reconstruct the mock factory.
const mockLimit = vi.fn();

vi.mock("@upstash/redis", () => ({
  // Redis must be constructable; the instance itself is unused since
  // we intercept at the Ratelimit.limit() layer.
  Redis: vi.fn(() => ({})),
}));

vi.mock("@upstash/ratelimit", () => {
  // Ratelimit must be callable as `new Ratelimit({...})` AND expose
  // the static `.slidingWindow()` factory that getLimiter() calls.
  const Ratelimit = vi.fn(() => ({ limit: mockLimit }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Ratelimit as any).slidingWindow = vi.fn(() => ({}));
  return { Ratelimit };
});

// ── Test suite ─────────────────────────────────────────────────────────────
describe("rateLimit() — in-memory fallback when Redis fails", () => {
  // Matches the barcode route: rateLimit(`barcode:${user.id}`, 200, 3_600_000)
  const KEY = "barcode:deadbeef-1234-5678-90ab-cdef01234567";
  const LIMIT = 200;
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour

  beforeEach(() => {
    // vi.resetModules() clears the module registry but NOT mock registrations.
    // The next dynamic import() will re-execute rate-limit.ts, giving us a
    // FRESH memoryStore = new Map() for isolation between test cases.
    vi.resetModules();

    // Set Redis env vars so getLimiter() returns a non-null Ratelimit instance.
    // Without these, getLimiter() returns null and we skip to inMemoryRateLimit
    // directly — but we want to test the Redis-failure → fallback code path.
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token-abc";

    // Make Ratelimit.limit() always reject — simulates Redis connection failure.
    // This triggers the catch branch in rateLimit() that calls inMemoryRateLimit().
    mockLimit.mockRejectedValue(new Error("ECONNREFUSED: Redis unavailable"));
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.clearAllMocks();
  });

  it("allows exactly 200 requests then blocks the 201st via in-memory fallback", async () => {
    // Dynamic import AFTER vi.resetModules() gives a fresh module instance
    // with an empty memoryStore. The mocks registered above still apply.
    const { rateLimit } = await import("@/lib/rate-limit");

    // Requests 1–200: all must pass (in-memory count increments 1 → 200)
    for (let i = 1; i <= LIMIT; i++) {
      const allowed = await rateLimit(KEY, LIMIT, WINDOW_MS);
      expect(allowed, `Request #${i} should be allowed`).toBe(true);
    }

    // Request 201: in-memory entry.count === LIMIT → blocked
    const blocked = await rateLimit(KEY, LIMIT, WINDOW_MS);
    expect(blocked, "201st request must be blocked (429 territory)").toBe(
      false
    );
  });

  it("allows a second key independently after the first key is exhausted", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const KEY_B = "barcode:other-user-uuid-9999";

    // Exhaust KEY_A
    for (let i = 0; i < LIMIT; i++) {
      await rateLimit(KEY, LIMIT, WINDOW_MS);
    }
    expect(await rateLimit(KEY, LIMIT, WINDOW_MS)).toBe(false);

    // KEY_B has its own fresh window — must still be allowed
    expect(await rateLimit(KEY_B, LIMIT, WINDOW_MS)).toBe(true);
  });

  it("resets the window after WINDOW_MS elapses (fixed-window rollover)", async () => {
    const SHORT_WINDOW = 100; // 100ms for fast testing
    const SHORT_LIMIT = 3;
    const { rateLimit } = await import("@/lib/rate-limit");

    // Exhaust the short window
    for (let i = 0; i < SHORT_LIMIT; i++) {
      await rateLimit(KEY, SHORT_LIMIT, SHORT_WINDOW);
    }
    expect(await rateLimit(KEY, SHORT_LIMIT, SHORT_WINDOW)).toBe(false);

    // Wait for the window to expire
    await new Promise((resolve) => setTimeout(resolve, SHORT_WINDOW + 10));

    // Window has rolled over — first request of the new window is allowed
    const afterExpiry = await rateLimit(KEY, SHORT_LIMIT, SHORT_WINDOW);
    expect(afterExpiry).toBe(true);
  });

  it("falls back to in-memory when Redis env vars are absent (no-config path)", async () => {
    // Remove env vars so getLimiter() returns null (no Redis configured)
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { rateLimit } = await import("@/lib/rate-limit");
    const KEY_DEV = "barcode:dev-user";

    // Should still enforce limits via the direct in-memory path
    for (let i = 0; i < LIMIT; i++) {
      await rateLimit(KEY_DEV, LIMIT, WINDOW_MS);
    }
    expect(await rateLimit(KEY_DEV, LIMIT, WINDOW_MS)).toBe(false);
  });
});
