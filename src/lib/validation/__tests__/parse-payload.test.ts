import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parsePayload } from "../parse";

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
  email: z.string().email().optional(),
});

describe("parsePayload", () => {
  it("returns success with typed data for valid payload", () => {
    const result = parsePayload(testSchema, { name: "Alice", age: 30 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Alice", age: 30 });
    }
  });

  it("includes optional fields when provided", () => {
    const result = parsePayload(testSchema, {
      name: "Bob",
      age: 25,
      email: "bob@test.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("bob@test.com");
    }
  });

  it("returns failure for missing required field", () => {
    const result = parsePayload(testSchema, { age: 30 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("Invalid request payload");
    }
  });

  it("returns failure for invalid type", () => {
    const result = parsePayload(testSchema, { name: "Alice", age: "not a number" });
    expect(result.success).toBe(false);
  });

  it("returns failure for null input", () => {
    const result = parsePayload(testSchema, null);
    expect(result.success).toBe(false);
  });

  it("returns failure for undefined input", () => {
    const result = parsePayload(testSchema, undefined);
    expect(result.success).toBe(false);
  });

  it("returns failure for empty object", () => {
    const result = parsePayload(testSchema, {});
    expect(result.success).toBe(false);
  });

  it("error includes field-level details", () => {
    const result = parsePayload(testSchema, { name: "", age: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("Invalid request payload");
      expect(result.error.fieldErrors).toBeDefined();
    }
  });
});
