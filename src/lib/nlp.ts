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
  // ASCII 短碼保留 \b (避免 apple / happy 誤觸發 p0/p1/p2/p3/h/m/l)
  { pattern: /\b(p0|p-)\b/i, priority: "do-now" },
  // 中文 pattern 移除 \b: \b 在中文不是 word boundary (中文字符不是 \w 字符),
  // 用 \b 永遠不匹配 → 整個 NLP 中文解析失效 (BUG-2026-08-01)
  { pattern: /非常重要|急要|超緊急|緊急/i, priority: "do-now" },
  { pattern: /優先.*高|高優先|很重要/i, priority: "schedule" },
  { pattern: /\b(p1|h)\b/i, priority: "schedule" },
  { pattern: /排程|排入.*日程/i, priority: "schedule" },
  { pattern: /優先.*中|中優先/i, priority: "delegate" },
  { pattern: /\b(p2|m)\b/i, priority: "delegate" },
  { pattern: /轉交|委派|併購/i, priority: "delegate" },
  { pattern: /優先.*低|低優先|有空再/i, priority: "none" },
  { pattern: /暫緩|緩/i, priority: "none" },
  { pattern: /\b(p3|l)\b/i, priority: "none" },
];

// ─── Date / Time patterns ───────────────────────────────────
const DATE_PATTERNS: Array<{ pattern: RegExp; getDate: (text?: string) => string }> = [
  // Absolute dates
  { pattern: /(\d{1,2})\/(\d{1,2})/, getDate: () => "" }, // placeholder
  { pattern: /(\d{4})-(\d{1,2})-(\d{1,2})/, getDate: () => "" },
  // Relative(中文 pattern 全部移除 \b,理由同 priority)
  { pattern: /今天/, getDate: () => today() },
  { pattern: /明天/, getDate: () => addDays(1) },
  { pattern: /後天/, getDate: () => addDays(2) },
  { pattern: /大後天/, getDate: () => addDays(3) },
  { pattern: /下週[一二三四五六日天]/, getDate: (text) => nextWeekday(text || "") },
  { pattern: /下週/, getDate: () => addDays(7) },
  { pattern: /這週/, getDate: () => today() },
  { pattern: /本週/, getDate: () => today() },
  { pattern: /下個月/, getDate: () => addDays(30) },
  // Weekday names — 需傳入 text 才能從匹配字串解析具體週X
  { pattern: /(?:週|星期|禮拜)[一二三四五六日天]/, getDate: (text) => nextWeekday(text || "") },
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
  { pattern: /每天|每日/, getRecurrence: () => ({ pattern: "daily", interval: 1, completedCount: 0 }) },
  { pattern: /每週/, getRecurrence: () => ({ pattern: "weekly", interval: 1, completedCount: 0 }) },
  { pattern: /每個月/, getRecurrence: () => ({ pattern: "monthly", interval: 1, completedCount: 0 }) },
  { pattern: /每隔(\d+)[天日]/, getRecurrence: () => ({ pattern: "custom", interval: 1, completedCount: 0 }) },
  { pattern: /每[週周](\S)/, getRecurrence: () => ({ pattern: "weekly", interval: 1, daysOfWeek: [], completedCount: 0 }) },
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
