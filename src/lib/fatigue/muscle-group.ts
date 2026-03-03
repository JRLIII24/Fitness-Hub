/**
 * Muscle-Group Recovery Model
 *
 * Estimates per-muscle-group recovery based on:
 * - Time since last training (hours)
 * - Training volume (total sets in window)
 * - Training intensity (avg RPE)
 *
 * Base recovery: 48h (light) to 72h (heavy)
 * Adjusted by volume and intensity factors.
 */

export type RecoveryStatus = "recovered" | "recovering" | "fatigued" | "untrained";

export interface MuscleGroupRecovery {
  muscleGroup: string;
  displayName: string;
  lastTrainedAt: string | null;
  hoursSinceTrained: number | null;
  totalSets: number;
  totalVolumeKg: number;
  recoveryStatus: RecoveryStatus;
  recoveryPct: number; // 0-100
}

// Display names for muscle groups (maps DB values to friendly labels)
const MUSCLE_GROUP_DISPLAY: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  abs: "Core",
  quadriceps: "Quads",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  legs: "Legs",
  traps: "Traps",
  lats: "Lats",
  full_body: "Full Body",
};

export function getDisplayName(muscleGroup: string): string {
  return (
    MUSCLE_GROUP_DISPLAY[muscleGroup.toLowerCase()] ||
    muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1).toLowerCase()
  );
}

export function computeRecoveryStatus(
  hoursSinceTrained: number | null,
  totalSets: number,
  avgRpe: number | null
): { status: RecoveryStatus; pct: number } {
  if (hoursSinceTrained == null || hoursSinceTrained < 0) {
    return { status: "untrained", pct: 100 };
  }

  // Base recovery time scales with intensity (RPE)
  // RPE 5 -> 48h, RPE 10 -> 72h (linear interpolation)
  const intensity = avgRpe ?? 6;
  const baseRecoveryHours = 48 + (intensity - 5) * 4.8;

  // Volume factor: more sets = slightly longer recovery
  // 10 sets is baseline; each additional set adds ~2% recovery time
  const volumeFactor = Math.min(1.4, 1 + Math.max(0, totalSets - 10) * 0.02);

  const adjustedRecoveryHours = baseRecoveryHours * volumeFactor;
  const pct = Math.min(100, Math.round((hoursSinceTrained / adjustedRecoveryHours) * 100));

  if (pct >= 90) return { status: "recovered", pct };
  if (pct >= 50) return { status: "recovering", pct };
  return { status: "fatigued", pct };
}

/** Color class for each recovery status */
export function recoveryColor(status: RecoveryStatus): string {
  switch (status) {
    case "recovered":
      return "text-emerald-400";
    case "recovering":
      return "text-amber-400";
    case "fatigued":
      return "text-rose-400";
    case "untrained":
      return "text-muted-foreground";
  }
}

export function recoveryBarColor(status: RecoveryStatus): string {
  switch (status) {
    case "recovered":
      return "bg-emerald-400";
    case "recovering":
      return "bg-amber-400";
    case "fatigued":
      return "bg-rose-400";
    case "untrained":
      return "bg-muted";
  }
}
