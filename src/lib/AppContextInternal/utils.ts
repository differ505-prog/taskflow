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
