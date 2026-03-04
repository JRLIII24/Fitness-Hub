import { describe, it, expect } from "vitest";
import { getBackoffMs } from "../queue";

describe("getBackoffMs", () => {
  it("returns ~1s for first retry", () => {
    const ms = getBackoffMs(1);
    // Base is 1000ms, with ±25% jitter: 750-1500ms
    expect(ms).toBeGreaterThanOrEqual(750);
    expect(ms).toBeLessThanOrEqual(1500);
  });

  it("returns ~2s for second retry", () => {
    const ms = getBackoffMs(2);
    // 2000ms * 0.75-1.25 = 1500-2500ms
    expect(ms).toBeGreaterThanOrEqual(1500);
    expect(ms).toBeLessThanOrEqual(2500);
  });

  it("returns ~4s for third retry", () => {
    const ms = getBackoffMs(3);
    expect(ms).toBeGreaterThanOrEqual(3000);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it("caps at 5 minutes for high attempt counts", () => {
    const ms = getBackoffMs(20);
    const maxWithJitter = 5 * 60 * 1000 * 1.25;
    expect(ms).toBeLessThanOrEqual(maxWithJitter);
  });

  it("increases with each attempt", () => {
    // Due to jitter, we check averaged behavior over multiple samples
    const samples = 100;
    let avg1 = 0, avg3 = 0, avg5 = 0;
    for (let i = 0; i < samples; i++) {
      avg1 += getBackoffMs(1);
      avg3 += getBackoffMs(3);
      avg5 += getBackoffMs(5);
    }
    avg1 /= samples;
    avg3 /= samples;
    avg5 /= samples;

    expect(avg3).toBeGreaterThan(avg1);
    expect(avg5).toBeGreaterThan(avg3);
  });
});
