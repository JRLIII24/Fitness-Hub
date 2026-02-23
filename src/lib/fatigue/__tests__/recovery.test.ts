import { describe, expect, it } from "vitest";
import { deriveRecoveryRaw } from "../calculate";

describe("deriveRecoveryRaw", () => {
  it("inverts sleep and motivation correctly", () => {
    const raw = deriveRecoveryRaw({
      sleep_quality: 9,
      soreness: 2,
      stress: 3,
      motivation: 8,
    });

    // (1 + 2 + 3 + 2) / 4
    expect(raw).toBe(2);
  });

  it("returns null for missing check-in", () => {
    expect(deriveRecoveryRaw(null)).toBeNull();
  });
});
