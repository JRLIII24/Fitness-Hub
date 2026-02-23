import { normalizeError, SafeError } from '../errors/normalize';

export type MutationResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: SafeError };

/**
 * Wraps a Supabase async call with robust error handling.
 */
export async function safeSupabaseCall<T>(
    promise: PromiseLike<{ data: T | null; error: any }>
): Promise<MutationResult<T>> {
    try {
        const { data, error } = await promise;
        if (error) {
            console.error('[Supabase Error]:', error);
            return { ok: false, error: normalizeError(error) };
        }
        // Note: some read queries return null for data, but mutations often return the updated row.
        // If we absolutely require data, we can check. For now, we allow null if it's a void return.
        return { ok: true, data: data as T };
    } catch (err) {
        console.error('[Supabase Exception]:', err);
        return { ok: false, error: normalizeError(err) };
    }
}
