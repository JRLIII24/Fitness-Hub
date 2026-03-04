import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { uuid } from '@/lib/uuid';
import { SyncMutationPayload } from './queue.types';
import { getSyncHandler } from './sync-registry';

interface SyncQueueDB extends DBSchema {
    mutations: {
        key: string;
        value: SyncMutationPayload;
        indexes: { 'by-date': number };
    };
}

let dbPromise: Promise<IDBPDatabase<SyncQueueDB>> | null = null;

/** Exponential backoff with jitter: base 1s, max 5min */
export function getBackoffMs(attempt: number): number {
    const baseMs = 1000;
    const maxMs = 5 * 60 * 1000;
    const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));
    // Add ±25% jitter
    const jitter = exponential * (0.75 + Math.random() * 0.5);
    return Math.round(jitter);
}

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

export async function enqueueMutation(type: string, payload: unknown, idempotencyKey: string = uuid()) {
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

    const allMutations = await db.getAllFromIndex('mutations', 'by-date');
    if (allMutations.length === 0) return;

    for (const mutation of allMutations) {
        const handler = getSyncHandler(mutation.type);
        if (!handler) {
            // Unknown type — remove stale entry
            await db.delete('mutations', mutation.id);
            continue;
        }

        // Exponential backoff: skip if not enough time has passed since last attempt
        if (mutation.attempts > 0 && mutation.lastAttemptAt) {
            const backoffMs = getBackoffMs(mutation.attempts);
            if (Date.now() - mutation.lastAttemptAt < backoffMs) {
                continue; // Not ready for retry yet
            }
        }

        try {
            await handler(mutation.payload);
            // Success — remove from queue
            await db.delete('mutations', mutation.id);
        } catch (err) {
            mutation.attempts += 1;
            mutation.lastAttemptAt = Date.now();

            // Give up after 10 attempts
            if (mutation.attempts >= 10) {
                console.error(
                    `[OfflineQueue] Giving up on mutation ${mutation.id} after ${mutation.attempts} attempts`,
                    err
                );
                await db.delete('mutations', mutation.id);
            } else {
                await db.put('mutations', mutation);
            }
        }
    }
}

export async function getPendingCount(): Promise<number> {
    const db = await getDB();
    if (!db) return 0;
    return db.count('mutations');
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
