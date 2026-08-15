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
    case "monthly":
      d.setMonth(d.getMonth() + recurrence.interval);
      if (recurrence.dayOfMonth) {
        d.setDate(Math.min(recurrence.dayOfMonth, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      }
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + recurrence.interval);
      break;
    case "custom":
      d.setDate(d.getDate() + recurrence.interval);
      break;
  }
  const nextDueDate = d.toISOString().split("T")[0];
  if (startFrom) {
    const s = new Date(startFrom);
    const fromDate = new Date(from);
    const daysDelta = Math.round((fromDate.getTime() - s.getTime()) / 86400000);
    const nextStartDate = new Date(d.getTime());
    nextStartDate.setDate(nextStartDate.getDate() - daysDelta);
    return { dueDate: nextDueDate, startDate: nextStartDate.toISOString().split("T")[0] };
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
