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
  isUnscheduledTask,
  computeSelectedSmartSchedulePlan,
  formatShortDateLabel,
  formatTaskScheduleChip,
  partitionInboxActiveTasks,
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
  it("避開已滿的今天，將過期任務近端優先填滿到每日上限後再往後排", () => {
    const today = "2026-11-26";
    const existing: Task[] = [
      makeTask({ id: "e1", dueDate: "2026-11-26" }),
      makeTask({ id: "e2", dueDate: "2026-11-26" }),
      makeTask({ id: "e3", dueDate: "2026-11-26" }), // 今天已達 3 件上限
      makeTask({ id: "e4", dueDate: "2026-11-27" }), // 明天 1 件，還可排 2 件
    ];
    const overdue: Task[] = [
      makeTask({ id: "o1", dueDate: "2026-11-20", priority: "do-now" }),
      makeTask({ id: "o2", dueDate: "2026-11-21", priority: "schedule" }),
      makeTask({ id: "o3", dueDate: "2026-11-22", priority: "delegate" }),
    ];

    const plan = computeSmartReschedulePlan(overdue, [...existing, ...overdue], today, {
      dailyCap: 3,
    });

    expect(plan).toHaveLength(3);
    // 11/26 已滿 3 件跳過；11/27 原 1 件先填滿到 3 件，第 3 筆溢流到 11/28
    expect(plan[0].task.id).toBe("o1");
    expect(plan[0].targetDate).toBe("2026-11-27");
    expect(plan[0].existingLoadBefore).toBe(1);
    expect(plan[1].task.id).toBe("o2");
    expect(plan[1].targetDate).toBe("2026-11-27");
    expect(plan[2].task.id).toBe("o3");
    expect(plan[2].targetDate).toBe("2026-11-28");
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

  it("依 customOrderIds（Tap-to-Rank）優先填滿最早日，超過上限才順延", () => {
    const today = "2026-11-26";
    const overdue: Task[] = [
      makeTask({ id: "t1", title: "一般任務 A", dueDate: "2026-11-20", priority: "do-now" }),
      makeTask({ id: "t2", title: "一般任務 B", dueDate: "2026-11-21", priority: "delegate" }),
      makeTask({ id: "t3", title: "一般任務 C", dueDate: "2026-11-22", priority: "none" }),
    ];

    // 設每日上限 2 件：先點 t3、再點 t2 搶先填滿今天，未點的 t1 順延到明天
    const plan = computeSmartReschedulePlan(overdue, overdue, today, {
      dailyCap: 2,
      customOrderIds: ["t3", "t2"],
    });

    expect(plan.map((p) => p.task.id)).toEqual(["t3", "t2", "t1"]);
    expect(plan[0].targetDate).toBe("2026-11-26");
    expect(plan[1].targetDate).toBe("2026-11-26");
    expect(plan[2].targetDate).toBe("2026-11-27");
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

describe("isUnscheduledTask", () => {
  it("未完成、未封存、頂層且無任何日期的任務視為未排期", () => {
    const t = makeTask({ id: "u1" });
    expect(isUnscheduledTask(t)).toBe(true);
  });

  it("有截止日、有起始日、已完成、已封存或有父任務皆視為已排期", () => {
    expect(isUnscheduledTask(makeTask({ id: "u2", dueDate: "2026-11-29" }))).toBe(false);
    expect(isUnscheduledTask(makeTask({ id: "u3", startDate: "2026-11-29" }))).toBe(false);
    expect(isUnscheduledTask(makeTask({ id: "u4", status: "done" }))).toBe(false);
    expect(isUnscheduledTask(makeTask({ id: "u5", isArchived: true }))).toBe(false);
    expect(isUnscheduledTask(makeTask({ id: "u6", parentId: "p1" }))).toBe(false);
  });
});

describe("computeSelectedSmartSchedulePlan", () => {
  it("selectedIds 為空時零排程，即使候選清單有任務", () => {
    const today = "2026-11-26";
    const candidates = [
      makeTask({ id: "c1", title: "未排期 A" }),
      makeTask({ id: "c2", title: "未排期 B" }),
      makeTask({ id: "c3", title: "未排期 C" }),
    ];
    expect(computeSelectedSmartSchedulePlan([], candidates, candidates, today)).toEqual([]);
  });

  it("只為點選的任務排程，並依點選順序填滿每日上限", () => {
    const today = "2026-11-26";
    const candidates = [
      makeTask({ id: "c1", title: "未排期 A" }),
      makeTask({ id: "c2", title: "未排期 B" }),
      makeTask({ id: "c3", title: "未排期 C" }),
    ];

    const plan = computeSelectedSmartSchedulePlan(
      ["c3", "c1"],
      candidates,
      candidates,
      today,
      { dailyCap: 2 }
    );

    expect(plan.map((p) => p.task.id)).toEqual(["c3", "c1"]);
    expect(plan[0].targetDate).toBe("2026-11-26");
    expect(plan[1].targetDate).toBe("2026-11-26");
    // 未被點選的 c2 不出現在結果中
    expect(plan.find((p) => p.task.id === "c2")).toBeUndefined();
  });

  it("會計入 allTasks 既有的硬排程負載，今天已滿時自動從隔日開始排入", () => {
    const today = "2026-11-26";
    const existing: Task[] = [
      makeTask({ id: "e1", dueDate: "2026-11-26" }),
      makeTask({ id: "e2", dueDate: "2026-11-26" }),
      makeTask({ id: "e3", dueDate: "2026-11-26" }), // 今天已達上限 3 件
    ];
    const candidates = [makeTask({ id: "c1", title: "未排期 A" })];

    const plan = computeSelectedSmartSchedulePlan(["c1"], candidates, [...existing, ...candidates], today, {
      dailyCap: 3,
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].targetDate).toBe("2026-11-27");
    expect(plan[0].existingLoadBefore).toBe(0);
  });
});

describe("formatShortDateLabel", () => {
  it("今天顯示「今天」，其他日期顯示 M/d 與星期", () => {
    expect(formatShortDateLabel("2026-11-26", "2026-11-26")).toBe("今天");
    expect(formatShortDateLabel("2026-11-29", "2026-11-26")).toContain("11/29");
  });
});

describe("formatTaskScheduleChip", () => {
  const today = "2026-11-26";

  it("無任何日期時回傳 null", () => {
    expect(formatTaskScheduleChip({}, today)).toBeNull();
    expect(formatTaskScheduleChip({ dueTime: "14:00" }, today)).toBeNull();
  });

  it("單日不含 dueTime 時只顯示日期短標籤", () => {
    expect(formatTaskScheduleChip({ dueDate: "2026-11-29" }, today)).toBe(
      formatShortDateLabel("2026-11-29", today)
    );
    expect(formatTaskScheduleChip({ startDate: "2026-11-29" }, today)).toBe(
      formatShortDateLabel("2026-11-29", today)
    );
  });

  it("單日含 dueTime 時附加時間", () => {
    const label = formatTaskScheduleChip({ dueDate: "2026-11-29", dueTime: "14:00" }, today);
    expect(label).toBe(`${formatShortDateLabel("2026-11-29", today)} 14:00`);
  });

  it("今天顯示「今天」而非日期", () => {
    expect(formatTaskScheduleChip({ dueDate: today }, today)).toBe("今天");
    expect(formatTaskScheduleChip({ dueDate: today, dueTime: "09:30" }, today)).toBe("今天 09:30");
  });

  it("跨日區間回傳「起 – 迄」", () => {
    const label = formatTaskScheduleChip(
      { startDate: "2026-11-27", dueDate: "2026-11-30" },
      today
    );
    expect(label).toBe(
      `${formatShortDateLabel("2026-11-27", today)} – ${formatShortDateLabel("2026-11-30", today)}`
    );
  });
});

describe("partitionInboxActiveTasks", () => {
  it("嚴格守恆：無日期進 unscheduled，有日期進 scheduled，原順序保留", () => {
    const tasks: Task[] = [
      makeTask({ id: "p1", title: "無日期 A" }),
      makeTask({ id: "p2", title: "有截止日 B", dueDate: "2026-11-29" }),
      makeTask({ id: "p3", title: "有起始日 C", startDate: "2026-11-28" }),
      makeTask({ id: "p4", title: "無日期 D" }),
      makeTask({ id: "p5", title: "跨日 E", startDate: "2026-11-27", dueDate: "2026-11-29" }),
    ];

    const { unscheduled, scheduled } = partitionInboxActiveTasks(tasks);

    expect(unscheduled.map((t) => t.id)).toEqual(["p1", "p4"]);
    expect(scheduled.map((t) => t.id)).toEqual(["p2", "p3", "p5"]);

    // 零遺漏、零重複
    expect(unscheduled.length + scheduled.length).toBe(tasks.length);
    const ids = [...unscheduled, ...scheduled].map((t) => t.id);
    expect(new Set(ids).size).toBe(tasks.length);
  });

  it("空陣列時兩段皆為空", () => {
    const { unscheduled, scheduled } = partitionInboxActiveTasks([]);
    expect(unscheduled).toEqual([]);
    expect(scheduled).toEqual([]);
  });
});
