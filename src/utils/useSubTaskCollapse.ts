"use client";

/**
 * 已完成子任務摺疊狀態 hook
 *
 * 設計：
 * - 預設摺疊（首次載入 task，已完成子任務群組收起來）
 * - 用戶手動點 chevron → 切換 + 持久化到 localStorage
 * - 當某子任務剛被標記為 done 時，自動摺疊（讓焦點回到未完成項）
 * - 未完成子任務永遠展開（不參與摺疊狀態）
 *
 * 持久化 schema：
 * - key: `subtask-collapse:v1:${userScope}`
 * - value: Record<taskId, "expanded" | "collapsed">
 *
 * 為什麼不存 Task model：摺疊屬於「視圖偏好」而非「任務資料」，
 * 跨設備同步優先級低、且任務資料越輕越好（Supabase Realtime 帶寬成本）
 */

import { useState, useEffect, useCallback } from "react";
import type { SubTask } from "@/lib/types";

export type CollapsePreference = "expanded" | "collapsed";

const STORAGE_PREFIX = "subtask-collapse:v1:";

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
  _subTasks: SubTask[],
  scope: string = "anon",
) {
  const [prefs, setPrefs] = useState<Record<string, CollapsePreference>>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    setPrefs(loadFromStorage(scope));
    setHydrated(true);
  }, [scope]);

  const pref: CollapsePreference = prefs[taskId] ?? "collapsed";

  const toggle = useCallback(() => {
    setPrefs((prev) => {
      const current: CollapsePreference = prev[taskId] ?? "collapsed";
      const next: CollapsePreference = current === "expanded" ? "collapsed" : "expanded";
      const nextMap = { ...prev, [taskId]: next };
      saveToStorage(scope, nextMap);
      return nextMap;
    });
  }, [scope, taskId]);

  // 已完成群組是否摺疊（hydrated=false 時一律視為 collapsed，避免 SSR flash）
  const isCollapsed = hydrated ? pref === "collapsed" : true;

  return {
    isCollapsed,
    toggle,
  };
}