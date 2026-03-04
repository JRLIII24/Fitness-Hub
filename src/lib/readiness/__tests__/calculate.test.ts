import { describe, it, expect } from "vitest";
import { calculateReadiness } from "../calculate";
import type { ReadinessInputs } from "../types";

describe("calculateReadiness", () => {
  it("all domains present → weighted blend, high confidence", () => {
    const inputs: ReadinessInputs = {
      fatigueScore: 30, // training = 70
      nutritionCompliance: { daysTracked: 3, avgCaloriePct: 95, avgProteinPct: 100 },
      recoveryRaw: 2, // inverted: 8 → 80
      healthKit: { sleepHours: 8, restingHeartRate: 55, hrvMs: 85, steps: 10000 },
    };

    const result = calculateReadiness(inputs);

    expect(result.confidence).toBe("high");
    expect(result.readinessScore).toBeGreaterThanOrEqual(60);
    expect(result.readinessScore).toBeLessThanOrEqual(100);
    expect(result.domains.training).toBe(70);
    expect(result.domains.nutrition).toBe(90); // both in 70-120 range
    expect(result.domains.recovery).toBe(80);
    expect(result.domains.external).not.toBeNull();
    expect(result.level).toMatch(/peak|good/);
  });

  it("missing HealthKit → weights redistribute, no external domain", () => {
    const inputs: ReadinessInputs = {
      fatigueScore: 30,
      nutritionCompliance: { daysTracked: 3, avgCaloriePct: 95, avgProteinPct: 100 },
      recoveryRaw: 2,
      healthKit: null,
    };

    const result = calculateReadiness(inputs);

    expect(result.domains.external).toBeNull();
    expect(result.confidence).toBe("high"); // 3 domains still present
    // Without external: 0.4*70 + 0.25*90 + 0.35*80 = 28 + 22.5 + 28 = 78.5 → 79
    expect(result.readinessScore).toBeCloseTo(79, 0);
  });

  it("all null inputs → defaults to 50, low confidence", () => {
    const inputs: ReadinessInputs = {
      fatigueScore: null,
      nutritionCompliance: null,
      recoveryRaw: null,
      healthKit: null,
    };

    const result = calculateReadiness(inputs);

    expect(result.confidence).toBe("low");
    expect(result.domains.training).toBe(50);
    expect(result.domains.nutrition).toBe(50);
    expect(result.domains.recovery).toBe(50);
    expect(result.domains.external).toBeNull();
    // 0.4*50 + 0.25*50 + 0.35*50 = 50
    expect(result.readinessScore).toBe(50);
    expect(result.level).toBe("moderate");
  });

  it("high fatigue + poor nutrition → low readiness", () => {
    const inputs: ReadinessInputs = {
      fatigueScore: 85, // training = 15
      nutritionCompliance: { daysTracked: 2, avgCaloriePct: 30, avgProteinPct: 40 },
      recoveryRaw: 8, // inverted: 2 → 20
      healthKit: null,
    };

    const result = calculateReadiness(inputs);

    expect(result.domains.training).toBe(15);
    expect(result.domains.recovery).toBe(20);
    expect(result.readinessScore).toBeLessThan(30);
    expect(result.level).toMatch(/low|rest/);
    expect(result.confidence).toBe("high"); // 3 domains present
  });

  it("fresh + good nutrition + good recovery → peak readiness", () => {
    const inputs: ReadinessInputs = {
      fatigueScore: 10, // training = 90
      nutritionCompliance: { daysTracked: 3, avgCaloriePct: 100, avgProteinPct: 110 },
      recoveryRaw: 1, // inverted: 9 → 90
      healthKit: null,
    };

    const result = calculateReadiness(inputs);

    expect(result.domains.training).toBe(90);
    expect(result.domains.nutrition).toBe(90);
    expect(result.domains.recovery).toBe(90);
    // 0.4*90 + 0.25*90 + 0.35*90 = 90
    expect(result.readinessScore).toBe(90);
    expect(result.level).toBe("peak");
    expect(result.recommendation).toContain("high-intensity");
  });

  it("nutrition compliance at 70% boundary → scores 90", () => {
    const inputs: ReadinessInputs = {
      fatigueScore: null,
      nutritionCompliance: { daysTracked: 3, avgCaloriePct: 70, avgProteinPct: 70 },
      recoveryRaw: null,
      healthKit: null,
    };

    const result = calculateReadiness(inputs);
    expect(result.domains.nutrition).toBe(90);
  });

  it("nutrition compliance at 120% boundary → scores 90", () => {
    const inputs: ReadinessInputs = {
      fatigueScore: null,
      nutritionCompliance: { daysTracked: 3, avgCaloriePct: 120, avgProteinPct: 120 },
      recoveryRaw: null,
      healthKit: null,
    };

    const result = calculateReadiness(inputs);
    expect(result.domains.nutrition).toBe(90);
  });

  it("nutrition compliance at 150% → mild penalty, capped at 70", () => {
    const inputs: ReadinessInputs = {
      fatigueScore: null,
      nutritionCompliance: { daysTracked: 3, avgCaloriePct: 150, avgProteinPct: 150 },
      recoveryRaw: null,
      healthKit: null,
    };

    const result = calculateReadiness(inputs);
    expect(result.domains.nutrition).toBeGreaterThanOrEqual(70);
    expect(result.domains.nutrition).toBeLessThan(90);
  });

  it("0 days tracked nutrition → defaults to 50", () => {
    const inputs: ReadinessInputs = {
      fatigueScore: null,
      nutritionCompliance: { daysTracked: 0, avgCaloriePct: 0, avgProteinPct: 0 },
      recoveryRaw: null,
      healthKit: null,
    };

    const result = calculateReadiness(inputs);
    expect(result.domains.nutrition).toBe(50);
    expect(result.confidence).toBe("low");
  });

  it("healthKit with only sleep → still computes external domain", () => {
    const inputs: ReadinessInputs = {
      fatigueScore: 40,
      nutritionCompliance: null,
      recoveryRaw: null,
      healthKit: { sleepHours: 8, restingHeartRate: null, hrvMs: null, steps: null },
    };

    const result = calculateReadiness(inputs);
    expect(result.domains.external).not.toBeNull();
    expect(result.domains.external!).toBeGreaterThanOrEqual(80);
    expect(result.confidence).toBe("medium"); // fatigue + external = 2
  });

  it("healthKit with all null values → external is null", () => {
    const inputs: ReadinessInputs = {
      fatigueScore: 50,
      nutritionCompliance: null,
      recoveryRaw: null,
      healthKit: { sleepHours: null, restingHeartRate: null, hrvMs: null, steps: null },
    };

    const result = calculateReadiness(inputs);
    expect(result.domains.external).toBeNull();
  });

  it("level thresholds are correct", () => {
    // Test each boundary
    const makeInputs = (fatigue: number): ReadinessInputs => ({
      fatigueScore: fatigue,
      nutritionCompliance: null,
      recoveryRaw: null,
      healthKit: null,
    });

    // fatigue 0 → training 100, score = 0.4*100 + 0.25*50 + 0.35*50 = 70
    expect(calculateReadiness(makeInputs(0)).level).toBe("good");

    // fatigue 100 → training 0, score = 0.4*0 + 0.25*50 + 0.35*50 = 30
    expect(calculateReadiness(makeInputs(100)).level).toBe("low");
  });

  it("recommendation strings match levels", () => {
    const peak = calculateReadiness({
      fatigueScore: 5,
      nutritionCompliance: { daysTracked: 3, avgCaloriePct: 100, avgProteinPct: 100 },
      recoveryRaw: 0,
      healthKit: null,
    });
    expect(peak.recommendation).toContain("high-intensity");

    const rest = calculateReadiness({
      fatigueScore: 100,
      nutritionCompliance: { daysTracked: 3, avgCaloriePct: 10, avgProteinPct: 10 },
      recoveryRaw: 10,
      healthKit: null,
    });
    expect(rest.recommendation).toContain("rest");
  });
});
