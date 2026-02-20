import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Exercise, WorkoutExercise, WorkoutSet, ActiveWorkout } from "@/types/workout";
import { createClient } from "@/lib/supabase/client";

interface WorkoutState {
  activeWorkout: ActiveWorkout | null;
  isWorkoutActive: boolean;
  editingWorkoutId: string | null;

  // Actions
  startWorkout: (name: string, templateId?: string) => Promise<void>;
  loadWorkoutForEdit: (workout: ActiveWorkout, workoutSessionId: string) => void;
  cancelWorkout: () => Promise<void>;
  finishWorkout: () => Promise<ActiveWorkout | null>;

  // Workout metadata actions
  updateWorkoutName: (name: string) => void;

  // Notes actions
  setWorkoutNote: (note: string) => void;
  setExerciseNote: (exerciseIndex: number, note: string) => void;

  // Exercise actions
  addExercise: (exercise: Exercise) => void;
  removeExercise: (exerciseIndex: number) => void;
  reorderExercise: (from: number, to: number) => void;
  toggleExerciseCollapse: (exerciseIndex: number) => void;

  // Set actions
  addSet: (exerciseIndex: number) => void;
  updateSet: (
    exerciseIndex: number,
    setIndex: number,
    updates: Partial<WorkoutSet>
  ) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  completeSet: (exerciseIndex: number, setIndex: number) => void;
}

function generateId() {
  return crypto.randomUUID();
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

      startWorkout: async (name: string, templateId?: string) => {
        const workoutId = generateId();
        const startedAt = new Date().toISOString();

        // Sync to database: create active session record
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          await supabase
            .from('active_workout_sessions')
            .upsert({
              user_id: user.id,
              session_name: name,
              started_at: startedAt,
              exercise_count: 0,
            });
        }

        // Set local state
        set({
          activeWorkout: {
            id: workoutId,
            name,
            template_id: templateId || null,
            started_at: startedAt,
            exercises: [],
            notes: "",
          },
          isWorkoutActive: true,
          editingWorkoutId: null,
        });
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

      cancelWorkout: async () => {
        // Remove active session from database
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          await supabase
            .from('active_workout_sessions')
            .delete()
            .eq('user_id', user.id);
        }

        // Clear local state
        set({ activeWorkout: null, isWorkoutActive: false, editingWorkoutId: null });
      },

      finishWorkout: async () => {
        const workout = get().activeWorkout;

        // Remove active session from database
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          await supabase
            .from('active_workout_sessions')
            .delete()
            .eq('user_id', user.id);
        }

        // Clear local state
        set({ activeWorkout: null, isWorkoutActive: false, editingWorkoutId: null });
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

        set({
          activeWorkout: {
            ...state.activeWorkout,
            exercises,
          },
        });
      },
    }),
    {
      name: "fit-hub-workout",
    }
  )
);
