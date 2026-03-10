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
  LogQuickMealActionData,
  CreateProgramActionData,
  PendingAction,
} from "./types";
import { isDestructiveAction } from "./types";
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
  form_check: "/workout/form-check",
  programs: "/programs",
  reports: "/reports",
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
  /** Set when a destructive action needs user confirmation before executing */
  pending?: PendingAction;
}

/** Generate a human-readable description of a destructive action */
function describeDestructiveAction(
  action: CoachAction,
  data: Record<string, unknown> | null | undefined,
  workout: WorkoutStoreApi,
): string {
  if (action === "swap_exercise") {
    const d = data as unknown as SwapExerciseActionData;
    const currentName = d?.current_exercise_name ?? "exercise";
    const newName = d?.new_exercise_name ?? "another exercise";
    return `Swap ${currentName} → ${newName}`;
  }
  if (action === "remove_exercise") {
    const d = data as unknown as RemoveExerciseActionData;
    return `Remove ${d?.exercise_name ?? "exercise"}`;
  }
  if (action === "update_set") {
    const d = data as unknown as UpdateSetActionData;
    const parts: string[] = [];
    if (d?.updates?.weight_kg != null) parts.push(`${d.updates.weight_kg}kg`);
    if (d?.updates?.reps != null) parts.push(`${d.updates.reps} reps`);
    const detail = parts.length > 0 ? ` to ${parts.join(", ")}` : "";
    return `Update set ${d?.set_number ?? "?"} on ${d?.exercise_name ?? "exercise"}${detail}`;
  }
  return `Execute ${action}`;
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
 * Destructive actions (swap, remove, update) return a `pending` result
 * requiring user confirmation before the mutation runs.
 */
export async function executeCoachAction(
  action: CoachAction,
  data: Record<string, unknown> | null | undefined,
  stores: { workout: WorkoutStoreApi; timer: TimerStoreApi; router: RouterApi; userId?: string },
): Promise<ActionResult> {
  const { workout, timer, router } = stores;

  // Intercept destructive actions — return pending confirmation instead of executing
  if (isDestructiveAction(action)) {
    return {
      success: true,
      message: "",
      pending: {
        action,
        data: (data as Record<string, unknown>) ?? null,
        description: describeDestructiveAction(action, data, workout),
      },
    };
  }

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

    // swap_exercise, update_set, remove_exercise are intercepted above as destructive
    // and handled via confirmAction() after user approval

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

      // Normalize exercises — AI may omit muscle_group or use non-standard names
      const normalizedExercises = d.exercises.map((ex) => ({
        exercise_name: ex.exercise_name,
        muscle_group: ex.muscle_group || d.primary_muscle_group || "chest",
        target_sets: ex.target_sets || 3,
        target_reps: String(ex.target_reps || "8-12"),
        target_weight_kg: ex.target_weight_kg,
        rest_seconds: ex.rest_seconds || 90,
        equipment: ex.equipment,
        category: ex.category,
      }));

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
            exercises: normalizedExercises,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { success: false, message: (err as { error?: string }).error || "Failed to create template" };
        }
        const result = await res.json() as { template_id: string; exercise_count: number };
        // Store template_id so AI can reference it for follow-up start action
        if (data) {
          (data as Record<string, unknown>).created_template_id = result.template_id;
        }

        // If the AI requested immediate start, kick off the workout right now
        if (d.start_immediately && !workout.activeWorkout && stores.userId) {
          try {
            const teRes = await fetch(`/api/templates/${result.template_id}/exercises`);
            if (teRes.ok) {
              const { template_name, exercises: templateExercises } = await teRes.json() as {
                template_name: string;
                exercises: Array<{ exercises: Exercise; target_sets: number | null }>;
              };
              workout.startWorkout(template_name || d.template_name, stores.userId, result.template_id);
              for (const te of templateExercises) {
                const exercise = te.exercises;
                if (!exercise) continue;
                workout.addExercise(exercise);
                const exIdx = workout.activeWorkout!.exercises.length - 1;
                const targetSets = te.target_sets || 3;
                for (let s = 1; s < targetSets; s++) {
                  workout.addSet(exIdx);
                }
              }
              router.push("/workout");
              return {
                success: true,
                message: `Created and started "${d.template_name}" with ${result.exercise_count} exercises`,
              };
            }
          } catch {
            // Fall through — template was still saved successfully
          }
        }

        return {
          success: true,
          message: `Created "${d.template_name}" with ${result.exercise_count} exercises`,
        };
      } catch (e) {
        return { success: false, message: `Failed to create template: ${e instanceof Error ? e.message : "network error"}` };
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

    case "log_quick_meal": {
      const d = data as unknown as LogQuickMealActionData;
      if (!d?.description) return { success: false, message: "No meal description" };
      try {
        const res = await fetch("/api/nutrition/quick-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: d.description, meal_type: d.meal_type || "snack" }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { success: false, message: (err as { error?: string }).error || "Failed to log meal" };
        }
        const result = await res.json() as { logged: number };
        return { success: true, message: `Logged ${result.logged} item${result.logged !== 1 ? "s" : ""}` };
      } catch {
        return { success: false, message: "Network error logging meal" };
      }
    }

    case "create_program": {
      const d = data as unknown as CreateProgramActionData;
      if (!d?.goal || !d?.weeks || !d?.days_per_week) {
        return { success: false, message: "Missing program parameters" };
      }
      try {
        const res = await fetch("/api/ai/program-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(d),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          let errMsg = "Failed to generate program";
          try { errMsg = (JSON.parse(text) as { error?: string }).error || errMsg; } catch { /* SSE or non-JSON */ }
          return { success: false, message: errMsg };
        }
        // The program builder returns an SSE stream — read events until "done" or "error"
        const reader = res.body?.getReader();
        if (!reader) return { success: false, message: "No response stream" };
        const decoder = new TextDecoder();
        let programId: string | null = null;
        let errorMsg: string | null = null;
        let buffer = "";
        // Robust SSE parser: accumulate event + data, finalize on blank line
        let currentEvent = "";
        let currentData = "";
        const processEvent = () => {
          if (!currentEvent || !currentData) { currentEvent = ""; currentData = ""; return; }
          try {
            const payload = JSON.parse(currentData);
            if (currentEvent === "done" && payload.program_id) {
              programId = payload.program_id as string;
            } else if (currentEvent === "error") {
              errorMsg = (payload.error as string) || "Program generation failed";
            }
          } catch { /* malformed JSON */ }
          currentEvent = "";
          currentData = "";
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (value) buffer += decoder.decode(value, { stream: true });
          // Split on newlines, keep incomplete trailing line in buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line === "") {
              // Blank line = end of SSE event
              processEvent();
            } else if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              currentData = line.slice(6);
            }
          }
          if (errorMsg) return { success: false, message: errorMsg };
          if (done) break;
        }
        // Process any remaining buffered event
        processEvent();
        if (errorMsg) return { success: false, message: errorMsg };
        if (!programId) {
          console.error("[create_program] Stream ended without program_id");
          return { success: false, message: "Program generation failed" };
        }
        if (data) {
          (data as Record<string, unknown>).program_id = programId;
        }
        router.push(`/programs/${programId}`);
        return { success: true, message: "Program created successfully" };
      } catch (err) {
        console.error("[create_program] Network error:", err);
        return { success: false, message: "Network error generating program" };
      }
    }

    // save_memory is handled server-side in the coach API route — no client action needed
    case "save_memory":
    // Display-only actions — no store mutation needed
    case "show_exercise_history":
    case "generate_workout":
    case "show_substitution":
    case "show_readiness":
    case "show_recovery":
    case "show_prescription":
    case "show_meal_suggestion":
    case "show_macro_breakdown":
    case "none":
      return { success: true, message: "" };

    default:
      return { success: false, message: `Unknown action: ${action}` };
  }
}

/**
 * Confirm and execute a previously-pending destructive action.
 * Called when the user taps "Accept" on a confirmation card.
 */
export async function confirmAction(
  pending: PendingAction,
  stores: { workout: WorkoutStoreApi; timer: TimerStoreApi; router: RouterApi; userId?: string },
): Promise<ActionResult> {
  const { workout } = stores;
  const { action, data } = pending;

  switch (action) {
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
      return { success: true, message: `Swapped ${oldName} → ${newExercise.name}` };
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

    case "update_set": {
      const d = data as unknown as UpdateSetActionData;
      if (!d?.exercise_name || d?.set_number == null) {
        return { success: false, message: "Missing exercise name or set number" };
      }
      if (!workout.activeWorkout) return { success: false, message: "No active workout" };

      const exIdx = findExerciseIndex(workout.activeWorkout, d.exercise_name);
      if (exIdx < 0) return { success: false, message: `"${d.exercise_name}" not in workout` };

      const setIdx = d.set_number - 1;
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
      return { success: true, message: `Updated set ${d.set_number} on ${ex.exercise.name}` };
    }

    default:
      return { success: false, message: `Cannot confirm non-destructive action: ${action}` };
  }
}
