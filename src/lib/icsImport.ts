/**
 * iCal (.ics) parser for read-only external calendar import.
 * Companion to ical.ts (which generates). This parser extracts dates for
 * conflict indicators and, only for the official Taiwan public holiday feed,
 * event titles for in-calendar labels. Private calendar content is never persisted.
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
const EXTERNAL_CAL_IMPORT = "icsImport";

/** 一鍵訂閱的官方台灣公開節日來源；只有此 URL 可保存事件標題。 */
export const TAIWAN_HOLIDAYS_ICS_URL =
  "https://calendar.google.com/calendar/ical/zh-tw.taiwan%23holiday%40group.v.calendar.google.com/public/basic.ics";

/** 以完整 URL 判斷是否為官方台灣公開節日來源。 */
export function isTaiwanHolidaysUrl(url: string): boolean {
  return url.trim() === TAIWAN_HOLIDAYS_ICS_URL;
}

import { logger } from "@/lib/logger";
const log = logger.ns(EXTERNAL_CAL_IMPORT);
/** 快取結構:{ url → { dateCountMap, fetchedAt } } */
interface CachedCalendar {
  dateCountMap: Record<string, number>; // YYYY-MM-DD → 事件數
  /** 僅官方台灣公開節日來源使用。私人日曆不保存此欄位。 */
  dateTitleMap?: Record<string, string[]>;
  fetchedAt: number; // ms epoch
}

function readExternalCalendars(): Record<string, CachedCalendar> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EXTERNAL_CAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CachedCalendar>;
    const sanitized: Record<string, CachedCalendar> = {};
    for (const [url, cached] of Object.entries(parsed)) {
      if (!cached?.dateCountMap || typeof cached.fetchedAt !== "number") continue;
      sanitized[url] = {
        dateCountMap: cached.dateCountMap,
        // 向後相容舊快取時，也只允許官方台灣公開來源保存標題。
        ...(isTaiwanHolidaysUrl(url) && cached.dateTitleMap
          ? { dateTitleMap: cached.dateTitleMap }
          : {}),
        fetchedAt: cached.fetchedAt,
      };
    }
    return sanitized;
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
  /** VEVENT 的公開標題；只有官方台灣節日來源會保存到快取。 */
  summary: string | null;
  /**
   * DESCRIPTION 原文。**只在官方台灣節日 URL 解析路徑會用到,用來區分
   * 「國定假日」vs「假日節慶」。**私人 ICS 解析結果不寫盤,等同忽略。
   */
  description: string | null;
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
  let summary: string | null = null;
  let description: string | null = null;

  const flush = () => {
    if (!inEvent || !dtstart) return;
    const dateStr = parseICSDateToDateStr(dtstart, dtstartIsDate);
    if (dateStr) {
      events.push({
        dateStr,
        allDay: dtstartIsDate,
        uid,
        summary,
        description,
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
      summary = null;
      description = null;
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
    } else if (propUpper.startsWith("SUMMARY")) {
      summary = value.trim() || null;
    } else if (propUpper.startsWith("DESCRIPTION")) {
      // 官方台灣節日 ICS 用 DESCRIPTION 標記「國定假日」(全民放假) vs
      // 「假日節慶\n如要隱藏假日節慶...」(僅紀念日,不全民放假)。
      // 解析但不寫盤(隱私保護),由後續 aggregate 路徑判斷是否使用。
      description = value || null;
    }
    // 其他屬性(LOCATION/CATEGORIES 等)刻意忽略 — 隱私保護 + 節省記憶體
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

/**
 * 從 ICS DESCRIPTION 區分全民國定假日 vs 紀念日(不放假)。
 * 來源:Google「台灣的節慶假日」公開日曆官方分類 — 非自行判斷。
 * - `DESCRIPTION:國定假日` → 全民放假 → ★
 * - `DESCRIPTION:假日節慶...`(不放假,僅紀念)→ ◇
 * - 其他/缺失 → 保守視為全民放假(★),維持向後相容(舊 cache / 其他 ICS 來源)
 *
 * §F4 (2026-09-14):Google ICS 沒跟上「紀念日及節日實施條例」2025 年修法,
 * 仍把下列 3 個**已升格為國定假日**的日子標成「假日節慶」:
 *   - 教師節 / 孔子誕辰紀念日 (9/28)
 *   - 台灣光復節 (10/25,長名為「臺灣光復暨金門古寧頭大捷紀念日」)
 *   - 行憲紀念日 (12/25)
 * 用 SUMMARY 命中這份 override 白名單,**強制回傳 ★**,不再受 DESCRIPTION 誤導。
 * 長期正解見「優化清單.md — DGPA SSOT 替換」條目。
 */
const SUMMARY_FULL_HOLIDAY_OVERRIDE: ReadonlySet<string> = new Set([
  "教師節",
  "孔子誕辰紀念日",
  "孔子誕辰紀念日／教師節",
  "台灣光復節",
  "臺灣光復節",
  "臺灣光復暨金門古寧頭大捷紀念日",
  "行憲紀念日",
]);

function deriveHolidayPrefix(
  summary: string | null,
  description: string | null,
): "★" | "◇" {
  // §F4 override:SUMMARY 命中白名單 → 直接 ★,不看 DESCRIPTION
  if (summary && SUMMARY_FULL_HOLIDAY_OVERRIDE.has(summary)) return "★";
  if (!description) return "★";
  // 順序:先檢查「國定假日」,因為兩者互斥但若字串同時含兩個關鍵字(異常資料)
  // 我們以「國定假日」優先 — 它才是法定的全國放假依據。
  if (description.includes("國定假日")) return "★";
  if (description.includes("假日節慶")) return "◇";
  return "★";
}

/** 過濾 / 聚合:只保留官方台灣公開節日的日期 → 標題陣列。 */
export function aggregateTitlesByDate(events: ParsedVEVENT[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const ev of events) {
    if (!ev.summary) continue;
    // 補班日是上班日,不應標為假日（DGPA 行事曆慣例:補假=放,補班=上）
    if (ev.summary.includes("補班")) continue;
    const prefix = deriveHolidayPrefix(ev.summary, ev.description);
    const titles = map[ev.dateStr] ?? [];
    // ★=全民國定假日, ◇=紀念日(軍人節/教師節等,僅部分族群放假)
    const label = `${prefix} ${ev.summary}`;
    if (!titles.includes(label)) titles.push(label);
    map[ev.dateStr] = titles;
  }
  return map;
}

/** 去除節日前置 ★ 或 ◇ 符號，取得乾淨名稱 */
export function cleanHolidayName(raw: string): string {
  if (!raw) return "";
  return raw.replace(/^[★◇]\s*/, "").trim();
}

/** 台灣常見節日縮寫字典（在手機版月曆 ~50px 窄格中提供極佳可讀性） */
const HOLIDAY_SHORT_NAMES: Record<string, string> = {
  "中華民國開國紀念日": "元旦",
  "和平紀念日": "二二八",
  "民族掃墓節": "清明",
  "清明節": "清明",
  "孔子誕辰紀念日": "教師節",
  "孔子誕辰紀念日／教師節": "教師節",
  "臺灣光復暨金門古寧頭大捷紀念日": "光復節",
  "臺灣光復節": "光復節",
  "台灣光復節": "光復節",
  "農曆除夕": "除夕",
  "春節": "春節",
  "端午節": "端午",
  "中秋節": "中秋",
  "國慶日": "國慶",
  "兒童節": "兒童",
  "勞動節": "勞動",
  "軍人節": "軍人",
  "教師節": "教師",
  "行憲紀念日": "行憲",
  "原住民族歲時祭儀": "歲時祭",
};

/**
 * 取得適用於月曆格子的 2~3 字精簡節日標籤
 */
export function getShortHolidayName(raw: string): string {
  const clean = cleanHolidayName(raw);
  if (!clean) return "";
  if (HOLIDAY_SHORT_NAMES[clean]) {
    return HOLIDAY_SHORT_NAMES[clean];
  }
  const stripped = clean.replace(/紀念日$/, "").replace(/節$/, "");
  if (stripped.length >= 2 && stripped.length <= 3) {
    return stripped;
  }
  return clean.length > 3 ? clean.slice(0, 3) : clean;
}

export interface FetchCalendarResult {
  ok: boolean;
  dateCountMap?: Record<string, number>;
  /** 僅官方台灣公開節日來源可能回傳；私人日曆永遠為空。 */
  dateTitleMap?: Record<string, string[]>;
  error?: string;
}

/**
 * 從遠端 ICS URL 拉取 + 解析 + 寫入 localStorage 快取。
 * 若失敗,保留舊快取(不要把使用者好不容易設好的東西覆蓋掉)。
 *
 * §A1 (2026-09-08):所有外部 ICS fetch 統一走 /api/external-calendar 後端代理,
 * 避免瀏覽器 CORS 阻擋(Google iCal / iCloud / Outlook 都沒送
 * Access-Control-Allow-Origin,直接從前端 fetch 必失敗)。
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

  // 走後端代理避免瀏覽器 CORS:把外網 URL 編碼後塞到 query param
  const proxyUrl = `/api/external-calendar?url=${encodeURIComponent(trimmed)}`;

  try {
    const res = await fetch(proxyUrl, {
      method: "GET",
      signal: options.signal,
      // 給 ~10s + route 端內建 10s = 給「重新整理全部」一次完整刷新的合理時間
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) {
      // 上游 4xx/5xx 包成 JSON {error}
      let errMsg = `代理 HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) errMsg = body.error;
      } catch {
        // 無法解析時保留原 status 訊息
      }
      return { ok: false, error: errMsg };
    }
    const text = await res.text();
    const events = parseICal(text);
    if (events.length === 0) {
      return { ok: false, error: "ICS 解析失敗或日曆為空 — 請確認這是有效的日曆訂閱連結" };
    }
    const dateCountMap = aggregateByDate(events);
    const shouldStoreTitles = isTaiwanHolidaysUrl(trimmed);
    const dateTitleMap = shouldStoreTitles ? aggregateTitlesByDate(events) : {};
    const all = readExternalCalendars();
    all[trimmed] = {
      dateCountMap,
      ...(shouldStoreTitles ? { dateTitleMap } : {}),
      fetchedAt: Date.now(),
    };
    writeExternalCalendars(all);
    return { ok: true, dateCountMap, ...(shouldStoreTitles ? { dateTitleMap } : {}) };
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

/** 聚合官方台灣公開節日的標題；私人日曆不會產生標題資料。 */
export function mergeExternalCalendarTitles(
  urls: string[],
): Record<string, string[]> {
  const all = readExternalCalendars();
  const merged: Record<string, string[]> = {};
  for (const url of urls) {
    const cached = all[url];
    if (!cached?.dateTitleMap) continue;
    for (const [date, titles] of Object.entries(cached.dateTitleMap)) {
      const existing = merged[date] ?? [];
      merged[date] = [...new Set([...existing, ...titles])];
    }
  }
  return merged;
}