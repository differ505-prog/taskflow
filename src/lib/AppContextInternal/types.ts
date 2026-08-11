// ── AppContext Value Interface ─────────────────────────────────
export interface AppContextValue {
  // ── 資料 ──────────────────────────────────────────────
  tasks: import("../types").Task[];
  lists: import("../types").TaskList[];
  habits: import("../types").Habit[];
  todayFocusMinutes: number;
  isAppReady: boolean;
  tasksInitialized: boolean;
  forceReload: () => void;

  // ── View ──────────────────────────────────────────────
  currentView: import("../types").AppView;
  currentListId?: string;
  setCurrentView: (v: import("../types").AppView, listId?: string) => void;
  currentSharedListId?: string;
  setCurrentSharedList: (sharedId: string | undefined) => void;

  // ── 搜尋/篩選 ──────────────────────────────────────────
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeFilter: import("../types").TaskFilter;
  setActiveFilter: (f: import("../types").TaskFilter) => void;

  // ── 任務 CRUD ──────────────────────────────────────────
  addTask: (data: Omit<import("../types").Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">) => string;
  addTaskLocalOnly: (
    datas: Omit<import("../types").Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order" | "ownerUid">[]
  ) => string[];
  batchAddTasks: (
    datas: Omit<import("../types").Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">[]
  ) => string[];
  updateTask: (id: string, updates: Partial<import("../types").Task>) => void;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => void;
  markEditingActivity: (id: string) => void;
  clearEditingActivity: (id: string) => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  escapeTask: (id: string) => void;

  // ── 子任務 ─────────────────────────────────────────────
  addSubTask: (parentId: string, title: string) => void;
  toggleSubTask: (parentId: string, subId: string) => void;
  deleteSubTask: (parentId: string, subId: string) => void;
  reorderSubTasks: (parentId: string, newTodoSubs: import("../types").SubTask[]) => void;

  // ── 週期 ──────────────────────────────────────────────
  completeRecurringAndClone: (taskId: string) => void;
  completeTask: (taskId: string) => void;

  // ── 清單 CRUD ──────────────────────────────────────────
  addList: (data: Omit<import("../types").TaskList, "id" | "createdAt" | "updatedAt" | "order">) => string;
  updateList: (id: string, updates: Partial<import("../types").TaskList>) => void;
  deleteList: (id: string) => void;
  reorderLists: (newListOrder: import("../types").TaskList[]) => void;
  reorderTasks: (reorderedTasks: import("../types").Task[]) => void;
  saveTasksDirectly: (updatedTasks: import("../types").Task[]) => void;

  // ── 習慣 CRUD ─────────────────────────────────────────
  addHabit: (data: Omit<import("../types").Habit, "id" | "createdAt" | "updatedAt" | "checkins" | "streak" | "longestStreak">) => void;
  updateHabit: (id: string, updates: Partial<import("../types").Habit>) => void;
  archiveHabit: (id: string) => void;
  unarchiveHabit: (id: string) => void;
  checkinHabit: (id: string, date: string, count?: number, note?: string) => void;
  uncheckHabit: (id: string, date: string) => void;

  // ── Quick Add ──────────────────────────────────────────
  quickAdd: (input: string, currentView?: string) => string | null;

  // ── 通知 ──────────────────────────────────────────────
  requestNotificationPermission: () => Promise<boolean>;
  notificationPermission: NotificationPermission | "default";
  setNotificationPermission: (perm: NotificationPermission | "default") => void;

  // ── Shared Lists ──────────────────────────────────────
  sharedLists: Record<string, import("../storage").SharedListData>;
  sharedListIds: string[];
  acceptedSharedListIds: string[];
  shareList: (listId: string) => Promise<string | null>;
  unshareList: (sharedListId: string) => Promise<void>;
  acceptSharedList: (sharedListId: string, data: import("../types").SharedListSnapshot) => void;
  removeAcceptedSharedList: (sharedListId: string) => void;
  checkIncomingShareLink: () => Promise<{ sharedListId: string; snapshot: import("../types").SharedListSnapshot } | null>;
  quickAddToShared: (sharedListId: string, input: string) => string | null;
  updateSharedTask: (sharedListId: string, taskId: string, updates: Partial<import("../types").Task>) => void;
  deleteSharedTask: (sharedListId: string, taskId: string) => void;
  reorderSharedTask: (sharedListId: string, taskId: string, position: number) => Promise<void>;

  // ── Members ───────────────────────────────────────────
  listSharedMembers: (sharedListId: string) => Promise<import("../sharedSync").SharedMember[]>;
  inviteToSharedList: (sharedListId: string, email: string, role: import("../sharedSync").MemberRole) => Promise<void>;
  kickFromSharedList: (sharedListId: string, email: string) => Promise<void>;
  changeSharedMemberRole: (sharedListId: string, email: string, role: import("../sharedSync").MemberRole) => Promise<void>;
  getMyRole: (sharedListId: string) => import("../sharedSync").MemberRole | null;
  membersBySharedList: Record<string, import("../sharedSync").SharedMember[]>;

  // ── 工具 ─────────────────────────────────────────────
  getFilteredTasks: () => import("../types").Task[];
  viewCounts: { inbox: number; today: number; next7days: number; q1: number; q2: number; q3: number; q4: number };
  getListTaskCount: (listId: string) => number;
  getTagCounts: () => Record<string, number>;
}
