export interface SyncMutationPayload {
    id: string; // Idempotency key
    type: string;
    payload: unknown;
    createdAt: number;
    attempts: number;
    lastAttemptAt?: number;
}
