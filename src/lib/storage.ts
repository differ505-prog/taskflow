import { Task, TaskList, Habit, PomodoroSession, Tag, DEFAULT_LISTS } from "./types";

const TASKS_KEY = "taskflow_tasks";
const LISTS_KEY = "taskflow_lists";
const HABITS_KEY = "taskflow_habits";
const POMODORO_KEY = "taskflow_pomodoro";
const TAGS_KEY = "taskflow_tags";

// ─── Generic helpers ────────────────────────────────────────────
function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const data = localStorage.getItem(key);
    return data ? (JSON.parse(data) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn("Storage write failed for:", key);
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Tasks ──────────────────────────────────────────────────────
export function getTasks(): Task[] {
  return read<Task[]>(TASKS_KEY, []);
}

export function saveTasks(tasks: Task[]): void {
  write(TASKS_KEY, tasks);
}

export function initDefaultLists(): TaskList[] {
  const existing = read<TaskList[]>(LISTS_KEY, []);
  if (existing.length === 0) {
    const defaults = DEFAULT_LISTS.map((l) => ({
      ...l,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    write(LISTS_KEY, defaults);
    return defaults;
  }
  return existing;
}

// ─── Lists ──────────────────────────────────────────────────────
export function getLists(): TaskList[] {
  return read<TaskList[]>(LISTS_KEY, []);
}

export function saveLists(lists: TaskList[]): void {
  write(LISTS_KEY, lists);
}

export function addList(list: Omit<TaskList, "id" | "createdAt" | "updatedAt">): TaskList {
  const newList: TaskList = {
    ...list,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const lists = getLists();
  lists.push(newList);
  saveLists(lists);
  return newList;
}

export function updateList(id: string, updates: Partial<TaskList>): void {
  const lists = getLists().map((l) =>
    l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
  );
  saveLists(lists);
}

export function deleteList(id: string): void {
  const lists = getLists().filter((l) => l.id !== id);
  saveLists(lists);
  // Unlink tasks from deleted list
  const tasks = getTasks().map((t) =>
    t.listId === id ? { ...t, listId: undefined } : t
  );
  saveTasks(tasks);
}

// ─── Habits ──────────────────────────────────────────────────────
export function getHabits(): Habit[] {
  return read<Habit[]>(HABITS_KEY, []);
}

export function saveHabits(habits: Habit[]): void {
  write(HABITS_KEY, habits);
}

export function addHabit(habit: Omit<Habit, "id" | "createdAt" | "updatedAt" | "checkins" | "streak" | "longestStreak">): Habit {
  const newHabit: Habit = {
    ...habit,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    checkins: [],
    streak: 0,
    longestStreak: 0,
  };
  const habits = getHabits();
  habits.push(newHabit);
  saveHabits(habits);
  return newHabit;
}

export function updateHabit(id: string, updates: Partial<Habit>): void {
  const habits = getHabits().map((h) =>
    h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h
  );
  saveHabits(habits);
}

export function deleteHabit(id: string): void {
  saveHabits(getHabits().filter((h) => h.id !== id));
}

export function checkinHabit(id: string, date: string, count = 1, note?: string): void {
  const habits = getHabits().map((h) => {
    if (h.id !== id) return h;
    const existing = h.checkins.find((c) => c.date === date);
    let checkins: Habit["checkins"];
    if (existing) {
      checkins = h.checkins.map((c) =>
        c.date === date ? { ...c, count: c.count + count, note: note ?? c.note } : c
      );
    } else {
      checkins = [...h.checkins, { date, completed: true, count, note }];
    }
    const streak = computeStreak(h, checkins);
    const longestStreak = Math.max(h.longestStreak, streak);
    return { ...h, checkins, streak, longestStreak, updatedAt: new Date().toISOString() };
  });
  saveHabits(habits);
}

function computeStreak(habit: Habit, checkins: Habit["checkins"]): number {
  if (checkins.length === 0) return 0;
  const sortedDates = checkins
    .filter((c) => c.completed)
    .map((c) => c.date)
    .sort()
    .reverse();

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0;

  let streak = 0;
  const dateSet = new Set(sortedDates);
  const d = new Date(sortedDates[0]);
  while (dateSet.has(d.toISOString().split("T")[0])) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ─── Pomodoro ───────────────────────────────────────────────────
export function getPomodoroSessions(): PomodoroSession[] {
  return read<PomodoroSession[]>(POMODORO_KEY, []);
}

export function savePomodoroSessions(sessions: PomodoroSession[]): void {
  write(POMODORO_KEY, sessions);
}

export function addPomodoroSession(session: Omit<PomodoroSession, "id">): PomodoroSession {
  const newSession: PomodoroSession = {
    ...session,
    id: generateId(),
  };
  const sessions = getPomodoroSessions();
  sessions.push(newSession);
  savePomodoroSessions(sessions);
  return newSession;
}

export function getTodayFocusMinutes(): number {
  const today = new Date().toISOString().split("T")[0];
  return getPomodoroSessions()
    .filter((s) => s.completed && s.type === "focus" && s.startTime.startsWith(today))
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

// ─── Tags ───────────────────────────────────────────────────────
export function getTags(): Tag[] {
  return read<Tag[]>(TAGS_KEY, []);
}

export function saveTags(tags: Tag[]): void {
  write(TAGS_KEY, tags);
}

// ─── Export / Clear All ─────────────────────────────────────────
export function exportAllData(): string {
  return JSON.stringify({
    tasks: getTasks(),
    lists: getLists(),
    habits: getHabits(),
    pomodoro: getPomodoroSessions(),
    tags: getTags(),
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

export function clearAllData(): void {
  [TASKS_KEY, LISTS_KEY, HABITS_KEY, POMODORO_KEY, TAGS_KEY].forEach((k) =>
    localStorage.removeItem(k)
  );
}
