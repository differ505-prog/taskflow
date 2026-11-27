import type { Task } from "@/lib/types";

/**
 * 番茄鐘純函式模組
 *
 * 設計紀律：
 *  - 純函式，不依賴 React / DOM，方便單元測試
 *  - 單一計時真相源在 useFlowTimer；這裡只負責「分鐘數 ↔ 字串」與「專注日誌」運算
 */

/** 番茄鐘快捷時長（分鐘） */
export const POMODORO_PRESETS = [5, 15, 25, 45] as const;

/** 預設番茄時長（分鐘） */
export const DEFAULT_POMODORO_MINUTES = 25;

/** 番茄時長下限（分鐘） */
export const MIN_POMODORO_MINUTES = 1;

/** 番茄時長上限（分鐘） */
export const MAX_POMODORO_MINUTES = 180;

/**
 * 清理番茄分鐘數：僅接受可轉為有限數字的輸入，
 * 四捨五入後落在 1..180 回傳整數，否則回傳 null。
 */
export function sanitizePomodoroMinutes(raw: unknown): number | null {
  const num = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  if (rounded < MIN_POMODORO_MINUTES || rounded > MAX_POMODORO_MINUTES) {
    return null;
  }
  return rounded;
}

/**
 * 將秒數格式化為 MM:SS
 * - 負數視為 0
 * - 超過 59 分直接顯示總分鐘（如 90:00）
 */
export function formatPomodoroClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const totalMinutes = Math.floor(safe / 60);
  const restSeconds = safe % 60;
  return `${String(totalMinutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

/**
 * 將分鐘數格式化為人類可讀的專注時長
 * - <= 0 → "0 分"
 * - < 60 → "N 分"
 * - >= 60 且整除 → "N 小時"
 * - 否則 → "N 小時 M 分"
 */
export function formatFocusDuration(minutes: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0));
  if (safe <= 0) return "0 分";
  if (safe < 60) return `${safe} 分`;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (rest === 0) return `${hours} 小時`;
  return `${hours} 小時 ${rest} 分`;
}

/** 取任務在指定日期的累計專注分鐘數（不小於 0） */
export function getTaskTodayFocusMinutes(
  task: { focusLogByDate?: Record<string, number> },
  today: string
): number {
  return Math.max(0, task.focusLogByDate?.[today] ?? 0);
}

/** 彙總一組任務的「今日專注分鐘」與「歷史累計分鐘」 */
export function getTasksViewFocusSummary(
  tasks: { focusMinutes?: number; focusLogByDate?: Record<string, number> }[],
  today: string
): { todayMinutes: number; totalMinutes: number } {
  let todayMinutes = 0;
  let totalMinutes = 0;

  for (const task of tasks) {
    todayMinutes += getTaskTodayFocusMinutes(task, today);
    totalMinutes += Math.max(0, task.focusMinutes ?? 0);
  }

  return { todayMinutes, totalMinutes };
}

/**
 * 產生不可變的新任務專注資料
 * - addedMinutes <= 0 時不增加任何數值
 * - focusMinutes 累計總時長；focusLogByDate 累計當日日誌
 */
export function buildTaskFocusUpdate(
  task: { focusMinutes?: number; focusLogByDate?: Record<string, number> },
  today: string,
  addedMinutes: number
): { focusMinutes: number; focusLogByDate: Record<string, number> } {
  const currentTotal = Math.max(0, task.focusMinutes ?? 0);
  const currentLog = task.focusLogByDate ?? {};

  if (!Number.isFinite(addedMinutes) || addedMinutes <= 0) {
    return {
      focusMinutes: currentTotal,
      focusLogByDate: { ...currentLog },
    };
  }

  const added = Math.round(addedMinutes);
  const todayMinutes = Math.max(0, currentLog[today] ?? 0);

  return {
    focusMinutes: currentTotal + added,
    focusLogByDate: {
      ...currentLog,
      [today]: todayMinutes + added,
    },
  };
}
