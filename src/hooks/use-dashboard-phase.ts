import React from "react";
import type { DashboardPhase } from "@/components/dashboard/dashboard-content";
import { SwipeableCardCarousel } from "@/components/ui/swipeable-card-carousel";

const PHASE_ORDER: Record<DashboardPhase, string[]> = {
  morning: ["fatigue", "muscleRecovery", "weight", "nutrition", "launcher", "recovery", "ninetyDay"],
  pre_workout: ["launcher", "fatigue", "muscleRecovery", "recovery", "weight", "nutrition"],
  post_workout: ["nutrition", "recovery", "muscleRecovery", "weight", "fatigue", "launcher"],
  active: ["launcher", "fatigue"],
  evening: ["launcher", "fatigue", "muscleRecovery", "recovery", "weight", "ninetyDay", "nutrition"],
};

const SECONDARY_KEYS = new Set(["fatigue", "muscleRecovery", "recovery", "weight"]);

/**
 * Accepts a phase and a card map, returns an ordered array of React nodes
 * with secondary cards grouped into a SwipeableCardCarousel on mobile.
 */
export function useDashboardPhase(
  phase: DashboardPhase,
  cards: Record<string, React.ReactNode>,
): React.ReactNode[] {
  return React.useMemo(() => {
    const orderedKeys = PHASE_ORDER[phase];
    const primaryCards: React.ReactNode[] = [];
    const secondaryCards: React.ReactNode[] = [];

    for (const id of orderedKeys) {
      if (SECONDARY_KEYS.has(id)) {
        secondaryCards.push(cards[id]);
      } else {
        if (secondaryCards.length > 0) {
          primaryCards.push(
            React.createElement(React.Fragment, { key: `secondary-group-${primaryCards.length}` },
              React.createElement("div", { className: "lg:hidden" },
                React.createElement(SwipeableCardCarousel, null, ...secondaryCards),
              ),
              React.createElement("div", { className: "hidden lg:flex lg:flex-col lg:gap-5" },
                ...secondaryCards,
              ),
            ),
          );
          secondaryCards.length = 0;
        }
        primaryCards.push(cards[id]);
      }
    }

    if (secondaryCards.length > 0) {
      primaryCards.push(
        React.createElement(React.Fragment, { key: `secondary-group-${primaryCards.length}` },
          React.createElement("div", { className: "lg:hidden" },
            React.createElement(SwipeableCardCarousel, null, ...secondaryCards),
          ),
          React.createElement("div", { className: "hidden lg:flex lg:flex-col lg:gap-5" },
            ...secondaryCards,
          ),
        ),
      );
    }

    return primaryCards;
  }, [phase, cards]);
}
