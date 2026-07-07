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

// ─── CSV Export ─────────────────────────────────────────────────
export function exportTasksToCSV(tasks: Task[]): string {
  const headers = ["標題", "描述", "優先級", "狀態", "截止日期", "截止時間", "標籤", "循環模式", "建立時間", "專注分鐘"];
  const rows = tasks.map((t) => [
    `"${(t.title || "").replace(/"/g, '""')}"`,
    `"${(t.description || "").replace(/"/g, '""')}"`,
    t.priority,
    t.status,
    t.dueDate || "",
    t.dueTime || "",
    `"${(t.tags || []).join(", ")}"`,
    t.recurrence ? `${t.recurrence.pattern} (每隔${t.recurrence.interval})` : "",
    t.createdAt,
    t.focusMinutes || 0,
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportHabitsToCSV(habits: Habit[]): string {
  const headers = ["名稱", "目標描述", "頻率", "建立時間", "連續天數", "最長連續", "總打卡次數"];
  const rows = habits.map((h) => [
    `"${(h.title || "").replace(/"/g, '""')}"`,
    `"${(h.description || "").replace(/"/g, '""')}"`,
    h.frequency,
    h.createdAt,
    h.streak,
    h.longestStreak,
    h.checkins.length,
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCSV(content: string, filename: string) {
  downloadBlob(content, filename, "text/csv;charset=utf-8");
}

export function downloadJSON(data: string, filename: string) {
  downloadBlob(data, filename, "application/json;charset=utf-8");
}

// ─── JSON Import ────────────────────────────────────────────────
export interface ImportResult {
  success: boolean;
  tasks: number;
  habits: number;
  lists: number;
  pomodoro: number;
  tags: number;
  errors: string[];
}

export function importData(
  jsonString: string,
  existingTasks: Task[],
  existingHabits: Habit[],
  existingLists: TaskList[]
): ImportResult {
  const errors: string[] = [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { success: false, tasks: 0, habits: 0, lists: 0, pomodoro: 0, tags: 0, errors: ["JSON 格式無效"] };
  }

  const validateArray = (key: string) =>
    Array.isArray(parsed[key]) ? parsed[key] : [];

  const importedTasks: Task[] = validateArray("tasks").map((t, i) => {
    if (!t.title || typeof t.title !== "string") {
      errors.push(`任務 ${i + 1} 缺少標題`);
      return null;
    }
    return {
      ...t,
      id: generateId(),
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Task;
  }).filter(Boolean) as Task[];

  const importedHabits: Habit[] = validateArray("habits").map((h, i) => {
    if (!h.title && !h.name) {
      errors.push(`習慣 ${i + 1} 缺少標題`);
      return null;
    }
    return {
      ...h,
      id: generateId(),
      title: h.title || h.name,
      createdAt: h.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checkins: h.checkins || [],
    } as Habit;
  }).filter(Boolean) as Habit[];

  const importedLists: TaskList[] = validateArray("lists").map((l: any, i) => {
    if (!l.name || typeof l.name !== "string") {
      errors.push(`清單 ${i + 1} 缺少名稱`);
      return null;
    }
    return {
      ...l,
      id: generateId(),
      createdAt: l.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as TaskList;
  }).filter(Boolean) as TaskList[];

  return {
    success: true,
    tasks: importedTasks.length,
    habits: importedHabits.length,
    lists: importedLists.length,
    pomodoro: validateArray("pomodoro").length,
    tags: validateArray("tags").length,
    errors,
  };
}
