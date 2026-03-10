/**
 * Pure utility functions extracted from use-workout-completion.ts
 * for testability. These handle PR detection, duration formatting,
 * and celebration stats computation without any React or Supabase deps.
 */

export interface SetData {
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
  set_number: number;
  completed_at?: string | null;
  rest_seconds?: number | null;
  rir?: number | null;
  set_type?: string;
}

export interface ExerciseBlock {
  exercise: { id: string; name: string };
  sets: SetData[];
}

export interface PreviousSet {
  reps: number | null;
  weight: number | null;
}

export interface GhostSet {
  setNumber: number;
  weight: number | null;
  reps: number | null;
}

// ── Error detection ──

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: string; message?: string; details?: string };
  const text = `${candidate.message ?? ""} ${candidate.details ?? ""}`.toLowerCase();

  return (
    candidate.code === "PGRST205" ||
    (text.includes("could not find the table") ||
      (text.includes("relation") && text.includes("does not exist")))
  );
}

// ── PR detection ──

/**
 * Determines if a set is a personal record compared to previous best.
 * A PR occurs when:
 * - Same reps but higher weight
 * - Same weight but higher reps
 * - Both weight and reps are higher
 */
export function isPersonalRecord(
  currentWeight: number,
  currentReps: number,
  previousWeight: number,
  previousReps: number,
): boolean {
  return (
    (currentReps === previousReps && currentWeight > previousWeight) ||
    (currentWeight === previousWeight && currentReps > previousReps) ||
    (currentWeight > previousWeight && currentReps > previousReps)
  );
}

/**
 * Find the best previous set by volume (weight * reps).
 */
export function findPreviousBest(previousSets: PreviousSet[]): PreviousSet | null {
  return previousSets.reduce<PreviousSet | null>((best, set) => {
    const setScore =
      set.weight != null && set.reps != null ? set.weight * set.reps : -1;
    const bestScore =
      best && best.weight != null && best.reps != null ? best.weight * best.reps : -1;
    return setScore > bestScore ? set : best;
  }, null);
}

// ── Duration formatting ──

/**
 * Calculate workout duration string from start time.
 */
export function formatDuration(startedAt: string, endedAt: string | number): string {
  const endTime = typeof endedAt === "number" ? endedAt : new Date(endedAt).getTime();
  const durationMs = endTime - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * Calculate duration in seconds (clamped to >= 0).
 */
export function calculateDurationSeconds(startedAt: string, endedAt: string): number {
  return Math.max(
    0,
    Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000),
  );
}

// ── Volume calculation ──

/**
 * Calculate total workout volume in kg from all sets.
 */
export function calculateTotalVolume(exercises: ExerciseBlock[]): number {
  return exercises
    .flatMap((e) => e.sets)
    .reduce((acc, set) => acc + (set.weight_kg ?? 0) * (set.reps ?? 0), 0);
}

// ── Ghost comparison ──

/**
 * Check if any current set in an exercise beats the corresponding ghost set (by volume score).
 */
export function didBeatGhost(
  sets: SetData[],
  ghostSets: GhostSet[],
): boolean {
  const ghostSetByNumber = new Map(ghostSets.map((gs) => [gs.setNumber, gs]));

  for (const set of sets) {
    if (!set.completed) continue;
    const ghostSet = ghostSetByNumber.get(set.set_number);
    if (
      ghostSet &&
      ghostSet.weight != null &&
      ghostSet.reps != null &&
      set.weight_kg != null &&
      set.reps != null
    ) {
      const currentScore = (set.weight_kg ?? 0) * (set.reps ?? 0);
      const ghostScore = (ghostSet.weight ?? 0) * (ghostSet.reps ?? 0);
      if (currentScore > ghostScore) return true;
    }
  }
  return false;
}

// ── XP calculation ──

export function calculateXpAwarded(setsCompleted: number): number {
  return 100 + setsCompleted * 2;
}

// ── Milestone text ──

export function getMilestoneText(currentStreak: number): string {
  const milestones = [7, 30, 100, 365];
  const nextMilestone = milestones.find((m) => m > currentStreak) ?? null;
  return nextMilestone != null
    ? `${nextMilestone - currentStreak} days to ${nextMilestone}-day milestone`
    : "Milestone ladder complete";
}
