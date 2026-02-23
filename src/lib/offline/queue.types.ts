export interface SyncMutationPayload {
    id: string; // Idempotency key
    type: string;
    payload: any;
    createdAt: number;
    attempts: number;
    lastAttemptAt?: number;
}
