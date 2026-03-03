export type SafeError = { message: string; code?: string; retryable: boolean };

export function normalizeError(err: unknown): SafeError {
    if (err instanceof Error) {
        const networkPatterns = [
            "network",
            "fetch",
            "failed to fetch",
            "load failed",
            "timeout",
            "aborted",
            "err_internet_disconnected",
            "net::err_",
        ];
        const msg = err.message.toLowerCase();
        const isNetworkError = networkPatterns.some((p) => msg.includes(p));
        return { message: err.message, retryable: isNetworkError };
    }
    if (typeof err === 'string') {
        return { message: err, retryable: false };
    }
    return { message: 'An unexpected error occurred.', retryable: false };
}
