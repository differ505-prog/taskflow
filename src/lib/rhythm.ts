import type { RhythmAnchorId, RhythmSettings, ThemeDay } from "@/lib/types";
import { isPlanPaused } from "@/lib/sourcePlan";
import { toLocalDateString } from "@/lib/dateUtils";

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ANCHOR_WINDOW_MINUTES = 10;
const MINUTES_PER_DAY = 1440;

/** Parse "HH:mm" (00:00–23:59) into minutes since midnight, or null if invalid. */
export function parseHHmm(s: string): number | null {
  const match = HHMM_RE.exec(s.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

/** Return minutes elapsed since local midnight for the given Date. */
export function getMinutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Return the first enabled anchor whose target time is within ±10 minutes of `now`. */
export function getActiveAnchor(now: Date, s: RhythmSettings): RhythmAnchorId | null {
  const nowMin = getMinutesSinceMidnight(now);
  const candidates: Array<{ id: RhythmAnchorId; time: string }> = [
    { id: "wake", time: s.wakeTime },
    { id: "offduty", time: s.offDutyTime },
    { id: "screensoff", time: s.screensOffTime },
  ];

  for (const { id, time } of candidates) {
    if (!s.enabled[id]) continue;
    const targetMin = parseHHmm(time);
    if (targetMin === null) continue;
    const rawDiff = Math.abs(nowMin - targetMin);
    const circularDiff = Math.min(rawDiff, MINUTES_PER_DAY - rawDiff);
    if (circularDiff <= ANCHOR_WINDOW_MINUTES) {
      return id;
    }
  }

  // ── 第 4 顆：使用者自訂紅線 ──────────────────────────────────
  // 前 3 顆都未命中才檢查；自訂錨點獨立於 enabled.custom 的旗標開關，
  // 以 customAnchor.enabled 為準（避免兩處開關互相打架）。
  const custom = s.customAnchor;
  if (custom?.enabled && custom.label.trim()) {
    const customMin = parseHHmm(custom.time);
    if (customMin !== null) {
      const rawDiff = Math.abs(nowMin - customMin);
      const circularDiff = Math.min(rawDiff, MINUTES_PER_DAY - rawDiff);
      if (circularDiff <= ANCHOR_WINDOW_MINUTES) {
        return "custom";
      }
    }
  }

  return null;
}

/** Return true when `now` is at or after offDutyTime and before screensOffTime. */
export function isOffDutyNow(now: Date, s: RhythmSettings): boolean {
  const offMin = parseHHmm(s.offDutyTime);
  const screensOffMin = parseHHmm(s.screensOffTime);
  if (offMin === null || screensOffMin === null) return false;

  const nowMin = getMinutesSinceMidnight(now);
  if (offMin <= screensOffMin) {
    return nowMin >= offMin && nowMin < screensOffMin;
  }
  return nowMin >= offMin || nowMin < screensOffMin;
}

const ANCHOR_COPIES: Record<RhythmAnchorId, { title: string; body: string }> = {
  wake: {
    title: "早安，開機時間到了",
    body: "先挑一件小事暖機就好",
  },
  offduty: {
    title: "下班閥門，剩下的先送回大廳",
    body: "今天已經很夠了，剩下的交給明天",
  },
  screensoff: {
    title: "熄屏時間到，眼睛先下班",
    body: "把螢幕關上，讓腦袋慢慢降速",
  },
  custom: {
    title: "個人節奏紅線",
    body: "守住這條線，明天會謝謝你",
  },
};

/** Return calm, non-judgmental copy for a rhythm anchor. */
export function anchorCopy(
  id: RhythmAnchorId,
  s?: RhythmSettings
): { title: string; body: string } {
  if (id === "custom") {
    const label = s?.customAnchor?.label?.trim();
    return {
      title: label || "個人節奏紅線",
      body: "守住這條線，明天會謝謝你",
    };
  }
  return ANCHOR_COPIES[id];
}

/**
 * Return the first ThemeDay matching `now.getDay()`, or null if none match.
 * 已休眠方案的主題日會被略過（休眠方案不會佔用今天的主題）。
 */
export function getTodayTheme(s: RhythmSettings, now: Date): ThemeDay | null {
  const weekday = now.getDay();
  const todayStr = toLocalDateString(now);
  const candidates = s.themeDays.filter(
    (t) => !isPlanPaused(t.sourcePlan?.id, s.pausedPlans, todayStr)
  );
  return candidates.find((t) => t.weekdays.includes(weekday)) ?? null;
}

/** Format display copy for a ThemeDay. */
export function themeCopy(t: ThemeDay): { title: string; body: string } {
  const prefix = t.emoji.trim();
  const title = prefix ? `${prefix} ${t.label}` : t.label;
  return {
    title,
    body: "今天主攻這條線",
  };
}
