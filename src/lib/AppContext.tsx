"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Task,
  TaskList,
  Habit,
  PomodoroSession,
  AppView,
  TaskFilter,
  SubTask,
  Recurrence,
  SharedListSnapshot,
} from "./types";
import {
  getTasks,
  saveTasks,
  getLists,
  saveLists,
  getHabits,
  saveHabits,
  initDefaultLists,
  generateId,
  getTodayFocusMinutes,
  SharedListData,
  saveSharedList,
  getSharedLists,
  removeSharedList,
  saveOwnedSharedListIds,
  getOwnedSharedListIds,
} from "./storage";
import {
  createSharedList,
  updateSharedSnapshot,
  subscribeToSharedSnapshot,
  deleteSharedList,
  getSharedSnapshot,
} from "./firestore";
import { parseNaturalLanguage } from "./nlp";
import { useAuth } from "./AuthContext";

interface AppContextValue {
  // ── Data ────────────────────────────────────────────────
  tasks: Task[];
  lists: TaskList[];
  habits: Habit[];
  todayFocusMinutes: number;

  // ── Firebase sync ────────────────────────────────────────
  /** 強制從 localStorage 重新讀取（例如 Firebase 即時更新後） */
  forceReload: () => void;

  // ── View ────────────────────────────────────────────────
  currentView: AppView;
  currentListId?: string;
  setCurrentView: (v: AppView, listId?: string) => void;
  currentSharedListId?: string;
  setCurrentSharedList: (sharedId: string | undefined) => void;

  // ── Search / Filter ─────────────────────────────────────
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeFilter: TaskFilter;
  setActiveFilter: (f: TaskFilter) => void;

  // ── Task CRUD ────────────────────────────────────────────
  addTask: (data: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;

  // ── SubTask ──────────────────────────────────────────────
  addSubTask: (parentId: string, title: string) => void;
  toggleSubTask: (parentId: string, subId: string) => void;
  deleteSubTask: (parentId: string, subId: string) => void;

  // ── Recurring ────────────────────────────────────────────
  completeRecurringAndClone: (taskId: string) => void;

  // ── List CRUD ────────────────────────────────────────────
  addList: (data: Omit<TaskList, "id" | "createdAt" | "updatedAt" | "order">) => void;
  updateList: (id: string, updates: Partial<TaskList>) => void;
  deleteList: (id: string) => void;

  // ── Habit CRUD ──────────────────────────────────────────
  addHabit: (data: Omit<Habit, "id" | "createdAt" | "updatedAt" | "checkins" | "streak" | "longestStreak">) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  checkinHabit: (id: string, date: string, count?: number, note?: string) => void;

  // ── Quick Add ────────────────────────────────────────────
  quickAdd: (input: string) => string | null;

  // ── Notifications ───────────────────────────────────────
  requestNotificationPermission: () => Promise<boolean>;
  notificationPermission: NotificationPermission | "default";

  // ── Shared Lists ─────────────────────────────────────────
  sharedLists: Record<string, SharedListData>;
  sharedListIds: string[];
  shareList: (listId: string) => Promise<string | null>;
  unshareList: (sharedListId: string) => Promise<void>;
  acceptSharedList: (sharedListId: string, data: SharedListSnapshot) => void;
  removeAcceptedSharedList: (sharedListId: string) => void;
  checkIncomingShareLink: () => Promise<{ sharedListId: string; snapshot: SharedListSnapshot } | null>;
  quickAddToShared: (sharedListId: string, input: string) => string | null;
  updateSharedTask: (sharedListId: string, taskId: string, updates: Partial<Task>) => void;
  deleteSharedTask: (sharedListId: string, taskId: string) => void;

  // ── Helpers ──────────────────────────────────────────────
  getFilteredTasks: () => Task[];
  viewCounts: { inbox: number; today: number; next7days: number };
  getListTaskCount: (listId: string) => number;
  getTagCounts: () => Record<string, number>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayFocusMinutes, setTodayFocusMinutes] = useState(0);
  const [currentView, setCurrentViewState] = useState<AppView>("inbox");
  const [currentListId, setCurrentListId] = useState<string | undefined>(undefined);
  const [currentSharedListId, setCurrentSharedListIdState] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TaskFilter>({});
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "default">("default");
  const [isLoaded, setIsLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // ── Shared List State ─────────────────────────────────────
  const [sharedLists, setSharedLists] = useState<Record<string, SharedListData>>({});
  // Track which shared lists the current user owns (for sync updates)
  const [ownedSharedListIds, _setOwnedSharedListIds] = useState<string[]>([]);
  // Wrap setter to persist ownedSharedListIds to localStorage
  const ownedSharedListIdsRef = useRef<string[]>([]);
  const setOwnedSharedListIds = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    _setOwnedSharedListIds((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      ownedSharedListIdsRef.current = next;
      saveOwnedSharedListIds(next);
      return next;
    });
  }, []);
  // Track shared list IDs that the current user has accepted (recipients)
  const [acceptedSharedListIds, setAcceptedSharedListIds] = useState<string[]>([]);
  // Refs to store unsubscribe functions for Firestore listeners
  const sharedListUnsubscribeRefs = useRef<Record<string, () => void>>({});
  // Track remote tasks from recipients (tasks with createdBy !== owner)
  const remoteSharedTasksRef = useRef<Record<string, Task[]>>({});
  // Track last-written snapshot hash to prevent infinite sync loops
  const lastSyncedHashRef = useRef<Record<string, string>>({});
  // Track whether we've received the first snapshot for each shared list
  // (prevents writing before we know what's on the server)
  const snapshotReadyRef = useRef<Record<string, boolean>>({});
  // Store latest snapshot tasks from subscription (bypasses React state closure)
  const snapshotTasksRef = useRef<Record<string, Task[]>>({});

  // ── Init ────────────────────────────────────────────────
  useEffect(() => {
    const storedLists = initDefaultLists();
    setLists(storedLists);
    setTasks(getTasks());
    setHabits(getHabits());
    setTodayFocusMinutes(getTodayFocusMinutes());
    // Restore ownedSharedListIds from localStorage (critical for Firestore subscription on reload)
    const storedOwnedIds = getOwnedSharedListIds();
    console.log("[AppContext Init] storedOwnedIds from localStorage:", storedOwnedIds);
    if (storedOwnedIds.length > 0) {
      _setOwnedSharedListIds(storedOwnedIds);
      ownedSharedListIdsRef.current = storedOwnedIds;
    }
    const storedSharedLists = getSharedLists();
    console.log("[AppContext Init] storedSharedLists keys:", Object.keys(storedSharedLists));
    setSharedLists(storedSharedLists);

    if (typeof Notification !== "undefined") {
      setNotificationPermission(Notification.permission);
    }
    setIsLoaded(true);
  }, [reloadKey]);

  // ── Restore accepted shared list IDs from storage after load ─
  useEffect(() => {
    if (!isLoaded) return;
    const storedSharedLists = getSharedLists();
    const acceptedIds = Object.keys(storedSharedLists).filter(
      (id) => !ownedSharedListIds.includes(id)
    );
    setAcceptedSharedListIds(acceptedIds);
  }, [isLoaded, reloadKey]);

  // ── Restore owned shared list IDs from lists after load ─────
  // Without this, the Owner's Firestore subscription would never be
  // established after a page reload, causing remote tasks to be lost.
  useEffect(() => {
    if (!isLoaded || !user) return;
    const ownedIds = lists
      .filter((l) => l.ownerId === user.uid && l.sharedId)
      .map((l) => l.sharedId!);
    if (ownedIds.length > 0) {
      setOwnedSharedListIds((prev) => {
        const newIds = ownedIds.filter((id) => !prev.includes(id));
        return newIds.length > 0 ? [...prev, ...newIds] : prev;
      });
    }
  }, [isLoaded, user, lists]);

  const setCurrentView = useCallback((v: AppView, listId?: string) => {
    setCurrentViewState(v);
    setCurrentListId(listId);
    setCurrentSharedListIdState(undefined);
    setSearchQuery("");
    setActiveFilter({});
  }, []);

  const setCurrentSharedList = useCallback((sharedId: string | undefined) => {
    setCurrentSharedListIdState(sharedId);
    setCurrentViewState(sharedId ? "shared" : "inbox");
    setSearchQuery("");
    setActiveFilter({});
  }, []);

  // ── Filtered tasks ────────────────────────────────────────
  const getFilteredTasks = useCallback((): Task[] => {
    const active = tasks.filter((t) => !t.isArchived);
    let result = active;

    // View-based filtering
    const today = new Date().toISOString().split("T")[0];
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    if (currentView === "today") {
      result = result.filter((t) => t.dueDate === today);
    } else if (currentView === "next7days") {
      result = result.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd);
    } else if (currentView === "all") {
      // all active tasks, no date filter
    } else if (currentView === "list" && currentListId) {
      result = result.filter((t) => t.listId === currentListId);
    } else if (currentView === "inbox") {
      // 收集箱 = 沒有歸屬到任何清單的任務
      result = result.filter((t) => !t.listId);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    // Priority filter
    if (activeFilter.priority) {
      result = result.filter((t) => t.priority === activeFilter.priority);
    }

    // Status filter
    if (activeFilter.status) {
      result = result.filter((t) => t.status === activeFilter.status);
    }

    // Tag filter
    if (activeFilter.tag) {
      result = result.filter((t) => t.tags.includes(activeFilter.tag!));
    }

    // Sort: incomplete first, then by priority, then by order
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return result.sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      const po = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (po !== 0) return po;
      return a.order - b.order;
    });
  }, [tasks, currentView, currentListId, searchQuery, activeFilter]);

  // ── View counts ──────────────────────────────────────────
  const viewCounts = useMemo(() => {
    const active = tasks.filter((t) => !t.isArchived);
    const today = new Date().toISOString().split("T")[0];
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    return {
      // 收集箱：沒有歸屬清單的任務
      inbox: active.filter((t) => !t.listId).length,
      // 今天：有截止日期等於今天的任務
      today: active.filter((t) => t.dueDate === today).length,
      // 未來 7 天：截止日期在未來 7 天內的任務
      next7days: active.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd).length,
    };
  }, [tasks]);

  const getListTaskCount = useCallback((listId: string) => {
    return tasks.filter((t) => t.listId === listId && !t.isArchived).length;
  }, [tasks]);

  const getTagCounts = useCallback(() => {
    const counts: Record<string, number> = {};
    tasks.filter((t) => !t.isArchived).forEach((t) => {
      t.tags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return counts;
  }, [tasks]);

  // ── Task CRUD ─────────────────────────────────────────────
  const addTask = useCallback((
    data: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">
  ): string => {
    const id = generateId();
    const task: Task = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      focusMinutes: 0,
      isArchived: false,
      order: tasks.filter((t) => !t.isArchived).length,
    };
    const updated = [task, ...tasks];
    setTasks(updated);
    saveTasks(updated);
    return id;
  }, [tasks]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    setTasks(updated);
    saveTasks(updated);
  }, [tasks]);

  const deleteTask = useCallback((id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    saveTasks(updated);
  }, [tasks]);

  const toggleTaskStatus = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const next: Record<string, string> = { todo: "in-progress", "in-progress": "done", done: "todo" };
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, status: next[t.status] as Task["status"], updatedAt: new Date().toISOString() } : t
    );
    setTasks(updated);
    saveTasks(updated);
  }, [tasks]);

  const archiveTask = useCallback((id: string) => {
    updateTask(id, { isArchived: true });
  }, [updateTask]);

  const unarchiveTask = useCallback((id: string) => {
    updateTask(id, { isArchived: false });
  }, [updateTask]);

  // ── SubTask ──────────────────────────────────────────────
  const addSubTask = useCallback((parentId: string, title: string) => {
    const task = tasks.find((t) => t.id === parentId);
    if (!task) return;
    const subTask: SubTask = {
      id: generateId(),
      title,
      status: "todo",
      createdAt: new Date().toISOString(),
    };
    updateTask(parentId, { subTasks: [...(task.subTasks || []), subTask] });
  }, [tasks, updateTask]);

  const toggleSubTask = useCallback((parentId: string, subId: string) => {
    const task = tasks.find((t) => t.id === parentId);
    if (!task) return;
    const subTasks = (task.subTasks || []).map((s) =>
      s.id === subId ? { ...s, status: (s.status === "done" ? "todo" : "done") as "todo" | "done" } : s
    );
    updateTask(parentId, { subTasks });
  }, [tasks, updateTask]);

  const deleteSubTask = useCallback((parentId: string, subId: string) => {
    const task = tasks.find((t) => t.id === parentId);
    if (!task) return;
    const subTasks = (task.subTasks || []).filter((s) => s.id !== subId);
    updateTask(parentId, { subTasks });
  }, [tasks, updateTask]);

  // ── Recurring ────────────────────────────────────────────
  const completeRecurringAndClone = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task?.recurrence) return;

    const nextDate = getNextRecurrenceDate(task.dueDate || new Date().toISOString().split("T")[0], task.recurrence);
    if (task.recurrence.endDate && nextDate > task.recurrence.endDate) return;

    // Update original task: reset to todo, new due date
    const updatedRecurrence = { ...task.recurrence, completedCount: task.recurrence.completedCount + 1 };
    const updated = tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: "todo" as const, dueDate: nextDate, recurrence: updatedRecurrence, updatedAt: new Date().toISOString() }
        : t
    );
    setTasks(updated);
    saveTasks(updated);
  }, [tasks]);

  // ── List CRUD ────────────────────────────────────────────
  const addList = useCallback((data: Omit<TaskList, "id" | "createdAt" | "updatedAt" | "order">) => {
    const newList: TaskList = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: lists.length,
    };
    const updated = [...lists, newList];
    setLists(updated);
    saveLists(updated);
  }, [lists]);

  const updateList = useCallback((id: string, updates: Partial<TaskList>) => {
    const updated = lists.map((l) =>
      l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
    );
    setLists(updated);
    saveLists(updated);
  }, [lists]);

  const deleteList = useCallback((id: string) => {
    const updated = lists.filter((l) => l.id !== id);
    setLists(updated);
    saveLists(updated);
    // Unlink tasks
    const taskUpdated = tasks.map((t) =>
      t.listId === id ? { ...t, listId: undefined } : t
    );
    setTasks(taskUpdated);
    saveTasks(taskUpdated);
  }, [lists, tasks]);

  // ── Habit CRUD ───────────────────────────────────────────
  const addHabit = useCallback((data: Omit<Habit, "id" | "createdAt" | "updatedAt" | "checkins" | "streak" | "longestStreak">) => {
    const newHabit: Habit = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checkins: [],
      streak: 0,
      longestStreak: 0,
    };
    const updated = [...habits, newHabit];
    setHabits(updated);
    saveHabits(updated);
  }, [habits]);

  const updateHabit = useCallback((id: string, updates: Partial<Habit>) => {
    const updated = habits.map((h) =>
      h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h
    );
    setHabits(updated);
    saveHabits(updated);
  }, [habits]);

  const deleteHabit = useCallback((id: string) => {
    const updated = habits.filter((h) => h.id !== id);
    setHabits(updated);
    saveHabits(updated);
  }, [habits]);

  const checkinHabitFn = useCallback((id: string, date: string, count = 1, note?: string) => {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    const existing = habit.checkins.find((c) => c.date === date);
    let checkins: Habit["checkins"];
    if (existing) {
      checkins = habit.checkins.map((c) =>
        c.date === date ? { ...c, count: c.count + count, note: note ?? c.note } : c
      );
    } else {
      checkins = [...habit.checkins, { date, completed: true, count, note }];
    }
    const sortedCheckins = checkins.sort((a, b) => b.date.localeCompare(a.date));
    const streak = computeHabitStreak(habit, sortedCheckins);
    const longestStreak = Math.max(habit.longestStreak, streak);
    const updated = habits.map((h) =>
      h.id === id ? { ...h, checkins: sortedCheckins, streak, longestStreak, updatedAt: new Date().toISOString() } : h
    );
    setHabits(updated);
    saveHabits(updated);
  }, [habits]);

  // ── Shared List Functions ───────────────────────────────────
  const shareList = useCallback(async (listId: string): Promise<string | null> => {
    if (!user) return null;
    const list = lists.find((l) => l.id === listId);
    if (!list) return null;

    const listTasks = tasks.filter((t) => t.listId === listId);
    const ownerName = user.displayName || user.email || undefined;

    try {
      const sharedListId = await createSharedList(list, listTasks, user.uid, ownerName);

      // Update the list with the sharedId
      const updatedList = { ...list, sharedId: sharedListId, ownerId: user.uid };
      const updatedLists = lists.map((l) => l.id === listId ? updatedList : l);
      setLists(updatedLists);
      saveLists(updatedLists);

      // Track this as an owned shared list for sync
      setOwnedSharedListIds((prev) => {
        if (prev.includes(sharedListId)) return prev;
        return [...prev, sharedListId];
      });

      return sharedListId;
    } catch (error) {
      console.error("Failed to share list:", error);
      return null;
    }
  }, [user, lists, tasks]);

  const unshareList = useCallback(async (sharedListId: string): Promise<void> => {
    if (!user) return;

    try {
      await deleteSharedList(sharedListId);

      // Remove sharedId from the list
      const updatedLists = lists.map((l) =>
        l.sharedId === sharedListId ? { ...l, sharedId: undefined, ownerId: undefined } : l
      );
      setLists(updatedLists);
      saveLists(updatedLists);

      // Remove from owned shared lists
      setOwnedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));

      // Unsubscribe from Firestore updates
      if (sharedListUnsubscribeRefs.current[sharedListId]) {
        sharedListUnsubscribeRefs.current[sharedListId]();
        delete sharedListUnsubscribeRefs.current[sharedListId];
      }
    } catch (error) {
      console.error("Failed to unshare list:", error);
    }
  }, [user, lists]);

  const acceptSharedList = useCallback(async (sharedListId: string, data: SharedListSnapshot): Promise<void> => {
    // Ensure ownerId is always set
    const ownerId = data.ownerId || data.list.ownerId;
    console.log("[SharedList] acceptSharedList:", {
      sharedListId,
      "data.ownerId": data.ownerId,
      "data.list.ownerId": data.list.ownerId,
      resolvedOwnerId: ownerId,
      taskCount: data.tasks?.length,
      ownerName: data.ownerName,
    });

    // Ensure required list fields are never undefined (SharedListMeta doesn't store icon/color)
    const listWithDefaults: TaskList = {
      ...data.list,
      ownerId,
      icon: data.list.icon || "📋",
      color: data.list.color || "#3B82F6",
    };

    const sharedData: SharedListData = {
      list: listWithDefaults,
      tasks: data.tasks,
      ownerName: data.ownerName,
    };

    // Save to localStorage first
    saveSharedList(sharedListId, sharedData);
    setSharedLists(getSharedLists());
    setAcceptedSharedListIds((prev) =>
      prev.includes(sharedListId) ? prev : [...prev, sharedListId]
    );

    // Subscribe to real-time updates and wait for connection
    return new Promise<void>((resolve) => {
      subscribeToSharedSnapshot(
        sharedListId,
        (snapshot) => {
          console.log("[SharedList] Received Firestore update for", sharedListId, snapshot?.tasks?.length, "tasks");
          if (snapshot) {
            const snapshotOwnerId = snapshot.ownerId || snapshot.list.ownerId;
            const snapshotListWithDefaults: TaskList = {
              ...snapshot.list,
              ownerId: snapshotOwnerId,
              icon: snapshot.list.icon || "📋",
              color: snapshot.list.color || "#3B82F6",
            };
            const updatedData: SharedListData = {
              list: snapshotListWithDefaults,
              tasks: snapshot.tasks,
              ownerName: snapshot.ownerName,
            };
            saveSharedList(sharedListId, updatedData);
            setSharedLists(getSharedLists());
          }
        },
        () => {
          // Shared list was deleted by owner
          console.log("[SharedList] Shared list deleted:", sharedListId);
          removeSharedList(sharedListId);
          setSharedLists(getSharedLists());
          setAcceptedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));
          if (sharedListUnsubscribeRefs.current[sharedListId]) {
            delete sharedListUnsubscribeRefs.current[sharedListId];
          }
        }
      ).then((unsubscribe) => {
        console.log("[SharedList] Subscribed to shared list:", sharedListId);
        sharedListUnsubscribeRefs.current[sharedListId] = unsubscribe;
        resolve(); // Signal that subscription is ready
      }).catch((error) => {
        console.error("[SharedList] Failed to subscribe:", error);
        resolve(); // Still resolve to not block UI
      });
    });
  }, []);

  const removeAcceptedSharedList = useCallback((sharedListId: string): void => {
    removeSharedList(sharedListId);
    setSharedLists(getSharedLists());
    setAcceptedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));

    // Unsubscribe from updates
    if (sharedListUnsubscribeRefs.current[sharedListId]) {
      sharedListUnsubscribeRefs.current[sharedListId]();
      delete sharedListUnsubscribeRefs.current[sharedListId];
    }
  }, []);

  const checkIncomingShareLink = useCallback(async (): Promise<{ sharedListId: string; snapshot: SharedListSnapshot } | null> => {
    if (typeof window === "undefined") return null;

    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get("share");

    if (!shareParam) return null;

    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);

    // shareParam is the sharedListId (e.g., "sl_xxx")
    try {
      const snapshot = await getSharedSnapshot(shareParam);
      if (snapshot) {
        return { sharedListId: shareParam, snapshot };
      }
    } catch (error) {
      console.error("Failed to fetch shared list:", error);
    }

    return null;
  }, []);

  // ── Subscribe to owned shared lists for sync updates ───────
  // Owner subscribes to capture tasks written by recipients
  useEffect(() => {
    if (!user || ownedSharedListIds.length === 0) return;

    const currentUserLists = lists.filter((l) => user && l.ownerId === user.uid && l.sharedId);

    const promises: Promise<void>[] = [];
    currentUserLists.forEach((list) => {
      const sharedId = list.sharedId;
      if (!sharedId) return;
      if (sharedListUnsubscribeRefs.current[sharedId]) return; // Already subscribed

      const promise = subscribeToSharedSnapshot(
        sharedId,
        (snapshot) => {
          if (!snapshot) return;

          const isFirstSnapshot = !snapshotReadyRef.current[sharedId];
          snapshotReadyRef.current[sharedId] = true;

          // Use snapshot.ownerId as source of truth (always set by createSharedList)
          const snapshotOwnerId = snapshot.ownerId || snapshot.list.ownerId;

          // Update sharedLists state — use snapshot.ownerId directly
          const updatedData: SharedListData = {
            list: { ...snapshot.list, ownerId: snapshotOwnerId },
            tasks: snapshot.tasks,
            ownerName: snapshot.ownerName,
          };
          setSharedLists((prev) => ({ ...prev, [sharedId]: updatedData }));

          // Save to localStorage — use snapshot data directly (not closure sharedLists)
          saveSharedList(sharedId, updatedData);
          console.log("[SharedList] Owner subscription fired, saved", snapshot.tasks.length, "tasks, ownerId:", snapshotOwnerId);

          // Always update sharedLists state to ensure UI stays in sync
          setSharedLists((prev) => ({ ...prev, [sharedId]: updatedData }));

          // Capture remote (recipient) tasks for the sync effect's merge logic
          const remoteTasks = snapshot.tasks.filter(
            (t) => t.createdBy && t.createdBy !== user.uid
          );
          remoteSharedTasksRef.current[sharedId] = remoteTasks;
          // Store latest snapshot tasks so sync effect can read without closure lag
          snapshotTasksRef.current[sharedId] = snapshot.tasks;

          // Sync all snapshot tasks into local tasks state so owner can see them
          // (both owner-created and recipient-created tasks, deduplicated by id)
          setTasks((prev) => {
            const prevMap = new Map(prev.map(t => [t.id, t]));
            const merged = [...prev];
            let changed = false;
            for (const st of snapshot.tasks) {
              const existing = prevMap.get(st.id);
              if (!existing) {
                merged.push(st);
                changed = true;
              } else if (st.updatedAt > existing.updatedAt) {
                const idx = merged.findIndex(t => t.id === st.id);
                if (idx >= 0) merged[idx] = st;
                changed = true;
              }
            }
            return changed ? merged : prev;
          });

          // Update the hash so we know what's on the server
          const hash = JSON.stringify(snapshot.tasks.map(t => `${t.id}:${t.updatedAt}`).sort());
          lastSyncedHashRef.current[sharedId] = hash;
        },
        () => {
          // List was deleted externally
          setOwnedSharedListIds((prev) => prev.filter((id) => id !== sharedId));
          setSharedLists((prev) => {
            const next = { ...prev };
            delete next[sharedId];
            return next;
          });
          removeSharedList(sharedId);
          delete remoteSharedTasksRef.current[sharedId];
          delete lastSyncedHashRef.current[sharedId];
          delete snapshotReadyRef.current[sharedId];
        }
      ).then((unsubscribe) => {
        sharedListUnsubscribeRefs.current[sharedId] = unsubscribe;
      }).catch(() => {});
      promises.push(promise);
    });

    return () => {
      // Cleanup: unsubscribe from lists that are no longer owned
      Object.keys(sharedListUnsubscribeRefs.current).forEach((id) => {
        if (!ownedSharedListIds.includes(id)) {
          sharedListUnsubscribeRefs.current[id]();
          delete sharedListUnsubscribeRefs.current[id];
          delete remoteSharedTasksRef.current[id];
          delete lastSyncedHashRef.current[id];
          delete snapshotReadyRef.current[id];
        }
      });
    };
  }, [user, ownedSharedListIds]);

  // ── Subscribe to accepted shared lists (recipient side) ─────
  useEffect(() => {
    if (!user || acceptedSharedListIds.length === 0) return;

    const promises: Promise<void>[] = [];
    acceptedSharedListIds.forEach((sharedListId) => {
      if (sharedListUnsubscribeRefs.current[sharedListId]) return; // Already subscribed

      const promise = subscribeToSharedSnapshot(
        sharedListId,
        (snapshot) => {
          if (snapshot) {
            const snapshotOwnerId = snapshot.ownerId || snapshot.list.ownerId;
            // Ensure required fields are never undefined
            const snapshotListWithDefaults: TaskList = {
              ...snapshot.list,
              ownerId: snapshotOwnerId,
              icon: snapshot.list.icon || "📋",
              color: snapshot.list.color || "#3B82F6",
            };
            const updatedData: SharedListData = {
              list: snapshotListWithDefaults,
              tasks: snapshot.tasks,
              ownerName: snapshot.ownerName,
            };
            saveSharedList(sharedListId, updatedData);
            // Sync snapshot tasks into local tasks state so recipient sees them
            setTasks((prev) => {
              const prevMap = new Map(prev.map(t => [t.id, t]));
              const merged = [...prev];
              let changed = false;
              for (const st of snapshot.tasks) {
                const existing = prevMap.get(st.id);
                if (!existing) {
                  merged.push(st);
                  changed = true;
                } else if (st.updatedAt > existing.updatedAt) {
                  const idx = merged.findIndex(t => t.id === st.id);
                  if (idx >= 0) merged[idx] = st;
                  changed = true;
                }
              }
              return changed ? merged : prev;
            });
            setSharedLists(getSharedLists());
          }
        },
        () => {
          // Shared list was deleted by owner
          removeSharedList(sharedListId);
          setSharedLists(getSharedLists());
          setAcceptedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));
          if (sharedListUnsubscribeRefs.current[sharedListId]) {
            delete sharedListUnsubscribeRefs.current[sharedListId];
          }
        }
      ).then((unsubscribe) => {
        sharedListUnsubscribeRefs.current[sharedListId] = unsubscribe;
      }).catch(() => {});
      promises.push(promise);
    });

    return () => {
      // Cleanup: unsubscribe from lists no longer accepted
      Object.keys(sharedListUnsubscribeRefs.current).forEach((id) => {
        if (!ownedSharedListIds.includes(id) && !acceptedSharedListIds.includes(id)) {
          sharedListUnsubscribeRefs.current[id]();
          delete sharedListUnsubscribeRefs.current[id];
        }
      });
    };
  }, [user, acceptedSharedListIds]);

  // ── Quick Add ─────────────────────────────────────────────
  const quickAdd = useCallback((input: string): string | null => {
    if (!input.trim()) return null;
    const parsed = parseNaturalLanguage(input);
    return addTask({
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority,
      status: "todo",
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      tags: parsed.tags,
      listId: currentListId,
      recurrence: parsed.recurrence,
      reminder: parsed.reminder,
      subTasks: [],
    });
  }, [addTask, currentListId]);

  // ── Shared List Task Operations ──────────────────────────
  // Helper: ensure sharedLists[sharedListId] is populated (fetch from Firestore if needed)
  const ensureSharedListData = useCallback(async (sharedListId: string): Promise<SharedListData | null> => {
    const existing = sharedLists[sharedListId];
    if (existing) return existing;
    // sharedLists hasn't been populated yet (subscription may not have fired).
    // Fetch the current snapshot from Firestore to get authoritative data.
    const snapshot = await getSharedSnapshot(sharedListId);
    if (!snapshot) return null;
    const data: SharedListData = { list: snapshot.list, tasks: snapshot.tasks, ownerName: snapshot.ownerName };
    saveSharedList(sharedListId, data);
    setSharedLists(getSharedLists());
    return data;
  }, [sharedLists]);

  const quickAddToShared = useCallback((sharedListId: string, input: string): string | null => {
    if (!input.trim()) return null;
    const parsed = parseNaturalLanguage(input);
    const id = generateId();
    const now = new Date().toISOString();
    const task: Task = {
      id,
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority,
      status: "todo",
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      tags: parsed.tags,
      listId: sharedListId,
      recurrence: parsed.recurrence,
      reminder: parsed.reminder,
      subTasks: [],
      createdAt: now,
      updatedAt: now,
      focusMinutes: 0,
      isArchived: false,
      order: 0,
      createdBy: user?.uid,
    };

    // Find shared list data
    const data = sharedLists[sharedListId];
    if (!data) {
      // sharedLists not yet populated — fetch from Firestore first
      console.log("[SharedList] sharedLists not populated, fetching from Firestore...");
      ensureSharedListData(sharedListId).then((fetchedData) => {
        if (!fetchedData) {
          console.error("[SharedList] Failed to fetch shared list data");
          return;
        }
        const updatedTasks = [task, ...fetchedData.tasks];
        const updatedData: SharedListData = { ...fetchedData, tasks: updatedTasks };
        saveSharedList(sharedListId, updatedData);
        setSharedLists(getSharedLists());
        
        const ownerId = fetchedData.list.ownerId ?? "";
        console.log("[SharedList] Writing new task to Firestore, ownerId:", ownerId);
        updateSharedSnapshot(
          sharedListId,
          updatedData.list,
          updatedTasks,
          ownerId,
          fetchedData.ownerName,
          (writtenTasks) => {
            snapshotTasksRef.current[sharedListId] = writtenTasks;
            const hash = JSON.stringify(writtenTasks.map(t => `${t.id}:${t.updatedAt}`).sort());
            lastSyncedHashRef.current[sharedListId] = hash;
            console.log("[SharedList] Task saved to Firestore, hash updated to:", hash.substring(0, 30));
          }
        ).catch((error) => console.error("[SharedList] Failed to save task to Firestore:", error));
      });
      return id; // Return id so UI doesn't show error
    }

    // Add task to local state
    const updatedTasks = [task, ...data.tasks];
    const updatedData: SharedListData = { ...data, tasks: updatedTasks };
    saveSharedList(sharedListId, updatedData);
    setSharedLists(getSharedLists());

    const ownerId = data.list.ownerId ?? "";
    if (!ownerId) {
      console.error("[SharedList] CRITICAL: ownerId is empty!", {
        sharedListId,
        dataList: data.list,
      });
    }
    console.log("[SharedList] Writing new task to Firestore, ownerId:", ownerId);

    // Write to Firestore with error handling
    updateSharedSnapshot(
      sharedListId,
      updatedData.list,
      updatedTasks,
      ownerId,
      data.ownerName,
      (writtenTasks) => {
        // Update refs after successful write so subscription doesn't overwrite
        snapshotTasksRef.current[sharedListId] = writtenTasks;
        const hash = JSON.stringify(writtenTasks.map(t => `${t.id}:${t.updatedAt}`).sort());
        lastSyncedHashRef.current[sharedListId] = hash;
        console.log("[SharedList] Task saved to Firestore, hash updated to:", hash.substring(0, 30));
      }
    ).catch((error) => {
        console.error("[SharedList] Failed to save task to Firestore:", error);
        // If Firestore write fails, remove the task from local state
        const revertedTasks = data.tasks;
        const revertedData: SharedListData = { ...data, tasks: revertedTasks };
        saveSharedList(sharedListId, revertedData);
        setSharedLists(getSharedLists());
      });

    return id;
  }, [sharedLists, user, ensureSharedListData]);

  const updateSharedTask = useCallback((sharedListId: string, taskId: string, updates: Partial<Task>) => {
    const data = sharedLists[sharedListId];
    if (!data) return;
    
    const updatedTasks = data.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    const updatedData: SharedListData = { ...data, tasks: updatedTasks };
    saveSharedList(sharedListId, updatedData);
    setSharedLists(getSharedLists());
    
    const ownerId = data.list.ownerId ?? "";
    updateSharedSnapshot(
      sharedListId,
      updatedData.list,
      updatedTasks,
      ownerId,
      data.ownerName,
      (writtenTasks) => {
        snapshotTasksRef.current[sharedListId] = writtenTasks;
        const hash = JSON.stringify(writtenTasks.map(t => `${t.id}:${t.updatedAt}`).sort());
        lastSyncedHashRef.current[sharedListId] = hash;
      }
    ).catch((error) => {
      console.error("[SharedList] Failed to update task:", error);
      // Revert on failure
      saveSharedList(sharedListId, data);
      setSharedLists(getSharedLists());
    });
  }, [sharedLists, ensureSharedListData]);

  const deleteSharedTask = useCallback((sharedListId: string, taskId: string) => {
    const data = sharedLists[sharedListId];
    if (!data) return;
    
    const updatedTasks = data.tasks.filter((t) => t.id !== taskId);
    const updatedData: SharedListData = { ...data, tasks: updatedTasks };
    saveSharedList(sharedListId, updatedData);
    setSharedLists(getSharedLists());
    
    const ownerId = data.list.ownerId ?? "";
    updateSharedSnapshot(
      sharedListId,
      updatedData.list,
      updatedTasks,
      ownerId,
      data.ownerName,
      (writtenTasks) => {
        snapshotTasksRef.current[sharedListId] = writtenTasks;
        const hash = JSON.stringify(writtenTasks.map(t => `${t.id}:${t.updatedAt}`).sort());
        lastSyncedHashRef.current[sharedListId] = hash;
      }
    ).catch((error) => {
      console.error("[SharedList] Failed to delete task:", error);
      // Revert on failure
      saveSharedList(sharedListId, data);
      setSharedLists(getSharedLists());
    });
  }, [sharedLists, ensureSharedListData]);

  // ── Notifications ─────────────────────────────────────────
  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === "undefined") return false;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    return result === "granted";
  }, []);

  const value: AppContextValue = {
    tasks,
    lists,
    habits,
    todayFocusMinutes,
    currentView,
    currentListId,
    setCurrentView,
    currentSharedListId,
    setCurrentSharedList,
    searchQuery,
    setSearchQuery,
    activeFilter, setActiveFilter,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    archiveTask,
    unarchiveTask,
    addSubTask,
    toggleSubTask,
    deleteSubTask,
    completeRecurringAndClone,
    addList,
    updateList,
    deleteList,
    addHabit,
    updateHabit,
    deleteHabit,
    checkinHabit: checkinHabitFn,
    quickAdd,
    requestNotificationPermission,
    notificationPermission,
    getFilteredTasks,
    viewCounts,
    getListTaskCount,
    getTagCounts,
    forceReload: () => setReloadKey((k) => k + 1),
    // Shared lists
    sharedLists,
    sharedListIds: Object.keys(sharedLists),
    shareList,
    unshareList,
    acceptSharedList,
    removeAcceptedSharedList,
    checkIncomingShareLink,
    quickAddToShared,
    updateSharedTask,
    deleteSharedTask,
  };

  if (!isLoaded) return null;

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────
function computeHabitStreak(habit: Habit, checkins: Habit["checkins"]): number {
  if (checkins.length === 0) return 0;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const doneDates = checkins.filter((c) => c.completed).map((c) => c.date).sort().reverse();
  if (doneDates.length === 0) return 0;
  if (doneDates[0] !== today && doneDates[0] !== yesterday) return 0;
  let streak = 0;
  const dateSet = new Set(doneDates);
  const d = new Date(doneDates[0]);
  while (dateSet.has(d.toISOString().split("T")[0])) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function getNextRecurrenceDate(from: string, recurrence: Recurrence): string {
  const d = new Date(from);
  switch (recurrence.pattern) {
    case "daily":
      d.setDate(d.getDate() + recurrence.interval);
      break;
    case "weekly":
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        d.setDate(d.getDate() + 1);
        while (!recurrence.daysOfWeek.includes(d.getDay())) {
          d.setDate(d.getDate() + 1);
        }
      } else {
        d.setDate(d.getDate() + 7 * recurrence.interval);
      }
      break;
    case "monthly":
      d.setMonth(d.getMonth() + recurrence.interval);
      if (recurrence.dayOfMonth) {
        d.setDate(Math.min(recurrence.dayOfMonth, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      }
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + recurrence.interval);
      break;
    case "custom":
      d.setDate(d.getDate() + recurrence.interval);
      break;
  }
  return d.toISOString().split("T")[0];
}
