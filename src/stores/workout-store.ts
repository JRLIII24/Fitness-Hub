import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Exercise, WorkoutExercise, WorkoutSet, ActiveWorkout } from "@/types/workout";
import { idbStorage } from "@/lib/idb-storage";
import { uuid } from "@/lib/uuid";
import { createActiveWorkoutSession, deleteActiveWorkoutSession } from "@/lib/services/workout.service";

interface WorkoutState {
  activeWorkout: ActiveWorkout | null;
  isWorkoutActive: boolean;
  editingWorkoutId: string | null;
  _isHydrated: boolean;

  // Actions
  startWorkout: (name: string, userId: string, templateId?: string) => void;
  loadWorkoutForEdit: (workout: ActiveWorkout, workoutSessionId: string) => void;
  cancelWorkout: (userId: string) => void;
  finishWorkout: (userId: string) => ActiveWorkout | null;

  // Workout metadata actions
  updateWorkoutName: (name: string) => void;
  setWorkoutType: (workoutType: string | null) => void;
  updateExerciseEquipment: (exerciseIndex: number, equipment: string) => void;
  updateExerciseName: (exerciseIndex: number, name: string) => void;

  // Notes actions
  setWorkoutNote: (note: string) => void;
  setExerciseNote: (exerciseIndex: number, note: string) => void;

  // Exercise actions
  addExercise: (exercise: Exercise) => void;
  removeExercise: (exerciseIndex: number) => void;
  reorderExercise: (from: number, to: number) => void;
  toggleExerciseCollapse: (exerciseIndex: number) => void;
  swapExercise: (exerciseIndex: number, newExercise: Exercise) => void;

  // Set actions
  addSet: (exerciseIndex: number) => void;
  updateSet: (
    exerciseIndex: number,
    setIndex: number,
    updates: Partial<WorkoutSet>
  ) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  completeSet: (exerciseIndex: number, setIndex: number) => void;

  // Predictive overload
  applyPredictiveOverload: (
    predictions: Map<string, { weightKg: number; reps: number | null; intent: string }>,
    options?: { forceKeys?: Iterable<string> }
  ) => void;
}

function generateId() {
  return uuid();
}

function createEmptySet(exerciseId: string, setNumber: number): WorkoutSet {
  return {
    id: generateId(),
    exercise_id: exerciseId,
    set_number: setNumber,
    set_type: "working",
    reps: null,
    weight_kg: null,
    duration_seconds: null,
    rpe: null,
    rir: null,
    rest_seconds: null,
    completed: false,
    completed_at: null,
  };
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeWorkout: null,
      isWorkoutActive: false,
      editingWorkoutId: null,
      _isHydrated: false,

      startWorkout: (name: string, userId: string, templateId?: string) => {
        const workoutId = generateId();
        const startedAt = new Date().toISOString();

        // Set local state IMMEDIATELY for instant UI response
        set({
          activeWorkout: {
            id: workoutId,
            name,
            template_id: templateId || null,
            started_at: startedAt,
            exercises: [],
            notes: "",
            workout_type: null,
          },
          isWorkoutActive: true,
          editingWorkoutId: null,
        });

        // Sync to database in background (fire-and-forget)
        void createActiveWorkoutSession(userId, name, startedAt);
      },

      loadWorkoutForEdit: (workout: ActiveWorkout, workoutSessionId: string) => {
        set({
          activeWorkout: workout,
          isWorkoutActive: true,
          editingWorkoutId: workoutSessionId,
        });
      },

      updateWorkoutName: (name: string) => {
        const state = get();
        if (!state.activeWorkout) return;
        set({ activeWorkout: { ...state.activeWorkout, name } });
      },

      setWorkoutType: (workoutType: string | null) => {
        const state = get();
        if (!state.activeWorkout) return;
        set({ activeWorkout: { ...state.activeWorkout, workout_type: workoutType } });
      },

      updateExerciseEquipment: (exerciseIndex: number, equipment: string) => {
        const state = get();
        if (!state.activeWorkout) return;
        const exercise = state.activeWorkout.exercises[exerciseIndex]?.exercise;
        if (!exercise) return;
        const exercises = [...state.activeWorkout.exercises];
        exercises[exerciseIndex] = {
          ...exercises[exerciseIndex],
          exercise: { ...exercise, equipment },
        };
        set({ activeWorkout: { ...state.activeWorkout, exercises } });

        // Persist to DB for custom exercises (fire-and-forget)
        if (!exercise.id.startsWith("custom-")) {
          void fetch(`/api/exercises/${exercise.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ equipment }),
          }).catch(() => {});
        }
      },

      updateExerciseName: (exerciseIndex: number, name: string) => {
        const state = get();
        if (!state.activeWorkout) return;
        const exercise = state.activeWorkout.exercises[exerciseIndex]?.exercise;
        if (!exercise) return;
        const exercises = [...state.activeWorkout.exercises];
        exercises[exerciseIndex] = {
          ...exercises[exerciseIndex],
          exercise: { ...exercise, name },
        };
        set({ activeWorkout: { ...state.activeWorkout, exercises } });

        // Persist to DB for custom exercises (fire-and-forget)
        if (!exercise.id.startsWith("custom-")) {
          void fetch(`/api/exercises/${exercise.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          }).catch(() => {});
        }
      },

      setWorkoutNote: (note: string) => {
        const state = get();
        if (!state.activeWorkout) return;
        set({ activeWorkout: { ...state.activeWorkout, notes: note } });
      },

      setExerciseNote: (exerciseIndex: number, note: string) => {
        const state = get();
        if (!state.activeWorkout) return;
        const exercises = [...state.activeWorkout.exercises];
        exercises[exerciseIndex] = { ...exercises[exerciseIndex], notes: note };
        set({ activeWorkout: { ...state.activeWorkout, exercises } });
      },

      cancelWorkout: (userId: string) => {
        // Clear local state IMMEDIATELY
        set({ activeWorkout: null, isWorkoutActive: false, editingWorkoutId: null });

        // Remove active session from database in background
        void deleteActiveWorkoutSession(userId);
      },

      finishWorkout: (userId: string) => {
        // Capture workout reference before clearing state
        const workout = get().activeWorkout;

        // Clear local state IMMEDIATELY
        set({ activeWorkout: null, isWorkoutActive: false, editingWorkoutId: null });

        // Remove active session from database in background
        void deleteActiveWorkoutSession(userId);

        return workout;
      },

      addExercise: (exercise: Exercise) => {
        const state = get();
        if (!state.activeWorkout) return;

        const newExercise: WorkoutExercise = {
          exercise,
          sets: [createEmptySet(exercise.id, 1)],
          collapsed: false,
          notes: "",
        };

        set({
          activeWorkout: {
            ...state.activeWorkout,
            exercises: [...state.activeWorkout.exercises, newExercise],
          },
        });
      },

      removeExercise: (exerciseIndex: number) => {
        const state = get();
        if (!state.activeWorkout) return;

        set({
          activeWorkout: {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises.filter(
              (_, i) => i !== exerciseIndex
            ),
          },
        });
      },

      swapExercise: (exerciseIndex: number, newExercise: Exercise) => {
        const state = get();
        if (!state.activeWorkout) return;

        const exercises = [...state.activeWorkout.exercises];
        const existing = exercises[exerciseIndex];

        // Keep same set count and reps/rest structure; reset weight (movement-specific)
        exercises[exerciseIndex] = {
          ...existing,
          exercise: newExercise,
          sets: existing.sets.map((s) => ({
            ...s,
            exercise_id: newExercise.id,
            weight_kg: null,
          })),
        };

        set({
          activeWorkout: {
            ...state.activeWorkout,
            exercises,
          },
        });
      },

      reorderExercise: (from: number, to: number) => {
        const state = get();
        if (!state.activeWorkout) return;

        const exercises = [...state.activeWorkout.exercises];
        const [moved] = exercises.splice(from, 1);
        exercises.splice(to, 0, moved);

        set({
          activeWorkout: {
            ...state.activeWorkout,
            exercises,
          },
        });
      },

      toggleExerciseCollapse: (exerciseIndex: number) => {
        const state = get();
        if (!state.activeWorkout) return;

        const exercises = [...state.activeWorkout.exercises];
        exercises[exerciseIndex] = {
          ...exercises[exerciseIndex],
          collapsed: !exercises[exerciseIndex].collapsed,
        };

        set({
          activeWorkout: {
            ...state.activeWorkout,
            exercises,
          },
        });
      },

      addSet: (exerciseIndex: number) => {
        const state = get();
        if (!state.activeWorkout) return;

        const exercises = [...state.activeWorkout.exercises];
        const exercise = exercises[exerciseIndex];
        const newSetNumber = exercise.sets.length + 1;

        // Copy weight/reps from previous set as a convenience
        const prevSet = exercise.sets[exercise.sets.length - 1];

        exercises[exerciseIndex] = {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              ...createEmptySet(exercise.exercise.id, newSetNumber),
              weight_kg: prevSet?.weight_kg ?? null,
              reps: prevSet?.reps ?? null,
              set_type: prevSet?.set_type ?? "working",
            },
          ],
        };

        set({
          activeWorkout: {
            ...state.activeWorkout,
            exercises,
          },
        });
      },

      updateSet: (
        exerciseIndex: number,
        setIndex: number,
        updates: Partial<WorkoutSet>
      ) => {
        const state = get();
        if (!state.activeWorkout) return;

        const exercises = [...state.activeWorkout.exercises];
        const sets = [...exercises[exerciseIndex].sets];
        sets[setIndex] = { ...sets[setIndex], ...updates };
        exercises[exerciseIndex] = { ...exercises[exerciseIndex], sets };

        set({
          activeWorkout: {
            ...state.activeWorkout,
            exercises,
          },
        });
      },

      removeSet: (exerciseIndex: number, setIndex: number) => {
        const state = get();
        if (!state.activeWorkout) return;

        const exercises = [...state.activeWorkout.exercises];
        const sets = exercises[exerciseIndex].sets.filter(
          (_, i) => i !== setIndex
        );
        // Re-number remaining sets
        const renumbered = sets.map((s, i) => ({
          ...s,
          set_number: i + 1,
        }));
        exercises[exerciseIndex] = {
          ...exercises[exerciseIndex],
          sets: renumbered,
        };

        set({
          activeWorkout: {
            ...state.activeWorkout,
            exercises,
          },
        });
      },

      applyPredictiveOverload: (
        predictions: Map<string, { weightKg: number; reps: number | null; intent: string }>,
        options?: { forceKeys?: Iterable<string> }
      ) => {
        const state = get();
        if (!state.activeWorkout || predictions.size === 0) return;

        const exercises = [...state.activeWorkout.exercises];
        const forceKeys = new Set(options?.forceKeys ?? []);
        let changed = false;

        for (let ei = 0; ei < exercises.length; ei++) {
          const sets = [...exercises[ei].sets];
          let exerciseChanged = false;
          for (let si = 0; si < sets.length; si++) {
            const key = `${exercises[ei].exercise.id}:${si}`;
            const prediction = predictions.get(key);
            if (!prediction) continue;
            if (sets[si].completed) continue;

            const forceApply = forceKeys.has(key);
            const shouldApplyWeight =
              forceApply || sets[si].weight_kg === null || Boolean(sets[si].is_predicted);
            const shouldApplyReps =
              prediction.reps !== null &&
              (forceApply || sets[si].reps === null || Boolean(sets[si].is_predicted));

            if (!shouldApplyWeight && !shouldApplyReps) continue;

            const nextWeight = shouldApplyWeight
              ? prediction.weightKg
              : sets[si].weight_kg;
            const nextReps = shouldApplyReps ? prediction.reps : sets[si].reps;

            if (
              sets[si].weight_kg === nextWeight &&
              sets[si].reps === nextReps &&
              sets[si].is_predicted === true
            ) {
              continue;
            }

            sets[si] = {
              ...sets[si],
              weight_kg: nextWeight,
              reps: nextReps,
              is_predicted: true,
            };
            exerciseChanged = true;
          }
          if (exerciseChanged) {
            exercises[ei] = { ...exercises[ei], sets };
            changed = true;
          }
        }

        if (changed) {
          set({ activeWorkout: { ...state.activeWorkout, exercises } });
        }
      },

      completeSet: (exerciseIndex: number, setIndex: number) => {
        const state = get();
        if (!state.activeWorkout) return;

        const exercises = [...state.activeWorkout.exercises];
        const sets = [...exercises[exerciseIndex].sets];
        sets[setIndex] = {
          ...sets[setIndex],
          completed: !sets[setIndex].completed,
          completed_at: sets[setIndex].completed
            ? null
            : new Date().toISOString(),
        };
        exercises[exerciseIndex] = { ...exercises[exerciseIndex], sets };

        const updatedWorkout = {
          ...state.activeWorkout,
          exercises,
        };

        set({ activeWorkout: updatedWorkout });

        // Persist draft server-side so the workout can be restored if the app crashes.
        // Fire-and-forget — failures are silent (best-effort only).
        void fetch("/api/workout/draft", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draft_data: {
              workoutName: updatedWorkout.name,
              startedAt: updatedWorkout.started_at,
              templateId: updatedWorkout.template_id ?? null,
              exercises: updatedWorkout.exercises,
            },
          }),
        }).catch(() => {});
      },
    }),
    {
      name: "fit-hub-workout",
      storage: createJSONStorage(() => idbStorage),
      onRehydrateStorage: () => () => {
        useWorkoutStore.setState({ _isHydrated: true });
      },
    }
  )
);
