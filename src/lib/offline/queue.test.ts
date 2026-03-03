import { describe, it, expect } from "vitest";

describe("offline queue module", () => {
  it("exports enqueueMutation and triggerSync functions", async () => {
    const mod = await import("./queue");
    expect(typeof mod.enqueueMutation).toBe("function");
    expect(typeof mod.triggerSync).toBe("function");
  });

  it("module does not throw on import (SSR-safe)", async () => {
    await expect(import("./queue")).resolves.toBeDefined();
  });
});
