import { describe, it, expect } from "vitest";
import {
  isMultiDayRange,
  shiftRangeByStartDate,
  getInclusiveDayCount,
  getQuickDatePresets,
} from "@/lib/dateRangeHelpers";

describe("dateRangeHelpers", () => {
  it("recognizes multi-day ranges only when startDate and dueDate differ", () => {
    expect(isMultiDayRange("2026-12-05", "2026-12-06")).toBe(true);
    expect(isMultiDayRange("2026-12-05", "2026-12-05")).toBe(false);
    expect(isMultiDayRange("", "2026-12-05")).toBe(false);
    expect(isMultiDayRange(undefined, "2026-12-05")).toBe(false);
  });

  it("shifts dueDate automatically preserving span length when startDate changes", () => {
    // 2 天 1 夜行程（12/05 ~ 12/06）延後一週
    expect(shiftRangeByStartDate("2026-12-05", "2026-12-06", "2026-12-12")).toEqual({
      startDate: "2026-12-12",
      dueDate: "2026-12-13",
    });

    // 4 天行程提早
    expect(shiftRangeByStartDate("2026-12-10", "2026-12-13", "2026-12-01")).toEqual({
      startDate: "2026-12-01",
      dueDate: "2026-12-04",
    });
  });

  it("computes inclusive day count and quick presets accurately", () => {
    expect(getInclusiveDayCount("2026-12-05", "2026-12-06")).toBe(2);
    expect(getInclusiveDayCount("2026-12-05", "2026-12-05")).toBe(1);

    // 2026-11-27 is Friday -> nextMonday is 2026-11-30
    const presets = getQuickDatePresets("2026-11-27");
    expect(presets).toEqual([
      { label: "今天", date: "2026-11-27" },
      { label: "明天", date: "2026-11-28" },
      { label: "下週一", date: "2026-11-30" },
    ]);
  });
});
