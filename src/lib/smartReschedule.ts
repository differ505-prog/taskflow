import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { PRIORITY_RANK, type Task } from "@/lib/types";

/** 每日硬排程建議上限（單日非重複任務＋跨日截止日） */
export const DEFAULT_DAILY_HARD_CAP = 3;

/** 每日上限可選值（2 / 3 / 4） */
export const DAILY_CAP_OPTIONS = [2, 3, 4] as const;

/** 每日上限的 localStorage key（與 LostAndFound / InboxSmartPicker 共用 SSOT） */
export const DAILY_CAP_STORAGE_KEY = "lost_found_daily_cap";

/** 每日上限變更的自訂事件（跨元件即時同步） */
export const DAILY_CAP_CHANGE_EVENT = "vibelist:daily-cap-change";

/** 優先排入本週（7 天），滿載時自動延展至 14 天 */
export const PRIMARY_WINDOW_DAYS = 7;
export const DEFAULT_LOOKAHEAD_DAYS = 14;

/**
 * 判斷任務在指定日期是否屬於「彈性／低視覺權重」任務：
 * - 重複任務（recurrence）：可暫時跳過
 * - 模板方案（sourcePlan）的跨日區間任務（startDate !== dueDate）：全區間皆歸為方案背景，不搶佔手動行程的實心藍計數
 * - 使用者手動建立的跨日任務（無 sourcePlan，例如出遊／出差）：每一天都視為硬排程，絕不隱藏
 */
export function isFlexibleOnDate(task: Task, _dateStr: string): boolean {
  if (task.recurrence) return true;
  if (task.sourcePlan && task.startDate && task.dueDate && task.startDate !== task.dueDate) {
    return true;
  }
  return false;
}

/**
 * 判斷任務是否為「使用者親自建立的跨日任務」（無 sourcePlan、非重複、startDate !== dueDate）
 */
export function isManualMultiDayTask(task: Task): boolean {
  return (
    !task.sourcePlan &&
    !task.recurrence &&
    Boolean(task.startDate && task.dueDate && task.startDate !== task.dueDate)
  );
}

/**
 * 將某天的未完成任務依 UI/UX 層級分成兩段並排序（方案 1）：
 * - hard: 手動跨日永遠最前 → 置頂 → 手動單日 → 方案單日（同組依優先級與具體時間）
 * - flexible: 重複任務 ＋ 模板跨日任務（依優先級與具體時間）
 */
export function partitionAndSortDayTasks(
  todoTasks: Task[],
  dateStr: string
): { hard: Task[]; flexible: Task[] } {
  const hard: Task[] = [];
  const flexible: Task[] = [];

  for (const task of todoTasks) {
    if (isFlexibleOnDate(task, dateStr)) {
      flexible.push(task);
    } else {
      hard.push(task);
    }
  }

  const getHardTier = (t: Task): number => {
    if (isManualMultiDayTask(t)) return 0;
    if (t.isPinned) return 1;
    if (!t.sourcePlan) return 2;
    return 3;
  };

  const compareTieBreak = (a: Task, b: Task): number => {
    const pDiff = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
    if (pDiff !== 0) return pDiff;
    return (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99");
  };

  hard.sort((a, b) => {
    const tierDiff = getHardTier(a) - getHardTier(b);
    if (tierDiff !== 0) return tierDiff;
    return compareTieBreak(a, b);
  });

  flexible.sort(compareTieBreak);

  return { hard, flexible };
}

/** 判斷任務是否落在指定日期（與 useMonthGrid 規則一致） */
export function taskOccursOnDate(task: Task, dateStr: string): boolean {
  if (task.isArchived) return false;
  const start = task.startDate;
  const end = task.dueDate;
  if (start && end) return dateStr >= start && dateStr <= end;
  if (!start && end) return dateStr === end;
  if (start && !end) return dateStr === start;
  return false;
}

/** 產生從 todayStr 起的連續 N 天 YYYY-MM-DD 陣列 */
export function buildDateWindow(todayStr: string, daysCount: number): string[] {
  const base = parseISO(todayStr);
  return Array.from({ length: daysCount }, (_, i) =>
    format(addDays(base, i), "yyyy-MM-dd")
  );
}

/** 計算指定日期視窗內，每天的「未完成硬排程」數量（不含重複與跨日中間日） */
export function countHardTasksByDate(
  tasks: Task[],
  candidateDates: string[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of candidateDates) {
    counts[d] = 0;
  }

  for (const task of tasks) {
    if (task.isArchived || task.status === "done" || task.parentId) continue;
    for (const dateStr of candidateDates) {
      if (taskOccursOnDate(task, dateStr) && !isFlexibleOnDate(task, dateStr)) {
        counts[dateStr] += 1;
      }
    }
  }

  return counts;
}

export interface SmartRescheduleAssignment {
  task: Task;
  /** 建議排入的新截止日（YYYY-MM-DD） */
  targetDate: string;
  /** 若原任務有 startDate，保留原區間長度推算出的新 startDate */
  newStartDate?: string;
  /** 排入前，該日期原本的硬排程數（給預覽 UI 顯示「原 N 件」） */
  existingLoadBefore: number;
  /** 排入這筆後，該日期預估的硬排程數 */
  projectedLoadAfter: number;
}

export interface SmartRescheduleOptions {
  dailyCap?: number;
  lookaheadDays?: number;
  primaryWindowDays?: number;
  /** 使用者手動點選的優先順序 ID 陣列（Tap-to-Rank）：排在陣列越前面越優先取得最早空檔 */
  customOrderIds?: string[];
}

function pickBestDate(
  candidateDates: string[],
  loadMap: Record<string, number>,
  dailyCap: number
): string {
  // Tier 1: 近端優先填滿 — 由今天起依序找第一個未達每日硬排程上限的日子
  for (const d of candidateDates) {
    if ((loadMap[d] ?? 0) < dailyCap) {
      return d;
    }
  }

  // Tier 2: 視窗內全部已達上限時，取負載最輕那天（同負載取最早日）
  let fallback = candidateDates[0];
  let minLoad = loadMap[fallback] ?? 0;
  for (const d of candidateDates) {
    const load = loadMap[d] ?? 0;
    if (load < minLoad) {
      fallback = d;
      minLoad = load;
    }
  }
  return fallback;
}

function computeNewStartDate(task: Task, targetDate: string): string | undefined {
  if (!task.startDate) return undefined;
  if (!task.dueDate || task.startDate === task.dueDate) return targetDate;
  const spanDays = Math.max(
    0,
    differenceInCalendarDays(parseISO(task.dueDate), parseISO(task.startDate))
  );
  return format(addDays(parseISO(targetDate), -spanDays), "yyyy-MM-dd");
}

/**
 * 智慧負載平衡排程：
 * 1. 依優先級（do-now → schedule → delegate → none）與原到期日排序，重要任務優先拿最早空檔
 * 2. 衡量未來每日「硬排程」負載，自動攤平到最空日，避免全塞進今天造成過載
 */
export function computeSmartReschedulePlan(
  overdueTasks: Task[],
  allTasks: Task[],
  todayStr: string,
  options: SmartRescheduleOptions = {}
): SmartRescheduleAssignment[] {
  if (overdueTasks.length === 0) return [];

  const dailyCap = options.dailyCap ?? DEFAULT_DAILY_HARD_CAP;
  const lookaheadDays = options.lookaheadDays ?? DEFAULT_LOOKAHEAD_DAYS;

  const candidateDates = buildDateWindow(todayStr, lookaheadDays);
  const initialLoad = countHardTasksByDate(allTasks, candidateDates);
  const workingLoad: Record<string, number> = { ...initialLoad };

  const customRankMap = new Map<string, number>();
  if (options.customOrderIds) {
    options.customOrderIds.forEach((id, index) => {
      if (!customRankMap.has(id)) customRankMap.set(id, index);
    });
  }

  const sorted = [...overdueTasks].sort((a, b) => {
    const rankA = customRankMap.get(a.id);
    const rankB = customRankMap.get(b.id);
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;

    const rankDiff = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
    if (rankDiff !== 0) return rankDiff;
    return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  });

  return sorted.map((task) => {
    const targetDate = pickBestDate(candidateDates, workingLoad, dailyCap);
    const existingLoadBefore = initialLoad[targetDate] ?? 0;
    const incrementsHardLoad = !task.recurrence;
    if (incrementsHardLoad) {
      workingLoad[targetDate] = (workingLoad[targetDate] ?? 0) + 1;
    }
    return {
      task,
      targetDate,
      newStartDate: computeNewStartDate(task, targetDate),
      existingLoadBefore,
      projectedLoadAfter: workingLoad[targetDate] ?? existingLoadBefore,
    };
  });
}

/** 為單筆過期任務挑出最佳落點日 */
export function suggestBestDateForTask(
  task: Task,
  allTasks: Task[],
  todayStr: string,
  options: SmartRescheduleOptions = {}
): SmartRescheduleAssignment {
  return computeSmartReschedulePlan([task], allTasks, todayStr, options)[0];
}

/** 讀取儲存的每日上限；若無效或 SSR 環境則回退到預設值 */
export function readSavedDailyCap(): number {
  if (typeof window === "undefined") return DEFAULT_DAILY_HARD_CAP;
  try {
    const saved = Number(localStorage.getItem(DAILY_CAP_STORAGE_KEY));
    if (DAILY_CAP_OPTIONS.includes(saved as (typeof DAILY_CAP_OPTIONS)[number])) {
      return saved;
    }
    return DEFAULT_DAILY_HARD_CAP;
  } catch {
    return DEFAULT_DAILY_HARD_CAP;
  }
}

/** 儲存每日上限並廣播變更事件（供其他元件即時同步） */
export function saveDailyCap(cap: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DAILY_CAP_STORAGE_KEY, String(cap));
    window.dispatchEvent(new Event(DAILY_CAP_CHANGE_EVENT));
  } catch {
    // ignore storage errors
  }
}

/** 短日期標籤：今天顯示「今天」，其餘顯示「M/d (EEEEE)」 */
export function formatShortDateLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return "今天";
  return format(parseISO(dateStr), "M/d (EEEEE)", { locale: zhTW });
}

/** 判斷任務是否為「尚未排期」的收集箱任務（無 dueDate / startDate） */
export function isUnscheduledTask(task: Task): boolean {
  return (
    !task.isArchived &&
    task.status !== "done" &&
    !task.parentId &&
    !task.dueDate &&
    !task.startDate
  );
}

/**
 * 產生任務列的「靜態輕量日期標籤」：
 * - 無任何日期 → null（不貼「無日期」警示貼紙，靠空間分區辨識）
 * - 跨日區間 → 「起 – 迄」
 * - 單日 → 「M/d (EEEEE)」或「M/d (EEEEE) HH:mm」（含 dueTime）
 */
export function formatTaskScheduleChip(
  task: Pick<Task, "startDate" | "dueDate" | "dueTime">,
  todayStr: string
): string | null {
  if (!task.startDate && !task.dueDate) return null;

  if (task.startDate && task.dueDate && task.startDate !== task.dueDate) {
    return `${formatShortDateLabel(task.startDate, todayStr)} – ${formatShortDateLabel(task.dueDate, todayStr)}`;
  }

  const d = task.dueDate ?? task.startDate!;
  if (task.dueTime) {
    return `${formatShortDateLabel(d, todayStr)} ${task.dueTime}`;
  }
  return formatShortDateLabel(d, todayStr);
}

/**
 * 個人收集箱雙區分組：未排期 / 已排好日期
 * 守恆性：unscheduled.length + scheduled.length === activeTasks.length（零遺漏、零重複）
 */
export function partitionInboxActiveTasks(activeTasks: Task[]): {
  unscheduled: Task[];
  scheduled: Task[];
} {
  const unscheduled: Task[] = [];
  const scheduled: Task[] = [];

  for (const t of activeTasks) {
    if (isUnscheduledTask(t)) {
      unscheduled.push(t);
    } else {
      scheduled.push(t);
    }
  }

  return { unscheduled, scheduled };
}

/**
 * 選取式智慧排程：只為使用者親手點選的任務排程，並嚴格依點選順序填滿每日上限。
 * 全不選（selectedIds 為空）時回傳空陣列 —— 零自動排程。
 */
export function computeSelectedSmartSchedulePlan(
  selectedIds: string[],
  candidateTasks: Task[],
  allTasks: Task[],
  todayStr: string,
  options: Omit<SmartRescheduleOptions, "customOrderIds"> = {}
): SmartRescheduleAssignment[] {
  if (selectedIds.length === 0) return [];

  const selectedSet = new Set(selectedIds);
  const picked = candidateTasks.filter((t) => selectedSet.has(t.id) && isUnscheduledTask(t));
  if (picked.length === 0) return [];

  return computeSmartReschedulePlan(picked, allTasks, todayStr, {
    ...options,
    customOrderIds: selectedIds,
  });
}
