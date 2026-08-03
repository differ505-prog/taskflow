import { describe, it, expect } from "vitest";
import { generateICal } from "@/lib/ical";
import type { Task } from "@/lib/types";

/**
 * iCal generator round-trip 測試 — RFC 5545 關鍵規則
 *
 * 為什麼重要:產生出的 .ics 會被 Google Calendar / Apple Calendar 匯入,
 * 任何 RFC 違規 = 使用者事件看不到或匯入失敗。
 *
 * 涵蓋規則:
 * 1. CRLF 行尾
 * 2. VEVENT block 結構正確
 * 3. all-day event DTEND 必須是 DTSTART + 1 day (exclusive)
 * 4. timed event DTSTART/DTEND 必須有 HHmmss
 * 5. ESC 處理:title 中的 `;` `,` `\` 換行 必須正確 escape
 * 6. STATUS:COMPLETED + COMPLETED timestamp 對已 done 任務
 * 7. STATUS:CONFIRMED + TRANSP:OPAQUE 對 active 任務
 * 8. archive 過濾:isArchived=true 應被排除
 * 9. 無 dueDate 應被排除
 */

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "買牛奶",
  priority: "none",
  status: "todo",
  createdAt: "2026-08-04T10:00:00.000Z",
  updatedAt: "2026-08-04T10:00:00.000Z",
  tags: [],
  isArchived: false,
  focusMinutes: 0,
  order: 0,
  ...overrides,
});

describe("generateICal (RFC 5545 規則)", () => {
  it("基本結構:VCALENDAR 包 VEVENT + END:VCALENDAR", () => {
    const ics = generateICal([makeTask({ dueDate: "2026-08-05" })], "MyList");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("X-WR-CALNAME:MyList");
  });

  it("行尾必須是 CRLF (\\r\\n)", () => {
    const ics = generateICal([makeTask({ dueDate: "2026-08-05" })]);
    expect(ics).toContain("\r\n");
    // 確認沒有 standalone LF (排除 CRLF 內的)
    const lines = ics.split("\r\n");
    for (const line of lines) {
      expect(line).not.toContain("\n");
    }
  });

  it("all-day event:DTEND 必須是 DTSTART + 1 day (RFC 5545 §3.6.1)", () => {
    const ics = generateICal([
      makeTask({ dueDate: "2026-08-05", startDate: "2026-08-01" }),
    ]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260801");
    expect(ics).toContain("DTEND;VALUE=DATE:20260806"); // +1 day
  });

  it("all-day event:無 startDate 時,DTSTART = dueDate", () => {
    const ics = generateICal([makeTask({ dueDate: "2026-08-05" })]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260805");
    expect(ics).toContain("DTEND;VALUE=DATE:20260806");
  });

  it("timed event:帶 dueTime 時必須用 DTSTART:YYYYMMDDTHHmmss (floating local)", () => {
    const ics = generateICal([
      makeTask({ dueDate: "2026-08-05", dueTime: "14:30" }),
    ]);
    expect(ics).toMatch(/DTSTART:20260805T143000/);
    expect(ics).toMatch(/DTEND:20260805T153000/); // +1h
  });

  it("DTSTAMP/CREATED/LAST-MODIFIED 必須帶 Z (UTC)", () => {
    const ics = generateICal([
      makeTask({ createdAt: "2026-08-04T10:00:00.000Z", dueDate: "2026-08-05" }),
    ]);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(ics).toMatch(/CREATED:\d{8}T\d{6}Z/);
    expect(ics).toMatch(/LAST-MODIFIED:\d{8}T\d{6}Z/);
  });

  it("title 中的分號必須 escape (\\;)", () => {
    const ics = generateICal([
      makeTask({ title: "買牛奶;豆漿", dueDate: "2026-08-05" }),
    ]);
    expect(ics).toContain("SUMMARY:買牛奶\\;豆漿");
    // 不可有未 escape 的 ;
    expect(ics).not.toContain("SUMMARY:買牛奶;豆漿");
  });

  it("title 中的逗號必須 escape (\\,)", () => {
    const ics = generateICal([
      makeTask({ title: "買牛奶,豆漿", dueDate: "2026-08-05" }),
    ]);
    expect(ics).toContain("SUMMARY:買牛奶\\,豆漿");
  });

  it("title 中的反斜線必須 escape (\\\\)", () => {
    const ics = generateICal([
      makeTask({ title: "path\\to\\file", dueDate: "2026-08-05" }),
    ]);
    expect(ics).toContain("SUMMARY:path\\\\to\\\\file");
  });

  it("description 中的換行必須 escape (\\n)", () => {
    const ics = generateICal([
      makeTask({
        title: "task",
        description: "line1\nline2",
        dueDate: "2026-08-05",
      }),
    ]);
    expect(ics).toContain("DESCRIPTION:line1\\nline2");
  });

  it("已 done 任務:STATUS:COMPLETED + COMPLETED timestamp", () => {
    const ics = generateICal([
      makeTask({ status: "done", dueDate: "2026-08-05" }),
    ]);
    expect(ics).toContain("STATUS:COMPLETED");
    expect(ics).toMatch(/COMPLETED:\d{8}T\d{6}Z/);
    expect(ics).not.toContain("STATUS:CONFIRMED");
  });

  it("active 任務:STATUS:CONFIRMED + TRANSP:OPAQUE", () => {
    const ics = generateICal([makeTask({ dueDate: "2026-08-05" })]);
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("TRANSP:OPAQUE");
    expect(ics).not.toContain("STATUS:COMPLETED");
  });

  it("priority 對應 RFC 5545 (do-now=1, schedule=3, none=9, delegate 省略)", () => {
    const ics1 = generateICal([makeTask({ priority: "do-now", dueDate: "2026-08-05" })]);
    expect(ics1).toContain("PRIORITY:1");
    const ics2 = generateICal([makeTask({ priority: "schedule", dueDate: "2026-08-05" })]);
    expect(ics2).toContain("PRIORITY:3");
    const ics3 = generateICal([makeTask({ priority: "none", dueDate: "2026-08-05" })]);
    expect(ics3).toContain("PRIORITY:9");
    const ics4 = generateICal([makeTask({ priority: "delegate", dueDate: "2026-08-05" })]);
    expect(ics4).not.toContain("PRIORITY:"); // delegate 省略
  });

  it("archived 任務必須被排除", () => {
    const ics = generateICal([
      makeTask({ id: "active", dueDate: "2026-08-05" }),
      makeTask({ id: "archived", isArchived: true, dueDate: "2026-08-05" }),
    ]);
    expect(ics).toContain("X-VIBELIST-ID:active");
    expect(ics).not.toContain("X-VIBELIST-ID:archived");
  });

  it("無 dueDate 任務必須被排除", () => {
    const ics = generateICal([
      makeTask({ id: "with-date", dueDate: "2026-08-05" }),
      makeTask({ id: "no-date" }),
    ]);
    expect(ics).toContain("X-VIBELIST-ID:with-date");
    expect(ics).not.toContain("X-VIBELIST-ID:no-date");
  });

  it("tags 必須 escape + CATEGORIES 行格式", () => {
    const ics = generateICal([
      makeTask({ tags: ["urgent", "工作"], dueDate: "2026-08-05" }),
    ]);
    expect(ics).toContain("CATEGORIES:urgent,工作");
  });

  it("空 list:VCALENDAR 仍正確,沒有 VEVENT", () => {
    const ics = generateICal([], "EmptyList");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).toContain("X-WR-CALNAME:EmptyList");
  });

  it("listName 中的特殊字元必須 escape", () => {
    const ics = generateICal([], "My,List;Test");
    expect(ics).toContain("X-WR-CALNAME:My\\,List\\;Test");
  });
});
