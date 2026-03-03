import { describe, it, expect } from "vitest";
import { createPodSchema } from "./pods.schemas";
import { submitReviewSchema } from "./reviews.schemas";

describe("createPodSchema", () => {
  it("accepts valid pod name", () => {
    expect(createPodSchema.safeParse({ name: "My Pod" }).success).toBe(true);
  });

  it("rejects name shorter than 2 chars", () => {
    const result = createPodSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 50 chars", () => {
    const result = createPodSchema.safeParse({ name: "A".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from name", () => {
    const result = createPodSchema.parse({ name: "  My Pod  " });
    expect(result.name).toBe("My Pod");
  });

  it("accepts optional description", () => {
    expect(createPodSchema.safeParse({ name: "Pod", description: "A fitness group" }).success).toBe(true);
  });

  it("rejects description over 200 chars", () => {
    const result = createPodSchema.safeParse({ name: "Pod", description: "x".repeat(201) });
    expect(result.success).toBe(false);
  });
});

describe("submitReviewSchema", () => {
  it("accepts valid rating with comment", () => {
    expect(submitReviewSchema.safeParse({ rating: 4, comment: "Great template!" }).success).toBe(true);
  });

  it("accepts rating without comment", () => {
    expect(submitReviewSchema.safeParse({ rating: 3 }).success).toBe(true);
  });

  it("rejects rating below 1", () => {
    expect(submitReviewSchema.safeParse({ rating: 0 }).success).toBe(false);
  });

  it("rejects rating above 5", () => {
    expect(submitReviewSchema.safeParse({ rating: 6 }).success).toBe(false);
  });

  it("rejects non-integer rating", () => {
    expect(submitReviewSchema.safeParse({ rating: 3.5 }).success).toBe(false);
  });

  it("rejects comment over 500 chars", () => {
    expect(submitReviewSchema.safeParse({ rating: 5, comment: "x".repeat(501) }).success).toBe(false);
  });
});
