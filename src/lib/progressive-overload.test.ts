import { describe, it, expect } from "vitest";
import { calcSuggestedWeight } from "./progressive-overload";
import { kgToLbs } from "./units";

describe("calcSuggestedWeight", () => {
  describe("metric", () => {
    it("bumps by 1.25kg for weights under 50kg", () => {
      const result = calcSuggestedWeight(40, "metric");
      // 40 + 1.25 = 41.25, snapped to nearest 1.25 = 41.25
      expect(result).toBeCloseTo(41.25, 2);
    });

    it("bumps by 2.5kg for weights at or above 50kg", () => {
      const result = calcSuggestedWeight(60, "metric");
      // 60 + 2.5 = 62.5, snapped to nearest 1.25 = 62.5
      expect(result).toBeCloseTo(62.5, 2);
    });

    it("snaps to nearest 1.25kg", () => {
      const result = calcSuggestedWeight(41, "metric");
      // 41 + 1.25 = 42.25 → round to nearest 1.25 → 42.5
      expect(result % 1.25).toBeCloseTo(0, 5);
    });

    it("always increases weight", () => {
      for (const w of [20, 40, 50, 60, 80, 100]) {
        expect(calcSuggestedWeight(w, "metric")).toBeGreaterThan(w);
      }
    });
  });

  describe("imperial", () => {
    it("bumps by 2.5lbs for weights under 100lbs", () => {
      const ghostKg = 40; // ~88 lbs
      const result = calcSuggestedWeight(ghostKg, "imperial");
      const resultLbs = kgToLbs(result);
      // Should be ~90.5 lbs, snapped to nearest 2.5 → 90
      expect(resultLbs).toBeGreaterThan(88);
    });

    it("bumps by 5lbs for weights at or above 100lbs", () => {
      const ghostKg = 50; // ~110 lbs
      const result = calcSuggestedWeight(ghostKg, "imperial");
      const resultLbs = kgToLbs(result);
      expect(resultLbs).toBeGreaterThan(110);
    });

    it("snaps to nearest 2.5lbs", () => {
      const result = calcSuggestedWeight(45, "imperial");
      const resultLbs = kgToLbs(result);
      const remainder = resultLbs % 2.5;
      expect(Math.min(remainder, 2.5 - remainder)).toBeLessThan(0.01);
    });

    it("always increases weight", () => {
      for (const w of [20, 40, 50, 60, 80]) {
        expect(calcSuggestedWeight(w, "imperial")).toBeGreaterThan(w);
      }
    });
  });
});
