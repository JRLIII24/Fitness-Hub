import { describe, it, expect } from "vitest";
import { estimateE1RM } from "../e1rm";

describe("estimateE1RM", () => {
  it("returns the weight itself for 1 rep", () => {
    expect(estimateE1RM(100, 1)).toBe(100);
  });

  it("returns null for 0 reps", () => {
    expect(estimateE1RM(100, 0)).toBeNull();
  });

  it("returns null for > 12 reps", () => {
    expect(estimateE1RM(100, 13)).toBeNull();
  });

  it("returns null for 0 weight", () => {
    expect(estimateE1RM(0, 5)).toBeNull();
  });

  it("calculates Brzycki e1RM for 5 reps at 100kg", () => {
    // Brzycki: 100 * (36 / (37 - 5)) = 100 * (36/32) = 112.5
    const result = estimateE1RM(100, 5);
    expect(result).toBeCloseTo(112.5, 1);
  });

  it("calculates Brzycki e1RM for 10 reps at 80kg", () => {
    // Brzycki: 80 * (36 / (37 - 10)) = 80 * (36/27) ≈ 106.67
    const result = estimateE1RM(80, 10);
    expect(result).toBeCloseTo(106.67, 1);
  });

  it("higher reps yield higher e1RM at same weight", () => {
    const e1rm5 = estimateE1RM(100, 5)!;
    const e1rm8 = estimateE1RM(100, 8)!;
    expect(e1rm8).toBeGreaterThan(e1rm5);
  });
});
