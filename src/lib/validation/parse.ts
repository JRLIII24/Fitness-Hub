import { z } from 'zod';

export type ParseResult<T> =
    | { success: true; data: T }
    | { success: false; error: { message: string; fieldErrors?: Record<string, string[]> } };

/**
 * Safely parses any generic payload using a Zod schema.
 */
export function parsePayload<T>(schema: z.ZodSchema<T>, payload: unknown): ParseResult<T> {
    const result = schema.safeParse(payload);

    if (result.success) {
        return { success: true, data: result.data };
    }

    console.warn('[Validation Warning] Invalid payload:', result.error.flatten());
    const flattened = result.error.flatten();
    const fieldErrors = Object.fromEntries(
        Object.entries(flattened.fieldErrors).filter(
            (entry): entry is [string, string[]] => Array.isArray(entry[1])
        )
    );

    return {
        success: false,
        error: {
            message: 'Invalid request payload',
            fieldErrors,
        }
    };
}
