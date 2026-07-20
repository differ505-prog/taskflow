"use client";

/**
 * useTagRename — 標籤全域重新命名 Hook
 *
 * 功能：
 * - 呼叫 /api/tags/rename 批次更新 Supabase 中所有任務的標籤
 * - 同步更新 localStorage 中的任務
 * - Free 用戶被 API 守衛擋下（由後端 RLS 控制）
 *
 * 用法：
 *   const { renameTag, isLoading, error } = useTagRename();
 *   await renameTag("work", "工作", tasks, setTasks, tagColors, setTagColors);
 */
import { useState, useCallback } from "react";
import { Task } from "./types";
import { saveTasks, saveTagColors } from "./storage";

export interface UseTagRenameReturn {
  renameTag: (args: RenameTagArgs) => Promise<{ success: boolean; updatedCount?: number; error?: string }>;
  isLoading: boolean;
  error: string | null;
}

export interface RenameTagArgs {
  oldName: string;
  newName: string;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  tagColors: Record<string, string>;
  setTagColors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function useTagRename(): UseTagRenameReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renameTag = useCallback(async ({
    oldName,
    newName,
    tasks,
    setTasks,
    tagColors,
    setTagColors,
  }: RenameTagArgs): Promise<{ success: boolean; updatedCount?: number; error?: string }> => {
    if (oldName === newName || !oldName || !newName) {
      return { success: false, error: "名稱無變化" };
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. 更新 Supabase（跨設備同步）
      const res = await fetch("/api/tags/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Free 用戶會被後端擋下
        return { success: false, error: data.error || "重新命名失敗" };
      }

      // 2. 更新本地 state + localStorage（立即反映到 UI）
      const existingColor = tagColors[oldName];
      if (existingColor && !tagColors[newName]) {
        const newColors = { ...tagColors };
        delete newColors[oldName];
        newColors[newName] = existingColor;
        setTagColors(newColors);
        saveTagColors(newColors);
      }

      const updated = tasks.map((task) => ({
        ...task,
        tags: task.tags.map((t) => (t === oldName ? newName : t)),
        updatedAt: new Date().toISOString(),
      }));
      setTasks(updated);
      saveTasks(updated);

      return { success: true, updatedCount: data.updatedCount ?? 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "重新命名失敗";
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { renameTag, isLoading, error };
}
