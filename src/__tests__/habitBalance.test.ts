import { describe, it, expect } from "vitest";
import { Habit, HabitCheckin } from "@/lib/types";
import {
  computeHabitBalance,
  daysInclusive,
  formatBalanceChip,
  getCheckinMinutes,
  getHeatmapFill,
  getTargetStartDate,
} from "@/lib/habitBalance";

const COLOR = "#4F6AF5";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-balance-test",
    title: "每日專注閱讀",
    frequency: "daily",
    color: COLOR,
    targetCount: 1,
    pomodoroMinutes: 25,
    streak: 0,
    longestStreak: 0,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
    checkins: [],
    ...overrides,
  };
}

function checkin(date: string, minutes: number, extra: Partial<HabitCheckin> = {}): HabitCheckin {
  return { date, completed: true, count: 1, minutes, ...extra };
}

describe("habitBalance — 累積目標池計算", () => {
  it("未設定 dailyTarget 時 computeHabitBalance 回 null", () => {
    const habit = makeHabit();
    expect(computeHabitBalance(habit, "2026-10-26")).toBeNull();
  });

  it("dailyTarget.minutes = 0 時視為未啟用，回 null", () => {
    const habit = makeHabit({ dailyTarget: { minutes: 0, minutesSetAt: "2026-10-26" } });
    expect(computeHabitBalance(habit, "2026-10-26")).toBeNull();
  });

  it("起算日 = 今天、目標 30 分、當天投入 0 → 結餘 -30、天數 1", () => {
    const habit = makeHabit({ dailyTarget: { minutes: 30, minutesSetAt: "2026-10-26" } });
    const b = computeHabitBalance(habit, "2026-10-26");
    expect(b).not.toBeNull();
    expect(b!.days).toBe(1);
    expect(b!.target).toBe(30);
    expect(b!.invested).toBe(0);
    expect(b!.balance).toBe(-30);
  });

  it("出遊日缺口可由後續天數補回：3 天 [60, 10, 50] 分、目標 30 分/天 → 結餘 0", () => {
    const habit = makeHabit({
      dailyTarget: { minutes: 30, minutesSetAt: "2026-10-22" },
      checkins: [
        checkin("2026-10-22", 60),
        checkin("2026-10-23", 10),
        checkin("2026-10-24", 50),
      ],
    });
    const b = computeHabitBalance(habit, "2026-10-24");
    expect(b!.days).toBe(3);
    expect(b!.invested).toBe(120);
    expect(b!.target).toBe(90);
    expect(b!.balance).toBe(30);
  });

  it("累積投入仍不足時結餘為負：3 天 [60, 10, 10] 分、目標 30 分/天 → 結餘 -10", () => {
    const habit = makeHabit({
      dailyTarget: { minutes: 30, minutesSetAt: "2026-10-22" },
      checkins: [
        checkin("2026-10-22", 60),
        checkin("2026-10-23", 10),
        checkin("2026-10-24", 10),
      ],
    });
    const b = computeHabitBalance(habit, "2026-10-24");
    expect(b!.invested).toBe(80);
    expect(b!.target).toBe(90);
    expect(b!.balance).toBe(-10);
  });

  it("起算日之前的 checkin 不計入 invested（累計起算日回歸測試）", () => {
    const habit = makeHabit({
      dailyTarget: { minutes: 30, minutesSetAt: "2026-10-24" },
      checkins: [
        checkin("2026-10-20", 300),
        checkin("2026-10-24", 30),
      ],
    });
    const b = computeHabitBalance(habit, "2026-10-24");
    expect(b!.invested).toBe(30);
    expect(b!.target).toBe(30);
    expect(b!.balance).toBe(0);
  });

  it("只有 pomodoros 沒有 minutes 時以 番茄數 × 單位時長 計入", () => {
    const habit = makeHabit({
      pomodoroMinutes: 25,
      dailyTarget: { minutes: 30, minutesSetAt: "2026-10-24" },
      checkins: [{ date: "2026-10-24", completed: true, count: 1, pomodoros: 2 }],
    });
    const b = computeHabitBalance(habit, "2026-10-24");
    expect(b!.invested).toBe(50);
    expect(b!.balance).toBe(20);
  });

  it("跨月天數計算正確（2026-01-30 → 2026-02-02 = 4 天）", () => {
    expect(daysInclusive("2026-01-30", "2026-02-02")).toBe(4);
  });

  it("today 早於 minutesSetAt（未來日）→ 結餘 0 且不拋錯", () => {
    const habit = makeHabit({ dailyTarget: { minutes: 30, minutesSetAt: "2026-11-01" } });
    const b = computeHabitBalance(habit, "2026-10-26");
    expect(b).not.toBeNull();
    expect(b!.balance).toBe(0);
    expect(b!.days).toBe(0);
  });

  it("formatBalanceChip 產出中性語氣文案", () => {
    expect(formatBalanceChip(0)).toBe("結餘 +0 分");
    expect(formatBalanceChip(-20)).toBe("還差 20 分");
    expect(formatBalanceChip(65)).toBe("結餘 +65 分");
  });

  it("getHeatmapFill 依投入/目標比例回傳五種色階", () => {
    const habit = makeHabit({
      dailyTarget: { minutes: 30, minutesSetAt: "2026-10-20" },
      checkins: [
        checkin("2026-10-20", 0),
        checkin("2026-10-21", 15),
        checkin("2026-10-22", 45),
        checkin("2026-10-23", 75),
        checkin("2026-10-24", 105),
      ],
    });
    expect(getHeatmapFill(habit, "2026-10-20")).toBe("var(--surface-hover)");
    expect(getHeatmapFill(habit, "2026-10-21")).toBe(COLOR + "40");
    expect(getHeatmapFill(habit, "2026-10-22")).toBe(COLOR + "88");
    expect(getHeatmapFill(habit, "2026-10-23")).toBe(COLOR + "CC");
    expect(getHeatmapFill(habit, "2026-10-24")).toBe(COLOR);
  });

  it("getCheckinMinutes 無 minutes 時退回番茄數 × 單位時長", () => {
    expect(getCheckinMinutes(undefined, 25)).toBe(0);
    expect(getCheckinMinutes({ date: "2026-10-24", completed: true, count: 1, pomodoros: 3 }, 25)).toBe(75);
    expect(getCheckinMinutes({ date: "2026-10-24", completed: true, count: 1, pomodoros: 3, minutes: 60 }, 25)).toBe(60);
  });

  it("getTargetStartDate 優先取 minutesSetAt，否則取建立日本地日期", () => {
    const withSet = makeHabit({ dailyTarget: { minutes: 30, minutesSetAt: "2026-10-24" } });
    expect(getTargetStartDate(withSet)).toBe("2026-10-24");
    const without = makeHabit();
    expect(getTargetStartDate(without)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("未啟用目標時 getHeatmapFill 回 null（交由呼叫端走舊邏輯）", () => {
    expect(getHeatmapFill(makeHabit(), "2026-10-24")).toBeNull();
  });
});
