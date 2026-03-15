/**
 * Vibe Check System — fun callouts for training behaviors.
 * Purely cosmetic, no scoring impact.
 * Computed client-side from workout history data.
 */

import { Y2K } from "./y2k-tokens";

export interface VibeCheck {
  id: string;
  label: string;
  desc: string;
  emoji: string;
  color: string;
}

export const VIBE_CATALOG: VibeCheck[] = [
  {
    id: "skip_legs",
    label: "Leg Day? Never Heard of Her",
    desc: "No lower body work in 14+ days",
    emoji: "🦵",
    color: Y2K.status.critical.fg,
  },
  {
    id: "went_dark",
    label: "Gone Ghost",
    desc: "No workouts in 10+ days",
    emoji: "👻",
    color: Y2K.status.critical.fg,
  },
  {
    id: "monday_chest",
    label: "Monday Chest Bro",
    desc: "Chest on Monday again",
    emoji: "📅",
    color: Y2K.status.warning.fg,
  },
  {
    id: "one_set_wonder",
    label: "One and Done",
    desc: "Averaging 1 set per exercise",
    emoji: "1️⃣",
    color: Y2K.status.warning.fg,
  },
  {
    id: "cardio_bunny",
    label: "Cardio Era",
    desc: "Only cardio logged this week",
    emoji: "🐰",
    color: "#00D4FF",
  },
  {
    id: "iron_addict",
    label: "No Days Off",
    desc: "7 sessions logged in a single week",
    emoji: "🔥",
    color: Y2K.cyan,
  },
];

/**
 * Detect vibes from workout history summary.
 * Takes pre-computed stats to avoid heavy DB queries on the client.
 */
export interface WorkoutStats {
  daysSinceLastWorkout: number;
  daysSinceLastLegDay: number;
  avgSetsPerExercise: number;
  sessionsThisWeek: number;
  onlyCardioThisWeek: boolean;
  chestOnMondayCount: number;
}

export function detectVibes(stats: WorkoutStats): VibeCheck[] {
  const vibes: VibeCheck[] = [];

  if (stats.daysSinceLastWorkout >= 10) {
    vibes.push(VIBE_CATALOG.find((c) => c.id === "went_dark")!);
  }

  if (stats.daysSinceLastLegDay >= 14) {
    vibes.push(VIBE_CATALOG.find((c) => c.id === "skip_legs")!);
  }

  if (stats.avgSetsPerExercise > 0 && stats.avgSetsPerExercise <= 1.2) {
    vibes.push(VIBE_CATALOG.find((c) => c.id === "one_set_wonder")!);
  }

  if (stats.onlyCardioThisWeek && stats.sessionsThisWeek > 0) {
    vibes.push(VIBE_CATALOG.find((c) => c.id === "cardio_bunny")!);
  }

  if (stats.chestOnMondayCount >= 3) {
    vibes.push(VIBE_CATALOG.find((c) => c.id === "monday_chest")!);
  }

  if (stats.sessionsThisWeek >= 7) {
    vibes.push(VIBE_CATALOG.find((c) => c.id === "iron_addict")!);
  }

  return vibes;
}
