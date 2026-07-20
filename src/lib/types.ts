/**
 * 優先級 4 值（艾森豪四象限語意化）
 * - do-now      速辦：立即處理（24h 內到期，或顯式標記）
 * - schedule    排程：重要但未到期限，列入日程
 * - delegate    轉交：可委派或併購的事
 * - none        暫緩：低優先（保留而非刪除，避免決策疲勞）
 *
 * 設計原則：
 * 1. 語意 > 抽象（do-now 比 urgent 更具行動指引）
 * 2. 動詞命名：告訴用戶「下一步該做什麼」
 * 3. 避免「緊急」誤用：用「速辦」對齊 do-now 含義，「緊急」僅是輔助視覺標記
 */
export type Priority = "do-now" | "schedule" | "delegate" | "none";

/**
 * Eisenhower 四象限：Q1 為「重要且緊急」、Q2「重要不緊急」、Q3「緊急不重要」、Q4「不重要不緊急」
 * 與 Priority 同義，純視覺層（給 Q1 badge、自動偵測等用）
 */
export type EisenhowerQuadrant = "do-now" | "schedule" | "delegate" | "none";

/**
 * 老資料型別（向後相容，僅用於遷移判斷）
 */
/**
 * 老資料型別（向後相容，僅用於遷移判斷）
 */
export type LegacyPriority = "urgent" | "high" | "medium" | "low";

/**
 * 老資料遷移對照表（lazy migration）
 * urgent → do-now（兩者語意接近：「立即做」）
 * high → schedule（語意：「重要但未到期限」）
 * medium → delegate（語意：「可併購或委派」）
 * low → none（語意：「暫緩」）
 */
export const LEGACY_PRIORITY_MAP: Record<LegacyPriority, Priority> = {
  urgent: "do-now",
  high: "schedule",
  medium: "delegate",
  low: "none",
};

/**
 * Lazy migration：把舊 priority 值轉換成新值
 * 對於無效值（null/undefined/未知字串），fallback 到 "none"
 */
export function migratePriority(p: unknown): Priority {
  if (p === "do-now" || p === "schedule" || p === "delegate" || p === "none") return p;
  if (p === "urgent" || p === "high" || p === "medium" || p === "low") return LEGACY_PRIORITY_MAP[p];
  return "none";
}

/**
 * 排序權重：do-now > schedule > delegate > none
 */
export const PRIORITY_RANK: Record<Priority, number> = {
  "do-now": 0,
  schedule: 1,
  delegate: 2,
  none: 3,
};

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
export type UserRole = "admin" | "pro" | "beta" | "free";

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
  pro: {
    label: "PRO 用戶",
    description: "完整權限：自訂標籤顏色、總覽儀表板、批次操作",
    canUpload: true,
    maxFileSizeMB: 50,
    badgeColor: "#F59E0B",
    badgeBg: "rgba(245, 158, 11, 0.12)",
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

// PRO 用戶邮箱列表（環境變數控制，沿用 ADMIN_EMAILS 模式）
const PRO_EMAILS_ENV = process.env.NEXT_PUBLIC_PRO_EMAILS || "";
export const PRO_EMAILS: string[] = PRO_EMAILS_ENV
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
  isPinned?: boolean; // 置頂（全域排序加權）
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

export type AppView = "inbox" | "today" | "next7days" | "all" | "calendar" | "habits" | "tags" | "list" | "stats" | "shared" | "archived" | "pinned" | "quadrant";

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
  archivedAt?: string;
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
  // Eisenhower 四象限計數（用於 Sidebar / Quadrant Radar 視圖）
  q1: number; // 速辦 (do-now)
  q2: number; // 排程 (schedule)
  q3: number; // 轉交 (delegate)
  q4: number; // 暫緩 (none)
}

// ─── Config Constants ──────────────────────────────────────────

/**
 * Priority 顯示設定（艾森豪四象限視覺）
 * - emoji 為主視覺（語意傳達：速辦/排程/轉交/暫緩）
 * - color 為輔助（Calendar / Stats / 統一色塊）
 * - dot 用於小尺寸場景（Badge 旁小圓點、Calendar 指示器）
 */
export interface PriorityDisplay {
  label: string;
  emoji: string;
  color: string;
  colorHex: string;
  dot: string;
  qLabel: string;
  subtitle: string;
}

export const PRIORITY_CONFIG: Record<Priority, PriorityDisplay> = {
  "do-now": {
    label: "速辦",
    emoji: "🔥",
    color: "var(--priority-do-now)",
    colorHex: "#D70015",
    dot: "#D70015",
    qLabel: "Q1",
    subtitle: "立即處理",
  },
  schedule: {
    label: "排程",
    emoji: "🗓️",
    color: "var(--priority-schedule)",
    colorHex: "#F97316",
    dot: "#F97316",
    qLabel: "Q2",
    subtitle: "排入日程",
  },
  delegate: {
    label: "轉交",
    emoji: "🤝",
    color: "var(--priority-delegate)",
    colorHex: "#EAB308",
    dot: "#EAB308",
    qLabel: "Q3",
    subtitle: "可委派",
  },
  none: {
    label: "暫緩",
    emoji: "💤",
    color: "var(--priority-none)",
    colorHex: "#9CA3AF",
    dot: "#9CA3AF",
    qLabel: "Q4",
    subtitle: "留著就好",
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
