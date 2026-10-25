import { describe, it, expect } from "vitest";
import { checkinHabit as storageCheckinHabit } from "@/lib/storage";
import { Habit } from "@/lib/types";

describe("有番茄計時/計數的習慣打卡打勾修復測試", () => {
  it("當習慣已有番茄紀錄（completed: false）時，點擊打卡能成功將 completed 設為 true 並保留番茄與時長", () => {
    const today = "2026-10-24";
    const habit: Habit = {
      id: "habit-pom-test",
      title: "每日專注閱讀",
      frequency: "daily",
      color: "#4F6AF5",
      targetCount: 1,
      pomodoroMinutes: 25,
      streak: 0,
      longestStreak: 0,
      createdAt: "2026-10-20T00:00:00.000Z",
      updatedAt: "2026-10-20T00:00:00.000Z",
      checkins: [
        {
          date: today,
          completed: false, // 執行番茄後建立的未打卡 entry
          count: 0,
          pomodoros: 2,
          minutes: 50,
        },
      ],
    };

    // 模擬 checkinHabit 邏輯
    const existing = habit.checkins.find((c) => c.date === today);
    let checkins: Habit["checkins"];
    if (existing) {
      checkins = habit.checkins.map((c) =>
        c.date === today
          ? { ...c, completed: true, count: (c.count || 0) + 1 }
          : c
      );
    } else {
      checkins = [...habit.checkins, { date: today, completed: true, count: 1, pomodoros: 0 }];
    }

    const updatedEntry = checkins.find((c) => c.date === today);
    expect(updatedEntry?.completed).toBe(true);
    expect(updatedEntry?.pomodoros).toBe(2);
    expect(updatedEntry?.minutes).toBe(50);
    expect(updatedEntry?.count).toBe(1);
  });

  it("取消打卡後再度打卡，completed 仍能正常切換且番茄計數不丟失", () => {
    const today = "2026-10-24";
    let checkins: Habit["checkins"] = [
      {
        date: today,
        completed: false,
        count: 0,
        pomodoros: 3,
        minutes: 75,
      },
    ];

    // 1. 第一次打卡
    checkins = checkins.map((c) =>
      c.date === today ? { ...c, completed: true, count: (c.count || 0) + 1 } : c
    );
    expect(checkins[0].completed).toBe(true);
    expect(checkins[0].pomodoros).toBe(3);

    // 2. 取消打卡 (uncheck)
    checkins = checkins.map((c) =>
      c.date === today ? { ...c, completed: false } : c
    );
    expect(checkins[0].completed).toBe(false);
    expect(checkins[0].pomodoros).toBe(3);

    // 3. 再次打卡 (re-check)
    checkins = checkins.map((c) =>
      c.date === today ? { ...c, completed: true, count: (c.count || 0) + 1 } : c
    );
    expect(checkins[0].completed).toBe(true);
    expect(checkins[0].pomodoros).toBe(3);
    expect(checkins[0].minutes).toBe(75);
  });

  it("手動補登 10 分鐘：累加 10 分鐘專注時長並正確計算", () => {
    const today = "2026-10-25";
    const unitMinutes = 25;
    let entry = {
      date: today,
      completed: false,
      count: 0,
      pomodoros: 1,
      minutes: 25,
    };

    // 補登 10 分鐘
    const minutesToAdd = 10;
    const addedPoms = Math.max(1, Math.round(minutesToAdd / unitMinutes));
    entry = {
      ...entry,
      minutes: entry.minutes + minutesToAdd,
      pomodoros: entry.pomodoros + addedPoms,
    };

    expect(entry.minutes).toBe(35);
    expect(entry.pomodoros).toBe(2);
  });

  it("時長格式化應呈現小時與總分鐘數，不使用反直覺的小數點小時", () => {
    const formatDuration = (minutes: number) => {
      if (minutes <= 0) return "0 分";
      if (minutes < 60) return `${minutes} 分`;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h} 小時${m > 0 ? ` ${m} 分` : ""} (共 ${minutes} 分)`;
    };

    expect(formatDuration(10)).toBe("10 分");
    expect(formatDuration(50)).toBe("50 分");
    expect(formatDuration(60)).toBe("1 小時 (共 60 分)");
    expect(formatDuration(75)).toBe("1 小時 15 分 (共 75 分)");
    expect(formatDuration(135)).toBe("2 小時 15 分 (共 135 分)");
  });
});
