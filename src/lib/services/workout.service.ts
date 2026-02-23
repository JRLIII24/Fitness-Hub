import { createClient } from '@/lib/supabase/client';
import { safeSupabaseCall } from './supabase-safe';
import { enqueueMutation } from '@/lib/offline/queue';

export async function createActiveWorkoutSession(userId: string, sessionName: string, startedAt: string) {
    const supabase = createClient();
    const promise = supabase
        .from('active_workout_sessions')
        .upsert({
            user_id: userId,
            session_name: sessionName,
            started_at: startedAt,
            exercise_count: 0,
        });

    // Optimistic/Offline fallback
    const result = await safeSupabaseCall(promise);
    if (!result.ok) {
        // If failed, add to offline queue
        await enqueueMutation('UPSERT_ACTIVE_SESSION', { userId, sessionName, startedAt });
    }
    return result;
}

export async function deleteActiveWorkoutSession(userId: string) {
    const supabase = createClient();
    const promise = supabase
        .from('active_workout_sessions')
        .delete()
        .eq('user_id', userId);

    const result = await safeSupabaseCall(promise);
    if (!result.ok) {
        await enqueueMutation('DELETE_ACTIVE_SESSION', { userId });
    }
    return result;
}

// Global listener for sync
if (typeof window !== 'undefined') {
    window.addEventListener('sync-mutation', async (e: any) => {
        const { mutation, db } = e.detail;
        if (mutation.type === 'UPSERT_ACTIVE_SESSION') {
            const res = await createActiveWorkoutSession(mutation.payload.userId, mutation.payload.sessionName, mutation.payload.startedAt);
            if (res.ok) {
                const tx = db.transaction('mutations', 'readwrite');
                await tx.objectStore('mutations').delete(mutation.id);
                await tx.done;
            }
        } else if (mutation.type === 'DELETE_ACTIVE_SESSION') {
            const res = await deleteActiveWorkoutSession(mutation.payload.userId);
            if (res.ok) {
                const tx = db.transaction('mutations', 'readwrite');
                await tx.objectStore('mutations').delete(mutation.id);
                await tx.done;
            }
        }
    });
}
