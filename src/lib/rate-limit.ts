/**
 * Distributed rate limiter powered by Upstash Redis.
 * Falls back to allow-all when Redis is not configured (dev mode).
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

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
        limiter: Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
        analytics: true,
        prefix: "fithub:rl",
      }),
    );
  }
  return limiters.get(key)!;
}

/**
 * Check rate limit for a key.
 * @returns true if allowed, false if rate limit exceeded.
 * Falls back to allow-all if Redis is not configured.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const limiter = getLimiter(limit, windowMs);
  if (!limiter) return true;
  const { success } = await limiter.limit(key);
  return success;
}
