/**
 * storage.test.ts — storage helpers smoke tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { generateId, importData, exportTasksToCSV, exportAllData, clearAllData, getLastBackupAt, recordBackupAt, getDaysSinceBackup } from "@/lib/storage";
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

describe("exportAllData", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("taskflow_tasks", JSON.stringify([{ id: "t1", title: "T", status: "todo", priority: "none", createdAt: "0", updatedAt: "0", order: 0, tags: [], isArchived: false, focusMinutes: 0 }]));
    localStorage.setItem("taskflow_lists", JSON.stringify([{ id: "l1", name: "List 1", order: 0, color: "#000" }]));
    localStorage.setItem("taskflow_habits", JSON.stringify([]));
    localStorage.setItem("taskflow_flow_timer", JSON.stringify([]));
    localStorage.setItem("taskflow_tags", JSON.stringify([]));
    localStorage.setItem("taskflow_tag_colors", JSON.stringify({}));
  });

  it("產出包含所有資料類型的 JSON", () => {
    const data = JSON.parse(exportAllData());
    expect(data).toHaveProperty("tasks");
    expect(data).toHaveProperty("lists");
    expect(data).toHaveProperty("habits");
    expect(data).toHaveProperty("flowTimer");
    expect(data).toHaveProperty("tags");
    expect(data).toHaveProperty("tagColors");
    expect(data).toHaveProperty("exportedAt");
  });

  it("tasks 數量正確", () => {
    const data = JSON.parse(exportAllData());
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].title).toBe("T");
  });

  it("exportedAt 為 ISO 字串", () => {
    const data = JSON.parse(exportAllData());
    expect(new Date(data.exportedAt).toISOString()).toBe(data.exportedAt);
  });
});

describe("clearAllData", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("taskflow_tasks", "[]");
    localStorage.setItem("taskflow_lists", "[]");
    localStorage.setItem("taskflow_habits", "[]");
    localStorage.setItem("taskflow_flow_timer", "[]");
    localStorage.setItem("taskflow_tags", "[]");
  });

  it("清除所有任務、清單、習慣資料", () => {
    clearAllData();
    expect(localStorage.getItem("taskflow_tasks")).toBeNull();
    expect(localStorage.getItem("taskflow_lists")).toBeNull();
    expect(localStorage.getItem("taskflow_habits")).toBeNull();
    expect(localStorage.getItem("taskflow_flow_timer")).toBeNull();
    expect(localStorage.getItem("taskflow_tags")).toBeNull();
  });

  it("清除後可正常寫入新資料", () => {
    clearAllData();
    const tasks = [{ id: "new-1", title: "New", status: "todo", priority: "none", createdAt: "0", updatedAt: "0", order: 0, tags: [], isArchived: false, focusMinutes: 0 }];
    localStorage.setItem("taskflow_tasks", JSON.stringify(tasks));
    expect(JSON.parse(localStorage.getItem("taskflow_tasks")!)).toHaveLength(1);
  });
});

describe("backup tracking", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getLastBackupAt 初值為 null", () => {
    expect(getLastBackupAt()).toBeNull();
  });

  it("recordBackupAt 寫入 ISO 時間", () => {
    recordBackupAt();
    const saved = getLastBackupAt();
    expect(saved).not.toBeNull();
    expect(new Date(saved!).toISOString()).toBe(saved);
  });

  it("getDaysSinceBackup 新備份為 0", () => {
    recordBackupAt();
    expect(getDaysSinceBackup()).toBe(0);
  });

  it("getDaysSinceBackup 無備份時回傳 Infinity", () => {
    expect(getDaysSinceBackup()).toBe(Infinity);
  });

  it("getDaysSinceBackup 計算正確（Mock 過去時間）", () => {
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString();
    localStorage.setItem("taskflow_last_backup_at", past);
    expect(getDaysSinceBackup()).toBeGreaterThanOrEqual(5);
  });
});
