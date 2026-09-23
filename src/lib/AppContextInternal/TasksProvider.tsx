"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Task,
  TaskList,
  SubTask,
  AppView,
  TaskFilter,
  SharedListSnapshot,
  migratePriority,
  PRIORITY_RANK,
} from "../types";
import {
  saveTasks,
  generateId,
  saveSharedList,
  getSharedLists,
  SharedListData,
} from "../storage";
import { toLocalDateString } from "../dateUtils";
import { getNextRecurrenceDate } from "./utils";
import { COMPLETED_TASK_RETENTION_MS, RECENT_DELETE_WINDOW_MS } from "@/lib/constants";

// ── WriteGuard type (mirrors useWriteGuard return shape) ─────────
interface WriteGuard {
  recentlyWrittenRef: React.MutableRefObject<Map<string, number>>;
  recentlyWrittenListsRef: React.MutableRefObject<Map<string, number>>;
  markRecentlyWritten: (id: string) => void;
  markEditingActivity: (id: string) => void;
  clearEditingActivity: (id: string) => void;
  isWithinRecentWriteWindow: (id: string) => boolean;
  isWithinEditingActivityWindow: (id: string) => boolean;
  recentDeleteTimestamps: React.MutableRefObject<Map<string, number>>;
  markRecentDelete: (id: string) => void;
}

// ── Types ────────────────────────────────────────────────────────

export interface GetFilteredTasksOpts {
  currentView: AppView;
  currentListId?: string;
  searchQuery?: string;
  activeFilter?: TaskFilter;
}

export interface TasksContextValue {
  tasks: Task[];
  getFilteredTasks: (opts: GetFilteredTasksOpts) => Task[];
  viewCounts: { inbox: number; today: number; next7days: number; q1: number; q2: number; q3: number; q4: number };
  getListTaskCount: (listId: string) => number;
  getTagCounts: () => Record<string, number>;
  addTask: (data: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">) => string;
  addTaskLocalOnly: (datas: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order" | "ownerUid">[]) => string[];
  batchAddTasks: (datas: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">[]) => string[];
  updateTask: (id: string, updates: Partial<Task>) => void;
  moveTaskToShared: (id: string, targetListId: string, updates?: Partial<Task>) => boolean;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => void;
  markEditingActivity: (id: string) => void;
  clearEditingActivity: (id: string) => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  escapeTask: (id: string) => void;
  addSubTask: (parentId: string, title: string) => void;
  toggleSubTask: (parentId: string, subId: string) => void;
  deleteSubTask: (parentId: string, subId: string) => void;
  reorderSubTasks: (parentId: string, newTodoSubs: SubTask[]) => void;
  completeRecurringAndClone: (taskId: string) => void;
  completeTask: (id: string) => void;
  reorderTasks: (reorderedTasks: Task[]) => void;
  saveTasksDirectly: (updatedTasks: Task[]) => void;
  undoDelete: (taskId: string) => void;
}

export interface TasksProviderProps {
  writeGuard: WriteGuard;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  lists: TaskList[];
  sharedLists: Record<string, SharedListData>;
  userUid?: string;
  onSharedListsChange?: (
    updater: Record<string, SharedListData> | ((
      prev: Record<string, SharedListData>
    ) => Record<string, SharedListData>)
  ) => void;
  /** 搬遷任務至共享清單時，通知上層處理雲端同步等副作用 */
  onMoveTaskToShared?: (params: {
    taskId: string;
    targetSharedId: string;
    newSharedTasks: Task[];
    ownerId: string;
    ownerName?: string;
    list: TaskList;
    mergedTask: Task;
  }) => void;
  children: React.ReactNode;
}

// ── Context ─────────────────────────────────────────────────────
const TasksContext = createContext<TasksContextValue | null>(null);

export { TasksContext };

// ── Provider ────────────────────────────────────────────────────
export function TasksProvider({
  writeGuard,
  tasks,
  setTasks,
  lists,
  sharedLists,
  userUid,
  onSharedListsChange,
  onMoveTaskToShared,
  children,
}: TasksProviderProps) {
  // ── Refs ────────────────────────────────────────────────────
  const tasksRef = useRef<Task[]>(tasks);
  const previousTasksRef = useRef<Task[]>([]);

  // toggleTaskStatus needs to be called inside completeRecurringAndClone;
  // use a ref so the closure is always fresh without adding to the dependency array.
  const toggleTaskStatusRef = useRef<(id: string) => void>(() => {});

  // deletedTaskIdsRef + guard timers: originally in AppProvider.
  // Kept here to track deleted task IDs locally for merge guards.
  const deletedTaskIdsRef = useRef<Set<string>>(new Set());
  const deletedTaskIdsRef_deleteGuards = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Sync tasksRef ───────────────────────────────────────────
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // ── Unwrap writeGuard ────────────────────────────────────────
  const {
    recentlyWrittenRef,
    recentlyWrittenListsRef,
    markRecentlyWritten,
    markEditingActivity,
    clearEditingActivity,
    isWithinRecentWriteWindow,
    isWithinEditingActivityWindow,
    recentDeleteTimestamps,
    markRecentDelete,
  } = writeGuard;

  // ── Local helper ─────────────────────────────────────────────
  const markListRecentlyWritten = useCallback(
    (listId: string) => recentlyWrittenListsRef.current.set(listId, Date.now()),
    [recentlyWrittenListsRef]
  );

  // ── getFilteredTasks ─────────────────────────────────────────
  const getFilteredTasks = useCallback(
    (opts: GetFilteredTasksOpts): Task[] => {
      const { currentView, currentListId, searchQuery, activeFilter } = opts;
      let migrated = false;
      const migratedTasks: Task[] = tasks.map((t: Task) => {
        const newP = migratePriority(t.priority);
        if (newP !== t.priority) {
          migrated = true;
          return { ...t, priority: newP };
        }
        return t;
      });
      if (migrated) {
        queueMicrotask(() => saveTasks(migratedTasks));
      }

      const active = migratedTasks.filter((t: Task) => {
        if (t.isArchived) return false;
        if (!t.listId) return true;
        const owningList = lists.find((l) => l.id === t.listId);
        return !owningList?.sharedId;
      });

      const activeShared = Object.entries(sharedLists).flatMap(([sharedId, l]) => {
        const localList = lists.find((list) => list.sharedId === sharedId);
        const mappedListId = localList ? localList.id : sharedId;
        return l.tasks.map((t) => ({ ...t, listId: mappedListId }));
      }).filter((t) => !t.isArchived);

      const pickedAt = (t: Task): number => {
        const ts = t.updatedAt;
        if (typeof ts !== "string") return 0;
        const ms = Date.parse(ts);
        return Number.isFinite(ms) ? ms : 0;
      };

      const resultById = new Map<string, Task>();
      [...active, ...activeShared].forEach((task) => {
        const existing = resultById.get(task.id);
        if (!existing || pickedAt(task) >= pickedAt(existing)) {
          resultById.set(task.id, task);
        }
      });

      let result = Array.from(resultById.values());
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const weekEndDate = new Date(now.getTime() + 7 * 86400000);
      const localWeekEnd = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, "0")}-${String(weekEndDate.getDate()).padStart(2, "0")}`;

      if (currentView === "today") {
        result = result.filter((t) => {
          if (!t.dueDate || t.status === "done") return false;
          return t.dueDate === localToday || t.dueDate < localToday;
        });
      } else if (currentView === "next7days") {
        result = result.filter((t) => t.dueDate && t.dueDate >= localToday && t.dueDate <= localWeekEnd);
      } else if (currentView === "list" && currentListId) {
        result = result.filter((t) => t.listId === currentListId);
      } else if (currentView === "inbox") {
        result = result.filter((t) =>
          !t.listId ||
          (!lists.find((l) => l.id === t.listId) &&
            !sharedLists[lists.find((l) => l.id === t.listId)?.sharedId || ""])
        );
      } else if (currentView === "pinned") {
        result = result.filter((t) => t.isPinned);
      } else if (currentView === "shared") {
        result = [];
      }

      if (searchQuery?.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
            t.subTasks?.some((s) => s.title.toLowerCase().includes(q))
        );
      }

      if (activeFilter?.priority) result = result.filter((t) => t.priority === activeFilter.priority);
      if (activeFilter?.status) result = result.filter((t) => t.status === activeFilter.status);
      if (activeFilter?.tag) result = result.filter((t) => t.tags.includes(activeFilter.tag!));

      return result.sort((a, b) => {
        if (!a.isArchived && a.status !== "done" && a.isPinned && !(b.isPinned && !b.isArchived && b.status !== "done"))
          return -1;
        if (!b.isArchived && b.status !== "done" && b.isPinned && !(a.isPinned && !a.isArchived && a.status !== "done"))
          return 1;
        if (a.status === "done" && b.status !== "done") return 1;
        if (a.status !== "done" && b.status === "done") return -1;
        const po = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (po !== 0) return po;
        return a.order - b.order;
      });
    },
    [tasks, lists, sharedLists]
  );

  // ── viewCounts ───────────────────────────────────────────────
  const viewCounts = useMemo<{ inbox: number; today: number; next7days: number; q1: number; q2: number; q3: number; q4: number }>(() => {
    const active = tasks.filter((t: Task) => !t.isArchived);
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const weekEndDate = new Date(now.getTime() + 7 * 86400000);
    const localWeekEnd = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, "0")}-${String(weekEndDate.getDate()).padStart(2, "0")}`;
    return {
      inbox: active.filter((t) => !t.listId && t.status !== "done").length,
      today: active.filter((t) => {
        if (!t.dueDate || t.status === "done") return false;
        return t.dueDate === localToday || t.dueDate < localToday;
      }).length,
      next7days: active.filter((t) => t.dueDate && t.dueDate >= localToday && t.dueDate <= localWeekEnd && t.status !== "done").length,
      q1: active.filter((t) => t.priority === "do-now" && t.status !== "done").length,
      q2: active.filter((t) => t.priority === "schedule" && t.status !== "done").length,
      q3: active.filter((t) => t.priority === "delegate" && t.status !== "done").length,
      q4: active.filter((t) => t.priority === "none" && t.status !== "done").length,
    };
  }, [tasks]);

  // ── getListTaskCount ──────────────────────────────────────────
  const getListTaskCount = useCallback(
    (listId: string) => {
      const list = lists.find((l) => l.id === listId);
      if (list?.sharedId && sharedLists[list.sharedId]) {
        return sharedLists[list.sharedId].tasks.filter((t) => !t.isArchived && t.status !== "done").length;
      }
      return tasks.filter((t) => t.listId === listId && !t.isArchived && t.status !== "done").length;
    },
    [tasks, lists, sharedLists]
  );

  // ── getTagCounts ─────────────────────────────────────────────
  const getTagCounts = useCallback(() => {
    const counts: Record<string, number> = {};
    tasks
      .filter((t) => !t.isArchived && t.status !== "done")
      .forEach((t) => {
        t.tags.forEach((tag) => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      });
    return counts;
  }, [tasks]);

  // ── updateTask ───────────────────────────────────────────────
  const updateTask = useCallback(
    (id: string, updates: Partial<Task>) => {
      const prevTask = tasks.find((t) => t.id === id);
      const nextListId = updates.listId ?? prevTask?.listId;
      const targetList = lists.find((l) => l.id === nextListId);
      const targetSharedId = targetList?.sharedId;
      const prevOwningList = prevTask?.listId ? lists.find((l) => l.id === prevTask.listId) : undefined;
      const prevSharedId = prevOwningList?.sharedId;

      // §FIX-D2: personal → shared migration must go through moveTaskToShared
      if (prevTask && targetSharedId && sharedLists[targetSharedId] && prevSharedId !== targetSharedId) {
        // Fallback: delegate to moveTaskToShared (fire-and-forget)
        if (onMoveTaskToShared) {
          const targetSharedData = sharedLists[targetSharedId];
          const mergedTask = { ...prevTask, ...updates, updatedAt: new Date().toISOString() };
          const existingIdx = targetSharedData.tasks.findIndex((t) => t.id === id);
          const newSharedTasks =
            existingIdx >= 0
              ? targetSharedData.tasks.map((t, i) => (i === existingIdx ? mergedTask : t))
              : [...targetSharedData.tasks, mergedTask];

          onMoveTaskToShared({
            taskId: id,
            targetSharedId,
            newSharedTasks,
            ownerId: targetSharedData.list.ownerId ?? "",
            ownerName: targetSharedData.ownerName,
            list: targetSharedData.list,
            mergedTask,
          });
        }
        return;
      }

      const updated = tasks.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      );
      setTasks(updated);
      saveTasks(updated);
      markRecentlyWritten(id);
    },
    [tasks, lists, sharedLists, markRecentlyWritten, onMoveTaskToShared]
  );

  // ── addTask ──────────────────────────────────────────────────
  const addTask = useCallback(
    (data: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">): string => {
      const id = generateId();
      const task: Task = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        focusMinutes: 0,
        isArchived: false,
        order: tasks.filter((t) => !t.isArchived).length,
        ownerUid: userUid,
      };
      const updated = [task, ...tasks];
      setTasks(updated);
      saveTasks(updated);
      markRecentlyWritten(id);
      return id;
    },
    [tasks, userUid, markRecentlyWritten]
  );

  // ── addTaskLocalOnly ─────────────────────────────────────────
  const addTaskLocalOnly = useCallback(
    (datas: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order" | "ownerUid">[]): string[] => {
      if (datas.length === 0) return [];
      const now = new Date().toISOString();
      const newTasks: Task[] = [];
      const ids: string[] = [];
      let nextOrder = tasks.filter((t) => !t.isArchived).length;
      for (const data of datas) {
        const id = generateId();
        ids.push(id);
        newTasks.push({
          ...data,
          id,
          createdAt: now,
          updatedAt: now,
          focusMinutes: 0,
          isArchived: false,
          order: nextOrder++,
        });
      }
      const updated = [...newTasks, ...tasks];
      setTasks(updated);
      saveTasks(updated);
      return ids;
    },
    [tasks]
  );

  // ── batchAddTasks ────────────────────────────────────────────
  const batchAddTasks = useCallback(
    (datas: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">[]): string[] => {
      if (datas.length === 0) return [];
      const now = new Date().toISOString();
      const newTasks: Task[] = [];
      const ids: string[] = [];
      let nextOrder = tasks.filter((t) => !t.isArchived).length;
      for (const data of datas) {
        const id = generateId();
        ids.push(id);
        newTasks.push({
          ...data,
          id,
          createdAt: now,
          updatedAt: now,
          focusMinutes: 0,
          isArchived: false,
          order: nextOrder++,
          ownerUid: userUid,
        });
      }
      const updated = [...newTasks, ...tasks];
      setTasks(updated);
      saveTasks(updated);
      ids.forEach((id) => markRecentlyWritten(id));
      return ids;
    },
    [tasks, userUid, markRecentlyWritten]
  );

  // ── moveTaskToShared ─────────────────────────────────────────
  const moveTaskToShared = useCallback(
    (id: string, targetListId: string, updates: Partial<Task> = {}): boolean => {
      const prevTask = tasks.find((t) => t.id === id);
      const targetList = lists.find((l) => l.id === targetListId);
      const targetSharedId = targetList?.sharedId;
      if (!prevTask || !targetSharedId || !sharedLists[targetSharedId]) {
        console.warn(`[TasksProvider] moveTaskToShared: missing prereqs (task=${!!prevTask} sharedId=${targetSharedId})`);
        return false;
      }

      const targetSharedData = sharedLists[targetSharedId];
      const mergedTask = {
        ...prevTask,
        ...updates,
        listId: targetListId,
        updatedAt: new Date().toISOString(),
      };
      const existingIdx = targetSharedData.tasks.findIndex((t) => t.id === id);
      const newSharedTasks =
        existingIdx >= 0
          ? targetSharedData.tasks.map((t, i) => (i === existingIdx ? mergedTask : t))
          : [...targetSharedData.tasks, mergedTask];

      // 1. Remove from personal tasks[]
      const personalUpdated = tasks.filter((t) => t.id !== id);
      setTasks(personalUpdated);
      saveTasks(personalUpdated);

      // 2. Write to shared snapshot (local)
      const newSharedData: SharedListData = { ...targetSharedData, tasks: newSharedTasks };
      saveSharedList(targetSharedId, newSharedData);
      onSharedListsChange?.(getSharedLists());

      markRecentlyWritten(id);

      // 3. Notify parent for cloud sync etc.
      if (onMoveTaskToShared) {
        onMoveTaskToShared({
          taskId: id,
          targetSharedId,
          newSharedTasks,
          ownerId: targetSharedData.list.ownerId ?? "",
          ownerName: targetSharedData.ownerName,
          list: targetSharedData.list,
          mergedTask,
        });
      }

      return true;
    },
    [tasks, lists, sharedLists, onSharedListsChange, markRecentlyWritten, onMoveTaskToShared]
  );

  // ── undoDelete ───────────────────────────────────────────────
  const undoDelete = useCallback(
    (taskId: string) => {
      const previous = previousTasksRef.current;
      const task = previous.find((t) => t.id === taskId);
      if (!task) return;
      const updated = [task, ...tasks];
      setTasks(updated);
      saveTasks(updated);
    },
    [tasks]
  );

  // ── deleteTask ───────────────────────────────────────────────
  const deleteTask = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      previousTasksRef.current = tasks;

      // §FIX-J: deletedTaskIdsRef must survive until Realtime DELETE callback processes it.
      deletedTaskIdsRef.current.add(id);
      const DELETE_GUARD_MS = 30_000;
      const existingGuard = deletedTaskIdsRef_deleteGuards.current.get(id);
      if (existingGuard) clearTimeout(existingGuard);
      const guard = setTimeout(() => {
        deletedTaskIdsRef.current.delete(id);
        deletedTaskIdsRef_deleteGuards.current.delete(id);
      }, DELETE_GUARD_MS);
      deletedTaskIdsRef_deleteGuards.current.set(id, guard);

      const updated = tasks.filter((t) => t.id !== id);
      setTasks(updated);
      saveTasks(updated);

      // Mark as recently deleted for undo-window guards
      recentDeleteTimestamps.current.set(id, Date.now());
      setTimeout(() => recentDeleteTimestamps.current.delete(id), RECENT_DELETE_WINDOW_MS);
    },
    [tasks, recentDeleteTimestamps]
  );

  // ── toggleTaskStatus ─────────────────────────────────────────
  const toggleTaskStatus = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const newStatus: Task["status"] = task.status === "done" ? "todo" : "done";
      const updated = tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: newStatus,
              updatedAt: new Date().toISOString(),
              completedAt: newStatus === "done" ? new Date().toISOString() : undefined,
            }
          : t
      );
      setTasks(updated);
      saveTasks(updated);
      markRecentlyWritten(id);
    },
    [tasks, markRecentlyWritten]
  );

  // Keep the ref up-to-date so completeRecurringAndClone can call it.
  const _toggleTaskStatus = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const newStatus: Task["status"] = task.status === "done" ? "todo" : "done";
      const updated = tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: newStatus,
              updatedAt: new Date().toISOString(),
              completedAt: newStatus === "done" ? new Date().toISOString() : undefined,
            }
          : t
      );
      setTasks(updated);
      saveTasks(updated);
      markRecentlyWritten(id);
    },
    [tasks, markRecentlyWritten]
  );
  toggleTaskStatusRef.current = _toggleTaskStatus;

  // ── archiveTask / unarchiveTask / escapeTask ───────────────────
  const archiveTask = useCallback((id: string) => updateTask(id, { isArchived: true }), [updateTask]);
  const unarchiveTask = useCallback((id: string) => updateTask(id, { isArchived: false }), [updateTask]);

  const escapeTask = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      if (task.recurrence) {
        const baseFrom = task.dueDate || new Date().toISOString().split("T")[0];
        const { dueDate: nextDate, startDate: nextStartDate } = getNextRecurrenceDate(
          baseFrom,
          task.recurrence,
          task.startDate
        );
        updateTask(id, { dueDate: nextDate, startDate: nextStartDate ?? task.startDate });
        return;
      }
      if (task.startDate) {
        const newStart = toLocalDateString(new Date(Date.now() + 86400000));
        const newDue = task.dueDate
          ? toLocalDateString(new Date(new Date(task.dueDate).getTime() + 86400000))
          : undefined;
        updateTask(id, { startDate: newStart, dueDate: newDue });
      } else {
        updateTask(id, { dueDate: undefined });
      }
    },
    [tasks, updateTask]
  );

  // ── SubTasks ──────────────────────────────────────────────────
  const addSubTask = useCallback(
    (parentId: string, title: string) => {
      const task = tasks.find((t) => t.id === parentId);
      if (!task) return;
      const existingSubs = task.subTasks || [];
      const subTask: SubTask = {
        id: generateId(),
        title,
        status: "todo",
        createdAt: new Date().toISOString(),
        order: existingSubs.length,
      };
      updateTask(parentId, { subTasks: [...existingSubs, subTask] });
    },
    [tasks, updateTask]
  );

  const toggleSubTask = useCallback(
    (parentId: string, subId: string) => {
      const task = tasks.find((t) => t.id === parentId);
      if (!task) return;
      const subTasks = (task.subTasks || []).map((s) =>
        s.id === subId ? { ...s, status: (s.status === "done" ? "todo" : "done") as "todo" | "done" } : s
      );
      updateTask(parentId, { subTasks });
    },
    [tasks, updateTask]
  );

  const deleteSubTask = useCallback(
    (parentId: string, subId: string) => {
      const task = tasks.find((t) => t.id === parentId);
      if (!task) return;
      const subTasks = (task.subTasks || []).filter((s) => s.id !== subId);
      updateTask(parentId, { subTasks });
    },
    [tasks, updateTask]
  );

  const reorderSubTasks = useCallback(
    (parentId: string, newTodoSubs: SubTask[]) => {
      const task = tasks.find((t) => t.id === parentId);
      if (!task) return;
      const existingSubs = task.subTasks || [];
      const doneSubs = existingSubs.filter((s) => s.status === "done");
      const renumbered: SubTask[] = newTodoSubs.map((s, idx) => ({ ...s, order: idx }));
      const merged = [...renumbered, ...doneSubs];
      updateTask(parentId, { subTasks: merged });
    },
    [tasks, updateTask]
  );

  // ── completeRecurringAndClone ─────────────────────────────────
  const completeRecurringAndClone = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task?.recurrence) return;
      const baseFrom = task.dueDate || new Date().toISOString().split("T")[0];
      const { dueDate: nextDate, startDate: nextStartDate } = getNextRecurrenceDate(
        baseFrom,
        task.recurrence,
        task.startDate
      );
      if (task.recurrence.endDate && nextDate > task.recurrence.endDate) {
        toggleTaskStatusRef.current(taskId);
        return;
      }
      const updatedRecurrence = { ...task.recurrence, completedCount: task.recurrence.completedCount + 1 };
      const updated = tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: "todo" as const,
              dueDate: nextDate,
              startDate: nextStartDate ?? t.startDate,
              recurrence: updatedRecurrence,
              updatedAt: new Date().toISOString(),
            }
          : t
      );
      setTasks(updated);
      saveTasks(updated);
      markRecentlyWritten(taskId);
    },
    [tasks, markRecentlyWritten]
  );

  // ── completeTask ──────────────────────────────────────────────
  const completeTask = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      if (task.status === "done") {
        toggleTaskStatusRef.current(id);
        return;
      }
      if (task.recurrence) {
        completeRecurringAndClone(id);
        return;
      }
      toggleTaskStatusRef.current(id);
    },
    [tasks, completeRecurringAndClone]
  );

  // ── reorderTasks ─────────────────────────────────────────────
  const reorderTasks = useCallback(
    (reorderedTasks: Task[]) => {
      if (reorderedTasks.length === 0) return;
      const now = new Date().toISOString();
      const updated: Task[] = reorderedTasks.map((t, idx) => ({ ...t, order: idx, updatedAt: now }));
      const ids = new Set(updated.map((t) => t.id));
      const merged = tasks.map((t) => (ids.has(t.id) ? updated.find((u) => u.id === t.id)! : t));
      setTasks(merged);
      saveTasks(merged);
      updated.forEach((t) => recentlyWrittenRef.current.set(t.id, Date.now()));
    },
    [tasks, recentlyWrittenRef]
  );

  // ── saveTasksDirectly ─────────────────────────────────────────
  const saveTasksDirectly = useCallback(
    (updatedTasks: Task[]) => {
      if (updatedTasks.length === 0) return;
      const ids = new Set(updatedTasks.map((t) => t.id));
      const merged = tasks.map((t) => (ids.has(t.id) ? updatedTasks.find((u) => u.id === t.id)! : t));
      setTasks(merged);
      saveTasks(merged);
      updatedTasks.forEach((t) => recentlyWrittenRef.current.set(t.id, Date.now()));
    },
    [tasks, recentlyWrittenRef]
  );

  // ── Context Value ─────────────────────────────────────────────
  const value: TasksContextValue = useMemo(
    () => ({
      tasks,
      getFilteredTasks,
      viewCounts,
      getListTaskCount,
      getTagCounts,
      addTask,
      addTaskLocalOnly,
      batchAddTasks,
      updateTask,
      moveTaskToShared,
      deleteTask,
      toggleTaskStatus,
      markEditingActivity,
      clearEditingActivity,
      archiveTask,
      unarchiveTask,
      escapeTask,
      addSubTask,
      toggleSubTask,
      deleteSubTask,
      reorderSubTasks,
      completeRecurringAndClone,
      completeTask,
      reorderTasks,
      saveTasksDirectly,
      undoDelete,
    }),
    [
      tasks,
      getFilteredTasks,
      viewCounts,
      getListTaskCount,
      getTagCounts,
      addTask,
      addTaskLocalOnly,
      batchAddTasks,
      updateTask,
      moveTaskToShared,
      deleteTask,
      toggleTaskStatus,
      markEditingActivity,
      clearEditingActivity,
      archiveTask,
      unarchiveTask,
      escapeTask,
      addSubTask,
      toggleSubTask,
      deleteSubTask,
      reorderSubTasks,
      completeRecurringAndClone,
      completeTask,
      reorderTasks,
      saveTasksDirectly,
      undoDelete,
    ]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────
export function useTasksContext(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) {
    throw new Error("useTasksContext must be used within a <TasksProvider>");
  }
  return ctx;
}
