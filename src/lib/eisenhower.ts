/**
 * 艾森豪矩陣視覺輔助（純 UI 層，不動 Priority 型別與資料結構）
 *
 * 四象限：
 *   Q1: do-now   🔥 速辦（深紅實心 + 驚嘆號 badge）
 *   Q2: schedule 🗓️ 排程（橘紅實心）
 *   Q3: delegate 🤝 轉交（黃實心）
 *   Q4: none     💤 暫緩（灰線框）
 *
 * 自動偵測規則：priority=schedule 且 dueDate 在 24h 內 → 視覺提升為 Q1（速辦）
 * 顯式標記的 do-now 不受 24h 規則影響。
 */

import { Task, Priority, EisenhowerQuadrant } from "./types";

/** Q1 緊急視窗大小（距離 dueDate 多少小時內算「緊急」） */
export const EISENHOWER_URGENT_HOURS = 24;

export type { EisenhowerQuadrant };

export interface EisenhowerVisual {
  quadrant: EisenhowerQuadrant;
  /** 主色（CSS variable） */
  color: string;
  /** Hex 色（calendar / stats 用） */
  colorHex: string;
  /** Emoji */
  emoji: string;
  /** 是否為「Q1 速辦」狀態（顯示驚嘆號 badge） */
  isUrgent: boolean;
  /** 標籤文字 */
  label: string;
}

const Q1_COLOR = "var(--priority-do-now)";
const Q1_HEX = "#D70015";
const Q1_EMOJI = "🔥";

const Q2_COLOR = "var(--priority-schedule)";
const Q2_HEX = "#F97316";
const Q2_EMOJI = "🗓️";

const Q3_COLOR = "var(--priority-delegate)";
const Q3_HEX = "#EAB308";
const Q3_EMOJI = "🤝";

const Q4_COLOR = "var(--priority-none)";
const Q4_HEX = "#9CA3AF";
const Q4_EMOJI = "💤";

/**
 * 根據任務的 priority + dueDate 派生艾森豪象限視覺
 *
 * @param task 任務
 * @param now 用於判斷 Q1 的「現在」時間點（可注入以便測試）
 */
export function getEisenhowerVisual(
  task: Task | { priority: Priority; dueDate?: string },
  now: Date = new Date(),
): EisenhowerVisual {
  const priority: Priority = task.priority ?? "none";

  // Q1 顯式：do-now（用戶/系統明確標記為「速辦」）
  if (priority === "do-now") {
    return {
      quadrant: "do-now",
      color: Q1_COLOR,
      colorHex: Q1_HEX,
      emoji: Q1_EMOJI,
      isUrgent: true,
      label: "速辦",
    };
  }

  // Q1 自動偵測：schedule 且 dueDate 在未來 24h 內（含已逾期）
  if (priority === "schedule" && task.dueDate) {
    const dueMs = parseDueDateMs(task.dueDate);
    if (dueMs !== null) {
      const diffMs = dueMs - now.getTime();
      if (diffMs <= EISENHOWER_URGENT_HOURS * 3_600_000) {
        return {
          quadrant: "do-now",
          color: Q1_COLOR,
          colorHex: Q1_HEX,
          emoji: Q1_EMOJI,
          isUrgent: true,
          label: "速辦",
        };
      }
    }
  }

  switch (priority) {
    case "schedule":
      return { quadrant: "schedule", color: Q2_COLOR, colorHex: Q2_HEX, emoji: Q2_EMOJI, isUrgent: false, label: "排程" };
    case "delegate":
      return { quadrant: "delegate", color: Q3_COLOR, colorHex: Q3_HEX, emoji: Q3_EMOJI, isUrgent: false, label: "轉交" };
    case "none":
    default:
      return { quadrant: "none", color: Q4_COLOR, colorHex: Q4_HEX, emoji: Q4_EMOJI, isUrgent: false, label: "暫緩" };
  }
}

/**
 * 解析 dueDate 為毫秒數
 * - 支援 ISO date "YYYY-MM-DD" 或完整 ISO datetime
 * - 若有 dueTime 則合併（假設本地時區）
 */
function parseDueDateMs(dueDate: string): number | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const [y, m, d] = dueDate.split("-").map(Number);
    return new Date(y, m - 1, d, 23, 59, 59).getTime();
  }
  const ms = new Date(dueDate).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** 計算距離 dueDate 的剩餘小時數（負數 = 已逾期） */
export function getHoursUntilDue(
  task: { dueDate?: string },
  now: Date = new Date(),
): number | null {
  if (!task.dueDate) return null;
  const ms = parseDueDateMs(task.dueDate);
  if (ms === null) return null;
  return (ms - now.getTime()) / 3_600_000;
}