/**
 * Simple in-memory rate limiter using a sliding window.
 * Resets per key after windowMs milliseconds.
 * Note: In-process only — resets on server restart. Good for development/small scale.
 * Replace with Upstash Redis rate limiting for production multi-instance deployments.
 */

const store = new Map<string, { count: number; reset: number }>();

/**
 * Check and increment rate limit for a key.
 * @returns true if request is allowed, false if rate limit exceeded
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return true; // allowed
  }

  entry.count++;
  if (entry.count > limit) return false; // blocked

  return true; // allowed
}
