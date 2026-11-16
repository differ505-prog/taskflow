import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types";
import { DEFAULT_RHYTHM_SETTINGS } from "@/lib/types";
import { buildDaySlots } from "@/lib/daySlots";
import {
  assignTaskToSlot,
  formatTaskTimeRange,
  groupTasksBySlot,
  groupUnassignedTasks,
  parseTaskTime,
  sortSlotTasks,
  taskEndMinutes,
} from "@/lib/taskSlots";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "買牛奶",
  priority: "none",
  status: "todo",
  createdAt: "2026-11-16T08:00:00.000Z",
  updatedAt: "2026-11-16T08:00:00.000Z",
  tags: [],
  isArchived: false,
  focusMinutes: 0,
  order: 0,
  ...overrides,
});

const SLOTS = buildDaySlots(DEFAULT_RHYTHM_SETTINGS);

describe("taskSlots — 任務歸槽與時間區間", () => {
  it("parseTaskTime 解析 HH:mm", () => {
    expect(parseTaskTime(makeTask({ dueTime: "09:30" }))).toBe(570);
  });

  it("parseTaskTime 對非兩位數小時回 null", () => {
    expect(parseTaskTime(makeTask({ dueTime: "9:30" }))).toBeNull();
  });

  it("parseTaskTime 對缺 dueTime 回 null", () => {
    expect(parseTaskTime(makeTask())).toBeNull();
  });

  it("taskEndMinutes 由 durationMinutes 推導結束時間", () => {
    expect(taskEndMinutes(makeTask({ dueTime: "09:30", durationMinutes: 60 }))).toBe(630);
  });

  it("taskEndMinutes 對 duration 為 0 或缺值回 null（不假造結束時間）", () => {
    expect(taskEndMinutes(makeTask({ dueTime: "09:30", durationMinutes: 0 }))).toBeNull();
    expect(taskEndMinutes(makeTask({ dueTime: "09:30" }))).toBeNull();
  });

  it("assignTaskToSlot 把 09:30 的任務放進第一槽", () => {
    const result = assignTaskToSlot(makeTask({ dueTime: "09:30" }), SLOTS);
    expect(result.slotIndex).toBe(0);
  });

  it("assignTaskToSlot 對槽範圍外的時間回 -1", () => {
    const result = assignTaskToSlot(makeTask({ dueTime: "03:00" }), SLOTS);
    expect(result.slotIndex).toBe(-1);
  });

  it("groupTasksBySlot 回傳陣列長度等於槽數，且總數守恆", () => {
    const tasks = [
      makeTask({ id: "a", dueTime: "09:30" }),
      makeTask({ id: "b", dueTime: "13:00" }),
      makeTask({ id: "c", dueTime: "03:00" }),
    ];
    const groups = groupTasksBySlot(tasks, SLOTS);
    expect(groups).toHaveLength(SLOTS.length);
    const inSlots = groups.reduce((sum, g) => sum + g.length, 0);
    const unassigned = groupUnassignedTasks(tasks, SLOTS);
    expect(inSlots + unassigned.length).toBe(tasks.length);
  });

  it("sortSlotTasks：早的時間先排，同時間依 order 升序", () => {
    const list = [
      { task: makeTask({ id: "late", dueTime: "15:00", order: 1 }), slotIndex: 0, startMin: 900, endMin: null },
      { task: makeTask({ id: "early", dueTime: "09:00", order: 5 }), slotIndex: 0, startMin: 540, endMin: null },
      { task: makeTask({ id: "same-b", dueTime: "10:00", order: 3 }), slotIndex: 0, startMin: 600, endMin: null },
      { task: makeTask({ id: "same-a", dueTime: "10:00", order: 2 }), slotIndex: 0, startMin: 600, endMin: null },
    ];
    const sorted = sortSlotTasks(list);
    expect(sorted.map((a) => a.task.id)).toEqual(["early", "same-a", "same-b", "late"]);
  });

  it("formatTaskTimeRange：無 dueTime 回空字串", () => {
    expect(formatTaskTimeRange(makeTask())).toBe("");
  });

  it("formatTaskTimeRange：有 dueTime 無 duration 只顯示開始時刻", () => {
    expect(formatTaskTimeRange(makeTask({ dueTime: "09:30" }))).toBe("09:30");
  });

  it("formatTaskTimeRange：有 duration 顯示完整區間", () => {
    expect(formatTaskTimeRange(makeTask({ dueTime: "09:30", durationMinutes: 60 }))).toBe(
      "09:30 – 10:30"
    );
  });
});
