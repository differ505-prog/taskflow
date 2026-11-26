import { describe, it, expect } from "vitest";
import type { Recurrence } from "@/lib/types";
import {
  getNthWeekdayOfMonth,
  getNextRecurrenceDate,
} from "@/lib/AppContextInternal/utils";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

describe("getNthWeekdayOfMonth — 每月第 N 個星期 X", () => {
  it("2026-11 第 1 個週六 = 11/07（11/1 是週日）", () => {
    const d = getNthWeekdayOfMonth(2026, 10, 1, 6);
    expect(ymd(d)).toBe("2026-11-07");
  });

  it("2026-11 第 2 個週六 = 11/14", () => {
    const d = getNthWeekdayOfMonth(2026, 10, 2, 6);
    expect(ymd(d)).toBe("2026-11-14");
  });

  it("2026-11 最後一個週六 = 11/28", () => {
    const d = getNthWeekdayOfMonth(2026, 10, -1, 6);
    expect(ymd(d)).toBe("2026-11-28");
  });

  it("2026-12 最後一個週日 = 12/27", () => {
    const d = getNthWeekdayOfMonth(2026, 11, -1, 0);
    expect(ymd(d)).toBe("2026-12-27");
  });

  it("該月沒有第 5 個星期時退回前一個月的同一天（2026-11 第 5 個週六不存在 → 退 7 天）", () => {
    // 2026-11 只有 4 個週六（7/14/21/28），第 5 個會溢位到 12/05，退 7 天 → 11/28
    const d = getNthWeekdayOfMonth(2026, 10, 5 as unknown as 1, 6);
    expect(ymd(d)).toBe("2026-11-28");
  });

  it("2027-02 最後一個週日 = 02/28（2027 非閏年）", () => {
    const d = getNthWeekdayOfMonth(2027, 1, -1, 0);
    expect(ymd(d)).toBe("2027-02-28");
  });
});

describe("getNextRecurrenceDate — 每月第 N 個星期 X", () => {
  const nthSaturday: Recurrence = {
    pattern: "monthly",
    interval: 1,
    weekOfMonth: 1,
    weekday: 6,
    completedCount: 0,
  };

  const lastSaturday: Recurrence = {
    pattern: "monthly",
    interval: 1,
    weekOfMonth: -1,
    weekday: 6,
    completedCount: 0,
  };

  it("每月第 1 個週六：從 2026-11-07 → 2026-12-05", () => {
    const r = getNextRecurrenceDate("2026-11-07", nthSaturday);
    expect(r.dueDate).toBe("2026-12-05");
  });

  it("每月最後一個週六：從 2026-11-28 → 2026-12-26", () => {
    const r = getNextRecurrenceDate("2026-11-28", lastSaturday);
    expect(r.dueDate).toBe("2026-12-26");
  });

  it("每月第 1 個週日：從 2026-11-01 → 2026-12-06", () => {
    const r = getNextRecurrenceDate("2026-11-01", {
      pattern: "monthly",
      interval: 1,
      weekOfMonth: 1,
      weekday: 0,
      completedCount: 0,
    });
    expect(r.dueDate).toBe("2026-12-06");
  });

  it("interval = 2 每月第 1 個週六：從 2026-11-07 → 2027-01-02", () => {
    const r = getNextRecurrenceDate("2026-11-07", { ...nthSaturday, interval: 2 });
    expect(r.dueDate).toBe("2027-01-02");
  });

  it("dayOfMonth 舊資料仍走原本的每月幾號邏輯", () => {
    const r = getNextRecurrenceDate("2026-11-15", {
      pattern: "monthly",
      interval: 1,
      dayOfMonth: 15,
      completedCount: 0,
    });
    expect(r.dueDate).toBe("2026-12-15");
  });

  it("每月 31 號遇到短月份自動 clamp 到月底", () => {
    const r = getNextRecurrenceDate("2026-01-31", {
      pattern: "monthly",
      interval: 1,
      dayOfMonth: 31,
      completedCount: 0,
    });
    expect(r.dueDate).toBe("2026-02-28");
  });

  it("未指定 dayOfMonth / weekOfMonth 時沿用當前日期並 clamp", () => {
    const r = getNextRecurrenceDate("2026-01-31", {
      pattern: "monthly",
      interval: 1,
      completedCount: 0,
    });
    expect(r.dueDate).toBe("2026-02-28");
  });
});
