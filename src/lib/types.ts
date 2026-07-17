export type Priority = "high" | "medium" | "low";
export type TaskStatus = "todo" | "in-progress" | "done";

// ─── Attachments ────────────────────────────────────────────────
export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: "image" | "file";
  size: number; // bytes
  mimeType: string;
  uploadedAt: string;
  storagePath?: string; // Firebase Storage path for deletion
}

// ─── User Roles & Permissions ───────────────────────────────────
export type UserRole = "admin" | "beta" | "free";

export interface RoleConfig {
  label: string;
  description: string;
  canUpload: boolean;
  maxFileSizeMB: number;
  badgeColor: string;
  badgeBg: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  admin: {
    label: "創辦人",
    description: "無限上傳，無容量限制",
    canUpload: true,
    maxFileSizeMB: Infinity,
    badgeColor: "#3B82F6",
    badgeBg: "rgba(59, 130, 246, 0.12)",
  },
  beta: {
    label: "早期測試者",
    description: "可上傳，最大 5MB/單檔",
    canUpload: true,
    maxFileSizeMB: 5,
    badgeColor: "#8B5CF6",
    badgeBg: "rgba(139, 92, 246, 0.12)",
  },
  free: {
    label: "免費用戶",
    description: "上傳功能暫未開放",
    canUpload: false,
    maxFileSizeMB: 0,
    badgeColor: "#6B7280",
    badgeBg: "rgba(107, 114, 128, 0.1)",
  },
};

// 管理員邮箱列表（完全由環境變數控制，不允許 hardcode）
const ADMIN_EMAILS_ENV = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
export const ADMIN_EMAILS: string[] = ADMIN_EMAILS_ENV
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export type RecurrencePattern =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom";

export interface Recurrence {
  pattern: RecurrencePattern;
  interval: number; // every N days/weeks/months
  daysOfWeek?: number[]; // 0=Sun..6=Sat, for weekly
  dayOfMonth?: number; // 1-31, for monthly
  endDate?: string; // ISO date when recurrence stops
  completedCount: number;
}

export interface SubTask {
  id: string;
  title: string;
  status: "todo" | "done";
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  startDate?: string; // 區間起點（ISO date string YYYY-MM-DD）
  dueDate?: string;   // 截止日 / 區間終點（ISO date string YYYY-MM-DD）
  dueTime?: string;   // HH:mm
  createdAt: string; // ISO datetime
  updatedAt: string;
  tags: string[];
  listId?: string;
  parentId?: string; // for sub-tasks
  subTasks?: SubTask[];
  recurrence?: Recurrence;
  reminder?: string; // ISO datetime string
  isArchived: boolean;
  completedAt?: string; // ISO datetime，任務被標記為完成時的時間戳
  focusMinutes: number; // total Pomodoro minutes logged
  order: number; // sort order within view
  createdBy?: string; // uid of the user who created this task (for shared lists)
  attachments?: Attachment[]; // 上傳的附件
}

export interface TaskFilter {
  status?: TaskStatus;
  priority?: Priority;
  tag?: string;
  listId?: string;
  search?: string;
  view?: AppView;
}

export type AppView = "inbox" | "today" | "next7days" | "all" | "calendar" | "habits" | "tags" | "list" | "stats" | "shared" | "archived";

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface TaskList {
  id: string;
  name: string;
  icon: string; // emoji or lucide icon name
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  // ── Sharing ────────────────────────────────────────────────
  sharedId?: string; // non-empty = this list is shared; value is the share token
  ownerId?: string;  // uid of the list owner (empty for own lists)
}

export interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: "daily" | "weekly" | "custom";
  daysOfWeek?: number[]; // for weekly
  targetCount: number; // e.g. 1 for daily, 7 for weekly
  color: string;
  createdAt: string;
  updatedAt: string;
  checkins: HabitCheckin[];
  streak: number;
  longestStreak: number;
}

export interface HabitCheckin {
  date: string; // YYYY-MM-DD
  completed: boolean;
  count: number; // how many times checked in that day
  note?: string;
}

export interface PomodoroSession {
  id: string;
  taskId?: string;
  startTime: string; // ISO datetime
  endTime?: string;
  durationMinutes: number;
  type: "focus" | "break" | "long-break";
  completed: boolean;
}

// ─── View Counts ───────────────────────────────────────────────
export interface ViewCounts {
  inbox: number;
  today: number;
  next7days: number;
}

// ─── Config Constants ──────────────────────────────────────────
export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  high: {
    label: "高",
    color: "text-red-600",
    bg: "bg-red-50",
    dot: "#FF3B30",
  },
  medium: {
    label: "中",
    color: "text-amber-600",
    bg: "bg-amber-50",
    dot: "#FF9500",
  },
  low: {
    label: "低",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    dot: "#34C759",
  },
};

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  "todo": {
    label: "待辦",
    color: "text-slate-600",
    bg: "bg-slate-100",
  },
  "in-progress": {
    label: "進行中",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  "done": {
    label: "已完成",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
};

export const DEFAULT_LISTS: Omit<TaskList, "id" | "createdAt" | "updatedAt">[] = [
  { name: "收集箱", icon: "📥", color: "#636366", order: 0 },
];
// 預設清單使用固定 id，避免多設備之間重複建立（因為 DEFAULT_LISTS 對應的清單本該只有一份）
export const DEFAULT_LIST_IDS: Record<string, string> = {
  "收集箱": "init:inbox",
};

// ─── Shared List Types ──────────────────────────────────────────
export interface SharedListMeta {
  id: string; // same as sharedListSnapshots/{id}
  ownerId: string;
  listId: string;
  ownerName?: string;
  createdAt: string;
}

export interface SharedListSnapshot {
  list: TaskList;
  tasks: Task[];
  ownerId: string;
  ownerName?: string;
  updatedAt: string;
}

export const TAG_COLORS = [
  "#3B82F6", "#8B5CF6", "#EC4899", "#EF4444",
  "#F97316", "#EAB308", "#22C55E", "#14B8A6",
  "#06B6D4", "#6366F1",
];
