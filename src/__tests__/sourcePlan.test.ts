import { describe, it, expect } from "vitest";
import type { Habit, Task, ThemeDay } from "@/lib/types";
import {
  archivePlanHabits,
  archivePlanTasks,
  collectInstalledPlans,
  isItemPausedByPlan,
  isPlanPaused,
  removePlanThemeDays,
} from "@/lib/sourcePlan";

const PLAN = { id: "plan-3.0", name: "一人公司 3.0" };

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Test Task",
    priority: "do-now",
    status: "todo",
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    tags: [],
    isArchived: false,
    focusMinutes: 0,
    order: 0,
    ...overrides,
  };
}

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    title: "Test Habit",
    frequency: "daily",
    targetCount: 1,
    color: "#4F6AF5",
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    checkins: [],
    streak: 0,
    longestStreak: 0,
    ...overrides,
  };
}

describe("sourcePlan safe uninstall helpers", () => {
  it("collects counts only for active plan items and ignores manual items", () => {
    const tasks: Task[] = [
      makeTask({ id: "t1", sourcePlan: PLAN }),
      makeTask({ id: "t2", status: "done", sourcePlan: PLAN }),
      makeTask({ id: "t3" }),
    ];
    const habits: Habit[] = [
      makeHabit({ id: "h1", sourcePlan: PLAN }),
      makeHabit({ id: "h2", archivedAt: "2026-11-13T00:00:00.000Z", sourcePlan: PLAN }),
      makeHabit({ id: "h3" }),
    ];
    const themeDays: ThemeDay[] = [
      { id: "td1", label: "Vibe Coding", emoji: "💻", weekdays: [1, 3, 5], sourcePlan: PLAN },
      { id: "td2", label: "Custom", emoji: "📝", weekdays: [2] },
    ];

    expect(collectInstalledPlans(tasks, habits, themeDays)).toEqual([
      {
        id: "plan-3.0",
        name: "一人公司 3.0",
        activeTasksCount: 1,
        activeHabitsCount: 1,
        themeDaysCount: 1,
      },
    ]);
  });

  it("archives unfinished plan tasks while keeping done tasks and manual tasks untouched", () => {
    const nowIso = "2026-11-13T12:20:00.000Z";
    const tasks: Task[] = [
      makeTask({ id: "t1", sourcePlan: PLAN }),
      makeTask({ id: "t2", status: "done", sourcePlan: PLAN }),
      makeTask({ id: "t3" }),
    ];

    const { nextTasks, changedTasks } = archivePlanTasks(tasks, "plan-3.0", nowIso);
    expect(changedTasks.map((t) => t.id)).toEqual(["t1"]);
    expect(nextTasks.find((t) => t.id === "t1")?.isArchived).toBe(true);
    expect(nextTasks.find((t) => t.id === "t2")?.isArchived).toBe(false);
    expect(nextTasks.find((t) => t.id === "t3")?.isArchived).toBe(false);
  });

  it("archives active plan habits while preserving checkin history", () => {
    const nowIso = "2026-11-13T12:20:00.000Z";
    const habits: Habit[] = [
      makeHabit({
        id: "h1",
        sourcePlan: PLAN,
        checkins: [{ date: "2026-11-13", completed: true, count: 1 }],
      }),
      makeHabit({ id: "h2" }),
    ];

    const { nextHabits, changedHabits } = archivePlanHabits(habits, "plan-3.0", nowIso);
    expect(changedHabits.map((h) => h.id)).toEqual(["h1"]);
    expect(nextHabits[0].archivedAt).toBe(nowIso);
    expect(nextHabits[0].checkins).toHaveLength(1);
    expect(nextHabits[1].archivedAt).toBeUndefined();
  });

  it("removes only themeDays belonging to the target plan", () => {
    const themeDays: ThemeDay[] = [
      { id: "td1", label: "Vibe Coding", emoji: "💻", weekdays: [1, 3, 5], sourcePlan: PLAN },
      { id: "td2", label: "Custom", emoji: "📝", weekdays: [2] },
    ];
    expect(removePlanThemeDays(themeDays, "plan-3.0")).toEqual([
      { id: "td2", label: "Custom", emoji: "📝", weekdays: [2] },
    ]);
  });
});

describe("sourcePlan 方案休眠判斷", () => {
  const pausedAt = "2026-11-26T10:00:00.000Z";

  it("未休眠：沒有 pausedPlans 紀錄 → false", () => {
    expect(isPlanPaused("plan-3.0", undefined, "2026-11-26")).toBe(false);
    expect(isPlanPaused("plan-3.0", {}, "2026-11-26")).toBe(false);
    expect(isPlanPaused("plan-3.0", { "plan-3.0": undefined as never }, "2026-11-26")).toBe(false);
  });

  it("無喚醒日：pausePlan 後持續休眠", () => {
    const pausedPlans = { "plan-3.0": { pausedAt } };
    expect(isPlanPaused("plan-3.0", pausedPlans, "2026-11-26")).toBe(true);
    expect(isPlanPaused("plan-3.0", pausedPlans, "2027-06-01")).toBe(true);
  });

  it("todayStr < resumeDate 時仍為休眠中", () => {
    const pausedPlans = { "plan-3.0": { pausedAt, resumeDate: "2027-01-01" } };
    expect(isPlanPaused("plan-3.0", pausedPlans, "2026-12-31")).toBe(true);
  });

  it("todayStr === resumeDate 當日自動喚醒 → false", () => {
    const pausedPlans = { "plan-3.0": { pausedAt, resumeDate: "2027-01-01" } };
    expect(isPlanPaused("plan-3.0", pausedPlans, "2027-01-01")).toBe(false);
  });

  it("沒有 sourcePlan 的手動項目永遠 false", () => {
    const pausedPlans = { "plan-3.0": { pausedAt } };
    expect(isItemPausedByPlan({}, pausedPlans, "2026-11-26")).toBe(false);
    expect(isItemPausedByPlan({ sourcePlan: { id: "plan-3.0", name: "一人公司 3.0" } }, pausedPlans, "2026-11-26")).toBe(true);
    expect(isItemPausedByPlan({ sourcePlan: { id: "plan-other", name: "其他" } }, pausedPlans, "2026-11-26")).toBe(false);
  });
});
