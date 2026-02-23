import { describe, expect, it } from "vitest";
import { mapStrainToLoadSubscore } from "../mapping";

describe("mapStrainToLoadSubscore", () => {
  it("matches required anchor points", () => {
    expect(mapStrainToLoadSubscore(0.8)).toBe(25);
    expect(mapStrainToLoadSubscore(1.0)).toBe(45);
    expect(mapStrainToLoadSubscore(1.5)).toBe(70);
    expect(mapStrainToLoadSubscore(2.0)).toBe(95);
  });

  it("clamps high values to top band", () => {
    expect(mapStrainToLoadSubscore(2.7)).toBe(95);
  });
});
