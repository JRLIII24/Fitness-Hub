/**
 * Distributed rate limiter with in-memory fallback.
 *
 * PRIMARY:  Upstash Redis — used when UPSTASH_REDIS_REST_URL + TOKEN are set.
 *           Provides distributed, cross-instance rate limiting suitable for
 *           production deployments on Vercel (multiple serverless instances).
 *
 * FALLBACK: In-memory sliding window — activates in two scenarios:
 *   1. Redis is not configured (local dev, CI).
 *   2. Redis IS configured but throws during a call (network blip, Redis down).
 *      Previously the code would fail-open (allow all) in this case.
 *      Now it enforces limits in-memory so the route is always protected.
 *
 * TRADE-OFF: The in-memory store is per-process. In a multi-instance deployment
 * (Vercel serverless) each cold-start gets its own empty map, so the effective
 * limit is (instances × limit). This is acceptable as a degraded-mode guard —
 * it's still far better than allowing unlimited requests during a Redis outage.
 *
 * MEMORY MANAGEMENT: A cleanup interval runs every 5 minutes to evict entries
 * whose window has expired. This bounds memory growth to O(active keys).
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// ---------------------------------------------------------------------------
// Redis / Upstash primary path
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

// Cache Ratelimit instances keyed by "limit:windowMs" so we don't recreate
// them on every request.
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${limit}:${windowMs}`;
  if (!limiters.has(key)) {
    limiters.set(
      key,
      new Ratelimit({
        redis,
        // Sliding window gives a smooth request distribution within any
        // rolling windowMs period (no "burst at window boundary" issue).
        limiter: Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
        analytics: true,
        prefix: "fithub:rl",
      }),
    );
  }
  return limiters.get(key)!;
}

// ---------------------------------------------------------------------------
// In-memory fallback: fixed sliding window per key
// ---------------------------------------------------------------------------

/**
 * A single in-memory rate-limit entry.
 *
 * We use a simple fixed window (not true sliding window) for the fallback.
 * This is intentional — simplicity over precision when Redis is absent/down.
 * The window resets `windowMs` milliseconds after the first request in that
 * window, not on a rolling basis.
 */
interface MemoryEntry {
  /** Number of requests seen in the current window. */
  count: number;
  /** Epoch ms when the current window started. */
  windowStart: number;
  /** The window duration in ms, stored per-entry for cleanup. */
  windowMs: number;
}

// Global store. Module-level singleton — persists across requests in the same
// process (serverless warm instance) but resets on cold start.
const memoryStore = new Map<string, MemoryEntry>();

/**
 * Enforce a fixed-window rate limit using the in-memory store.
 *
 * @returns true if the request is within the limit (allowed), false if blocked.
 */
function inMemoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    // No prior entry or the window has expired — start a fresh window.
    memoryStore.set(key, { count: 1, windowStart: now, windowMs });
    return true; // First request in the window is always allowed
  }

  if (entry.count >= limit) {
    // Window is still open and the limit has been reached.
    return false; // Blocked
  }

  // Window is open and count is below the limit — increment and allow.
  entry.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Periodic cleanup — evict expired entries to prevent unbounded memory growth
// ---------------------------------------------------------------------------

/**
 * Remove entries whose window has expired.
 * Runs every 5 minutes. At steady state with ~1 k unique rate-limit keys this
 * consumes negligible memory and CPU.
 *
 * The setInterval is guarded behind a typeof check so it doesn't run during
 * Edge Runtime where setInterval may not be available, and won't run during
 * test imports that don't need cleanup.
 */
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of memoryStore.entries()) {
        if (now - entry.windowStart >= entry.windowMs) {
          memoryStore.delete(key);
        }
      }
    },
    5 * 60 * 1000, // 5 minutes
  ).unref?.(); // .unref() lets the process exit even if this timer is pending (Node.js only)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check rate limit for a given key.
 *
 * @param key      - Unique identifier for the rate-limit bucket.
 *                   Use "routeName:userId" (e.g. "barcode:abc-123") to scope
 *                   limits per user rather than per IP.
 * @param limit    - Maximum number of requests allowed within the window.
 * @param windowMs - Window duration in milliseconds (e.g. 60_000 for 1 min).
 *
 * @returns Promise<true>  if the request is within the limit (allowed).
 *          Promise<false> if the rate limit has been exceeded (should 429).
 *
 * Failure modes:
 *  - Redis not configured → in-memory fallback (same behaviour as before)
 *  - Redis configured but throws → in-memory fallback (NEW: no longer fail-open)
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const limiter = getLimiter(limit, windowMs);

  if (!limiter) {
    // Redis is not configured (e.g. local dev without env vars).
    // Enforce limits in-memory so developers can still observe rate-limiting
    // behaviour without needing an Upstash account.
    return inMemoryRateLimit(key, limit, windowMs);
  }

  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch (err) {
    // Redis is configured but the call failed (network issue, Redis restart,
    // Upstash outage, etc.).
    //
    // PREVIOUS BEHAVIOUR: return true — silently allow all requests (fail-open).
    // NEW BEHAVIOUR: fall back to in-memory enforcement.
    //
    // This means during a Redis outage the limit is enforced per-process rather
    // than globally, but requests are still bounded rather than unlimited.
    console.error("[rate-limit] Redis call failed, using in-memory fallback:", err);
    return inMemoryRateLimit(key, limit, windowMs);
  }
}
