import type { RhythmAnchorId, RhythmSettings, ThemeDay } from "@/lib/types";

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
};

/** Return calm, non-judgmental copy for a rhythm anchor. */
export function anchorCopy(id: RhythmAnchorId): { title: string; body: string } {
  return ANCHOR_COPIES[id];
}

/** Return the first ThemeDay matching `now.getDay()`, or null if none match. */
export function getTodayTheme(s: RhythmSettings, now: Date): ThemeDay | null {
  const weekday = now.getDay();
  return s.themeDays.find((t) => t.weekdays.includes(weekday)) ?? null;
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
