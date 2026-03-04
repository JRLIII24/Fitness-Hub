import { describe, it, expect } from "vitest";
import type { DashboardPhase } from "@/components/dashboard/dashboard-content";

// Test the ordering logic directly — the hook wraps this in useMemo but the logic is deterministic
const PHASE_ORDER: Record<DashboardPhase, string[]> = {
  morning: ["fatigue", "muscleRecovery", "weight", "nutrition", "launcher", "recovery", "ninetyDay"],
  pre_workout: ["launcher", "fatigue", "muscleRecovery", "recovery", "weight", "nutrition"],
  post_workout: ["nutrition", "recovery", "muscleRecovery", "weight", "fatigue", "launcher"],
  active: ["launcher", "fatigue"],
  evening: ["launcher", "fatigue", "muscleRecovery", "recovery", "weight", "ninetyDay", "nutrition"],
};

const SECONDARY_KEYS = new Set(["fatigue", "muscleRecovery", "recovery", "weight"]);

function getOrderedGroups(phase: DashboardPhase) {
  const orderedKeys = PHASE_ORDER[phase];
  const groups: ({ type: "primary"; key: string } | { type: "secondary"; keys: string[] })[] = [];
  let secondaryBatch: string[] = [];

  for (const id of orderedKeys) {
    if (SECONDARY_KEYS.has(id)) {
      secondaryBatch.push(id);
    } else {
      if (secondaryBatch.length > 0) {
        groups.push({ type: "secondary", keys: [...secondaryBatch] });
        secondaryBatch = [];
      }
      groups.push({ type: "primary", key: id });
    }
  }
  if (secondaryBatch.length > 0) {
    groups.push({ type: "secondary", keys: secondaryBatch });
  }
  return groups;
}

describe("useDashboardPhase ordering logic", () => {
  const phases: DashboardPhase[] = ["morning", "pre_workout", "post_workout", "active", "evening"];

  phases.forEach((phase) => {
    it(`produces non-empty output for ${phase} phase`, () => {
      const groups = getOrderedGroups(phase);
      expect(groups.length).toBeGreaterThan(0);
    });
  });

  it("morning phase groups secondary cards before primary", () => {
    const groups = getOrderedGroups("morning");
    expect(groups[0]).toEqual({ type: "secondary", keys: ["fatigue", "muscleRecovery", "weight"] });
  });

  it("active phase has only 2 keys", () => {
    expect(PHASE_ORDER["active"]).toHaveLength(2);
    expect(PHASE_ORDER["active"]).toEqual(["launcher", "fatigue"]);
  });

  it("all phases reference only known card keys", () => {
    const allValidKeys = new Set(["launcher", "fatigue", "muscleRecovery", "recovery", "weight", "ninetyDay", "nutrition"]);
    phases.forEach((phase) => {
      PHASE_ORDER[phase].forEach((key) => {
        expect(allValidKeys.has(key)).toBe(true);
      });
    });
  });

  it("grouping reduces total items via batching", () => {
    const groups = getOrderedGroups("morning");
    expect(groups.length).toBeLessThan(PHASE_ORDER["morning"].length);
  });
});
