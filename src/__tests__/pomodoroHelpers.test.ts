import { describe, it, expect } from "vitest";
import {
  DEFAULT_POMODORO_MINUTES,
  MAX_POMODORO_MINUTES,
  MIN_POMODORO_MINUTES,
  POMODORO_PRESETS,
  buildTaskFocusUpdate,
  formatFocusDuration,
  formatPomodoroClock,
  getTaskTodayFocusMinutes,
  getTasksViewFocusSummary,
  sanitizePomodoroMinutes,
} from "@/lib/pomodoroHelpers";

describe("pomodoroHelpers 常數", () => {
  it("快捷時長為 5 / 15 / 25 / 45，預設 25，範圍 1..180", () => {
    expect(POMODORO_PRESETS).toEqual([5, 15, 25, 45]);
    expect(DEFAULT_POMODORO_MINUTES).toBe(25);
    expect(MIN_POMODORO_MINUTES).toBe(1);
    expect(MAX_POMODORO_MINUTES).toBe(180);
  });
});

describe("sanitizePomodoroMinutes", () => {
  it("接受範圍內的整數與字串", () => {
    expect(sanitizePomodoroMinutes(25)).toBe(25);
    expect(sanitizePomodoroMinutes(1)).toBe(1);
    expect(sanitizePomodoroMinutes(180)).toBe(180);
    expect(sanitizePomodoroMinutes("45")).toBe(45);
  });

  it("小數輸入四捨五入", () => {
    expect(sanitizePomodoroMinutes(24.4)).toBe(24);
    expect(sanitizePomodoroMinutes(24.5)).toBe(25);
  });

  it("越界與非有限值回傳 null", () => {
    expect(sanitizePomodoroMinutes(0)).toBeNull();
    expect(sanitizePomodoroMinutes(-5)).toBeNull();
    expect(sanitizePomodoroMinutes(181)).toBeNull();
    expect(sanitizePomodoroMinutes(NaN)).toBeNull();
    expect(sanitizePomodoroMinutes(Infinity)).toBeNull();
    expect(sanitizePomodoroMinutes(undefined)).toBeNull();
    expect(sanitizePomodoroMinutes("abc")).toBeNull();
  });
});

describe("formatPomodoroClock", () => {
  it("格式化為 MM:SS", () => {
    expect(formatPomodoroClock(0)).toBe("00:00");
    expect(formatPomodoroClock(5)).toBe("00:05");
    expect(formatPomodoroClock(65)).toBe("01:05");
    expect(formatPomodoroClock(599)).toBe("09:59");
  });

  it("負數視為 0，超過 59 分顯示總分鐘", () => {
    expect(formatPomodoroClock(-10)).toBe("00:00");
    expect(formatPomodoroClock(5400)).toBe("90:00");
    expect(formatPomodoroClock(3600)).toBe("60:00");
  });
});

describe("formatFocusDuration", () => {
  it("依門檻切換單位", () => {
    expect(formatFocusDuration(0)).toBe("0 分");
    expect(formatFocusDuration(-3)).toBe("0 分");
    expect(formatFocusDuration(25)).toBe("25 分");
    expect(formatFocusDuration(59)).toBe("59 分");
    expect(formatFocusDuration(60)).toBe("1 小時");
    expect(formatFocusDuration(120)).toBe("2 小時");
    expect(formatFocusDuration(95)).toBe("1 小時 35 分");
  });
});

describe("getTaskTodayFocusMinutes", () => {
  it("回傳指定日期的累計分鐘，且不小於 0", () => {
    const task = { focusLogByDate: { "2026-11-26": 45, "2026-11-25": 25 } };
    expect(getTaskTodayFocusMinutes(task, "2026-11-26")).toBe(45);
    expect(getTaskTodayFocusMinutes(task, "2026-11-27")).toBe(0);
    expect(getTaskTodayFocusMinutes({}, "2026-11-26")).toBe(0);
  });
});

describe("buildTaskFocusUpdate", () => {
  it("累加總時長與當日日誌，且不變更原物件", () => {
    const task = { focusMinutes: 30, focusLogByDate: { "2026-11-25": 30 } };
    const next = buildTaskFocusUpdate(task, "2026-11-26", 15);

    expect(next.focusMinutes).toBe(45);
    expect(next.focusLogByDate).toEqual({ "2026-11-25": 30, "2026-11-26": 15 });

    // 不可變性
    expect(task.focusMinutes).toBe(30);
    expect(task.focusLogByDate).toEqual({ "2026-11-25": 30 });
  });

  it("addedMinutes <= 0 時不增加任何數值", () => {
    const task = { focusMinutes: 30, focusLogByDate: { "2026-11-25": 30 } };
    const next = buildTaskFocusUpdate(task, "2026-11-26", 0);

    expect(next.focusMinutes).toBe(30);
    expect(next.focusLogByDate).toEqual({ "2026-11-25": 30 });

    const negative = buildTaskFocusUpdate(task, "2026-11-26", -10);
    expect(negative.focusMinutes).toBe(30);
    expect(negative.focusLogByDate).toEqual({ "2026-11-25": 30 });
  });

  it("跨日累加：不同日期各自累積", () => {
    let task: { focusMinutes?: number; focusLogByDate?: Record<string, number> } = {
      focusMinutes: 0,
      focusLogByDate: {},
    };
    task = buildTaskFocusUpdate(task, "2026-11-25", 25);
    task = buildTaskFocusUpdate(task, "2026-11-26", 15);

    expect(task.focusMinutes).toBe(40);
    expect(task.focusLogByDate).toEqual({ "2026-11-25": 25, "2026-11-26": 15 });
  });
});

describe("getTasksViewFocusSummary", () => {
  it("加總今日分鐘與歷史總分鐘", () => {
    const tasks: { focusMinutes: number; focusLogByDate: Record<string, number> }[] = [
      { focusMinutes: 60, focusLogByDate: { "2026-11-26": 30 } },
      { focusMinutes: 25, focusLogByDate: { "2026-11-26": 25 } },
      { focusMinutes: 15, focusLogByDate: { "2026-11-25": 15 } },
    ];

    const summary = getTasksViewFocusSummary(tasks, "2026-11-26");
    expect(summary.todayMinutes).toBe(55);
    expect(summary.totalMinutes).toBe(100);
  });

  it("空陣列回傳 0 / 0", () => {
    expect(getTasksViewFocusSummary([], "2026-11-26")).toEqual({
      todayMinutes: 0,
      totalMinutes: 0,
    });
  });
});
