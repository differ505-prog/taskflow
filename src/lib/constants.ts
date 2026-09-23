// ── Time Windows (ms) ────────────────────────────────────────────
export const RECENT_WRITE_WINDOW_MS = 5_000;
export const EDIT_ACTIVITY_WINDOW_MS = 30_000;
export const RECENT_DELETE_WINDOW_MS = 10_000;
export const UNDO_WINDOW_MS = 5_000;
export const ACTIVE_THROTTLE_MS = 30_000;

// ── Completed Task Retention ──────────────────────────────────────
export const COMPLETED_TASK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// ── App Views ────────────────────────────────────────────────────
export type AppView =
  | "inbox"
  | "today"
  | "next7days"
  | "pinned"
  | "shared"
  | "calendar"
  | "habits"
  | "tags"
  | "settings"
  | "zen"
  | "shared-list"
  | "shared-inbox"
  | "admin"
  | "list";

// ── View Labels ──────────────────────────────────────────────────
export const VIEW_LABELS: Record<AppView, string> = {
  inbox: "收集箱",
  today: "今天",
  next7days: "即將到來",
  pinned: "釘選",
  shared: "共享",
  calendar: "日曆",
  habits: "習慣",
  tags: "標籤",
  settings: "設定",
  zen: "禪",
  "shared-list": "共享清單",
  "shared-inbox": "共享收集箱",
  admin: "管理",
  list: "列表",
};
