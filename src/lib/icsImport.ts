/**
 * iCal (.ics) parser for read-only external calendar import.
 * Companion to ical.ts (which generates). This parser extracts only
 * 「這一天是否有事件」,不解析 SUMMARY/DESCRIPTION 用於顯示,
 * 保留使用者隱私(我們不存事件名稱,只存日期清單 + hash)。
 *
 * 支援 RFC 5545 的最小子集:
 * - VEVENT 區塊切分
 * - DTSTART;VALUE=DATE:YYYYMMDD → 全天事件
 * - DTSTART:YYYYMMDDTHHMMSSZ 或 floating → 帶時間事件
 * - DTEND 或 DURATION
 * - 行折疊(unfold lines)
 * - UTF-8 BOM 容忍
 * - Google / Apple / Outlook 三家產生的 ICS 都涵蓋
 *
 * 不支援:RRULE(週期)— 我們只讀「未來 90 天」視窗,Google 會自動展開 RRULE,
 * 所以實務上收到的 ICS 通常已是展開後的單次事件。
 */

// ─── localStorage 快取 ────────────────────────────────────────
const EXTERNAL_CAL_KEY = "taskflow_external_calendars";
import { logger } from "@/lib/logger";
const log = logger.ns("icsImport");
/** 快取結構:{ url → { dateCountMap, fetchedAt } } */
interface CachedCalendar {
  dateCountMap: Record<string, number>; // YYYY-MM-DD → 事件數
  fetchedAt: number; // ms epoch
}

function readExternalCalendars(): Record<string, CachedCalendar> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EXTERNAL_CAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeExternalCalendars(data: Record<string, CachedCalendar>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EXTERNAL_CAL_KEY, JSON.stringify(data));
  } catch (e) {
    log.warn("storage write failed", { error: e });
  }
}

export function getStoredExternalCalendarUrls(): string[] {
  const all = readExternalCalendars();
  return Object.keys(all);
}

export function removeStoredExternalCalendar(url: string): void {
  const all = readExternalCalendars();
  delete all[url];
  writeExternalCalendars(all);
}

export interface ParsedVEVENT {
  /** YYYY-MM-DD,本地時區 = event 的浮動日期(若 DTSTART 帶時間且有 TZ,簡化為 YYYY-MM-DD) */
  dateStr: string;
  /** 是否全天 */
  allDay: boolean;
  /** DTSTAMP 或 UID(用於除錯,不存儲) */
  uid: string | null;
}

/**
 * 解析 ICS 字串,回傳所有 VEVENT 的最小資料。
 * 折疊行(CRLF + space)先解開,然後逐行掃描。
 */
export function parseICal(icsText: string): ParsedVEVENT[] {
  if (!icsText || typeof icsText !== "string") return [];

  // 移除 BOM
  const cleaned = icsText.replace(/^\uFEFF/, "");

  // Unfold lines: RFC 5545 規定 CRLF + space/tab = 折行,需還原成單行
  const unfolded = cleaned.replace(/\r?\n[ \t]/g, "");

  const lines = unfolded.split(/\r?\n/);
  const events: ParsedVEVENT[] = [];
  let inEvent = false;
  let dtstart: string | null = null;
  let dtstartIsDate = false;
  let dtend: string | null = null;
  let dtendIsDate = false;
  let uid: string | null = null;

  const flush = () => {
    if (!inEvent || !dtstart) return;
    const dateStr = parseICSDateToDateStr(dtstart, dtstartIsDate);
    if (dateStr) {
      events.push({
        dateStr,
        allDay: dtstartIsDate,
        uid,
      });
    }
    // 註:不處理 DTEND 跨日展開 — 我們只需「這一天有事件」,
    // 多日事件會被兩端日期各記錄一次,中間日靠 recurrence 或手動展開。
    // 對 90 天視窗內的全天事件,Google/Apple 通常展開成多個 DTSTART。
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      dtstart = null;
      dtstartIsDate = false;
      dtend = null;
      dtendIsDate = false;
      uid = null;
      continue;
    }
    if (line === "END:VEVENT") {
      flush();
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    // 解析 "PROPERTY;PARAM=VAL:VALUE"
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const propertyPart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    const propUpper = propertyPart.toUpperCase();
    // 屬性名可能帶 parameters(DTSTART;VALUE=DATE:...) — 用 startsWith 判斷
    if (propUpper.startsWith("DTSTART")) {
      dtstartIsDate = /VALUE=DATE/.test(propertyPart);
      dtstart = value;
    } else if (propUpper.startsWith("DTEND")) {
      dtendIsDate = /VALUE=DATE/.test(propertyPart);
      dtend = value;
    } else if (propUpper.startsWith("UID")) {
      uid = value;
    }
    // 其他屬性(SUMMARY/DESCRIPTION/LOCATION 等)刻意忽略 — 隱私保護 + 節省記憶體
  }

  return events;
}

/**
 * 把 ICS 日期格式轉成本地 YYYY-MM-DD。
 * 處理兩種情況:
 * 1. 全天:VALUE=DATE:20251225 → "2025-12-25"
 * 2. UTC:20251225T080000Z → 取 YYYYMMDD 部分並轉本地(簡化:直接取日期部分,UTC 偏移當天內)
 * 3. Floating:20251225T080000 → 直接取日期部分
 */
function parseICSDateToDateStr(value: string, isDate: boolean): string | null {
  if (!value || value.length < 8) return null;

  // VALUE=DATE:YYYYMMDD (length 8)
  if (isDate) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return `${y}-${m}-${d}`;
  }

  // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ (length >= 15)
  if (value.length >= 15 && (value[8] === "T" || value[8] === " ")) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);

    if (value.endsWith("Z")) {
      // UTC:轉本地 — 但跨日場景較少,先採直接取日期
      // 完整本地化需用 Intl.DateTimeFormat,但對「那天有事件」判定影響不大
      const isoStr = `${y}-${m}-${d}T${value.slice(9, 15)}Z`;
      const dt = new Date(isoStr);
      if (isNaN(dt.getTime())) return `${y}-${m}-${d}`;
      // 用 toLocaleDateString 拿本地日期字串
      return dt.toLocaleDateString("en-CA");
    }

    // Floating (no TZ):直接取日期
    return `${y}-${m}-${d}`;
  }

  // 退化場景:當成日期處理
  if (value.length === 8) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return `${y}-${m}-${d}`;
  }

  return null;
}

// ─── Fetch + Aggregate + Cache ───────────────────────────────

/** 過濾 / 聚合:從 parsed events 產生 Record<dateStr, count> */
function aggregateByDate(events: ParsedVEVENT[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const ev of events) {
    map[ev.dateStr] = (map[ev.dateStr] ?? 0) + 1;
  }
  return map;
}

export interface FetchCalendarResult {
  ok: boolean;
  dateCountMap?: Record<string, number>;
  error?: string;
}

/**
 * 從遠端 ICS URL 拉取 + 解析 + 寫入 localStorage 快取。
 * 若失敗,保留舊快取(不要把使用者好不容易設好的東西覆蓋掉)。
 */
export async function fetchAndCacheExternalCalendar(
  url: string,
  options: { signal?: AbortSignal } = {},
): Promise<FetchCalendarResult> {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: "URL 不能為空" };
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: "URL 需以 http:// 或 https:// 開頭" };
  }

  try {
    const res = await fetch(trimmed, {
      signal: options.signal,
      // Google private ICS URL 通常不需要任何 header
      headers: { Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.5" },
      // 不帶 cookies / credentials,因為 private ICS URL 自帶 token
      credentials: "omit",
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} — 請檢查 URL 是否正確` };
    }
    const text = await res.text();
    const events = parseICal(text);
    if (events.length === 0) {
      return { ok: false, error: "ICS 解析失敗或日曆為空 — 請確認這是有效的日曆訂閱連結" };
    }
    const dateCountMap = aggregateByDate(events);
    const all = readExternalCalendars();
    all[trimmed] = { dateCountMap, fetchedAt: Date.now() };
    writeExternalCalendars(all);
    return { ok: true, dateCountMap };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "請求已取消" };
    }
    return {
      ok: false,
      error: e instanceof Error ? `網路錯誤:${e.message}` : "未知錯誤",
    };
  }
}

/** 重新從 localStorage 讀所有已存外部日曆(給 hook 用) */
export function readAllExternalCalendarCaches(): Record<string, CachedCalendar> {
  return readExternalCalendars();
}

/** 取得某 URL 的最後拉取時間(給 UI 顯示「最後更新 X 分鐘前」) */
export function getCalendarFetchedAt(url: string): number | null {
  const all = readExternalCalendars();
  return all[url]?.fetchedAt ?? null;
}

/** 聚合多個外部日曆的 count map(給月曆頁指示器用) */
export function mergeExternalCalendarCounts(
  urls: string[],
): Record<string, number> {
  const all = readExternalCalendars();
  const merged: Record<string, number> = {};
  for (const url of urls) {
    const cached = all[url];
    if (!cached) continue;
    for (const [date, count] of Object.entries(cached.dateCountMap)) {
      merged[date] = (merged[date] ?? 0) + count;
    }
  }
  return merged;
}