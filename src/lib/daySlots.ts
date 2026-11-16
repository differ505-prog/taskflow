import type { DaySlot, RhythmSettings } from "@/lib/types";
import { parseHHmm } from "@/lib/rhythm";

export const DEFAULT_SLOT_COUNT = 4;
export const MIN_SLOT_COUNT = 2;
export const MAX_SLOT_COUNT = 6;

/** 區段名順序詞（用於 label 去重時的 fallback，長度涵蓋 MAX_SLOT_COUNT） */
const ORDERED_SLOT_LABELS = ["上午", "下午", "傍晚", "晚上", "深夜", "清晨"] as const;

const MINUTES_PER_DAY = 1440;

/** 把分鐘數轉回 "HH:mm"（24 小時制、零填充）。 */
function minutesToHHmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 槽的區段名（依起始時刻判斷：<12 上午、<17 下午、其餘 晚上；跨午夜時以 endMin 判斷）。
 */
export function slotLabelFor(startMin: number, endMin: number): string {
  const ref = endMin > startMin ? startMin : endMin;
  if (ref < 12 * 60) return "上午";
  if (ref < 17 * 60) return "下午";
  return "晚上";
}

/**
 * 由作息錨點推導一天分幾段。回傳 null 表示設定不合理（例如跨午夜、槽長不足 1 分鐘）。
 */
export function deriveSlotBoundaries(
  s: RhythmSettings,
  slotCount?: number
): { startMin: number; endMin: number }[] | null {
  const startMin = parseHHmm(s.wakeTime);
  const endMin = parseHHmm(s.screensOffTime);
  if (startMin === null || endMin === null) return null;

  // 跨午夜不做跨日槽（避免複雜度與視覺混亂）
  if (endMin <= startMin) return null;

  const n = Math.min(MAX_SLOT_COUNT, Math.max(MIN_SLOT_COUNT, slotCount ?? DEFAULT_SLOT_COUNT));
  const span = endMin - startMin;
  if (span < n) return null; // 槽長不足 1 分鐘

  const boundaries: { startMin: number; endMin: number }[] = [];
  for (let i = 0; i < n; i++) {
    const from = startMin + Math.round((i * span) / n);
    const to = startMin + Math.round(((i + 1) * span) / n);
    boundaries.push({ startMin: from, endMin: to });
  }
  return boundaries;
}

/**
 * 推導今日槽位清單（帶 label）。設定不合理時回傳空陣列。
 */
export function buildDaySlots(s: RhythmSettings, slotCount?: number): DaySlot[] {
  const boundaries = deriveSlotBoundaries(s, slotCount);
  if (!boundaries || boundaries.length === 0) return [];

  const baseLabels = boundaries.map((b) => slotLabelFor(b.startMin, b.endMin));
  const hasDuplicate = new Set(baseLabels).size !== baseLabels.length;

  return boundaries.map((b, i) => ({
    id: `slot-${i}`,
    label: hasDuplicate ? ORDERED_SLOT_LABELS[i % ORDERED_SLOT_LABELS.length] : baseLabels[i],
    startMin: b.startMin,
    endMin: b.endMin,
  }));
}

/**
 * 某個時刻落在哪一個槽（回傳 index）。超出範圍回 -1。
 */
export function findSlotIndex(slots: DaySlot[], minutesSinceMidnight: number): number {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (minutesSinceMidnight >= slot.startMin && minutesSinceMidnight < slot.endMin) {
      return i;
    }
  }
  return -1;
}

/**
 * 槽的區間標籤，如 "08:00 – 11:00"（用 24 小時制、零填充）。
 */
export function formatSlotRange(slot: DaySlot): string {
  return `${minutesToHHmm(slot.startMin)} – ${minutesToHHmm(slot.endMin)}`;
}

/** 槽的長度（分鐘）。 */
export function slotDurationMinutes(slot: DaySlot): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY, slot.endMin - slot.startMin));
}
