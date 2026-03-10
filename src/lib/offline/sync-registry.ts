import { createClient } from '@/lib/supabase/client';
import type { SaveWorkoutPayload, LogBodyWeightPayload, LogFoodPayload, SyncGroceryPayload } from './queue.types';

type SyncHandler = (payload: unknown) => Promise<void>;

const handlers: Record<string, SyncHandler> = {
    SAVE_WORKOUT_SESSION: async (raw) => {
        const payload = raw as SaveWorkoutPayload;
        const supabase = createClient();

        // 1. Insert the workout session
        const { data: session, error: sessionError } = await supabase
            .from('workout_sessions')
            .upsert(
                {
                    id: payload.sessionId,
                    user_id: payload.userId,
                    template_id: payload.templateId,
                    name: payload.name,
                    started_at: payload.startedAt,
                    status: 'in_progress',
                    completed_at: null,
                    duration_seconds: null,
                    total_volume_kg: null,
                    notes: payload.notes,
                },
                { onConflict: 'id' }
            )
            .select('id')
            .single();

        if (sessionError || !session) throw sessionError ?? new Error('No session returned');

        // 2. Insert workout_sets
        const setRows = payload.setRows.map((s) => ({
            session_id: session.id,
            exercise_id: s.exerciseId,
            set_number: s.setNumber,
            set_type: s.setType as "warmup" | "working" | "dropset" | "failure",
            weight_kg: s.weightKg,
            reps: s.reps,
            rir: s.rir,
            rest_seconds: s.restSeconds,
            completed_at: s.completedAt,
            sort_order: s.sortOrder,
        }));

        const { error: setsError } = await supabase
            .from('workout_sets')
            .upsert(setRows, { onConflict: 'session_id,sort_order' });

        if (setsError) throw setsError;

        // 3. Mark session completed
        const { error: completeError } = await supabase
            .from('workout_sessions')
            .update({
                status: 'completed',
                completed_at: payload.endedAt,
                duration_seconds: payload.durationSeconds,
                total_volume_kg: payload.totalVolumeKg,
                notes: payload.notes,
            })
            .eq('id', session.id)
            .eq('user_id', payload.userId);

        if (completeError) throw completeError;
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
            meal_type: payload.mealType as "breakfast" | "lunch" | "dinner" | "snack",
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
