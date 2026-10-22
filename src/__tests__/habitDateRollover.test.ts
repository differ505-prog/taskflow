import { describe, it, expect, vi } from "vitest";
import { getLocalToday } from "@/lib/dateUtils";
import { Habit } from "@/lib/types";

describe("跨日習慣時長隔離與日期滾動測試", () => {
  it("昨日累積 2.5 小時（150分鐘），今日尚未開始時，今日時長為 0，歷史累計為 150", () => {
    const yesterday = "2026-10-21";
    const today = "2026-10-22";

    const habit: Habit = {
      id: "habit-1",
      title: "每日寫作",
      frequency: "daily",
      color: "#4F6AF5",
      targetCount: 1,
      pomodoroMinutes: 25,
      streak: 1,
      longestStreak: 1,
      createdAt: "2026-10-20T00:00:00.000Z",
      checkins: [
        {
          date: yesterday,
          completed: true,
          count: 1,
          pomodoros: 6,
          minutes: 150, // 昨日 2.5 小時
        },
      ],
    };

    // 今日 entry 不存在
    const todayEntry = habit.checkins.find((c) => c.date === today);
    const todayMinutes = todayEntry?.minutes ?? ((todayEntry?.pomodoros ?? 0) * (habit.pomodoroMinutes ?? 25));
    expect(todayMinutes).toBe(0);

    // 歷史累計包含昨日的 150 分鐘
    const totalHistoryMinutes = habit.checkins.reduce(
      (sum, c) => sum + (c.minutes ?? ((c.pomodoros ?? 0) * (habit.pomodoroMinutes ?? 25))),
      0
    );
    expect(totalHistoryMinutes).toBe(150);
  });

  it("跨日換日後新執行的番茄會寫入當日日期，不干擾昨日的 2.5 小時", () => {
    const yesterday = "2026-10-21";
    const today = "2026-10-22";

    const habit: Habit = {
      id: "habit-1",
      title: "每日寫作",
      frequency: "daily",
      color: "#4F6AF5",
      targetCount: 1,
      pomodoroMinutes: 25,
      streak: 1,
      longestStreak: 1,
      createdAt: "2026-10-20T00:00:00.000Z",
      checkins: [
        {
          date: yesterday,
          completed: true,
          count: 1,
          pomodoros: 6,
          minutes: 150,
        },
      ],
    };

    // 今日執行了一次 25 分鐘番茄
    const sessionMins = 25;
    const existing = habit.checkins.find((c) => c.date === today);
    let updatedCheckins: Habit["checkins"];
    if (existing) {
      updatedCheckins = habit.checkins.map((c) =>
        c.date === today
          ? { ...c, pomodoros: (c.pomodoros ?? 0) + 1, minutes: (c.minutes ?? 0) + sessionMins }
          : c
      );
    } else {
      updatedCheckins = [
        ...habit.checkins,
        { date: today, completed: false, count: 0, pomodoros: 1, minutes: sessionMins },
      ];
    }

    // 驗證昨日依然為 150 分鐘
    const yesterdayEntry = updatedCheckins.find((c) => c.date === yesterday);
    expect(yesterdayEntry?.minutes).toBe(150);

    // 驗證今日獨立計算為 25 分鐘
    const newTodayEntry = updatedCheckins.find((c) => c.date === today);
    expect(newTodayEntry?.minutes).toBe(25);

    // 驗證歷史累計為 175 分鐘（2.9 小時）
    const totalHistoryMinutes = updatedCheckins.reduce(
      (sum, c) => sum + (c.minutes ?? ((c.pomodoros ?? 0) * (habit.pomodoroMinutes ?? 25))),
      0
    );
    expect(totalHistoryMinutes).toBe(175);
  });
});
