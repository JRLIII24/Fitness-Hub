import { describe, it, expect } from "vitest";

/**
 * Unit tests for the useNetworkStatus hook's core invariants.
 * Tests SSR safety without needing @testing-library/react.
 */
describe("useNetworkStatus module", () => {
  it("exports useNetworkStatus as a function", async () => {
    const mod = await import("./use-network-status");
    expect(typeof mod.useNetworkStatus).toBe("function");
  });

  it("module does not throw on import (SSR-safe — no browser API access at module level)", async () => {
    await expect(import("./use-network-status")).resolves.toBeDefined();
  });
});
