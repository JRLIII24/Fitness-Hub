export type SafeError = { message: string; code?: string; retryable: boolean };

export function normalizeError(err: unknown): SafeError {
    if (err instanceof Error) {
        // Basic network error detection
        const isNetworkError = err.message.toLowerCase().includes('network') || err.message.toLowerCase().includes('fetch');
        return { message: err.message, retryable: isNetworkError };
    }
    if (typeof err === 'string') {
        return { message: err, retryable: false };
    }
    return { message: 'An unexpected error occurred.', retryable: false };
}
