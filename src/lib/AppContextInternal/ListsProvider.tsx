"use client";

import React, { useCallback, useMemo, useRef } from "react";
import {
  Task,
  TaskList,
  DEFAULT_LIST_IDS,
} from "../types";
import {
  saveTasks,
  saveLists,
  generateId,
} from "../storage";
import {
  batchSaveLists as batchSaveListsFirebase,
  deleteList as deleteListFirebase,
} from "../personalListSync";
import { useWriteGuard } from "@/hooks/useWriteGuard";
import { computeHabitStreak, appContextLog } from "./utils";

const log = appContextLog("ListsProvider");

// ── Context Types ───────────────────────────────────────────────
export interface ListsContextValue {
  lists: TaskList[];
  addList: (data: Omit<TaskList, "id" | "createdAt" | "updatedAt" | "order">) => string;
  updateList: (id: string, updates: Partial<TaskList>) => void;
  deleteList: (id: string) => void;
  reorderLists: (newListOrder: TaskList[]) => void;
  dedupeDuplicateLists: (lists: TaskList[]) => TaskList[];
  rebindTasksToKeptLists: (rawLists: TaskList[], deduped: TaskList[]) => void;
  markListRecentlyWritten: (listId: string) => void;
  isListWithinRecentWriteWindow: (listId: string) => boolean;
}

const ListsContext = React.createContext<ListsContextValue | null>(null);

export { ListsContext };

// ── Props ───────────────────────────────────────────────────────
export interface ListsProviderProps {
  writeGuard: ReturnType<typeof useWriteGuard>;
  lists: TaskList[];
  setLists: React.Dispatch<React.SetStateAction<TaskList[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  userUid?: string;
  children: React.ReactNode;
}

// ── Provider ────────────────────────────────────────────────────
export function ListsProvider({
  writeGuard,
  lists,
  setLists,
  tasks,
  setTasks,
  userUid,
  children,
}: ListsProviderProps) {
  // Ref for reading current tasks without triggering re-renders
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;

  const { recentlyWrittenListsRef } = writeGuard;
  const markRecentlyWrittenList = writeGuard.markRecentlyWrittenList;
  const isWithinRecentWriteWindowList = writeGuard.isWithinRecentWriteWindowList;

  // ── 清單去重 ────────────────────────────────────────────────
  const dedupeDuplicateLists = useCallback((listsToDedupe: TaskList[]): TaskList[] => {
    const seen = new Map<string, TaskList>();
    const dupIds: string[] = [];
    for (const l of listsToDedupe) {
      const key = DEFAULT_LIST_IDS[l.name] ?? l.id;
      const existing = seen.get(key);
      if (existing) {
        dupIds.push(l.id);
      } else {
        seen.set(key, l);
      }
    }
    if (dupIds.length === 0) return listsToDedupe;
    const result = Array.from(seen.values());
    const dupIdSet = new Set(dupIds);
    const rebuiltTasks = tasksRef.current.map((t) => {
      if (t.listId && dupIdSet.has(t.listId)) {
        const keeper = result.find((l) => l.name === listsToDedupe.find((x) => x.id === t.listId)?.name);
        return { ...t, listId: keeper?.id ?? t.listId };
      }
      return t;
    });
    if (rebuiltTasks.some((t, i) => t !== tasksRef.current[i])) {
      setTasks(rebuiltTasks);
      saveTasks(rebuiltTasks);
      if (userUid) batchSaveListsFirebase(userUid, rebuiltTasks as unknown as TaskList[]).catch((err) => log.warn("rebind tasks failed", err));
    }
    return result;
  }, [setTasks, userUid]);

  const rebindTasksToKeptLists = useCallback((rawLists: TaskList[], deduped: TaskList[]) => {
    if (!userUid) return;
    const liveIds = new Set(deduped.map((l) => l.id));
    const droppedToKeeper = new Map<string, string>();
    for (const raw of rawLists) {
      if (liveIds.has(raw.id)) continue;
      const keeper = deduped.find(
        (k) => (DEFAULT_LIST_IDS[k.name] ?? k.id) === (DEFAULT_LIST_IDS[raw.name] ?? raw.id)
      );
      if (keeper) droppedToKeeper.set(raw.id, keeper.id);
    }
    if (droppedToKeeper.size === 0) return;
    const currentTasks = tasksRef.current;
    const rebuilt = currentTasks.map((t) => {
      if (t.listId && droppedToKeeper.has(t.listId)) {
        return { ...t, listId: droppedToKeeper.get(t.listId)! };
      }
      return t;
    });
    if (rebuilt.some((t, i) => t !== currentTasks[i])) {
      setTasks(rebuilt);
      saveTasks(rebuilt);
      batchSaveListsFirebase(userUid, rebuilt as unknown as TaskList[]).catch((err) =>
        log.warn("rebind tasks failed", err)
      );
    }
  }, [setTasks, userUid]);

  // ── 清單 CRUD ───────────────────────────────────────────────
  const addList = useCallback((data: Omit<TaskList, "id" | "createdAt" | "updatedAt" | "order">): string => {
    const newList: TaskList = {
      ...data, id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: lists.length,
    };
    const updated = [...lists, newList];
    setLists(updated);
    saveLists(updated);
    if (userUid) batchSaveListsFirebase(userUid, [newList]).catch((err) => log.warn("addList failed", err));
    return newList.id;
  }, [lists, setLists, userUid]);

  const updateList = useCallback((id: string, updates: Partial<TaskList>) => {
    const updated = lists.map((l) =>
      l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
    );
    setLists(updated);
    saveLists(updated);
    if (userUid) {
      const list = updated.find((l) => l.id === id);
      if (list) batchSaveListsFirebase(userUid, [list]).catch((err) => log.warn("updateList failed", err));
    }
  }, [lists, setLists, userUid]);

  const deleteList = useCallback((id: string) => {
    const updated = lists.filter((l) => l.id !== id);
    setLists(updated);
    saveLists(updated);
    if (userUid) deleteListFirebase(userUid, id).catch((err) => log.warn("deleteList failed", err));
    const affectedTasks = tasks.filter((t) => t.listId === id);
    const taskUpdated = tasks.map((t) => t.listId === id ? { ...t, listId: undefined } : t);
    setTasks(taskUpdated);
    saveTasks(taskUpdated);
    if (userUid && affectedTasks.length > 0) {
      batchSaveListsFirebase(userUid, taskUpdated as unknown as TaskList[]).catch((err) => log.warn("deleteList clear tasks failed", err));
    }
  }, [lists, tasks, setLists, setTasks, userUid]);

  // ── 寫入保護 ───────────────────────────────────────────────
  const markListRecentlyWritten = useCallback((listId: string) => {
    recentlyWrittenListsRef.current.set(listId, Date.now());
  }, [recentlyWrittenListsRef]);

  const isListWithinRecentWriteWindow = useCallback((listId: string): boolean => {
    return isWithinRecentWriteWindowList(listId);
  }, [isWithinRecentWriteWindowList]);

  // ── 排序 ────────────────────────────────────────────────────
  const reorderLists = useCallback((newListOrder: TaskList[]) => {
    const now = new Date().toISOString();
    const updated: TaskList[] = newListOrder.map((l, idx) => {
      const existing = lists.find((cur) => cur.id === l.id);
      return existing
        ? { ...existing, order: idx, updatedAt: now }
        : { ...l, order: idx, updatedAt: now };
    });
    setLists(updated);
    saveLists(updated);
    updated.forEach((l) => recentlyWrittenListsRef.current.set(l.id, Date.now()));
    if (userUid) batchSaveListsFirebase(userUid, updated).catch((err) => log.warn("reorderLists failed", err));
  }, [lists, setLists, recentlyWrittenListsRef, userUid]);

  // ── Context Value ────────────────────────────────────────────
  const value = useMemo<ListsContextValue>(() => ({
    lists,
    addList,
    updateList,
    deleteList,
    reorderLists,
    dedupeDuplicateLists,
    rebindTasksToKeptLists,
    markListRecentlyWritten,
    isListWithinRecentWriteWindow,
  }), [
    lists,
    addList,
    updateList,
    deleteList,
    reorderLists,
    dedupeDuplicateLists,
    rebindTasksToKeptLists,
    markListRecentlyWritten,
    isListWithinRecentWriteWindow,
  ]);

  return (
    <ListsContext.Provider value={value}>
      {children}
    </ListsContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────
export function useListsContext(): ListsContextValue {
  const ctx = React.useContext(ListsContext);
  if (!ctx) {
    throw new Error("useListsContext must be used within a <ListsProvider>");
  }
  return ctx;
}
