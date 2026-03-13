/**
 * Workout Coverage Validator
 *
 * Programmatic safety net ensuring AI-generated workouts cover all required
 * movement patterns and muscle groups. Used alongside prompt-level guidance
 * to block and auto-fix workouts with missing coverage.
 */

import type { WorkoutOption, WorkoutOptionExercise } from "@/lib/coach/types";

// ── Types ──

export type WorkoutType =
  | "full_body"
  | "upper"
  | "lower"
  | "push"
  | "pull"
  | "athletic"
  | "hypertrophy_split";

export type MovementPattern =
  | "squat"
  | "hinge"
  | "horizontal_push"
  | "horizontal_pull"
  | "vertical_push"
  | "vertical_pull"
  | "unilateral"
  | "core_stability"
  | "anti_rotation"
  | "anti_extension"
  | "carry"
  | "power"
  | "scapular_stability";

export type Muscle =
  | "chest"
  | "lats"
  | "upper_back"
  | "rhomboids"
  | "front_delts"
  | "lateral_delts"
  | "rear_delts"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "adductors"
  | "abductors"
  | "calves"
  | "core";

export interface CoverageExercise {
  name: string;
  sets: number;
  reps: string;
  rpe?: number;
  movementPatterns: MovementPattern[];
  muscles: Muscle[];
}

export interface CoverageWorkout {
  workoutType: WorkoutType;
  exercises: CoverageExercise[];
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  missingMovementPatterns: string[];
  missingMuscles: string[];
  warnings: string[];
  notes: string[];
}

// ── Required Coverage Maps ──

const REQUIRED_PATTERNS: Record<WorkoutType, MovementPattern[]> = {
  full_body: [
    "squat",
    "hinge",
    "horizontal_push",
    "horizontal_pull",
    "core_stability",
  ],
  upper: [
    "horizontal_push",
    "horizontal_pull",
    "vertical_push",
    "vertical_pull",
    "scapular_stability",
  ],
  lower: ["squat", "hinge", "unilateral", "core_stability"],
  push: ["horizontal_push", "vertical_push", "core_stability"],
  pull: [
    "horizontal_pull",
    "vertical_pull",
    "scapular_stability",
    "core_stability",
  ],
  athletic: [
    "power",
    "anti_rotation",
    "horizontal_push",
    "horizontal_pull",
    "squat",
  ],
  hypertrophy_split: [],
};

const REQUIRED_MUSCLES: Record<WorkoutType, Muscle[]> = {
  full_body: [
    "quads",
    "hamstrings",
    "glutes",
    "chest",
    "lats",
    "upper_back",
    "core",
  ],
  upper: [
    "chest",
    "lats",
    "upper_back",
    "rear_delts",
    "biceps",
    "triceps",
  ],
  lower: ["quads", "hamstrings", "glutes", "calves", "core"],
  push: ["chest", "front_delts", "triceps"],
  pull: ["lats", "upper_back", "rear_delts", "biceps"],
  athletic: [
    "quads",
    "hamstrings",
    "glutes",
    "chest",
    "lats",
    "upper_back",
    "core",
  ],
  hypertrophy_split: [],
};

/**
 * Neglected-muscle checks scoped by workout type.
 * Only muscles relevant to the workout's intent are checked — a push day
 * should never be flagged for missing hamstrings or calves.
 */
const NEGLECTED_MUSCLES_BY_TYPE: Record<WorkoutType, Muscle[]> = {
  full_body: ["rear_delts", "upper_back", "hamstrings", "glutes", "calves", "core"],
  upper: ["rear_delts", "upper_back", "core"],
  lower: ["hamstrings", "glutes", "calves", "core"],
  push: ["core"],
  pull: ["rear_delts", "upper_back"],
  athletic: ["rear_delts", "upper_back", "hamstrings", "glutes", "calves", "core"],
  hypertrophy_split: [],
};

// ── Validator ──

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function validateWorkoutCoverage(
  workout: CoverageWorkout,
): ValidationResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  const allPatterns = uniq(
    workout.exercises.flatMap((exercise) => exercise.movementPatterns),
  );

  const allMuscles = uniq(
    workout.exercises.flatMap((exercise) => exercise.muscles),
  );

  const requiredPatterns = REQUIRED_PATTERNS[workout.workoutType] ?? [];
  const requiredMuscles = REQUIRED_MUSCLES[workout.workoutType] ?? [];

  const missingMovementPatterns = requiredPatterns.filter(
    (pattern) => !allPatterns.includes(pattern),
  );

  const missingMuscles = requiredMuscles.filter(
    (muscle) => !allMuscles.includes(muscle),
  );

  // Structural balance checks — only apply to workout types that include
  // both sides of the push/pull equation.  A push-only or pull-only day
  // should NOT be penalised for lacking the opposite movement.
  const balanceTypes: WorkoutType[] = ["full_body", "upper", "athletic"];

  if (balanceTypes.includes(workout.workoutType)) {
    const horizontalPushCount = workout.exercises.filter((e) =>
      e.movementPatterns.includes("horizontal_push"),
    ).length;

    const horizontalPullCount = workout.exercises.filter((e) =>
      e.movementPatterns.includes("horizontal_pull"),
    ).length;

    const verticalPushCount = workout.exercises.filter((e) =>
      e.movementPatterns.includes("vertical_push"),
    ).length;

    const verticalPullCount = workout.exercises.filter((e) =>
      e.movementPatterns.includes("vertical_pull"),
    ).length;

    if (horizontalPushCount > horizontalPullCount) {
      warnings.push(
        "Horizontal pushing volume exceeds horizontal pulling volume.",
      );
    }

    if (verticalPushCount > verticalPullCount) {
      warnings.push(
        "Vertical pushing volume exceeds vertical pulling volume.",
      );
    }
  }

  // Quad vs posterior chain balance — only relevant when both are expected
  const legBalanceTypes: WorkoutType[] = ["full_body", "lower", "athletic"];

  if (legBalanceTypes.includes(workout.workoutType)) {
    const quadCount = workout.exercises.filter((e) =>
      e.muscles.includes("quads"),
    ).length;

    const posteriorChainCount = workout.exercises.filter(
      (e) =>
        e.muscles.includes("hamstrings") ||
        e.muscles.includes("glutes") ||
        e.muscles.includes("upper_back"),
    ).length;

    if (posteriorChainCount < quadCount) {
      warnings.push("Posterior chain volume is lower than quad volume.");
    }
  }

  // Neglected muscle check — scoped to muscles relevant to this workout type
  const neglectedForType = NEGLECTED_MUSCLES_BY_TYPE[workout.workoutType] ?? [];
  const neglectedMissing = neglectedForType.filter(
    (muscle) => !allMuscles.includes(muscle),
  );

  if (neglectedForType.length === 0) {
    // No neglect check for this workout type (e.g. hypertrophy_split)
    notes.push("Neglected-muscle check skipped for this workout type.");
  } else if (neglectedMissing.length > 0) {
    warnings.push(
      `Neglected muscles missing: ${neglectedMissing.join(", ")}.`,
    );
  } else {
    notes.push("All commonly neglected muscles are covered.");
  }

  // Scoring
  let score = 10;
  score -= missingMovementPatterns.length * 1.5;
  score -= missingMuscles.length * 1.25;
  score -= warnings.length * 0.5;
  if (score < 1) score = 1;
  if (score > 10) score = 10;

  // Validity is determined by required patterns and muscles for the workout
  // type.  Neglected-muscle gaps and structural warnings are advisory — they
  // help the AI improve the workout but should NOT force a workout-type change.
  const isValid =
    missingMovementPatterns.length === 0 &&
    missingMuscles.length === 0 &&
    warnings.length <= 2;

  return {
    isValid,
    score: Number(score.toFixed(1)),
    missingMovementPatterns,
    missingMuscles,
    warnings,
    notes,
  };
}

// ── Helpers ──

/** Infer WorkoutType from the option's label / primary_muscle_group */
function inferWorkoutType(option: WorkoutOption): WorkoutType {
  const label = option.label.toLowerCase();
  const muscle = option.primary_muscle_group?.toLowerCase() ?? "";

  if (label.includes("full body") || label.includes("total body"))
    return "full_body";
  if (label.includes("upper")) return "upper";
  if (label.includes("lower") || label.includes("leg")) return "lower";
  if (label.includes("push")) return "push";
  if (label.includes("pull")) return "pull";
  if (
    label.includes("athletic") ||
    label.includes("sport") ||
    label.includes("power")
  )
    return "athletic";

  // Fallback based on primary muscle group
  if (["chest", "shoulders", "triceps"].includes(muscle)) return "push";
  if (["back", "biceps"].includes(muscle)) return "pull";
  if (["legs", "quads", "hamstrings", "glutes"].includes(muscle))
    return "lower";

  return "full_body";
}

/** Convert a WorkoutOption (AI format) to CoverageWorkout (validator format) */
export function mapOptionToCoverageWorkout(
  option: WorkoutOption,
): CoverageWorkout {
  return {
    workoutType: inferWorkoutType(option),
    exercises: option.exercises.map((ex: WorkoutOptionExercise) => ({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      movementPatterns: (ex.movement_patterns ?? []) as MovementPattern[],
      muscles: (ex.target_muscles ?? []) as Muscle[],
    })),
  };
}

/**
 * Validate all 3 workout options and build a revision message if any fail.
 * Returns null if all options pass, or a revision prompt string if fixes needed.
 */
export function buildCoverageRevisionMessage(
  options: WorkoutOption[],
): string | null {
  const failures: string[] = [];

  for (const option of options) {
    const workout = mapOptionToCoverageWorkout(option);
    const result = validateWorkoutCoverage(workout);

    if (!result.isValid) {
      const parts: string[] = [`Option ${option.id}`];
      if (result.missingMovementPatterns.length > 0) {
        parts.push(
          `missing patterns: [${result.missingMovementPatterns.join(", ")}]`,
        );
      }
      if (result.missingMuscles.length > 0) {
        parts.push(
          `missing muscles: [${result.missingMuscles.join(", ")}]`,
        );
      }
      if (result.warnings.length > 0) {
        parts.push(`warnings: [${result.warnings.join("; ")}]`);
      }
      failures.push(parts.join(" — "));
    }
  }

  if (failures.length === 0) return null;

  return `COVERAGE_AUDIT_FAILED: ${failures.join(". ")}. Revise all options to cover these gaps. Ensure every exercise includes movement_patterns and target_muscles arrays. IMPORTANT: preserve each option's workout type — do NOT add exercises from other categories (e.g. do not add legs to a push workout).`;
}
