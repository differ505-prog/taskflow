/**
 * storage.test.ts — storage helpers smoke tests
 */
import { describe, it, expect } from "vitest";
import { generateId, importData, exportTasksToCSV } from "@/lib/storage";
import type { Task } from "@/lib/types";

describe("generateId", () => {
  it("每次呼叫不同", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("格式包含 timestamp 和 random", () => {
    const id = generateId();
    expect(id).toMatch(/^\d+-[a-z0-9]+$/);
  });
});

describe("importData", () => {
  it("有效 JSON 解析正確", () => {
    const json = JSON.stringify({
      tasks: [{ title: "Task 1", status: "todo" }],
      habits: [],
      lists: [],
    });
    const result = importData(json, [], [], []);
    expect(result.success).toBe(true);
    expect(result.tasks).toBe(1);
  });

  it("無效 JSON 回傳 errors", () => {
    const result = importData("not json {{{", [], [], []);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("缺少標題的任務不計入", () => {
    const json = JSON.stringify({
      tasks: [{ title: "" }, { title: "Valid Task" }],
      habits: [],
      lists: [],
    });
    const result = importData(json, [], [], []);
    expect(result.tasks).toBe(1);
    expect(result.errors).toContainEqual(expect.stringContaining("任務 1"));
  });
});

describe("exportTasksToCSV", () => {
  it("產生合法 CSV（含 header）", () => {
    const tasks: Task[] = [
      {
        id: "t1",
        title: "Test, with comma",
        status: "todo",
        priority: "none",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        order: 0,
        tags: [],
        isArchived: false,
        focusMinutes: 0,
      },
    ];
    const csv = exportTasksToCSV(tasks);
    expect(csv).toContain("標題");
    expect(csv).toContain("Test, with comma");
  });
});
