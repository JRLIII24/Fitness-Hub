/**
 * Coach Action Executor — bridges AI coach responses to workout/timer store mutations.
 *
 * Receives a CoachResponse with an action + data payload, then executes the
 * corresponding store method(s) to modify the active workout in real-time.
 */

import type {
  CoachAction,
  AddExerciseActionData,
  SwapExerciseActionData,
  AddSetsActionData,
  UpdateSetActionData,
  RemoveExerciseActionData,
  CreateAndAddExerciseActionData,
  StartTimerActionData,
  NavigateToActionData,
  NavigateToScreen,
  CreateTemplateActionData,
  StartWorkoutFromTemplateActionData,
} from "./types";
import type { Exercise, WorkoutSet } from "@/types/workout";

/** Allowed navigation screens mapped to their app routes */
const SCREEN_ROUTES: Record<NavigateToScreen, string> = {
  dashboard: "/dashboard",
  workout: "/workout",
  nutrition: "/nutrition",
  history: "/history",
  body: "/body",
  marketplace: "/marketplace",
  pods: "/pods",
  exercises: "/exercises",
  settings: "/settings",
};

// Store API interfaces (subset of what we need from the Zustand stores)
export interface WorkoutStoreApi {
  activeWorkout: {
    id: string;
    exercises: Array<{
      exercise: Exercise;
      sets: WorkoutSet[];
    }>;
  } | null;
  startWorkout: (name: string, userId: string, templateId?: string) => void;
  addExercise: (exercise: Exercise) => void;
  swapExercise: (exerciseIndex: number, newExercise: Exercise) => void;
  addSet: (exerciseIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, updates: Partial<WorkoutSet>) => void;
  completeSet: (exerciseIndex: number, setIndex: number) => void;
  removeExercise: (exerciseIndex: number) => void;
}

export interface TimerStoreApi {
  startTimer: (exerciseId: string, exerciseName: string, seconds: number) => string;
}

export interface RouterApi {
  push: (href: string) => void;
}

export interface ActionResult {
  success: boolean;
  message: string;
}

/** Search for an exercise by name via the API */
async function searchExercise(name: string): Promise<Exercise | null> {
  try {
    const res = await fetch(
      `/api/exercises/search?query=${encodeURIComponent(name)}&limit=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const exercises = data.exercises ?? data;
    if (Array.isArray(exercises) && exercises.length > 0) {
      return exercises[0] as Exercise;
    }
    return null;
  } catch {
    return null;
  }
}

/** Create a custom exercise via the API */
async function createExercise(params: {
  name: string;
  muscle_group: string;
  equipment: string;
  category: string;
}): Promise<Exercise | null> {
  try {
    const res = await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    return (await res.json()) as Exercise;
  } catch {
    return null;
  }
}

/** Find exercise index in active workout by fuzzy name match */
function findExerciseIndex(
  workout: WorkoutStoreApi["activeWorkout"],
  exerciseName: string,
): number {
  if (!workout) return -1;
  const lower = exerciseName.toLowerCase();
  return workout.exercises.findIndex(
    (e) => e.exercise.name.toLowerCase().includes(lower) ||
           lower.includes(e.exercise.name.toLowerCase()),
  );
}

/**
 * Execute a coach action on the stores.
 * Returns a result indicating success/failure and a human-readable message.
 */
export async function executeCoachAction(
  action: CoachAction,
  data: Record<string, unknown> | null | undefined,
  stores: { workout: WorkoutStoreApi; timer: TimerStoreApi; router: RouterApi; userId?: string },
): Promise<ActionResult> {
  const { workout, timer, router } = stores;

  switch (action) {
    case "add_exercise": {
      const d = data as unknown as AddExerciseActionData;
      if (!d?.exercise_name) return { success: false, message: "No exercise name provided" };
      if (!workout.activeWorkout) return { success: false, message: "No active workout" };

      const exercise = await searchExercise(d.exercise_name);
      if (!exercise) return { success: false, message: `Exercise "${d.exercise_name}" not found` };

      workout.addExercise(exercise);
      const exIdx = workout.activeWorkout.exercises.length - 1;

      // If sets were prescribed, add them
      if (d.sets && Array.isArray(d.sets)) {
        for (let i = 0; i < d.sets.length; i++) {
          if (i > 0) workout.addSet(exIdx); // First set is auto-created
          const setIdx = i;
          const s = d.sets[i];
          workout.updateSet(exIdx, setIdx, {
            weight_kg: s.weight_kg ?? null,
            reps: s.reps ?? null,
            set_type: (s.set_type as WorkoutSet["set_type"]) ?? "working",
          });
          workout.completeSet(exIdx, setIdx);
        }
      }

      const setCount = d.sets?.length ?? 0;
      return {
        success: true,
        message: setCount > 0
          ? `Added ${exercise.name} with ${setCount} set${setCount !== 1 ? "s" : ""}`
          : `Added ${exercise.name}`,
      };
    }

    case "add_sets": {
      const d = data as unknown as AddSetsActionData;
      if (!d?.exercise_name || !d?.sets?.length) {
        return { success: false, message: "Missing exercise name or sets" };
      }
      if (!workout.activeWorkout) return { success: false, message: "No active workout" };

      let exIdx = findExerciseIndex(workout.activeWorkout, d.exercise_name);
      // If not found, try the last exercise
      if (exIdx < 0) exIdx = workout.activeWorkout.exercises.length - 1;
      if (exIdx < 0) return { success: false, message: "No exercises in workout" };

      const exName = workout.activeWorkout.exercises[exIdx].exercise.name;
      const existingSets = workout.activeWorkout.exercises[exIdx].sets.length;

      for (let i = 0; i < d.sets.length; i++) {
        // Add new set (workout store creates empty set)
        if (existingSets + i > 0) workout.addSet(exIdx);
        const setIdx = existingSets + i;
        const s = d.sets[i];
        workout.updateSet(exIdx, setIdx, {
          weight_kg: s.weight_kg ?? null,
          reps: s.reps ?? null,
          rpe: s.rpe ?? null,
          rir: s.rir ?? null,
          set_type: (s.set_type as WorkoutSet["set_type"]) ?? "working",
        });
        workout.completeSet(exIdx, setIdx);
      }

      return {
        success: true,
        message: `Logged ${d.sets.length} set${d.sets.length !== 1 ? "s" : ""} on ${exName}`,
      };
    }

    case "swap_exercise": {
      const d = data as unknown as SwapExerciseActionData;
      if (!d?.current_exercise_name || !d?.new_exercise_name) {
        return { success: false, message: "Missing exercise names for swap" };
      }
      if (!workout.activeWorkout) return { success: false, message: "No active workout" };

      const exIdx = findExerciseIndex(workout.activeWorkout, d.current_exercise_name);
      if (exIdx < 0) return { success: false, message: `"${d.current_exercise_name}" not in workout` };

      const newExercise = await searchExercise(d.new_exercise_name);
      if (!newExercise) return { success: false, message: `Exercise "${d.new_exercise_name}" not found` };

      const oldName = workout.activeWorkout.exercises[exIdx].exercise.name;
      workout.swapExercise(exIdx, newExercise);

      return {
        success: true,
        message: `Swapped ${oldName} → ${newExercise.name}`,
      };
    }

    case "update_set": {
      const d = data as unknown as UpdateSetActionData;
      if (!d?.exercise_name || d?.set_number == null) {
        return { success: false, message: "Missing exercise name or set number" };
      }
      if (!workout.activeWorkout) return { success: false, message: "No active workout" };

      const exIdx = findExerciseIndex(workout.activeWorkout, d.exercise_name);
      if (exIdx < 0) return { success: false, message: `"${d.exercise_name}" not in workout` };

      const setIdx = d.set_number - 1; // Convert 1-indexed to 0-indexed
      const ex = workout.activeWorkout.exercises[exIdx];
      if (setIdx < 0 || setIdx >= ex.sets.length) {
        return { success: false, message: `Set ${d.set_number} doesn't exist` };
      }

      workout.updateSet(exIdx, setIdx, {
        weight_kg: d.updates?.weight_kg ?? undefined,
        reps: d.updates?.reps ?? undefined,
        rpe: d.updates?.rpe ?? undefined,
        rir: d.updates?.rir ?? undefined,
      });

      return {
        success: true,
        message: `Updated set ${d.set_number} on ${ex.exercise.name}`,
      };
    }

    case "remove_exercise": {
      const d = data as unknown as RemoveExerciseActionData;
      if (!d?.exercise_name) return { success: false, message: "No exercise name provided" };
      if (!workout.activeWorkout) return { success: false, message: "No active workout" };

      const exIdx = findExerciseIndex(workout.activeWorkout, d.exercise_name);
      if (exIdx < 0) return { success: false, message: `"${d.exercise_name}" not in workout` };

      const name = workout.activeWorkout.exercises[exIdx].exercise.name;
      workout.removeExercise(exIdx);
      return { success: true, message: `Removed ${name}` };
    }

    case "create_and_add_exercise": {
      const d = data as unknown as CreateAndAddExerciseActionData;
      if (!d?.exercise_name || !d?.muscle_group || !d?.equipment || !d?.category) {
        return { success: false, message: "Missing required fields for custom exercise" };
      }
      if (!workout.activeWorkout) return { success: false, message: "No active workout" };

      // First try to find it (maybe it already exists)
      let exercise = await searchExercise(d.exercise_name);
      if (!exercise) {
        exercise = await createExercise({
          name: d.exercise_name,
          muscle_group: d.muscle_group,
          equipment: d.equipment,
          category: d.category,
        });
      }
      if (!exercise) return { success: false, message: "Failed to create exercise" };

      workout.addExercise(exercise);
      const exIdx = workout.activeWorkout.exercises.length - 1;

      if (d.sets && Array.isArray(d.sets)) {
        for (let i = 0; i < d.sets.length; i++) {
          if (i > 0) workout.addSet(exIdx);
          const s = d.sets[i];
          workout.updateSet(exIdx, i, {
            weight_kg: s.weight_kg ?? null,
            reps: s.reps ?? null,
            set_type: (s.set_type as WorkoutSet["set_type"]) ?? "working",
          });
          workout.completeSet(exIdx, i);
        }
      }

      return {
        success: true,
        message: `Created & added ${exercise.name}`,
      };
    }

    case "start_timer": {
      const d = data as unknown as StartTimerActionData;
      if (!d?.seconds || d.seconds <= 0) return { success: false, message: "Invalid timer duration" };

      timer.startTimer("coach", "Rest Timer", d.seconds);
      return { success: true, message: `Timer started: ${d.seconds}s` };
    }

    case "navigate_to": {
      const d = data as unknown as NavigateToActionData;
      const route = d?.screen ? SCREEN_ROUTES[d.screen] : null;
      if (!route) return { success: false, message: "Unknown screen" };
      router.push(route);
      return { success: true, message: `Navigating to ${d.screen}` };
    }

    case "create_template": {
      const d = data as unknown as CreateTemplateActionData;
      if (!d?.template_name || !d?.exercises?.length) {
        return { success: false, message: "Missing template name or exercises" };
      }

      try {
        const res = await fetch("/api/templates/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: d.template_name,
            description: d.description,
            primary_muscle_group: d.primary_muscle_group,
            estimated_duration_min: d.estimated_duration_min,
            difficulty_level: d.difficulty_level,
            exercises: d.exercises,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { success: false, message: (err as { error?: string }).error || "Failed to create template" };
        }
        const result = await res.json() as { template_id: string };
        // Store template_id so AI can reference it for follow-up start action
        if (data) {
          (data as Record<string, unknown>).created_template_id = result.template_id;
        }
        return {
          success: true,
          message: `Created "${d.template_name}" with ${d.exercises.length} exercises`,
        };
      } catch {
        return { success: false, message: "Failed to create template" };
      }
    }

    case "start_workout_from_template": {
      const d = data as unknown as StartWorkoutFromTemplateActionData;
      if (!d?.template_id) {
        return { success: false, message: "No template specified" };
      }
      if (workout.activeWorkout) {
        return { success: false, message: "A workout is already in progress. Finish or cancel it first." };
      }
      if (!stores.userId) {
        return { success: false, message: "User not authenticated" };
      }

      try {
        const res = await fetch(`/api/templates/${d.template_id}/exercises`);
        if (!res.ok) {
          return { success: false, message: "Could not load template" };
        }
        const { template_name, exercises: templateExercises } = await res.json() as {
          template_name: string;
          exercises: Array<{
            exercises: Exercise;
            target_sets: number | null;
          }>;
        };

        workout.startWorkout(
          template_name || d.template_name,
          stores.userId,
          d.template_id,
        );

        for (const te of templateExercises) {
          const exercise = te.exercises; // joined from Supabase
          if (!exercise) continue;
          workout.addExercise(exercise);
          const exIdx = workout.activeWorkout!.exercises.length - 1;
          // Add extra sets (first set is auto-created by addExercise)
          const targetSets = te.target_sets || 3;
          for (let s = 1; s < targetSets; s++) {
            workout.addSet(exIdx);
          }
        }

        router.push("/workout");

        return {
          success: true,
          message: `Started "${template_name}" with ${templateExercises.length} exercises`,
        };
      } catch {
        return { success: false, message: "Failed to start workout from template" };
      }
    }

    // Display-only actions — no store mutation needed
    case "show_exercise_history":
    case "generate_workout":
    case "show_substitution":
    case "show_readiness":
    case "show_recovery":
    case "show_prescription":
    case "none":
      return { success: true, message: "" };

    default:
      return { success: false, message: `Unknown action: ${action}` };
  }
}
