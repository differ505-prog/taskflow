import { addDays, differenceInCalendarDays, format, nextMonday, parseISO } from "date-fns";
import { getLocalToday } from "@/lib/dateUtils";

/** 判斷是否為真正的跨日區間（startDate 與 dueDate 皆存在且不相等） */
export function isMultiDayRange(startDate?: string, dueDate?: string): boolean {
  return Boolean(startDate && dueDate && startDate !== dueDate);
}

/**
 * 調整跨日區間的開始日期時，保留原本區間天數並同步平移截止日期。
 * 例：12/05 ~ 12/06（1 天間隔）把開始日改為 12/12 → 截止日自動順移到 12/13。
 */
export function shiftRangeByStartDate(
  prevStart: string,
  prevDue: string,
  newStart: string
): { startDate: string; dueDate: string } {
  if (!newStart) {
    return { startDate: "", dueDate: prevDue };
  }
  if (prevStart && prevDue && prevDue >= prevStart) {
    const spanDays = Math.max(
      0,
      differenceInCalendarDays(parseISO(prevDue), parseISO(prevStart))
    );
    const shiftedDue = format(addDays(parseISO(newStart), spanDays), "yyyy-MM-dd");
    return { startDate: newStart, dueDate: shiftedDue };
  }
  if (prevDue && newStart > prevDue) {
    return { startDate: newStart, dueDate: newStart };
  }
  return { startDate: newStart, dueDate: prevDue || newStart };
}

/** 計算兩個 ISO 日期的包含天數（單日回 1，跨 1 夜回 2） */
export function getInclusiveDayCount(startDate?: string, dueDate?: string): number {
  if (!startDate || !dueDate || dueDate < startDate) return 1;
  return differenceInCalendarDays(parseISO(dueDate), parseISO(startDate)) + 1;
}

export interface QuickDatePreset {
  label: string;
  date: string;
}

/** 產生單日快捷日期按鈕（今天 / 明天 / 下週一） */
export function getQuickDatePresets(todayStr: string = getLocalToday()): QuickDatePreset[] {
  const today = parseISO(todayStr);
  return [
    { label: "今天", date: todayStr },
    { label: "明天", date: format(addDays(today, 1), "yyyy-MM-dd") },
    { label: "下週一", date: format(nextMonday(today), "yyyy-MM-dd") },
  ];
}
