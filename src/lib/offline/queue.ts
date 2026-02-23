import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SyncMutationPayload } from './queue.types';

interface SyncQueueDB extends DBSchema {
    mutations: {
        key: string;
        value: SyncMutationPayload;
        indexes: { 'by-date': number };
    };
}

let dbPromise: Promise<IDBPDatabase<SyncQueueDB>> | null = null;

function getDB() {
    if (!dbPromise && typeof window !== 'undefined') {
        dbPromise = openDB<SyncQueueDB>('AppOfflineQueue', 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('mutations')) {
                    const store = db.createObjectStore('mutations', { keyPath: 'id' });
                    store.createIndex('by-date', 'createdAt');
                }
            },
        });
    }
    return dbPromise;
}

export async function enqueueMutation(type: string, payload: any, idempotencyKey: string = crypto.randomUUID()) {
    const db = await getDB();
    if (!db) return;
    await db.put('mutations', {
        id: idempotencyKey,
        type,
        payload,
        createdAt: Date.now(),
        attempts: 0
    });
    // Attempt sync immediately if we might be online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
        triggerSync();
    }
}

export async function triggerSync() {
    const db = await getDB();
    if (!db) return;

    const tx = db.transaction('mutations', 'readwrite');
    const store = tx.objectStore('mutations');
    const allMutations = await db.getAllFromIndex('mutations', 'by-date');

    if (allMutations.length === 0) return;

    for (const mutation of allMutations) {
        try {
            // We will map mutation logic based on type elsewhere, e.g. a sync registry.
            // For now, emit a custom event to allow service layers to listen and execute.
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('sync-mutation', {
                    detail: { mutation, db }
                });
                window.dispatchEvent(event);
            }
        } catch (e) {
            mutation.attempts += 1;
            mutation.lastAttemptAt = Date.now();
            await store.put(mutation);
        }
    }
    await tx.done;
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', triggerSync);
    // Optional visibility listener
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
            triggerSync();
        }
    });
}
