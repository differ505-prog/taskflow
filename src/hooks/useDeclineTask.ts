"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/AppContext";
import { useProgressStatus } from "@/hooks/useProgressStatus";
import type { Priority, Task } from "@/lib/types";

/** 守住注意力時的標籤（去重） */
export const DECLINED_TAG = "已拒絕";

/** 守住注意力的正向獎勵（PP） */
export const DECLINE_PP = 5;

/** 只有「可委派 / 暫緩」的任務才適用勇敢說不 */
export function canDeclineTask(task: Task): boolean {
  if (!task) return false;
  if (task.isArchived) return false;
  if (task.status === "done") return false;
  const p: Priority = task.priority;
  return p === "delegate" || p === "none";
}

/** 產生「已拒絕 + 封存」的欄位更新（標籤去重） */
export function buildDeclineUpdates(task: Task): Partial<Task> {
  const tags = Array.isArray(task.tags) ? task.tags : [];
  const nextTags = tags.includes(DECLINED_TAG) ? tags : [...tags, DECLINED_TAG];
  return { tags: nextTags, isArchived: true };
}

interface UseDeclineTaskReturn {
  /** 該任務是否可執行「勇敢說不」 */
  canDecline: (task: Task) => boolean;
  /** 執行：加標籤 → 封存 → 給 PP → toast */
  decline: (task: Task, updateTask?: (id: string, updates: Partial<Task>) => void) => void;
}

export function useDeclineTask(): UseDeclineTaskReturn {
  const { updateTask } = useApp();
  const { addPp } = useProgressStatus();

  const canDecline = useCallback((task: Task) => canDeclineTask(task), []);

  const decline = useCallback(
    (
      task: Task,
      updateTaskOverride?: (id: string, updates: Partial<Task>) => void
    ) => {
      if (!task) return;
      const updates = buildDeclineUpdates(task);
      const writer = updateTaskOverride ?? updateTask;
      writer(task.id, updates);
      addPp(DECLINE_PP);
      toast.success("已守住注意力，送進封存 ✓");
    },
    [updateTask, addPp]
  );

  return { canDecline, decline };
}
