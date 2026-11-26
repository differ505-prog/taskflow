import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { PRIORITY_RANK, type Task } from "@/lib/types";

/** 每日硬排程建議上限（單日非重複任務＋跨日截止日） */
export const DEFAULT_DAILY_HARD_CAP = 3;

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
}

function pickBestDate(
  candidateDates: string[],
  loadMap: Record<string, number>,
  dailyCap: number,
  primaryWindowDays: number
): string {
  const primary = candidateDates.slice(0, primaryWindowDays);
  const secondary = candidateDates.slice(primaryWindowDays);

  const pickLightestUnderCap = (dates: string[]): string | null => {
    let best: string | null = null;
    let bestLoad = Infinity;
    for (const d of dates) {
      const load = loadMap[d] ?? 0;
      if (load < dailyCap && load < bestLoad) {
        best = d;
        bestLoad = load;
      }
    }
    return best;
  };

  // Tier 1: 本週（前 7 天）未滿 dailyCap 且負載最輕（同負載取最早日）
  const tier1 = pickLightestUnderCap(primary);
  if (tier1) return tier1;

  // Tier 2: 次週（第 8–14 天）未滿 dailyCap 且負載最輕
  const tier2 = pickLightestUnderCap(secondary);
  if (tier2) return tier2;

  // Tier 3: 全部已達上限時，取全視窗負載最輕那天（同負載取最早日）
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
  const primaryWindowDays = Math.min(
    options.primaryWindowDays ?? PRIMARY_WINDOW_DAYS,
    lookaheadDays
  );

  const candidateDates = buildDateWindow(todayStr, lookaheadDays);
  const initialLoad = countHardTasksByDate(allTasks, candidateDates);
  const workingLoad: Record<string, number> = { ...initialLoad };

  const sorted = [...overdueTasks].sort((a, b) => {
    const rankDiff = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
    if (rankDiff !== 0) return rankDiff;
    return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  });

  return sorted.map((task) => {
    const targetDate = pickBestDate(candidateDates, workingLoad, dailyCap, primaryWindowDays);
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
