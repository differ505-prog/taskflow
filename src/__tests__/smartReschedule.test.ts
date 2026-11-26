import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types";
import {
  isFlexibleOnDate,
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

  it("跨日任務僅在非截止日視為彈性，截止日當天視為硬排程", () => {
    const span = makeTask({
      id: "s1",
      startDate: "2026-11-20",
      dueDate: "2026-11-28",
    });
    expect(isFlexibleOnDate(span, "2026-11-26")).toBe(true);
    expect(isFlexibleOnDate(span, "2026-11-28")).toBe(false);
  });

  it("單日非重複任務視為硬排程", () => {
    const single = makeTask({ id: "t1", dueDate: "2026-11-26" });
    expect(isFlexibleOnDate(single, "2026-11-26")).toBe(false);
  });
});

describe("countHardTasksByDate", () => {
  it("忽略重複任務、跨日中間日與已完成/封存任務", () => {
    const dates = buildDateWindow("2026-11-26", 3);
    const tasks: Task[] = [
      makeTask({ id: "hard-1", dueDate: "2026-11-26" }),
      makeTask({
        id: "rec-1",
        dueDate: "2026-11-26",
        recurrence: { pattern: "daily", interval: 1, completedCount: 0 },
      }),
      makeTask({
        id: "span-1",
        startDate: "2026-11-25",
        dueDate: "2026-11-28",
      }),
      makeTask({ id: "done-1", dueDate: "2026-11-26", status: "done" }),
      makeTask({ id: "arch-1", dueDate: "2026-11-26", isArchived: true }),
    ];

    const counts = countHardTasksByDate(tasks, dates);
    expect(counts["2026-11-26"]).toBe(1);
    expect(counts["2026-11-27"]).toBe(0);
    expect(counts["2026-11-28"]).toBe(1); // span-1 的截止日
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
