import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeCoachAction,
  confirmAction,
  type WorkoutStoreApi,
  type TimerStoreApi,
  type RouterApi,
} from "../action-executor";
import type { PendingAction } from "../types";
import type { Exercise, WorkoutSet } from "@/types/workout";

// ── Mocks ──

function makeExercise(name: string, id = "ex-1"): Exercise {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    muscle_group: "chest",
    equipment: "barbell",
    category: "compound",
    is_custom: false,
    created_by: null,
  } as Exercise;
}

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    set_number: 1,
    weight_kg: 100,
    reps: 5,
    rir: null,
    rpe: null,
    rest_seconds: null,
    set_type: "working",
    completed: false,
    completed_at: null,
    ...overrides,
  } as WorkoutSet;
}

function createMockStores(
  overrides: { hasActiveWorkout?: boolean; exercises?: Array<{ exercise: Exercise; sets: WorkoutSet[] }> } = {},
) {
  const exercises = overrides.exercises ?? [
    { exercise: makeExercise("Bench Press"), sets: [makeSet(), makeSet({ set_number: 2 })] },
  ];

  const workout: WorkoutStoreApi = {
    activeWorkout: overrides.hasActiveWorkout === false
      ? null
      : { id: "workout-1", exercises },
    startWorkout: vi.fn(),
    addExercise: vi.fn(),
    swapExercise: vi.fn(),
    addSet: vi.fn(),
    updateSet: vi.fn(),
    completeSet: vi.fn(),
    removeExercise: vi.fn(),
  };

  const timer: TimerStoreApi = {
    startTimer: vi.fn(() => "timer-1"),
  };

  const router: RouterApi = {
    push: vi.fn(),
  };

  return { workout, timer, router, userId: "user-1" };
}

// Mock the fetch calls used by searchExercise and createExercise
function mockFetchForSearch(exercise: Exercise | null) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: exercise !== null,
    json: async () => (exercise ? { exercises: [exercise] } : { exercises: [] }),
  });
}

// ── Destructive actions return pending ──

describe("executeCoachAction — destructive actions", () => {
  it("swap_exercise returns pending confirmation", async () => {
    const stores = createMockStores();
    const result = await executeCoachAction("swap_exercise", {
      current_exercise_name: "Bench Press",
      new_exercise_name: "Dumbbell Press",
      new_muscle_group: "chest",
      reason: "recovery",
    }, stores);

    expect(result.success).toBe(true);
    expect(result.pending).toBeDefined();
    expect(result.pending!.action).toBe("swap_exercise");
    expect(result.pending!.description).toContain("Bench Press");
    expect(result.pending!.description).toContain("Dumbbell Press");
    // Should NOT have called any store mutation
    expect(stores.workout.swapExercise).not.toHaveBeenCalled();
  });

  it("remove_exercise returns pending confirmation", async () => {
    const stores = createMockStores();
    const result = await executeCoachAction("remove_exercise", {
      exercise_name: "Bench Press",
      reason: "fatigue",
    }, stores);

    expect(result.success).toBe(true);
    expect(result.pending).toBeDefined();
    expect(result.pending!.action).toBe("remove_exercise");
    expect(result.pending!.description).toContain("Bench Press");
    expect(stores.workout.removeExercise).not.toHaveBeenCalled();
  });

  it("update_set returns pending confirmation with details", async () => {
    const stores = createMockStores();
    const result = await executeCoachAction("update_set", {
      exercise_name: "Bench Press",
      set_number: 1,
      updates: { weight_kg: 110, reps: 3 },
    }, stores);

    expect(result.success).toBe(true);
    expect(result.pending).toBeDefined();
    expect(result.pending!.action).toBe("update_set");
    expect(result.pending!.description).toContain("110kg");
    expect(result.pending!.description).toContain("3 reps");
    expect(stores.workout.updateSet).not.toHaveBeenCalled();
  });
});

// ── Non-destructive actions execute immediately ──

describe("executeCoachAction — non-destructive actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("start_timer starts timer immediately", async () => {
    const stores = createMockStores();
    const result = await executeCoachAction("start_timer", { seconds: 90 }, stores);

    expect(result.success).toBe(true);
    expect(result.message).toContain("90s");
    expect(stores.timer.startTimer).toHaveBeenCalledWith("coach", "Rest Timer", 90);
  });

  it("start_timer rejects invalid duration", async () => {
    const stores = createMockStores();

    const result1 = await executeCoachAction("start_timer", { seconds: 0 }, stores);
    expect(result1.success).toBe(false);

    const result2 = await executeCoachAction("start_timer", { seconds: -10 }, stores);
    expect(result2.success).toBe(false);

    const result3 = await executeCoachAction("start_timer", {}, stores);
    expect(result3.success).toBe(false);
  });

  it("navigate_to pushes correct route", async () => {
    const stores = createMockStores();
    const result = await executeCoachAction("navigate_to", { screen: "dashboard" }, stores);

    expect(result.success).toBe(true);
    expect(stores.router.push).toHaveBeenCalledWith("/dashboard");
  });

  it("navigate_to fails for unknown screen", async () => {
    const stores = createMockStores();
    const result = await executeCoachAction("navigate_to", { screen: "nonexistent" }, stores);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Unknown screen");
  });

  it("add_exercise fails without active workout", async () => {
    const stores = createMockStores({ hasActiveWorkout: false });
    mockFetchForSearch(makeExercise("Squat", "ex-2"));
    const result = await executeCoachAction("add_exercise", {
      exercise_name: "Squat",
      muscle_group: "legs",
    }, stores);

    expect(result.success).toBe(false);
    expect(result.message).toContain("No active workout");
  });

  it("add_exercise fails without exercise name", async () => {
    const stores = createMockStores();
    const result = await executeCoachAction("add_exercise", {}, stores);

    expect(result.success).toBe(false);
    expect(result.message).toContain("No exercise name");
  });

  it("add_exercise searches and adds exercise", async () => {
    const stores = createMockStores();
    const squat = makeExercise("Squat", "ex-2");
    mockFetchForSearch(squat);

    const result = await executeCoachAction("add_exercise", {
      exercise_name: "Squat",
      muscle_group: "legs",
    }, stores);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Squat");
    expect(stores.workout.addExercise).toHaveBeenCalledWith(squat);
  });

  it("add_exercise with prescribed sets updates and completes them", async () => {
    const stores = createMockStores();
    const squat = makeExercise("Squat", "ex-2");
    mockFetchForSearch(squat);

    const result = await executeCoachAction("add_exercise", {
      exercise_name: "Squat",
      muscle_group: "legs",
      sets: [
        { weight_kg: 100, reps: 5 },
        { weight_kg: 100, reps: 5 },
      ],
    }, stores);

    expect(result.success).toBe(true);
    expect(result.message).toContain("2 sets");
    // First set: update + complete (index 0)
    // Second set: addSet + update + complete (index 1)
    expect(stores.workout.addSet).toHaveBeenCalledTimes(1);
    expect(stores.workout.updateSet).toHaveBeenCalledTimes(2);
    expect(stores.workout.completeSet).toHaveBeenCalledTimes(2);
  });

  it("add_sets fails without exercise name or sets", async () => {
    const stores = createMockStores();
    const result = await executeCoachAction("add_sets", { exercise_name: "Bench" }, stores);
    expect(result.success).toBe(false);
  });

  it("display-only actions succeed immediately", async () => {
    const stores = createMockStores();
    const displayActions = [
      "show_exercise_history",
      "generate_workout",
      "show_substitution",
      "show_readiness",
      "show_recovery",
      "show_prescription",
      "show_meal_suggestion",
      "show_macro_breakdown",
      "none",
    ] as const;

    for (const action of displayActions) {
      const result = await executeCoachAction(action, {}, stores);
      expect(result.success).toBe(true);
      expect(result.pending).toBeUndefined();
    }
  });

  it("unknown action returns failure", async () => {
    const stores = createMockStores();
    // @ts-expect-error testing unknown action
    const result = await executeCoachAction("fly_to_moon", {}, stores);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Unknown action");
  });
});

// ── confirmAction (executing pending destructive actions) ──

describe("confirmAction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("confirms remove_exercise and calls store", async () => {
    const stores = createMockStores();
    const pending: PendingAction = {
      action: "remove_exercise",
      data: { exercise_name: "Bench Press", reason: "test" },
      description: "Remove Bench Press",
    };

    const result = await confirmAction(pending, stores);
    expect(result.success).toBe(true);
    expect(result.message).toContain("Removed");
    expect(stores.workout.removeExercise).toHaveBeenCalledWith(0);
  });

  it("confirmAction remove_exercise fails when exercise not found", async () => {
    const stores = createMockStores();
    const pending: PendingAction = {
      action: "remove_exercise",
      data: { exercise_name: "Nonexistent Exercise", reason: "test" },
      description: "Remove Nonexistent",
    };

    const result = await confirmAction(pending, stores);
    expect(result.success).toBe(false);
    expect(result.message).toContain("not in workout");
  });

  it("confirms update_set and calls store", async () => {
    const stores = createMockStores();
    const pending: PendingAction = {
      action: "update_set",
      data: {
        exercise_name: "Bench Press",
        set_number: 1,
        updates: { weight_kg: 110, reps: 3 },
      },
      description: "Update set 1",
    };

    const result = await confirmAction(pending, stores);
    expect(result.success).toBe(true);
    expect(stores.workout.updateSet).toHaveBeenCalledWith(0, 0, {
      weight_kg: 110,
      reps: 3,
      rpe: undefined,
      rir: undefined,
    });
  });

  it("confirms swap_exercise and calls store", async () => {
    const stores = createMockStores();
    const newExercise = makeExercise("Dumbbell Press", "ex-3");
    mockFetchForSearch(newExercise);

    const pending: PendingAction = {
      action: "swap_exercise",
      data: {
        current_exercise_name: "Bench Press",
        new_exercise_name: "Dumbbell Press",
        new_muscle_group: "chest",
        reason: "variation",
      },
      description: "Swap Bench Press -> Dumbbell Press",
    };

    const result = await confirmAction(pending, stores);
    expect(result.success).toBe(true);
    expect(stores.workout.swapExercise).toHaveBeenCalledWith(0, newExercise);
  });

  it("confirm fails for non-destructive action", async () => {
    const stores = createMockStores();
    const pending: PendingAction = {
      action: "start_timer",
      data: { seconds: 90 },
      description: "Start timer",
    };

    const result = await confirmAction(pending, stores);
    expect(result.success).toBe(false);
    expect(result.message).toContain("non-destructive");
  });

  it("confirm fails without active workout", async () => {
    const stores = createMockStores({ hasActiveWorkout: false });
    const pending: PendingAction = {
      action: "remove_exercise",
      data: { exercise_name: "Bench", reason: "test" },
      description: "Remove Bench",
    };

    const result = await confirmAction(pending, stores);
    expect(result.success).toBe(false);
    expect(result.message).toContain("No active workout");
  });

  it("update_set fails for out of range set number", async () => {
    const stores = createMockStores();
    const pending: PendingAction = {
      action: "update_set",
      data: {
        exercise_name: "Bench Press",
        set_number: 99,
        updates: { weight_kg: 110 },
      },
      description: "Update set 99",
    };

    const result = await confirmAction(pending, stores);
    expect(result.success).toBe(false);
    expect(result.message).toContain("doesn't exist");
  });
});

// ── findExerciseIndex (tested indirectly through confirmAction) ──

describe("findExerciseIndex (via confirmAction)", () => {
  it("matches exercise by partial name (current name includes search term)", async () => {
    const stores = createMockStores({
      exercises: [
        { exercise: makeExercise("Barbell Bench Press"), sets: [makeSet()] },
      ],
    });

    const pending: PendingAction = {
      action: "remove_exercise",
      data: { exercise_name: "Bench Press", reason: "test" },
      description: "Remove Bench Press",
    };

    const result = await confirmAction(pending, stores);
    expect(result.success).toBe(true);
    expect(stores.workout.removeExercise).toHaveBeenCalledWith(0);
  });

  it("matches when search term includes the exercise name", async () => {
    const stores = createMockStores({
      exercises: [
        { exercise: makeExercise("Squat"), sets: [makeSet()] },
      ],
    });

    const pending: PendingAction = {
      action: "remove_exercise",
      data: { exercise_name: "Barbell Back Squat", reason: "test" },
      description: "Remove Squat",
    };

    const result = await confirmAction(pending, stores);
    expect(result.success).toBe(true);
    expect(stores.workout.removeExercise).toHaveBeenCalledWith(0);
  });
});
