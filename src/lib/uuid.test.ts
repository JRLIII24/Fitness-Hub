import { describe, it, expect } from "vitest";
import { uuid } from "./uuid";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid", () => {
  it("returns a valid v4 UUID string", () => {
    const id = uuid();
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it("generates unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuid()));
    expect(ids.size).toBe(100);
  });

  it("works when crypto.randomUUID is unavailable (fallback path)", () => {
    const original = crypto.randomUUID;
    try {
      // Force fallback by removing randomUUID
      Object.defineProperty(crypto, "randomUUID", { value: undefined, writable: true, configurable: true });
      const id = uuid();
      expect(id).toMatch(UUID_V4_REGEX);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, writable: true, configurable: true });
    }
  });

  it("sets correct version and variant bits in fallback", () => {
    const original = crypto.randomUUID;
    try {
      Object.defineProperty(crypto, "randomUUID", { value: undefined, writable: true, configurable: true });
      for (let i = 0; i < 50; i++) {
        const id = uuid();
        // Version nibble (char at index 14) must be '4'
        expect(id[14]).toBe("4");
        // Variant nibble (char at index 19) must be 8, 9, a, or b
        expect("89ab").toContain(id[19]);
      }
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, writable: true, configurable: true });
    }
  });
});
