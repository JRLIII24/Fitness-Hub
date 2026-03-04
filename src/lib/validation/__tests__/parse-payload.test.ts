import { describe, it, expect } from "vitest";
import { z } from "zod";
import { NextResponse } from "next/server";
import { parsePayload } from "../parse-payload";

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
  email: z.string().email().optional(),
});

describe("parsePayload", () => {
  it("returns typed data for valid payload", () => {
    const result = parsePayload(testSchema, { name: "Alice", age: 30 });
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  it("includes optional fields when provided", () => {
    const result = parsePayload(testSchema, {
      name: "Bob",
      age: 25,
      email: "bob@test.com",
    });
    expect(result.email).toBe("bob@test.com");
  });

  it("throws NextResponse for missing required field", () => {
    try {
      parsePayload(testSchema, { age: 30 });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NextResponse);
      const response = err as NextResponse;
      expect(response.status).toBe(400);
    }
  });

  it("throws NextResponse for invalid type", () => {
    try {
      parsePayload(testSchema, { name: "Alice", age: "not a number" });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NextResponse);
    }
  });

  it("throws NextResponse for null input", () => {
    try {
      parsePayload(testSchema, null);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NextResponse);
    }
  });

  it("throws NextResponse for undefined input", () => {
    try {
      parsePayload(testSchema, undefined);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NextResponse);
    }
  });

  it("throws NextResponse for empty object", () => {
    try {
      parsePayload(testSchema, {});
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NextResponse);
    }
  });

  it("error response includes field-level details", async () => {
    try {
      parsePayload(testSchema, { name: "", age: -1 });
      expect.fail("Should have thrown");
    } catch (err) {
      const response = err as NextResponse;
      const body = await response.json();
      expect(body.error).toBe("Validation failed");
      expect(body.details).toBeInstanceOf(Array);
      expect(body.details.length).toBeGreaterThan(0);
      expect(body.details[0]).toHaveProperty("field");
      expect(body.details[0]).toHaveProperty("message");
    }
  });
});
