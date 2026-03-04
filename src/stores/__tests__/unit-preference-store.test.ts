import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage before importing the store
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (_index: number) => null,
  },
  writable: true,
});

const { useUnitPreferenceStore } = await import("../unit-preference-store");

describe("useUnitPreferenceStore", () => {
  beforeEach(() => {
    store.clear();
    // Reset to metric before each test
    useUnitPreferenceStore.getState().setPreference("metric");
  });

  describe("formatWeight", () => {
    it("formats metric weight in kg", () => {
      const { formatWeight } = useUnitPreferenceStore.getState();
      expect(formatWeight(80)).toBe("80 kg");
    });

    it("formats imperial weight in lbs", () => {
      useUnitPreferenceStore.getState().setPreference("imperial");
      const { formatWeight } = useUnitPreferenceStore.getState();
      expect(formatWeight(80)).toBe("176 lbs");
    });

    it("rounds to nearest whole number", () => {
      const { formatWeight } = useUnitPreferenceStore.getState();
      expect(formatWeight(80.7)).toBe("81 kg");
    });
  });

  describe("formatHeight", () => {
    it("formats metric height in cm", () => {
      const { formatHeight } = useUnitPreferenceStore.getState();
      expect(formatHeight(180)).toBe("180 cm");
    });

    it("formats imperial height in inches", () => {
      useUnitPreferenceStore.getState().setPreference("imperial");
      const { formatHeight } = useUnitPreferenceStore.getState();
      const result = formatHeight(180);
      expect(result).toMatch(/^\d+(\.\d)? inches$/);
      // 180 * 0.393701 ≈ 70.9
      expect(result).toBe("70.9 inches");
    });
  });

  describe("formatDistance", () => {
    it("formats metric distance in km", () => {
      const { formatDistance } = useUnitPreferenceStore.getState();
      expect(formatDistance(5000)).toBe("5.00 km");
    });

    it("formats imperial distance in miles", () => {
      useUnitPreferenceStore.getState().setPreference("imperial");
      const { formatDistance } = useUnitPreferenceStore.getState();
      const result = formatDistance(5000);
      expect(result).toBe("3.11 mi");
    });
  });

  describe("formatPace", () => {
    it("formats metric pace per km", () => {
      const { formatPace } = useUnitPreferenceStore.getState();
      // 300 sec/km = 5:00 /km
      expect(formatPace(300)).toBe("5:00 /km");
    });

    it("formats imperial pace per mile", () => {
      useUnitPreferenceStore.getState().setPreference("imperial");
      const { formatPace } = useUnitPreferenceStore.getState();
      // 300 sec/km * 1.60934 ≈ 482.8 sec/mi = 8:03 /mi
      const result = formatPace(300);
      expect(result).toMatch(/^\d+:\d{2} \/mi$/);
    });

    it("returns --:-- for zero pace", () => {
      const { formatPace } = useUnitPreferenceStore.getState();
      expect(formatPace(0)).toBe("--:--");
    });
  });

  describe("formatElevation", () => {
    it("formats metric elevation in meters", () => {
      const { formatElevation } = useUnitPreferenceStore.getState();
      expect(formatElevation(150)).toBe("150 m");
    });

    it("formats imperial elevation in feet", () => {
      useUnitPreferenceStore.getState().setPreference("imperial");
      const { formatElevation } = useUnitPreferenceStore.getState();
      // 150 * 3.28084 ≈ 492
      expect(formatElevation(150)).toBe("492 ft");
    });
  });

  describe("derived labels", () => {
    it("has correct metric labels", () => {
      const state = useUnitPreferenceStore.getState();
      expect(state.unitLabel).toBe("kg");
      expect(state.heightLabel).toBe("cm");
      expect(state.distanceLabel).toBe("km");
      expect(state.paceLabel).toBe("/km");
    });

    it("has correct imperial labels", () => {
      useUnitPreferenceStore.getState().setPreference("imperial");
      const state = useUnitPreferenceStore.getState();
      expect(state.unitLabel).toBe("lbs");
      expect(state.heightLabel).toBe("inches");
      expect(state.distanceLabel).toBe("mi");
      expect(state.paceLabel).toBe("/mi");
    });
  });
});
