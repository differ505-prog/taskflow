import { describe, it, expect } from "vitest";
import { DEFAULT_RHYTHM_SETTINGS, type RhythmSettings } from "@/lib/types";
import {
  buildDaySlots,
  deriveSlotBoundaries,
  findSlotIndex,
  formatSlotRange,
  slotLabelFor,
} from "@/lib/daySlots";

function settingsWith(overrides: Partial<RhythmSettings>): RhythmSettings {
  return { ...DEFAULT_RHYTHM_SETTINGS, ...overrides };
}

describe("daySlots — 由作息錨點推導一天的節奏槽", () => {
  it("預設切 4 槽", () => {
    const slots = buildDaySlots(DEFAULT_RHYTHM_SETTINGS);
    expect(slots).toHaveLength(4);
  });

  it("第一槽從起床時間開始，最後一槽在熄屏時間結束", () => {
    const slots = buildDaySlots(DEFAULT_RHYTHM_SETTINGS);
    expect(slots[0].startMin).toBe(480); // 08:00
    expect(slots[slots.length - 1].endMin).toBe(1335); // 22:15
  });

  it("相鄰槽邊界連續（不重疊不遺漏）", () => {
    const slots = buildDaySlots(DEFAULT_RHYTHM_SETTINGS);
    for (let i = 0; i < slots.length - 1; i++) {
      expect(slots[i].endMin).toBe(slots[i + 1].startMin);
    }
  });

  it("每槽長度皆為正", () => {
    const slots = buildDaySlots(DEFAULT_RHYTHM_SETTINGS);
    for (const slot of slots) {
      expect(slot.endMin).toBeGreaterThan(slot.startMin);
    }
  });

  it("跨午夜設定（起床 23:00 / 熄屏 01:00）回傳 null", () => {
    const boundaries = deriveSlotBoundaries(
      settingsWith({ wakeTime: "23:00", screensOffTime: "01:00" })
    );
    expect(boundaries).toBeNull();
  });

  it("熄屏早於起床（起床 23:30 / 熄屏 22:15）回傳 null", () => {
    const boundaries = deriveSlotBoundaries(
      settingsWith({ wakeTime: "23:30", screensOffTime: "22:15" })
    );
    expect(boundaries).toBeNull();
  });

  it("槽的 label 不得重複", () => {
    const slots = buildDaySlots(DEFAULT_RHYTHM_SETTINGS);
    const labels = slots.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("findSlotIndex：落在槽內回 index，超出範圍回 -1", () => {
    const slots = buildDaySlots(DEFAULT_RHYTHM_SETTINGS);
    expect(findSlotIndex(slots, 480)).toBe(0);
    expect(findSlotIndex(slots, 1335)).toBe(-1);
    expect(findSlotIndex(slots, -1)).toBe(-1);
  });

  it("formatSlotRange 輸出 24 小時制區間", () => {
    expect(
      formatSlotRange({ id: "x", label: "上午", startMin: 480, endMin: 660 })
    ).toBe("08:00 – 11:00");
  });

  it("slotLabelFor 依時刻判斷區段名", () => {
    expect(slotLabelFor(480, 660)).toBe("上午");
    expect(slotLabelFor(780, 960)).toBe("下午");
    expect(slotLabelFor(1140, 1320)).toBe("晚上");
  });

  it("槽數夾在 2 到 6 之間", () => {
    expect(buildDaySlots(DEFAULT_RHYTHM_SETTINGS, 1)).toHaveLength(2);
    expect(buildDaySlots(DEFAULT_RHYTHM_SETTINGS, 99)).toHaveLength(6);
  });
});
