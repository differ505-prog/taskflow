import { describe, it, expect } from "vitest";
import { computeMvdProgress } from "@/lib/mvd";

describe("computeMvdProgress", () => {
  it("returns zeros and reached=false when total is 0", () => {
    expect(computeMvdProgress(0, 0)).toEqual({
      total: 0,
      done: 0,
      pct: 0,
      reached: false,
    });
  });

  it("returns pct=20 and reached=true for 2 of 10", () => {
    const result = computeMvdProgress(10, 2);
    expect(result.pct).toBe(20);
    expect(result.reached).toBe(true);
  });

  it("returns pct=10 and reached=false for 1 of 10", () => {
    const result = computeMvdProgress(10, 1);
    expect(result.pct).toBe(10);
    expect(result.reached).toBe(false);
  });

  it("computes pct close to 33.33 for 1 of 3", () => {
    const result = computeMvdProgress(3, 1);
    expect(result.pct).toBeCloseTo(33.33, 2);
  });
});
