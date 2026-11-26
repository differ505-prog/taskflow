import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types";
import {
  isFlexibleOnDate,
  isManualMultiDayTask,
  partitionAndSortDayTasks,
  countHardTasksByDate,
  computeSmartReschedulePlan,
  suggestBestDateForTask,
  buildDateWindow,
} from "@/lib/smartReschedule";

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: "測試任務",
    priority: "delegate",
    status: "todo",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    tags: [],
    isArchived: false,
    focusMinutes: 0,
    order: 0,
    ...overrides,
  };
}

describe("isFlexibleOnDate", () => {
  it("重複任務永遠視為彈性", () => {
    const recurring = makeTask({
      id: "r1",
      dueDate: "2026-11-26",
      recurrence: { pattern: "weekly", interval: 1, completedCount: 0 },
    });
    expect(isFlexibleOnDate(recurring, "2026-11-26")).toBe(true);
  });

  it("模板方案跨日任務全區間（含截止日）皆視為彈性背景", () => {
    const planSpan = makeTask({
      id: "s1",
      startDate: "2026-12-01",
      dueDate: "2026-12-06",
      sourcePlan: { id: "plan-3.1-p0", name: "3.1 階段零" },
    });
    expect(isFlexibleOnDate(planSpan, "2026-12-03")).toBe(true);
    expect(isFlexibleOnDate(planSpan, "2026-12-06")).toBe(true);
    expect(isManualMultiDayTask(planSpan)).toBe(false);
  });

  it("手動建立的跨日任務（無 sourcePlan）每一天皆視為硬排程", () => {
    const manualSpan = makeTask({
      id: "s-manual",
      title: "宜蘭露營",
      startDate: "2026-12-05",
      dueDate: "2026-12-06",
    });
    expect(isFlexibleOnDate(manualSpan, "2026-12-05")).toBe(false);
    expect(isFlexibleOnDate(manualSpan, "2026-12-06")).toBe(false);
    expect(isManualMultiDayTask(manualSpan)).toBe(true);
  });

  it("單日非重複任務視為硬排程", () => {
    const single = makeTask({ id: "t1", dueDate: "2026-11-26" });
    expect(isFlexibleOnDate(single, "2026-11-26")).toBe(false);
  });
});

describe("partitionAndSortDayTasks", () => {
  it("手動跨日永遠排最前，並將重複與模板跨日分到下段", () => {
    const tasks: Task[] = [
      makeTask({
        id: "plan-span",
        title: "【階段零】日常休眠交接",
        startDate: "2026-12-01",
        dueDate: "2026-12-06",
        priority: "do-now",
        sourcePlan: { id: "plan-3.1-p0", name: "3.1 階段零" },
      }),
      makeTask({
        id: "plan-single",
        title: "【階段零】網拍切換",
        dueDate: "2026-12-06",
        priority: "do-now",
        sourcePlan: { id: "plan-3.1-p0", name: "3.1 階段零" },
      }),
      makeTask({
        id: "manual-single",
        title: "繳電費",
        dueDate: "2026-12-06",
        priority: "delegate",
      }),
      makeTask({
        id: "manual-span",
        title: "宜蘭露營",
        startDate: "2026-12-05",
        dueDate: "2026-12-06",
        priority: "delegate",
      }),
      makeTask({
        id: "recurring",
        title: "週度財務盤點",
        dueDate: "2026-12-06",
        recurrence: { pattern: "weekly", interval: 1, completedCount: 0 },
      }),
    ];

    const { hard, flexible } = partitionAndSortDayTasks(tasks, "2026-12-06");
    expect(hard.map((t) => t.id)).toEqual(["manual-span", "manual-single", "plan-single"]);
    expect(flexible.map((t) => t.id)).toEqual(["plan-span", "recurring"]);
  });
});

describe("countHardTasksByDate", () => {
  it("忽略重複任務、模板跨日任務與已完成/封存任務，但保留手動跨日每一天", () => {
    const dates = buildDateWindow("2026-11-26", 3);
    const tasks: Task[] = [
      makeTask({ id: "hard-1", dueDate: "2026-11-26" }),
      makeTask({
        id: "rec-1",
        dueDate: "2026-11-26",
        recurrence: { pattern: "daily", interval: 1, completedCount: 0 },
      }),
      makeTask({
        id: "plan-span-1",
        startDate: "2026-11-25",
        dueDate: "2026-11-28",
        sourcePlan: { id: "plan-3.1-p0", name: "3.1 階段零" },
      }),
      makeTask({
        id: "manual-span-1",
        startDate: "2026-11-27",
        dueDate: "2026-11-28",
      }),
      makeTask({ id: "done-1", dueDate: "2026-11-26", status: "done" }),
      makeTask({ id: "arch-1", dueDate: "2026-11-26", isArchived: true }),
    ];

    const counts = countHardTasksByDate(tasks, dates);
    expect(counts["2026-11-26"]).toBe(1);
    expect(counts["2026-11-27"]).toBe(1); // manual-span-1 首日保留為硬排程
    expect(counts["2026-11-28"]).toBe(1); // 僅 manual-span-1，plan-span-1 不再計入硬排程
  });
});

describe("computeSmartReschedulePlan", () => {
  it("避開已滿的今天，將過期任務平均攤平到本週最空日", () => {
    const today = "2026-11-26";
    const existing: Task[] = [
      makeTask({ id: "e1", dueDate: "2026-11-26" }),
      makeTask({ id: "e2", dueDate: "2026-11-26" }),
      makeTask({ id: "e3", dueDate: "2026-11-26" }), // 今天已達 3 件上限
      makeTask({ id: "e4", dueDate: "2026-11-27" }), // 明天 1 件
    ];
    const overdue: Task[] = [
      makeTask({ id: "o1", dueDate: "2026-11-20", priority: "do-now" }),
      makeTask({ id: "o2", dueDate: "2026-11-21", priority: "schedule" }),
    ];

    const plan = computeSmartReschedulePlan(overdue, [...existing, ...overdue], today, {
      dailyCap: 3,
    });

    expect(plan).toHaveLength(2);
    // 優先挑最空的 11/28（0 件）與 11/29（0 件），不會塞進已滿的 11/26
    expect(plan[0].task.id).toBe("o1");
    expect(plan[0].targetDate).toBe("2026-11-28");
    expect(plan[0].existingLoadBefore).toBe(0);
    expect(plan[1].task.id).toBe("o2");
    expect(plan[1].targetDate).toBe("2026-11-29");
  });

  it("前 7 天皆達上限時，自動延展至第 8–14 天", () => {
    const today = "2026-11-26";
    const weekDates = buildDateWindow(today, 7);
    const existing: Task[] = weekDates.flatMap((d, idx) => [
      makeTask({ id: `f-${idx}-1`, dueDate: d }),
      makeTask({ id: `f-${idx}-2`, dueDate: d }),
      makeTask({ id: `f-${idx}-3`, dueDate: d }),
    ]);
    const overdue = makeTask({ id: "o1", dueDate: "2026-11-20" });

    const suggestion = suggestBestDateForTask(overdue, [...existing, overdue], today, {
      dailyCap: 3,
    });

    expect(suggestion.targetDate).toBe("2026-12-03"); // 第 8 天
    expect(suggestion.existingLoadBefore).toBe(0);
  });

  it("保留跨日過期任務的區間長度", () => {
    const today = "2026-11-26";
    const spanOverdue = makeTask({
      id: "span-o",
      startDate: "2026-11-18",
      dueDate: "2026-11-20", // 2 天區間
    });
    const suggestion = suggestBestDateForTask(spanOverdue, [spanOverdue], today);
    expect(suggestion.targetDate).toBe("2026-11-26");
    expect(suggestion.newStartDate).toBe("2026-11-24");
  });
});
