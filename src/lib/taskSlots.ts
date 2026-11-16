import type { DaySlot, Task } from "@/lib/types";

export interface SlotAssignment {
  task: Task;
  slotIndex: number;      // -1 = 無法歸槽（沒有 dueTime，或落在槽範圍外）
  startMin: number;       // 任務起始分鐘（由 dueTime 解析）
  endMin: number | null;  // 任務結束分鐘（durationMinutes 存在才有，否則 null）
}

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_DAY = 1440;

/** 把分鐘數轉回 "HH:mm"（24 小時制、零填充）。 */
function minutesToHHmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 解析 "HH:mm" → 分鐘數；非法回 null。 */
export function parseTaskTime(t: Task): number | null {
  if (!t.dueTime) return null;
  const match = HHMM_RE.exec(t.dueTime.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * 計算任務的結束分鐘：dueTime + durationMinutes。durationMinutes 缺少或 <= 0 → null。
 * （不假造結束時間）
 */
export function taskEndMinutes(t: Task): number | null {
  const start = parseTaskTime(t);
  if (start === null) return null;
  const duration = t.durationMinutes;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return null;
  return start + duration;
}

/**
 * 把任務指派到槽位。回傳 { slotIndex, startMin, endMin }。
 */
export function assignTaskToSlot(
  t: Task,
  slots: DaySlot[]
): { slotIndex: number; startMin: number; endMin: number | null } {
  const startMin = parseTaskTime(t);
  if (startMin === null) {
    return { slotIndex: -1, startMin: -1, endMin: null };
  }
  const endMin = taskEndMinutes(t);
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (startMin >= slot.startMin && startMin < slot.endMin) {
      return { slotIndex: i, startMin, endMin };
    }
  }
  return { slotIndex: -1, startMin, endMin };
}

/**
 * 把一批任務依槽分組。回傳陣列長度 = slots.length，每格是該槽的任務（已排序）。
 */
export function groupTasksBySlot(tasks: Task[], slots: DaySlot[]): SlotAssignment[][] {
  const groups: SlotAssignment[][] = slots.map(() => []);
  for (const task of tasks) {
    const { slotIndex, startMin, endMin } = assignTaskToSlot(task, slots);
    if (slotIndex < 0) continue;
    groups[slotIndex].push({ task, slotIndex, startMin, endMin });
  }
  return groups.map(sortSlotTasks);
}

/**
 * 無法歸槽的任務（沒有 dueTime，或時間落在槽範圍外）。
 */
export function groupUnassignedTasks(tasks: Task[], slots: DaySlot[]): Task[] {
  const out: Task[] = [];
  for (const task of tasks) {
    const { slotIndex } = assignTaskToSlot(task, slots);
    if (slotIndex < 0) out.push(task);
  }
  return out;
}

/**
 * 槽內排序：有 dueTime 的先排（有時間的更明確），同時間依 order 升序，無 dueTime 的最後依 order 升序。
 */
export function sortSlotTasks(list: SlotAssignment[]): SlotAssignment[] {
  return [...list].sort((a, b) => {
    const aTime = parseTaskTime(a.task);
    const bTime = parseTaskTime(b.task);
    if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime;
    if (aTime !== null && bTime === null) return -1;
    if (aTime === null && bTime !== null) return 1;
    return (a.task.order || 0) - (b.task.order || 0);
  });
}

/**
 * 產生任務的時間顯示文字：
 *  - 無 dueTime → ""
 *  - 有 dueTime 無 duration → "09:30"
 *  - 有 dueTime 有 duration → "09:30 – 10:30"
 */
export function formatTaskTimeRange(t: Task): string {
  const startMin = parseTaskTime(t);
  if (startMin === null) return "";
  const endMin = taskEndMinutes(t);
  if (endMin === null) return t.dueTime!;
  // 不跨日顯示（不假造結束時間）
  if (endMin >= MINUTES_PER_DAY) return t.dueTime!;
  return `${t.dueTime} – ${minutesToHHmm(endMin)}`;
}
