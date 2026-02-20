/**
 * Normalization functions for external exercise data sources
 * Converts ExerciseDB and Free Exercise DB formats to our internal schema
 */

import type {
  ExerciseDBExercise,
  FreeExerciseDBExercise,
  InternalExercise,
} from "../src/types/exercise-data";
import {
  EXERCISEDB_MUSCLE_MAP,
  FREE_EXERCISE_DB_MUSCLE_MAP,
  EQUIPMENT_MAP,
  inferCategory,
  generateSlug,
} from "../src/types/exercise-data";

/**
 * Normalize ExerciseDB exercise to internal format
 */
export function normalizeExerciseDB(
  exercise: ExerciseDBExercise
): InternalExercise {
  // Map body part to muscle group
  const muscleGroup =
    EXERCISEDB_MUSCLE_MAP[exercise.bodyPart.toLowerCase()] || "other";

  // Map equipment (ensure it's always a valid enum value)
  const rawEquipment = exercise.equipment.toLowerCase();
  const equipment = EQUIPMENT_MAP[rawEquipment] || "bodyweight"; // Default to bodyweight if unknown

  // Generate slug
  const slug = generateSlug(exercise.name);

  // Infer category
  const category = inferCategory(exercise.name, equipment, muscleGroup);

  // Join instructions with newlines
  const instructions = exercise.instructions.join("\n\n");

  return {
    name: exercise.name,
    slug,
    muscle_group: muscleGroup,
    equipment, // Always a valid enum value, never null
    category,
    instructions,
    form_tips: null, // ExerciseDB doesn't provide form tips separately
    image_url: exercise.gifUrl, // Use GIF as primary image
    gif_url: exercise.gifUrl,
    source: "exercisedb",
    source_exercise_id: exercise.id,
  };
}

/**
 * Normalize Free Exercise DB exercise to internal format
 */
export function normalizeFreeExerciseDB(
  exercise: FreeExerciseDBExercise
): InternalExercise {
  // Map primary muscle to muscle group
  const primaryMuscle = exercise.primaryMuscles[0]?.toLowerCase() || "";
  const muscleGroup =
    FREE_EXERCISE_DB_MUSCLE_MAP[primaryMuscle] || "other";

  // Map equipment (ensure it's always a valid enum value)
  const rawEquipment = exercise.equipment?.toLowerCase() || "";
  const equipment = EQUIPMENT_MAP[rawEquipment] || "bodyweight"; // Default to bodyweight if unknown

  // Generate slug
  const slug = generateSlug(exercise.name);

  // Infer category
  const category = inferCategory(exercise.name, equipment, muscleGroup);

  // Join instructions with newlines
  const instructions = exercise.instructions.join("\n\n");

  // Use first image if available
  const imageUrl = exercise.images[0] || null;

  return {
    name: exercise.name,
    slug,
    muscle_group: muscleGroup,
    equipment, // Always a valid enum value, never null
    category,
    instructions,
    form_tips: null,
    image_url: imageUrl,
    gif_url: null, // Free Exercise DB doesn't have GIFs
    source: "free-exercise-db",
    source_exercise_id: exercise.id,
  };
}

/**
 * Deduplicate exercises by name and equipment
 * Prefer ExerciseDB over Free Exercise DB (better data quality + GIFs)
 */
export function deduplicateExercises(
  exercises: InternalExercise[]
): InternalExercise[] {
  const seen = new Map<string, InternalExercise>();

  for (const exercise of exercises) {
    // Create dedup key from name + equipment
    const key = `${exercise.name.toLowerCase()}|${exercise.equipment || "none"}`;

    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, exercise);
    } else {
      // Prefer ExerciseDB over Free Exercise DB
      if (exercise.source === "exercisedb" && existing.source === "free-exercise-db") {
        seen.set(key, exercise);
      }
      // If both are same source, keep first one
    }
  }

  return Array.from(seen.values());
}

/**
 * Validate exercise data
 */
export function validateExercise(exercise: InternalExercise): boolean {
  // Must have name
  if (!exercise.name || exercise.name.trim().length === 0) {
    return false;
  }

  // Must have muscle group
  if (!exercise.muscle_group || exercise.muscle_group === "other") {
    return false;
  }

  // Must have slug
  if (!exercise.slug) {
    return false;
  }

  // Must have instructions (at least some minimal guidance)
  if (!exercise.instructions || exercise.instructions.trim().length < 10) {
    return false;
  }

  return true;
}
