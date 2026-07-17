"use client";

/**
 * 子任務摺疊狀態 hook
 *
 * 設計：
 * - 預設展開（首次載入 task，子任務區塊展開）
 * - 用戶手動點 chevron → 切換 + 持久化到 localStorage
 * - 全部子任務完成（≥1 且全 done）→ 3 秒後自動摺疊 + 顯示「✓ 全部完成」慶祝標記
 * - 用戶手動展開後，自動摺疊不覆蓋手動選擇（除非再次達成「全部完成」條件）
 *
 * 持久化 schema：
 * - key: `subtask-collapse:v1:${userScope}`
 * - value: Record<taskId, "expanded" | "collapsed">
 * - "auto-done" 是 runtime 暫態，不寫 localStorage（重新整理後回歸 expanded）
 *
 * 為什麼不存 Task model：摺疊屬於「視圖偏好」而非「任務資料」，
 * 跨設備同步優先級低、且任務資料越輕越好（Supabase Realtime 帶寬成本）
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { SubTask } from "@/lib/types";

export type CollapsePreference = "expanded" | "collapsed";
export type CollapseState = CollapsePreference | "auto-done";

const STORAGE_PREFIX = "subtask-collapse:v1:";
const AUTO_COLLAPSE_DELAY_MS = 3000;

function getStorageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope}`;
}

function loadFromStorage(scope: string): Record<string, CollapsePreference> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(getStorageKey(scope));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    // sanitize: 只保留合法值
    const out: Record<string, CollapsePreference> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === "expanded" || v === "collapsed") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function saveToStorage(scope: string, map: Record<string, CollapsePreference>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(scope), JSON.stringify(map));
  } catch {
    // localStorage 寫入失敗（quota / private mode）→ 靜默忽略
  }
}

/**
 * @param taskId 任務 id
 * @param subTasks 子任務陣列
 * @param scope 用戶 scope（通常 = user.uid 或 "anon"）
 */
export function useSubTaskCollapse(
  taskId: string,
  subTasks: SubTask[],
  scope: string = "anon",
) {
  const [prefs, setPrefs] = useState<Record<string, CollapsePreference>>({});
  const [hydrated, setHydrated] = useState(false);
  const [autoCollapsing, setAutoCollapsing] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevAllDoneRef = useRef<boolean>(false);

  // Hydrate from localStorage
  useEffect(() => {
    setPrefs(loadFromStorage(scope));
    setHydrated(true);
  }, [scope]);

  const pref: CollapsePreference = prefs[taskId] ?? "expanded";

  const allDone =
    subTasks.length > 0 && subTasks.every((s) => s.status === "done");

  // Auto-collapse: 當所有子任務完成時，3 秒後自動切到 collapsed（顯示慶祝條）
  useEffect(() => {
    // 僅在 hydrated 後才判斷，避免初次 render 誤觸發
    if (!hydrated) return;

    const wasAllDone = prevAllDoneRef.current;
    prevAllDoneRef.current = allDone;

    // 進入「全部完成」狀態（之前沒完成、現在完成了）
    if (allDone && !wasAllDone) {
      // 如果用戶已手動設為 collapsed，不要覆蓋（已展開看不到 → 重置為 expanded 讓用戶看到慶祝）
      if (pref === "collapsed") return;
      setAutoCollapsing(true);
      autoTimerRef.current = setTimeout(() => {
        setPrefs((prev) => ({ ...prev, [taskId]: "collapsed" }));
        setAutoCollapsing(false);
      }, AUTO_COLLAPSE_DELAY_MS);
    }

    // 從「全部完成」變回未完成（用戶取消勾選）→ 回到 expanded
    if (!allDone && wasAllDone) {
      setAutoCollapsing(false);
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      // 若目前是 collapsed 且是 auto-done 造成的（用戶沒手動設）→ 展開
      // 判斷方式：localStorage 沒記錄時，pref 預設 expanded；
      // 若 localStorage 記為 collapsed 但沒 auto-collapsed 標記（無法區分）→ 保守不動
      // 簡化：讓 user 重新點 chevron
    }

    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [allDone, hydrated, taskId, pref]);

  const toggle = useCallback(() => {
    setPrefs((prev) => {
      const current: CollapsePreference = prev[taskId] ?? "expanded";
      const next: CollapsePreference = current === "expanded" ? "collapsed" : "expanded";
      const nextMap = { ...prev, [taskId]: next };
      saveToStorage(scope, nextMap);
      return nextMap;
    });
    // 手動切換時，取消任何 pending auto-collapse
    setAutoCollapsing(false);
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, [scope, taskId]);

  // 對外暴露 isCollapsed + isAutoCollapsing
  // hydrated=false 時一律視為 expanded（SSR safe + 避免 flash）
  const isCollapsed = hydrated && pref === "collapsed";

  return {
    isCollapsed,
    isAutoCollapsing: autoCollapsing,
    toggle,
    pref,
    allDone,
  };
}