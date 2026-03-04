import { type ZodSchema, ZodError } from "zod";
import { NextResponse } from "next/server";

/**
 * Parse and validate an unknown payload against a Zod schema.
 * Returns the typed result on success.
 * Throws a NextResponse with a 400 status and structured error on failure.
 */
export function parsePayload<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fieldErrors = result.error.issues.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));

  throw NextResponse.json(
    { error: "Validation failed", details: fieldErrors },
    { status: 400 },
  );
}

/**
 * Wrapper for API route handlers that catches parsePayload validation errors.
 * Returns the NextResponse error directly if thrown by parsePayload.
 */
export function withValidation(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  return handler().catch((err: unknown) => {
    if (err instanceof NextResponse) return err;
    throw err;
  });
}
