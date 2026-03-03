import { describe, it, expect } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows requests when Redis is not configured (dev fallback)", async () => {
    // Without UPSTASH_REDIS_REST_URL/TOKEN, rateLimit falls back to allow-all
    const key = "test-allow-" + Math.random();
    expect(await rateLimit(key, 1, 60000)).toBe(true);
    expect(await rateLimit(key, 1, 60000)).toBe(true);
    expect(await rateLimit(key, 1, 60000)).toBe(true);
  });

  it("returns a promise", () => {
    const result = rateLimit("test-promise", 1, 60000);
    expect(result).toBeInstanceOf(Promise);
  });
});
