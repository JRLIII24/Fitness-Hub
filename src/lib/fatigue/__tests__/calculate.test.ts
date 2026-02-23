import { describe, expect, it } from "vitest";
import { calculateFatigueScore } from "../calculate";

describe("calculateFatigueScore", () => {
  it("blends weighted subscores and clamps output", () => {
    const result = calculateFatigueScore({
      sessionLoadToday: 300,
      avgLoad7d: 200,
      avgLoad28d: 180,
      strain: 1.5,
      recoveryRaw: 6,
      performanceDelta: -0.09,
      performanceComparableEffort: true,
      hasRecoveryCheckin: true,
      hasPerformanceHistory: true,
      hasLoadData: true,
    });

    expect(result.fatigueScore).toBeGreaterThanOrEqual(0);
    expect(result.fatigueScore).toBeLessThanOrEqual(100);
    expect(result.confidence).toBe("high");
  });

  it("uses neutral defaults for missing data", () => {
    const result = calculateFatigueScore({
      sessionLoadToday: null,
      avgLoad7d: null,
      avgLoad28d: null,
      strain: null,
      recoveryRaw: null,
      performanceDelta: null,
      performanceComparableEffort: false,
      hasRecoveryCheckin: false,
      hasPerformanceHistory: false,
      hasLoadData: false,
    });

    expect(result.fatigueScore).toBe(48);
    expect(result.confidence).toBe("low");
  });

  it("pushes high when strain, recovery, and performance are all poor", () => {
    const result = calculateFatigueScore({
      sessionLoadToday: 450,
      avgLoad7d: 200,
      avgLoad28d: 180,
      strain: 2.3,
      recoveryRaw: 8.5,
      performanceDelta: -0.2,
      performanceComparableEffort: true,
      hasRecoveryCheckin: true,
      hasPerformanceHistory: true,
      hasLoadData: true,
    });

    expect(result.fatigueScore).toBeGreaterThanOrEqual(85);
    expect(result.recommendation.label).toBe("Very high fatigue");
  });

  it("keeps fresh users in low/moderate range", () => {
    const result = calculateFatigueScore({
      sessionLoadToday: 80,
      avgLoad7d: 160,
      avgLoad28d: 170,
      strain: 0.6,
      recoveryRaw: 2,
      performanceDelta: 0.05,
      performanceComparableEffort: true,
      hasRecoveryCheckin: true,
      hasPerformanceHistory: true,
      hasLoadData: true,
    });

    expect(result.fatigueScore).toBeLessThanOrEqual(45);
  });
});
