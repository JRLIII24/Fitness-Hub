import { createClient } from '@/lib/supabase/client';
import type { SaveWorkoutPayload, LogBodyWeightPayload, LogFoodPayload, SyncGroceryPayload } from './queue.types';

type SyncHandler = (payload: unknown) => Promise<void>;

const handlers: Record<string, SyncHandler> = {
    SAVE_WORKOUT_SESSION: async (raw) => {
        const payload = raw as SaveWorkoutPayload;
        const supabase = createClient();

        // Insert the workout session
        const { error: sessionError } = await supabase
            .from('workout_sessions')
            .upsert(
                {
                    id: payload.sessionId,
                    user_id: payload.userId,
                    name: payload.name,
                    started_at: payload.startedAt,
                    ended_at: payload.endedAt,
                    duration_seconds: payload.durationSeconds,
                    total_volume_kg: payload.totalVolumeKg,
                    notes: payload.notes,
                    status: 'completed',
                },
                { onConflict: 'id' }
            );

        if (sessionError) throw sessionError;

        // Insert exercises and sets
        for (const exercise of payload.exercises) {
            const { data: sessionExercise, error: exError } = await supabase
                .from('session_exercises')
                .upsert(
                    {
                        session_id: payload.sessionId,
                        exercise_id: exercise.exerciseId,
                        order_index: exercise.orderIndex,
                    },
                    { onConflict: 'session_id,exercise_id' }
                )
                .select('id')
                .single();

            if (exError) throw exError;

            // Insert sets
            const setRows = exercise.sets.map((s) => ({
                session_exercise_id: sessionExercise.id,
                set_number: s.setNumber,
                set_type: s.setType,
                weight_kg: s.weightKg,
                reps: s.reps,
                rir: s.rir,
                rest_seconds: s.restSeconds,
                completed: s.completed,
            }));

            const { error: setsError } = await supabase
                .from('exercise_sets')
                .upsert(setRows, { onConflict: 'session_exercise_id,set_number' });

            if (setsError) throw setsError;
        }
    },

    LOG_BODY_WEIGHT: async (raw) => {
        const payload = raw as LogBodyWeightPayload;
        const supabase = createClient();
        const { error } = await supabase.from('body_weight_logs').upsert(
            {
                user_id: payload.userId,
                logged_date: payload.loggedDate,
                weight_kg: payload.weightKg,
                body_fat_pct: payload.bodyFatPct,
                note: payload.note,
            },
            { onConflict: 'user_id,logged_date' }
        );

        if (error) throw error;
    },

    LOG_FOOD: async (raw) => {
        const payload = raw as LogFoodPayload;
        const supabase = createClient();
        const { error } = await supabase.from('food_log').insert({
            user_id: payload.userId,
            food_item_id: payload.foodItemId,
            meal_type: payload.mealType,
            servings: payload.servings,
            calories_consumed: payload.caloriesConsumed,
            protein_g: payload.proteinG,
            carbs_g: payload.carbsG,
            fat_g: payload.fatG,
        });

        if (error) throw error;
    },

    SYNC_GROCERY_ITEMS: async (raw) => {
        const payload = raw as SyncGroceryPayload;
        const res = await fetch(`/api/nutrition/grocery-list/${payload.groceryListId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: payload.items }),
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            throw new Error(errorData?.error ?? 'Failed to sync grocery items');
        }
    },
};

export function getSyncHandler(type: string): SyncHandler | undefined {
    return handlers[type];
}
