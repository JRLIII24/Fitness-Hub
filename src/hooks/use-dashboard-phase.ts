import React from "react";
import type { DashboardPhase } from "@/components/dashboard/dashboard-content";

const PHASE_ORDER: Record<DashboardPhase, string[]> = {
  morning: ["fatigue", "muscleRecovery", "weight", "nutrition", "launcher", "recovery"],
  pre_workout: ["launcher", "fatigue", "muscleRecovery", "recovery", "weight", "nutrition"],
  post_workout: ["nutrition", "recovery", "muscleRecovery", "weight", "fatigue", "launcher"],
  active: ["launcher", "fatigue"],
  evening: ["launcher", "fatigue", "muscleRecovery", "recovery", "weight", "nutrition"],
};

/**
 * Accepts a phase and a card map, returns an ordered flat array of React nodes.
 */
export function useDashboardPhase(
  phase: DashboardPhase,
  cards: Record<string, React.ReactNode>,
): React.ReactNode[] {
  return React.useMemo(() => {
    return PHASE_ORDER[phase]
      .filter((id) => id in cards)
      .map((id) => cards[id]);
  }, [phase, cards]);
}
