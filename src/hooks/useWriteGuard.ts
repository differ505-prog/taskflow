/**
 * useWriteGuard — 抽出 provider.tsx 內的 5 種寫入保護 ref 與相關 callbacks。
 * 所有時間視窗常數從 @/lib/constants 讀取。
 */
import { useRef, useCallback } from "react";
import {
  RECENT_WRITE_WINDOW_MS,
  EDIT_ACTIVITY_WINDOW_MS,
  RECENT_DELETE_WINDOW_MS,
} from "@/lib/constants";

export function useWriteGuard() {
  // 任務寫入保護
  const recentlyWrittenRef = useRef<Map<string, number>>(new Map());

  // 習慣寫入保護
  const recentlyWrittenHabitsRef = useRef<Map<string, number>>(new Map());

  // 清單寫入保護
  const recentlyWrittenListsRef = useRef<Map<string, number>>(new Map());

  // 編輯中任務 ID（§FIX-A: 防止即時同步覆蓋使用者正在編輯的內容）
  const editingTaskIdsRef = useRef<Set<string>>(new Set());
  const lastEditActivityRef = useRef<Map<string, number>>(new Map());

  // 任務刪除保護（Undo 視窗）
  const recentDeleteTimestamps = useRef<Map<string, number>>(new Map());

  // ── 任務寫入標記 ─────────────────────────────────────
  const markRecentlyWritten = useCallback((id: string) => {
    recentlyWrittenRef.current.set(id, Date.now());
  }, []);

  const isWithinRecentWriteWindow = useCallback((id: string): boolean => {
    const map = recentlyWrittenRef.current;
    const now = Date.now();
    for (const [tid, ts] of map) {
      if (now - ts >= RECENT_WRITE_WINDOW_MS) map.delete(tid);
    }
    const ts = map.get(id);
    return ts !== undefined && now - ts < RECENT_WRITE_WINDOW_MS;
  }, []);

  // ── 習慣寫入標記 ─────────────────────────────────────
  const markRecentlyWrittenHabit = useCallback((id: string) => {
    recentlyWrittenHabitsRef.current.set(id, Date.now());
  }, []);

  const isWithinRecentWriteWindowHabit = useCallback((id: string): boolean => {
    const map = recentlyWrittenHabitsRef.current;
    const now = Date.now();
    for (const [tid, ts] of map) {
      if (now - ts >= RECENT_WRITE_WINDOW_MS) map.delete(tid);
    }
    const ts = map.get(id);
    return ts !== undefined && now - ts < RECENT_WRITE_WINDOW_MS;
  }, []);

  // ── 清單寫入標記 ─────────────────────────────────────
  const markRecentlyWrittenList = useCallback((id: string) => {
    recentlyWrittenListsRef.current.set(id, Date.now());
  }, []);

  const isWithinRecentWriteWindowList = useCallback((id: string): boolean => {
    const map = recentlyWrittenListsRef.current;
    const now = Date.now();
    for (const [tid, ts] of map) {
      if (now - ts >= RECENT_WRITE_WINDOW_MS) map.delete(tid);
    }
    const ts = map.get(id);
    return ts !== undefined && now - ts < RECENT_WRITE_WINDOW_MS;
  }, []);

  // ── 編輯活動追蹤 ─────────────────────────────────────
  const markEditingActivity = useCallback((id: string) => {
    editingTaskIdsRef.current.add(id);
    lastEditActivityRef.current.set(id, Date.now());
  }, []);

  const clearEditingActivity = useCallback((id: string) => {
    editingTaskIdsRef.current.delete(id);
    lastEditActivityRef.current.delete(id);
  }, []);

  const isWithinEditingActivityWindow = useCallback((id: string): boolean => {
    if (!editingTaskIdsRef.current.has(id)) return false;
    const lastActivity = lastEditActivityRef.current.get(id);
    if (lastActivity === undefined) return false;
    const now = Date.now();
    const map = lastEditActivityRef.current;
    for (const [tid, ts] of map) {
      if (now - ts >= EDIT_ACTIVITY_WINDOW_MS) {
        map.delete(tid);
        editingTaskIdsRef.current.delete(tid);
      }
    }
    return now - lastActivity < EDIT_ACTIVITY_WINDOW_MS;
  }, []);

  // ── 刪除時間戳（Undo 視窗） ─────────────────────────
  const markRecentDelete = useCallback((id: string) => {
    recentDeleteTimestamps.current.set(id, Date.now());
  }, []);

  const isWithinRecentDeleteWindow = useCallback((id: string): boolean => {
    const ts = recentDeleteTimestamps.current.get(id);
    if (ts === undefined) return false;
    const now = Date.now();
    if (now - ts >= RECENT_DELETE_WINDOW_MS) {
      recentDeleteTimestamps.current.delete(id);
      return false;
    }
    return true;
  }, []);

  return {
    // Refs（可直接外部讀寫）
    recentlyWrittenRef,
    recentlyWrittenHabitsRef,
    recentlyWrittenListsRef,
    editingTaskIdsRef,
    lastEditActivityRef,
    recentDeleteTimestamps,
    // Callbacks
    markRecentlyWritten,
    isWithinRecentWriteWindow,
    markRecentlyWrittenHabit,
    isWithinRecentWriteWindowHabit,
    markRecentlyWrittenList,
    isWithinRecentWriteWindowList,
    markEditingActivity,
    clearEditingActivity,
    isWithinEditingActivityWindow,
    markRecentDelete,
    isWithinRecentDeleteWindow,
  };
}
