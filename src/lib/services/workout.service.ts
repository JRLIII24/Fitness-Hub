import { createClient } from '@/lib/supabase/client';
import { safeSupabaseCall } from './supabase-safe';
import { enqueueMutation } from '@/lib/offline/queue';
import type { IDBPDatabase, DBSchema } from 'idb';
import type { SyncMutationPayload } from '@/lib/offline/queue.types';

interface OfflineQueueDB extends DBSchema {
    mutations: {
        key: string;
        value: SyncMutationPayload;
        indexes: { 'by-date': number };
    };
}

type SyncMutationEventDetail = {
    mutation: SyncMutationPayload;
    db: IDBPDatabase<OfflineQueueDB>;
};

function asSyncMutationEvent(event: Event): CustomEvent<SyncMutationEventDetail> | null {
    if (!('detail' in event)) return null;
    return event as CustomEvent<SyncMutationEventDetail>;
}

function parseUpsertPayload(payload: unknown): { userId: string; sessionName: string; startedAt: string } | null {
    if (!payload || typeof payload !== 'object') return null;
    const candidate = payload as { userId?: unknown; sessionName?: unknown; startedAt?: unknown };
    if (
        typeof candidate.userId !== 'string' ||
        typeof candidate.sessionName !== 'string' ||
        typeof candidate.startedAt !== 'string'
    ) {
        return null;
    }
    return {
        userId: candidate.userId,
        sessionName: candidate.sessionName,
        startedAt: candidate.startedAt,
    };
}

function parseDeletePayload(payload: unknown): { userId: string } | null {
    if (!payload || typeof payload !== 'object') return null;
    const candidate = payload as { userId?: unknown };
    if (typeof candidate.userId !== 'string') return null;
    return { userId: candidate.userId };
}

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
    window.addEventListener('sync-mutation', async (event) => {
        const syncEvent = asSyncMutationEvent(event);
        if (!syncEvent) return;
        const { mutation, db } = syncEvent.detail;
        if (mutation.type === 'UPSERT_ACTIVE_SESSION') {
            const payload = parseUpsertPayload(mutation.payload);
            if (!payload) return;
            const res = await createActiveWorkoutSession(payload.userId, payload.sessionName, payload.startedAt);
            if (res.ok) {
                const tx = db.transaction('mutations', 'readwrite');
                await tx.objectStore('mutations').delete(mutation.id);
                await tx.done;
            }
        } else if (mutation.type === 'DELETE_ACTIVE_SESSION') {
            const payload = parseDeletePayload(mutation.payload);
            if (!payload) return;
            const res = await deleteActiveWorkoutSession(payload.userId);
            if (res.ok) {
                const tx = db.transaction('mutations', 'readwrite');
                await tx.objectStore('mutations').delete(mutation.id);
                await tx.done;
            }
        }
    });
}
