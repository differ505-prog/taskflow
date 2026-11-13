import type { Habit, Task, ThemeDay } from "@/lib/types";

export interface PlanSummary {
  id: string;
  name: string;
  activeTasksCount: number;
  activeHabitsCount: number;
  themeDaysCount: number;
}

/** Collect installed sourcePlan groups that still have active tasks, active habits, or themeDays. */
export function collectInstalledPlans(
  tasks: Task[],
  habits: Habit[],
  themeDays: ThemeDay[]
): PlanSummary[] {
  const map = new Map<string, PlanSummary>();

  const ensure = (id: string, name: string): PlanSummary => {
    const existing = map.get(id);
    if (existing) return existing;
    const created: PlanSummary = {
      id,
      name,
      activeTasksCount: 0,
      activeHabitsCount: 0,
      themeDaysCount: 0,
    };
    map.set(id, created);
    return created;
  };

  for (const t of tasks) {
    if (t.isArchived || t.status === "done" || !t.sourcePlan?.id) continue;
    ensure(t.sourcePlan.id, t.sourcePlan.name).activeTasksCount += 1;
  }

  for (const h of habits) {
    if (h.archivedAt || !h.sourcePlan?.id) continue;
    ensure(h.sourcePlan.id, h.sourcePlan.name).activeHabitsCount += 1;
  }

  for (const td of themeDays) {
    if (!td.sourcePlan?.id) continue;
    ensure(td.sourcePlan.id, td.sourcePlan.name).themeDaysCount += 1;
  }

  return Array.from(map.values());
}

/** Archive unfinished, non-archived tasks belonging to `planId` while preserving completed history. */
export function archivePlanTasks(
  tasks: Task[],
  planId: string,
  nowIso: string
): { nextTasks: Task[]; changedTasks: Task[] } {
  const changedTasks: Task[] = [];
  const nextTasks = tasks.map((t) => {
    if (t.sourcePlan?.id === planId && !t.isArchived && t.status !== "done") {
      const archived: Task = { ...t, isArchived: true, updatedAt: nowIso };
      changedTasks.push(archived);
      return archived;
    }
    return t;
  });
  return { nextTasks, changedTasks };
}

/** Archive active habits belonging to `planId` while preserving checkin history. */
export function archivePlanHabits(
  habits: Habit[],
  planId: string,
  nowIso: string
): { nextHabits: Habit[]; changedHabits: Habit[] } {
  const changedHabits: Habit[] = [];
  const nextHabits = habits.map((h) => {
    if (h.sourcePlan?.id === planId && !h.archivedAt) {
      const archived: Habit = { ...h, archivedAt: nowIso, updatedAt: nowIso };
      changedHabits.push(archived);
      return archived;
    }
    return h;
  });
  return { nextHabits, changedHabits };
}

/** Remove theme days belonging to `planId`. */
export function removePlanThemeDays(themeDays: ThemeDay[], planId: string): ThemeDay[] {
  return themeDays.filter((td) => td.sourcePlan?.id !== planId);
}
