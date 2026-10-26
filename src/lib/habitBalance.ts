/**
 * habitBalance.ts — 習慣「累積目標池」計算（純函式）
 *
 * 概念：每日投入時間是「存款」，每日目標是「定額扣款」。
 *   結餘 = 累計投入 − 累計目標
 * 某天出遊沒補滿 → 結餘為負 → 之後任何一天多投入就自動補回。
 *
 * 設計紅線（見 task.md §4）：
 * - 不影響打卡（completed / streak / longestStreak 完全不碰）
 * - 不回溯起算日之前的紀錄（minutesSetAt 之前不計）
 * - 負值語氣中性，禁止「欠 / 逾期 / 失敗」字眼
 */
import { Habit, HabitCheckin } from "./types";
import { toLocalDateString } from "./dateUtils";

/** 單日實際投入分鐘：優先真實 minutes，否則用番茄數 × 單位時長 */
export function getCheckinMinutes(
  c: HabitCheckin | undefined,
  unitMinutes: number
): number {
  if (!c) return 0;
  return c.minutes ?? (c.pomodoros ?? 0) * unitMinutes;
}

/** 累計起算日：優先 minutesSetAt，其次建立日（本地日期） */
export function getTargetStartDate(habit: Habit): string {
  const setAt = habit.dailyTarget?.minutesSetAt;
  if (setAt && /^\d{4}-\d{2}-\d{2}$/.test(setAt)) return setAt;
  return toLocalDateString(new Date(habit.createdAt));
}

/** 從 start 到 end 的含頭含尾天數；end < start 回 0。逐日 +1 計算，避免 DST 差一天 */
export function daysInclusive(start: string, end: string): number {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  if (!s || !e) return 0;
  if (e.getTime() < s.getTime()) return 0;
  let days = 0;
  const d = new Date(s);
  // 上限保護：避免極端輸入造成無限迴圈（100 年 ≈ 36500 天）
  while (d.getTime() <= e.getTime() && days < 36500) {
    days++;
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

export interface HabitBalance {
  /** 每日目標分鐘 */
  minutes: number;
  /** 累計實際投入分鐘 */
  invested: number;
  /** 累計目標分鐘 */
  target: number;
  /** 結餘 = invested − target */
  balance: number;
  /** 起算日（含）到 today（含）的天數 */
  days: number;
}

/**
 * 計算累積目標池結餘。
 * 未啟用（無 dailyTarget 或 minutes<=0）回 null。
 */
export function computeHabitBalance(
  habit: Habit,
  today: string
): HabitBalance | null {
  const minutes = habit.dailyTarget?.minutes ?? 0;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;

  const start = getTargetStartDate(habit);
  const days = daysInclusive(start, today);
  if (days <= 0) {
    // 起算日在今天之後（時鐘被調回或剛設定）→ 尚未開始計帳
    return { minutes, invested: 0, target: 0, balance: 0, days: 0 };
  }

  const unitMinutes = habit.pomodoroMinutes ?? 25;
  let invested = 0;
  for (const c of habit.checkins) {
    if (c.date < start || c.date > today) continue;
    invested += getCheckinMinutes(c, unitMinutes);
  }

  const target = minutes * days;
  return { minutes, invested, target, balance: invested - target, days };
}

/**
 * 熱力圖填色（有每日目標時使用）。回 null 代表「未啟用目標 → 走舊的 completed/番茄數邏輯」。
 */
export function getHeatmapFill(habit: Habit, date: string): string | null {
  const minutes = habit.dailyTarget?.minutes ?? 0;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;

  const start = getTargetStartDate(habit);
  if (date < start) return "var(--surface-hover)";

  const c = habit.checkins.find((x) => x.date === date);
  const invested = getCheckinMinutes(c, habit.pomodoroMinutes ?? 25);
  if (invested <= 0) return "var(--surface-hover)";

  const ratio = invested / minutes;
  if (ratio < 1) return habit.color + "40";
  if (ratio < 2) return habit.color + "88";
  if (ratio < 3) return habit.color + "CC";
  return habit.color;
}

/** 結餘膠囊文案。正負皆中性語氣。 */
export function formatBalanceChip(balance: number): string {
  const n = Math.abs(Math.round(balance));
  return balance >= 0 ? `結餘 +${n} 分` : `還差 ${n} 分`;
}
