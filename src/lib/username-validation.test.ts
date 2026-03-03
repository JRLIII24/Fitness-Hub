import { describe, it, expect } from "vitest";
import { isUsernameReserved } from "./username-validation";

// Note: We only test the pure functions (no DB dependency).
// validateUsername() requires Supabase client — tested at integration level.

describe("isUsernameReserved", () => {
  it("returns true for reserved usernames", () => {
    expect(isUsernameReserved("admin")).toBe(true);
    expect(isUsernameReserved("fithub")).toBe(true);
    expect(isUsernameReserved("support")).toBe(true);
    expect(isUsernameReserved("root")).toBe(true);
    expect(isUsernameReserved("moderator")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isUsernameReserved("Admin")).toBe(true);
    expect(isUsernameReserved("FITHUB")).toBe(true);
    expect(isUsernameReserved("SuPpOrT")).toBe(true);
  });

  it("returns false for non-reserved usernames", () => {
    expect(isUsernameReserved("john_doe")).toBe(false);
    expect(isUsernameReserved("fitguy42")).toBe(false);
    expect(isUsernameReserved("runner-pro")).toBe(false);
  });
});
