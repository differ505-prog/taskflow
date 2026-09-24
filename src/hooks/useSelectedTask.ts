import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { Task } from "@/lib/types";
import type { SharedListData } from "@/lib/storage";

export function findTaskById(
  id: string | null,
  tasks: Task[],
  sharedLists: Record<string, SharedListData>
): Task | null {
  if (!id) return null;
  const local = tasks.find((t) => t.id === id);
  if (local) return local;
  for (const listData of Object.values(sharedLists)) {
    const found = listData.tasks.find((t) => t.id === id);
    if (found) return found;
  }
  return null;
}

/**
 * Hook that returns the currently selected task, always fresh from the store.
 * Prefer this over passing `task: Task` as a prop, which can become stale.
 * If taskId is provided, returns that specific task; otherwise uses app.selectedTaskId.
 */
export function useSelectedTask(taskId?: string | null): Task | null {
  const app = useApp();
  const targetId = taskId !== undefined ? taskId : app.selectedTaskId;
  return useMemo(
    () => findTaskById(targetId ?? null, app.tasks, app.sharedLists ?? {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetId, app.tasks, app.sharedLists]
  );
}
