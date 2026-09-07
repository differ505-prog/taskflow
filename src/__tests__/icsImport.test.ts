/**
 * icsImport.test.ts — 隱私契約保護:私人 ICS 不保存事件標題。
 *
 * §18d 邊界(2026-09-08):
 *   - 私人 ICS 解析結果的「內容」不應寫入 localStorage
 *   - 只有官方台灣公開節日 URL 才能保留 date → title 對應
 *
 * 對應 commit 的變更:
 *   - ParsedVEVENT 新增 summary
 *   - CachedCalendar 新增 dateTitleMap
 *   - isTaiwanHolidaysUrl / mergeExternalCalendarTitles
 *
 * 這些測試是對「不存儲私人資料」這條隱私契約的最小守護,避免未來被無意改掉。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  }),
};

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", { localStorage: localStorageMock });

/**
 * ICS 取樣(真實台灣官方節日來源的最小邊界樣本):
 *   - 含一條 DTSTART + SUMMARY,模擬「節日名稱」
 *   - 同檔同時含一條 DESCRIPTION 與 TRANSP,確保 parser 不會誤用
 */
const PRIVATE_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:private-1@google.com",
  "DTSTART;VALUE=DATE:20261225",
  "SUMMARY:看牙醫",
  "DESCRIPTION:半年例行檢查",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const TAIWAN_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:tw-1@google.com",
  "DTSTART;VALUE=DATE:20261225",
  "SUMMARY:行憲紀念日",
  "DESCRIPTION:國定假日",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

// 動態載入時替換:避免 ESM 評估時 const hoist 時 TAIWAN_HOLIDAYS_ICS_URL 未定義。
// 直接先用 magic string,確保 beforeEach 在 import 前 mockStore 已存在。
const TAIWAN_HOLIDAYS_ICS_URL =
  "https://calendar.google.com/calendar/ical/zh-tw.taiwan%23holiday%40group.v.calendar.google.com/public/basic.ics";

describe("icsImport privacy contract", () => {
  beforeEach(() => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
    vi.clearAllMocks();
    mockStore["taskflow_external_calendars"] = JSON.stringify({
      [TAIWAN_HOLIDAYS_ICS_URL]: {
        dateCountMap: { "2026-12-25": 1 },
        dateTitleMap: { "2026-12-25": ["行憲紀念日"] },
        fetchedAt: 1700000000000,
      },
      "https://calendar.google.com/calendar/ical/private/basic.ics": {
        dateCountMap: { "2026-12-25": 1 },
        // 模擬「被偷偷持久化的私人事件名稱」 —— 應當被 sanitizer 清掉
        dateTitleMap: { "2026-12-25": ["看牙醫"] },
        fetchedAt: 1700000000000,
      },
    });
  });

  it("私人 ICS URL 在 cache 讀取時被剝除 dateTitleMap", async () => {
    vi.resetModules();
    const { mergeExternalCalendarTitles } = await import("@/lib/icsImport");
    const titles = mergeExternalCalendarTitles([
      "https://calendar.google.com/calendar/ical/private/basic.ics",
    ]);
    expect(titles).toEqual({}); // 私人節點的標題必須被拋棄
  });

  it("官方台灣節日 URL 才允許保留 dateTitleMap", async () => {
    vi.resetModules();
    const { mergeExternalCalendarTitles } = await import("@/lib/icsImport");
    const titles = mergeExternalCalendarTitles([TAIWAN_HOLIDAYS_ICS_URL]);
    expect(titles).toEqual({ "2026-12-25": ["行憲紀念日"] });
  });

  it("parseICal 對私人 ICS 仍會回傳 summary(記憶體層級,不寫盤)", async () => {
    vi.resetModules();
    const { parseICal } = await import("@/lib/icsImport");
    const events = parseICal(PRIVATE_ICS);
    expect(events).toHaveLength(1);
    // summary 保留在解析結果,但 fetchAndCacheExternalCalendar 必須判斷 URL 才決定是否落盤。
    expect(events[0].summary).toBe("看牙醫");
  });

  it("parseICal 能正確讀出官方台灣 ICS 的 SUMMARY", async () => {
    vi.resetModules();
    const { parseICal } = await import("@/lib/icsImport");
    const events = parseICal(TAIWAN_ICS);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("行憲紀念日");
  });

  it("isTaiwanHolidaysUrl 正確判定官方 URL", async () => {
    vi.resetModules();
    const { isTaiwanHolidaysUrl } = await import("@/lib/icsImport");
    expect(isTaiwanHolidaysUrl(TAIWAN_HOLIDAYS_ICS_URL)).toBe(true);
    expect(isTaiwanHolidaysUrl("https://private/calendar.ics")).toBe(false);
    expect(isTaiwanHolidaysUrl(`  ${TAIWAN_HOLIDAYS_ICS_URL}  `)).toBe(true);
  });

  it("readExternalCalendars 對私人 URL 完全不包含 dateTitleMap 鍵", async () => {
    vi.resetModules();
    const { readAllExternalCalendarCaches } = await import("@/lib/icsImport");
    const all = readAllExternalCalendarCaches();
    const privateUrl = "https://calendar.google.com/calendar/ical/private/basic.ics";
    expect(all[TAIWAN_HOLIDAYS_ICS_URL].dateTitleMap).toEqual({
      "2026-12-25": ["行憲紀念日"],
    });
    // 私人 URL 的 dateTitleMap 必須不存在(undefined),不能是空物件也不能保留舊值
    expect(all[privateUrl].dateTitleMap).toBeUndefined();
  });
});
