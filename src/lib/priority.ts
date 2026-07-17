/**
 * Priority 工具模組
 *
 * 提供：
 * 1. PRIORITY_RANK — 用於排序／過濾（urgent 永遠最前）
 * 2. migrateUrgentOnRead — 讀取時 lazy 遷移老資料
 *    老資料條件：priority="high" 且 dueDate 在 24h 內
 *    → 自動回寫 priority="urgent"
 *    → 同時 update tasks[id] 寫回 store
 */

import type { Priority, Task } from "./types";
import { EISENHOWER_URGENT_HOURS } from "./eisenhower";

/** 排序權重：urgent > high > medium > low */
export const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function comparePriority(a: Priority, b: Priority): number {
  return PRIORITY_RANK[a] - PRIORITY_RANK[b];
}

/**
 * Lazy migration：判斷是否需要把 priority="high" 升級為 "urgent"
 *
 * 規則（與艾森豪 Q1 自動偵測邏輯一致）：
 *   - priority="high"
 *   - 有 dueDate
 *   - 距離 dueDate ≤ 24h（含已逾期）
 */
export function shouldMigrateToUrgent(
  task: Pick<Task, "priority" | "dueDate" | "status">,
  now: Date = new Date(),
): boolean {
  if (task.priority !== "high") return false;
  if (!task.dueDate) return false;
  if (task.status === "done") return false; // 已完成不升，避免視覺閃動

  // 解析 dueDate — 與 eisenhower.ts 同邏輯
  let dueMs: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
    const [y, m, d] = task.dueDate.split("-").map(Number);
    dueMs = new Date(y, m - 1, d, 23, 59, 59).getTime();
  } else {
    dueMs = new Date(task.dueDate).getTime();
    if (Number.isNaN(dueMs)) return false;
  }

  const diffMs = dueMs - now.getTime();
  return diffMs <= EISENHOWER_URGENT_HOURS * 3_600_000;
}
