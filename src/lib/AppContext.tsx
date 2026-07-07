"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
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
} from "./storage";
import { parseNaturalLanguage } from "./nlp";

interface AppContextValue {
  // ── Data ────────────────────────────────────────────────
  tasks: Task[];
  lists: TaskList[];
  habits: Habit[];
  todayFocusMinutes: number;

  // ── View ────────────────────────────────────────────────
  currentView: AppView;
  currentListId?: string;
  setCurrentView: (v: AppView, listId?: string) => void;

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

  // ── Helpers ──────────────────────────────────────────────
  getFilteredTasks: () => Task[];
  viewCounts: { inbox: number; today: number; next7days: number };
  getListTaskCount: (listId: string) => number;
  getTagCounts: () => Record<string, number>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayFocusMinutes, setTodayFocusMinutes] = useState(0);
  const [currentView, setCurrentViewState] = useState<AppView>("inbox");
  const [currentListId, setCurrentListId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TaskFilter>({});
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "default">("default");
  const [isLoaded, setIsLoaded] = useState(false);

  // ── Init ────────────────────────────────────────────────
  useEffect(() => {
    const storedLists = initDefaultLists();
    setLists(storedLists);
    setTasks(getTasks());
    setHabits(getHabits());
    setTodayFocusMinutes(getTodayFocusMinutes());

    if (typeof Notification !== "undefined") {
      setNotificationPermission(Notification.permission);
    }
    setIsLoaded(true);
  }, []);

  const setCurrentView = useCallback((v: AppView, listId?: string) => {
    setCurrentViewState(v);
    setCurrentListId(listId);
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
    }
    // inbox = all active tasks (no date filter)

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
      inbox: active.length,
      today: active.filter((t) => t.dueDate === today).length,
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
