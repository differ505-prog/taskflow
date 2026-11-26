import { describe, it, expect } from "vitest";
import { DEFAULT_RHYTHM_SETTINGS, type RhythmSettings, type ThemeDay } from "@/lib/types";
import {
  anchorCopy,
  getActiveAnchor,
  getTodayTheme,
  isOffDutyNow,
  parseHHmm,
  themeCopy,
} from "@/lib/rhythm";

function makeDateAt(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

describe("rhythm pure helpers", () => {
  it('parses "08:00" as 480 minutes', () => {
    expect(parseHHmm("08:00")).toBe(480);
  });

  it('returns null for "24:00"', () => {
    expect(parseHHmm("24:00")).toBeNull();
  });

  it('returns null for "abc"', () => {
    expect(parseHHmm("abc")).toBeNull();
  });

  it("returns wake when time is 07:55 for wakeTime 08:00", () => {
    const now = makeDateAt(2026, 11, 13, 7, 55);
    expect(getActiveAnchor(now, DEFAULT_RHYTHM_SETTINGS)).toBe("wake");
  });

  it("returns wake when time is 08:05 for wakeTime 08:00", () => {
    const now = makeDateAt(2026, 11, 13, 8, 5);
    expect(getActiveAnchor(now, DEFAULT_RHYTHM_SETTINGS)).toBe("wake");
  });

  it("returns null when time is 08:30 for wakeTime 08:00", () => {
    const now = makeDateAt(2026, 11, 13, 8, 30);
    expect(getActiveAnchor(now, DEFAULT_RHYTHM_SETTINGS)).toBeNull();
  });

  it("returns null when enabled.wake is false", () => {
    const now = makeDateAt(2026, 11, 13, 8, 0);
    const settings: RhythmSettings = {
      ...DEFAULT_RHYTHM_SETTINGS,
      enabled: { ...DEFAULT_RHYTHM_SETTINGS.enabled, wake: false },
    };
    expect(getActiveAnchor(now, settings)).toBeNull();
  });

  it("returns true for isOffDutyNow at 17:00", () => {
    const now = makeDateAt(2026, 11, 13, 17, 0);
    expect(isOffDutyNow(now, DEFAULT_RHYTHM_SETTINGS)).toBe(true);
  });

  it("returns false for isOffDutyNow at 22:20", () => {
    const now = makeDateAt(2026, 11, 13, 22, 20);
    expect(isOffDutyNow(now, DEFAULT_RHYTHM_SETTINGS)).toBe(false);
  });

  it("returns false for isOffDutyNow at 16:59", () => {
    const now = makeDateAt(2026, 11, 13, 16, 59);
    expect(isOffDutyNow(now, DEFAULT_RHYTHM_SETTINGS)).toBe(false);
  });

  it("has calm offduty copy without exclamation marks or forbidden words", () => {
    const { title } = anchorCopy("offduty");
    const forbidden = ["!", "！", "過期", "逾期", "未完成", "失敗", "欠", "賴床"];
    for (const token of forbidden) {
      expect(title).not.toContain(token);
    }
  });

  it("matches theme day on Wednesday and returns null on Tuesday for weekdays [1,3,5]", () => {
    const theme: ThemeDay = {
      id: "vibe-coding",
      label: "Vibe Coding",
      emoji: "💻",
      weekdays: [1, 3, 5],
    };
    const settings: RhythmSettings = {
      ...DEFAULT_RHYTHM_SETTINGS,
      themeDays: [theme],
    };
    // 2026-11-11 is Wednesday (day 3), 2026-11-10 is Tuesday (day 2)
    const wed = makeDateAt(2026, 11, 11, 10, 0);
    const tue = makeDateAt(2026, 11, 10, 10, 0);
    expect(getTodayTheme(settings, wed)).toEqual(theme);
    expect(getTodayTheme(settings, tue)).toBeNull();
  });

  it("returns the first matching theme day when multiple match", () => {
    const first: ThemeDay = { id: "first", label: "寫作", emoji: "✍️", weekdays: [3] };
    const second: ThemeDay = { id: "second", label: "設計", emoji: "🎨", weekdays: [3] };
    const settings: RhythmSettings = {
      ...DEFAULT_RHYTHM_SETTINGS,
      themeDays: [first, second],
    };
    const wed = makeDateAt(2026, 11, 11, 10, 0);
    expect(getTodayTheme(settings, wed)).toEqual(first);
  });

  it("includes label in themeCopy", () => {
    const theme: ThemeDay = { id: "vibe", label: "Vibe Coding", emoji: "💻", weekdays: [1] };
    expect(themeCopy(theme).title).toContain("Vibe Coding");
  });
});

describe("rhythm — 第 4 顆自訂紅線與休眠主題日", () => {
  const customSettings: RhythmSettings = {
    ...DEFAULT_RHYTHM_SETTINGS,
    customAnchor: { label: "Highball 停杯紅線", time: "20:00", enabled: true },
  };

  it("customAnchor 啟用且在 ±10 分鐘內 → 回傳 custom", () => {
    const now = makeDateAt(2026, 11, 13, 19, 55);
    expect(getActiveAnchor(now, customSettings)).toBe("custom");
    const now2 = makeDateAt(2026, 11, 13, 20, 5);
    expect(getActiveAnchor(now2, customSettings)).toBe("custom");
  });

  it("customAnchor 關閉 → 不回傳 custom", () => {
    const off: RhythmSettings = {
      ...customSettings,
      customAnchor: { label: "Highball 停杯紅線", time: "20:00", enabled: false },
    };
    const now = makeDateAt(2026, 11, 13, 20, 0);
    expect(getActiveAnchor(now, off)).toBeNull();
  });

  it("anchorCopy(\"custom\") 使用自訂名稱且無禁詞", () => {
    const { title, body } = anchorCopy("custom", customSettings);
    expect(title).toBe("Highball 停杯紅線");
    const forbidden = ["!", "！", "過期", "逾期", "未完成", "失敗", "欠"];
    for (const token of forbidden) {
      expect(title).not.toContain(token);
      expect(body).not.toContain(token);
    }
    // 沒有自訂錨點時回退到預設名稱
    expect(anchorCopy("custom").title).toBe("個人節奏紅線");
  });

  it("getTodayTheme 略過已休眠方案的主題日", () => {
    const theme: ThemeDay = {
      id: "vibe-coding",
      label: "Vibe Coding",
      emoji: "💻",
      weekdays: [3],
      sourcePlan: { id: "plan-3.0", name: "一人公司 3.0" },
    };
    const wed = makeDateAt(2026, 11, 11, 10, 0);

    const awake: RhythmSettings = { ...DEFAULT_RHYTHM_SETTINGS, themeDays: [theme] };
    expect(getTodayTheme(awake, wed)).toEqual(theme);

    const paused: RhythmSettings = {
      ...awake,
      pausedPlans: { "plan-3.0": { pausedAt: "2026-11-01T00:00:00.000Z" } },
    };
    expect(getTodayTheme(paused, wed)).toBeNull();

    // 自動喚醒日當日恢復顯示
    const autoResume: RhythmSettings = {
      ...awake,
      pausedPlans: {
        "plan-3.0": { pausedAt: "2026-11-01T00:00:00.000Z", resumeDate: "2026-11-11" },
      },
    };
    expect(getTodayTheme(autoResume, wed)).toEqual(theme);
  });
});
