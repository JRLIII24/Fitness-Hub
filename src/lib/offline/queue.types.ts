export type MutationType =
    | 'UPSERT_ACTIVE_SESSION'
    | 'DELETE_ACTIVE_SESSION'
    | 'SAVE_WORKOUT_SESSION'
    | 'LOG_BODY_WEIGHT'
    | 'LOG_FOOD';

export interface SyncMutationPayload {
    id: string; // Idempotency key
    type: string;
    payload: unknown;
    createdAt: number;
    attempts: number;
    lastAttemptAt?: number;
}

export interface SaveWorkoutPayload {
    userId: string;
    sessionId: string;
    name: string;
    startedAt: string;
    endedAt: string;
    durationSeconds: number;
    totalVolumeKg: number;
    notes: string;
    exercises: Array<{
        exerciseId: string;
        orderIndex: number;
        sets: Array<{
            setNumber: number;
            setType: string;
            weightKg: number | null;
            reps: number | null;
            rir: number | null;
            restSeconds: number;
            completed: boolean;
        }>;
    }>;
}

export interface LogBodyWeightPayload {
    userId: string;
    loggedDate: string;
    weightKg: number;
    bodyFatPct: number | null;
    note: string | null;
}

export interface LogFoodPayload {
    userId: string;
    foodItemId: string;
    mealType: string;
    servings: number;
    caloriesConsumed: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
}
