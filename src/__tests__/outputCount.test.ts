import { describe, it, expect } from "vitest";
import {
  formatOutputLabel,
  incrementOutputCount,
  outputProgress,
} from "@/lib/outputCount";

describe("outputCount pure helpers", () => {
  it("increments undefined to 1", () => {
    expect(incrementOutputCount(undefined)).toBe(1);
  });

  it("increments 3 to 4", () => {
    expect(incrementOutputCount(3)).toBe(4);
  });

  it("returns null from outputProgress when target is undefined", () => {
    expect(outputProgress(undefined, undefined)).toBeNull();
  });

  it("returns progress object for 2 of 5 張", () => {
    expect(outputProgress(2, { count: 5, unit: "張" })).toEqual({
      done: 2,
      target: 5,
      unit: "張",
      pct: 40,
    });
  });

  it('formats "2/5 張" when target is set', () => {
    expect(formatOutputLabel(2, { count: 5, unit: "張" })).toBe("2/5 張");
  });

  it('returns "" when target is undefined', () => {
    expect(formatOutputLabel(2, undefined)).toBe("");
  });
});
