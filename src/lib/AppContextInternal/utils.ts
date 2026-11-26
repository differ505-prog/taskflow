// AppContextInternal — 純 helper（不依賴 React/Sync，不捕獲外部 scope）
import { Habit, Recurrence } from "../types";
import { getLocalToday, toLocalDateString } from "../dateUtils";

export function computeHabitStreak(habit: Habit, checkins: Habit["checkins"]): number {
  if (checkins.length === 0) return 0;
  const localToday = getLocalToday();
  const yesterday = toLocalDateString(new Date(Date.now() - 86400000));
  const doneDates = checkins.filter((c) => c.completed).map((c) => c.date).sort().reverse();
  if (doneDates.length === 0) return 0;
  if (doneDates[0] !== localToday && doneDates[0] !== yesterday) return 0;
  let streak = 0;
  let iterations = 0;
  const dateSet = new Set(doneDates);
  const d = new Date(doneDates[0]);
  while (dateSet.has(toLocalDateString(d)) && iterations < 1000) {
    streak++;
    d.setDate(d.getDate() - 1);
    iterations++;
  }
  return streak;
}

/**
 * 取得某月第 N 個星期 X 的日期
 *
 * - `weekOfMonth` = 1..4：找該月第 N 個該星期；超出該月則退 7 天（落到前一個月）
 * - `weekOfMonth` = -1：找該月「最後一個」該星期
 * - `weekday` = 0(Sun)..6(Sat)
 *
 * 回傳本地時間的 Date（`setHours(0,0,0,0)` 歸零，避免跨時區漂移）
 */
export function getNthWeekdayOfMonth(
  year: number,
  monthZeroBased: number,
  weekOfMonth: 1 | 2 | 3 | 4 | -1,
  weekday: number
): Date {
  const target = ((weekday % 7) + 7) % 7;

  if (weekOfMonth === -1) {
    // 該月最後一天往前找最近的該星期
    const lastDay = new Date(year, monthZeroBased + 1, 0);
    const delta = (lastDay.getDay() - target + 7) % 7;
    const d = new Date(year, monthZeroBased + 1, 0 - delta);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // 該月第一天，往後找最近的該星期
  const first = new Date(year, monthZeroBased, 1);
  const firstMatchOffset = (target - first.getDay() + 7) % 7;
  const day = 1 + firstMatchOffset + (weekOfMonth - 1) * 7;

  const daysInMonth = new Date(year, monthZeroBased + 1, 0).getDate();
  // 超出該月 → 退 7 天（落到前一個月的同樣星期）
  const clampedDay = day > daysInMonth ? day - 7 : day;

  const d = new Date(year, monthZeroBased, clampedDay);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getNextRecurrenceDate(
  from: string,
  recurrence: Recurrence,
  startFrom?: string
): { dueDate: string; startDate?: string } {
  const d = new Date(from);
  switch (recurrence.pattern) {
    case "daily":
      d.setDate(d.getDate() + recurrence.interval);
      break;
    case "weekly":
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        d.setDate(d.getDate() + 1);
        let iterations = 0;
        const validDays = recurrence.daysOfWeek.map(Number);
        while (!validDays.includes(d.getDay()) && iterations < 7) {
          d.setDate(d.getDate() + 1);
          iterations++;
        }
      } else {
        d.setDate(d.getDate() + 7 * recurrence.interval);
      }
      break;
    case "monthly": {
      // 先 setDate(1) 再 setMonth，防月底溢位（例如 1/31 + 1 month → 3/3）
      const dayOfMonth = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + recurrence.interval);

      if (recurrence.weekOfMonth !== undefined && recurrence.weekday !== undefined) {
        // 「每月第 N 個星期 X」模式
        const nth = getNthWeekdayOfMonth(
          d.getFullYear(),
          d.getMonth(),
          recurrence.weekOfMonth,
          recurrence.weekday
        );
        d.setFullYear(nth.getFullYear(), nth.getMonth(), nth.getDate());
        d.setHours(0, 0, 0, 0);
      } else if (recurrence.dayOfMonth) {
        const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(recurrence.dayOfMonth, maxDay));
      } else {
        // 沒給 dayOfMonth 也沒給 weekOfMonth → 保留原本的日期（clamp）
        const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(dayOfMonth, maxDay));
      }
      break;
    }
    case "yearly":
      d.setFullYear(d.getFullYear() + recurrence.interval);
      break;
    case "custom":
      d.setDate(d.getDate() + recurrence.interval);
      break;
  }
  // 使用本地日期格式（toISOString 會在 UTC+8 把本地午夜換算成前一天的 UTC 日期）
  const nextDueDate = toLocalDateString(d);
  if (startFrom) {
    const s = new Date(startFrom);
    const fromDate = new Date(from);
    const daysDelta = Math.round((fromDate.getTime() - s.getTime()) / 86400000);
    const nextStartDate = new Date(d.getTime());
    nextStartDate.setDate(nextStartDate.getDate() - daysDelta);
    return { dueDate: nextDueDate, startDate: toLocalDateString(nextStartDate) };
  }
  return { dueDate: nextDueDate };
}

/**
 * AppContext sync debug logger
 * - dev: 完整輸出可讀日誌
 * - prod: 靜默（生產日誌乾淨）
 *
 * 用法:
 *   import { appContextLog } from "./utils";
 *   const log = appContextLog("AppContext");
 *   log.sync("setTasks result", { merged: 3, deleted: 1 });
 */
export function appContextLog(ns: string) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    breadcrumb: (msg: string) => {
      if (isProd) return;
      console.log(`[${ns}] ${msg} — ${Date.now()}`);
    },
    sync: (msg: string, data?: Record<string, unknown>) => {
      if (isProd) return;
      if (data) {
        console.log(`[${ns}] ${msg}`, data);
      } else {
        console.log(`[${ns}] ${msg}`);
      }
    },
    warn: (msg: string, err?: unknown) => {
      if (isProd) return;
      if (err) {
        console.warn(`[${ns}] ${msg}`, err);
      } else {
        console.warn(`[${ns}] ${msg}`);
      }
    },
    error: (msg: string, err?: unknown) => {
      // error 等級無論環境都輸出，但 dev 格式更詳細
      if (isProd) {
        console.error(JSON.stringify({ ns, msg, error: String(err) }));
      } else {
        console.error(`[${ns}] ${msg}`, err);
      }
    },
    info: (msg: string, data?: Record<string, unknown>) => {
      if (isProd) return;
      if (data) {
        console.info(`[${ns}] ${msg}`, data);
      } else {
        console.info(`[${ns}] ${msg}`);
      }
    },
  };
}
