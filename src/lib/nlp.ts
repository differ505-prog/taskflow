import { Priority, Recurrence } from "./types";

interface ParsedTask {
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string;
  dueTime?: string;
  tags: string[];
  recurrence?: Recurrence;
  reminder?: string;
}

// ─── Priority patterns (order matters — longer/more specific first) ──
const PRIORITY_PATTERNS: Array<{ pattern: RegExp; priority: Priority }> = [
  { pattern: /\b(p0|p-)\b/i, priority: "do-now" },
  { pattern: /\b非常重要\b|\b急要\b|\b超緊急\b|\b緊急\b/i, priority: "do-now" },
  { pattern: /\b優先\b.*高|\b高優先\b|\b很重要\b/i, priority: "schedule" },
  { pattern: /\b(p1|h)\b/i, priority: "schedule" },
  { pattern: /\b排程\b|\b排入\b.*日程/i, priority: "schedule" },
  { pattern: /\b優先\b.*中|\b中優先\b/i, priority: "delegate" },
  { pattern: /\b(p2|m)\b/i, priority: "delegate" },
  { pattern: /\b轉交\b|\b委派\b|\b併購\b/i, priority: "delegate" },
  { pattern: /\b優先\b.*低|\b低優先\b|\b有空再\b/i, priority: "none" },
  { pattern: /\b暫緩\b|\b緩\b/i, priority: "none" },
  { pattern: /\b(p3|l)\b/i, priority: "none" },
];

// ─── Date / Time patterns ───────────────────────────────────
const DATE_PATTERNS: Array<{ pattern: RegExp; getDate: (text?: string) => string }> = [
  // Absolute dates
  { pattern: /(\d{1,2})\/(\d{1,2})/, getDate: () => "" }, // placeholder
  { pattern: /(\d{4})-(\d{1,2})-(\d{1,2})/, getDate: () => "" },
  // Relative
  { pattern: /\b今天\b/i, getDate: () => today() },
  { pattern: /\b明天\b/i, getDate: () => addDays(1) },
  { pattern: /\b後天\b/i, getDate: () => addDays(2) },
  { pattern: /\b大後天\b/i, getDate: () => addDays(3) },
  { pattern: /\b下週[一二三四五六日天]/i, getDate: (text) => nextWeekday(text || "") },
  { pattern: /\b下週\b/i, getDate: () => addDays(7) },
  { pattern: /\b這週\b/i, getDate: () => today() },
  { pattern: /\b本週\b/i, getDate: () => today() },
  { pattern: /\b下個月\b/i, getDate: () => addDays(30) },
  // Weekday names — 需傳入 text 才能從匹配字串解析具體週X
  { pattern: /\b(週|星期|禮拜)[一二三四五六日天]\b/i, getDate: (text) => nextWeekday(text || "") },
];

// ─── Time patterns ──────────────────────────────────────────
const TIME_PATTERNS = [
  { pattern: /(\d{1,2}):(\d{2})/, extract: (m: RegExpMatchArray) => `${m[1].padStart(2,"0")}:${m[2]}` },
  { pattern: /(\d{1,2})點(\d{1,2})?分?/, extract: (m: RegExpMatchArray) => `${m[1].padStart(2,"0")}:${m[2] ?? "00"}` },
  { pattern: /下午(\d{1,2})[:：]?(\d{2})?/, extract: (m: RegExpMatchArray) => {
    const h = parseInt(m[1]) === 12 ? 12 : parseInt(m[1]) + 12;
    return `${h}:${m[2] ?? "00"}`;
  }},
  { pattern: /早上(\d{1,2})[:：]?(\d{2})?/, extract: (m: RegExpMatchArray) => `${m[1].padStart(2,"0")}:${m[2] ?? "00"}` },
  { pattern: /中午(\d{1,2})?[:：]?(\d{2})?/, extract: () => "12:00" },
];

// ─── Recurrence patterns ─────────────────────────────────────
const RECURRENCE_PATTERNS: Array<{ pattern: RegExp; getRecurrence: () => Recurrence }> = [
  { pattern: /\b每天\b|\b每日\b/i, getRecurrence: () => ({ pattern: "daily", interval: 1, completedCount: 0 }) },
  { pattern: /\b每週\b/i, getRecurrence: () => ({ pattern: "weekly", interval: 1, completedCount: 0 }) },
  { pattern: /\b每個月\b/i, getRecurrence: () => ({ pattern: "monthly", interval: 1, completedCount: 0 }) },
  { pattern: /\b每隔(\d+)[天日]/i, getRecurrence: () => ({ pattern: "custom", interval: 1, completedCount: 0 }) },
  { pattern: /每[週周](\S)/i, getRecurrence: () => ({ pattern: "weekly", interval: 1, daysOfWeek: [], completedCount: 0 }) },
];

// ─── Tag extraction ──────────────────────────────────────────
const TAG_PATTERN = /#(\S+)/g;

// ─── Reminder patterns ───────────────────────────────────────
const REMINDER_PATTERNS = [
  { pattern: /提醒我?(在|於)?(.+?)(?=，|,|\s|$)/, extract: (m: RegExpMatchArray) => m[2] },
];

// ─── Main parser ─────────────────────────────────────────────
export function parseNaturalLanguage(input: string): ParsedTask {
  let text = input.trim();
  let priority: Priority = "delegate";
  let dueDate: string | undefined;
  let dueTime: string | undefined;
  let recurrence: Recurrence | undefined;
  const tags: string[] = [];

  // Extract tags
  let match;
  while ((match = TAG_PATTERN.exec(text)) !== null) {
    tags.push(match[1]);
  }
  text = text.replace(TAG_PATTERN, "").replace(/[#]{2,}/g, "#");

  // Extract priority
  for (const { pattern, priority: p } of PRIORITY_PATTERNS) {
    if (pattern.test(text)) {
      priority = p;
      text = text.replace(pattern, "").trim();
      break;
    }
  }

  // Extract date
  for (const item of DATE_PATTERNS) {
    const m = text.match(item.pattern);
    if (m) {
      // Handle MM/DD format
      if (item.pattern.source.includes("1,2") && !item.pattern.source.includes("4")) {
        const now = new Date();
        const month = parseInt(m[1]);
        const day = parseInt(m[2]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          dueDate = `${now.getFullYear()}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        }
      } else if (item.pattern.source.includes("4")) {
        dueDate = m[0];
      } else {
        dueDate = item.getDate(text);
      }
      text = text.replace(item.pattern, "").trim();
      break;
    }
  }

  // Extract time
  for (const item of TIME_PATTERNS) {
    const m = text.match(item.pattern);
    if (m) {
      dueTime = item.extract(m);
      text = text.replace(item.pattern, "").trim();
      break;
    }
  }

  // Extract recurrence
  for (const item of RECURRENCE_PATTERNS) {
    if (item.pattern.test(text)) {
      recurrence = item.getRecurrence();
      text = text.replace(item.pattern, "").trim();
      break;
    }
  }

  // Clean up title
  const title = text
    .replace(/[,，]\s*$/, "")
    .replace(/^\s*[-–—:：]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: title || input.trim(),
    priority,
    dueDate,
    dueTime,
    tags,
    recurrence,
  };
}

// ─── Helpers ─────────────────────────────────────────────────
// ⚠️ 用本地時區計算，避免 UTC offset 造成日期差一天
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function today(): string {
  return toLocalDateString(new Date());
}

function addDays(n: number): string {
  return toLocalDateString(new Date(Date.now() + n * 86400000));
}

function nextWeekday(text: string): string {
  const weekdayMap: Record<string, number> = {
    // 週 / 星期 / 禮拜 → JavaScript getDay() 對應
    "日": 0, "天": 0,
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
  };
  const m = text.match(/(週|星期|禮拜)([一二三四五六日天])/);
  if (!m) return addDays(1);
  const target = weekdayMap[m[2]];
  if (target === undefined) return addDays(1);
  const d = new Date();
  // 若今天就是目標日且有時間上下文(沒傳時間關鍵字),視為「下週」
  // 簡化:今天也算,因為使用者通常指「最近一次週X」(今天就今天,下週就下週)
  let diff = target - d.getDay();
  if (diff <= 0) diff += 7; // 已經過或就是今天 → 排下週
  d.setDate(d.getDate() + diff);
  return toLocalDateString(d);
}

function nextWeekDay(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
