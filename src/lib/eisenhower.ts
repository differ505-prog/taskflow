/**
 * 艾森豪矩陣視覺輔助（純 UI 層，不動 Priority 型別與資料結構）
 *
 * 四象限：
 *   Q1: 高 + 緊急（深紅實心旗 + 驚嘆號 badge）  → 自動偵測：priority=high && dueDate 在 24h 內
 *   Q2: 高        （紅旗實心）                  → priority=high
 *   Q3: 中        （黃旗實心）                  → priority=medium
 *   Q4: 低        （灰旗線框）                  → priority=low
 */

import { Task, Priority, EisenhowerQuadrant } from "./types";

/** Q1 緊急視窗大小（距離 dueDate 多少小時內算「緊急」） */
export const EISENHOWER_URGENT_HOURS = 24;

export type { EisenhowerQuadrant };

export interface EisenhowerVisual {
  quadrant: EisenhowerQuadrant;
  /** CSS 變數或 hex 顏色，用於旗子、卡片左條等 */
  color: string;
  /** 是否為「Q1 緊急」狀態（顯示驚嘆號 badge） */
  isUrgent: boolean;
  /** 標籤文字 */
  label: string;
}

const Q1_COLOR = "#D70015"; // 深紅（urgent）
const Q2_COLOR = "var(--priority-high)"; // 紅
const Q3_COLOR = "var(--priority-medium)"; // 黃
const Q4_COLOR = "var(--priority-low)"; // 綠/低

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
  const priority = task.priority;

  // Q1 強制路徑：priority = "urgent"（用戶/系統顯式標記為第一象限，不受 24h 限制）
  if (priority === "urgent") {
    return {
      quadrant: "urgent",
      color: Q1_COLOR,
      isUrgent: true,
      label: "緊急",
    };
  }

  // Q1 自動偵測：high 且 dueDate 在未來 24h 內（含已逾期）— 自動偵測到的 Q1 在顯示層昇為 urgent
  if (priority === "high" && task.dueDate) {
    const dueMs = parseDueDateMs(task.dueDate);
    if (dueMs !== null) {
      const diffMs = dueMs - now.getTime();
      // 24h 內（含已逾期）：diffMs <= EISENHOWER_URGENT_HOURS * 3600 * 1000
      if (diffMs <= EISENHOWER_URGENT_HOURS * 3_600_000) {
        return {
          quadrant: "urgent",
          color: Q1_COLOR,
          isUrgent: true,
          label: "緊急",
        };
      }
    }
  }

  switch (priority) {
    case "high":
      return { quadrant: "high", color: Q2_COLOR, isUrgent: false, label: "高" };
    case "medium":
      return { quadrant: "medium", color: Q3_COLOR, isUrgent: false, label: "中" };
    case "low":
      return { quadrant: "low", color: Q4_COLOR, isUrgent: false, label: "低" };
  }
}

/**
 * 解析 dueDate 為毫秒數
 * - 支援 ISO date "YYYY-MM-DD" 或完整 ISO datetime
 * - 若有 dueTime 則合併（假設本地時區）
 */
function parseDueDateMs(dueDate: string): number | null {
  // 純日期 YYYY-MM-DD：視為當天 23:59:59
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const [y, m, d] = dueDate.split("-").map(Number);
    return new Date(y, m - 1, d, 23, 59, 59).getTime();
  }
  // 完整 ISO datetime
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
