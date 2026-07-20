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
  DEFAULT_LIST_IDS,
  migratePriority,
  PRIORITY_RANK,
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
import { deleteFile } from "./storageUpload";
import {
  createSharedList,
  updateSharedSnapshot,
  subscribeToSharedSnapshot,
  deleteSharedList,
  getSharedSnapshot,
  kickFromSharedList,
  bindCurrentUserToSharedList,
  getMyRoleInSharedList,
  listSharedMembers,
  setSharedTaskPosition,
} from "./firestore";
import {
  subscribeTasks,
  saveTask as saveTaskFirebase,
  batchSaveTasks as batchSaveTasksFirebase,
  deleteTask as deleteTaskFirebase,
} from "./personalTaskSync";
import {
  subscribeLists as subscribeListsSync,
  batchSaveLists as batchSaveListsFirebase,
  deleteList as deleteListFirebase,
} from "./personalListSync";
import { SharedMember, MemberRole } from "./sharedSync";
import { parseNaturalLanguage } from "./nlp";
import { useAuth } from "./AuthContext";
import { updateLastActive } from "@/lib/userProfiles";
import { triggerWebhook } from "./useWebhook";
import { notifyFirstTaskDone } from "@/lib/useDiscordNotifier";
import { getKnownUserCount } from "@/lib/useNewUserDetection";
import { toast } from "sonner";
import { AppShellSkeleton } from "@/components/Skeleton";
import { dispatchFirstTaskDone } from "@/components/PwaPrompts";

interface AppContextValue {
  // ── 資料 ──────────────────────────────────────────────
  tasks: Task[];
  lists: TaskList[];
  habits: Habit[];
  todayFocusMinutes: number;

  forceReload: () => void;

  // ── View ──────────────────────────────────────────────
  currentView: AppView;
  currentListId?: string;
  setCurrentView: (v: AppView, listId?: string) => void;
  currentSharedListId?: string;
  setCurrentSharedList: (sharedId: string | undefined) => void;

  // ── 搜尋/篩選 ──────────────────────────────────────────
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeFilter: TaskFilter;
  setActiveFilter: (f: TaskFilter) => void;

  // ── 任務 CRUD ──────────────────────────────────────────
  addTask: (data: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => void;
  markEditingActivity: (id: string) => void;
  clearEditingActivity: (id: string) => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;

  // ── 子任務 ─────────────────────────────────────────────
  addSubTask: (parentId: string, title: string) => void;
  toggleSubTask: (parentId: string, subId: string) => void;
  deleteSubTask: (parentId: string, subId: string) => void;

  // ── 週期 ──────────────────────────────────────────────
  completeRecurringAndClone: (taskId: string) => void;

  // ── 清單 CRUD ──────────────────────────────────────────
  addList: (data: Omit<TaskList, "id" | "createdAt" | "updatedAt" | "order">) => string;
  updateList: (id: string, updates: Partial<TaskList>) => void;
  deleteList: (id: string) => void;

  // ── 習慣 CRUD ─────────────────────────────────────────
  addHabit: (data: Omit<Habit, "id" | "createdAt" | "updatedAt" | "checkins" | "streak" | "longestStreak">) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  checkinHabit: (id: string, date: string, count?: number, note?: string) => void;

  // ── Quick Add ──────────────────────────────────────────
  quickAdd: (input: string, currentView?: string) => string | null;

  // ── 通知 ──────────────────────────────────────────────
  requestNotificationPermission: () => Promise<boolean>;
  notificationPermission: NotificationPermission | "default";

  // ── Shared Lists ──────────────────────────────────────
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
  reorderSharedTask: (sharedListId: string, taskId: string, position: number) => Promise<void>;

  // ── Members ───────────────────────────────────────────
  listSharedMembers: (sharedListId: string) => Promise<SharedMember[]>;
  inviteToSharedList: (sharedListId: string, email: string, role: MemberRole) => Promise<void>;
  kickFromSharedList: (sharedListId: string, email: string) => Promise<void>;
  changeSharedMemberRole: (sharedListId: string, email: string, role: MemberRole) => Promise<void>;
  getMyRole: (sharedListId: string) => MemberRole | null;
  membersBySharedList: Record<string, SharedMember[]>;

  // ── 工具 ─────────────────────────────────────────────
  getFilteredTasks: () => Task[];
  viewCounts: { inbox: number; today: number; next7days: number; q1: number; q2: number; q3: number; q4: number };
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
  // ── Webhook outbound：當 tasks/habits/lists 變動時,debounce 500ms 觸發單次 batch 事件 ──
  const lastEmittedSizesRef = useRef({ tasks: 0, habits: 0, lists: 0 });
  const [currentView, setCurrentViewState] = useState<AppView>("inbox");
  const [currentListId, setCurrentListId] = useState<string | undefined>(undefined);
  const [currentSharedListId, setCurrentSharedListIdState] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TaskFilter>({});
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "default">("default");
  const [isLoaded, setIsLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const lastActiveWriteAtRef = useRef<Record<string, number>>({});
  const deletedTaskIdsRef = useRef<Set<string>>(new Set()); // 追蹤本地刪除，待 Firebase 確認後清除
  const previousTasksRef = useRef<Task[]>([]); // 儲存最近刪除前的快照，用於 Undo
  const recentlyWrittenRef = useRef<Map<string, number>>(new Map()); // 追蹤本地剛寫入的 task，5 秒內不被 realtime 推送覆蓋
  const RECENT_WRITE_WINDOW_MS = 5_000;
  // 持續輸入保護：被打開詳情面板的 task,在編輯活動窗內(每 keystroke 重置),不應被遠端覆蓋
  // 避免「打 50 字描述,打到第 30 字時,別人同步一個更新把我的字蓋掉」邊界問題(§26 類別 A 子模式)
  const editingTaskIdsRef = useRef<Set<string>>(new Set()); // 詳情面板開啟中
  const lastEditActivityRef = useRef<Map<string, number>>(new Map()); // 每 task 最後 keystroke 時間
  const EDIT_ACTIVITY_WINDOW_MS = 30_000; // 編輯活動窗(30 秒內有 keystroke 視為「正在編輯」)
  const firstTasksLoadDone = useRef(false); // 跳過 subscribeTasks 初次空資料覆蓋
  const firstListsLoadDone = useRef(false); // 跳過 subscribeListsSync 初次空資料覆蓋
  const ACTIVE_THROTTLE_MS = 30_000;

  // 標記 task 為「剛寫入」；realtime 推送的 fbTask 在窗內不會覆蓋本地版本
  const markRecentlyWritten = useCallback((id: string) => {
    recentlyWrittenRef.current.set(id, Date.now());
  }, []);

  // 標記 task 正在編輯(詳情面板 mount/unmount + 每 keystroke)
  const markEditingActivity = useCallback((id: string) => {
    editingTaskIdsRef.current.add(id);
    lastEditActivityRef.current.set(id, Date.now());
  }, []);
  const clearEditingActivity = useCallback((id: string) => {
    editingTaskIdsRef.current.delete(id);
    lastEditActivityRef.current.delete(id);
  }, []);

  // merge 時呼叫：判斷是否在寫入保護窗內，並順手做 lazy GC
  const isWithinRecentWriteWindow = useCallback((id: string): boolean => {
    const map = recentlyWrittenRef.current;
    const now = Date.now();
    // lazy GC：遍歷清掉過期項目（避免 map 累積）
    for (const [tid, ts] of map) {
      if (now - ts >= RECENT_WRITE_WINDOW_MS) map.delete(tid);
    }
    const ts = map.get(id);
    return ts !== undefined && now - ts < RECENT_WRITE_WINDOW_MS;
  }, []);

  // 持續輸入保護：task 在編輯活動窗內 → 保留本地(防止遠端 echo 覆蓋正在打的字)
  const isWithinEditingActivityWindow = useCallback((id: string): boolean => {
    if (!editingTaskIdsRef.current.has(id)) return false;
    const lastActivity = lastEditActivityRef.current.get(id);
    if (lastActivity === undefined) return false;
    const now = Date.now();
    // lazy GC 過期項目
    const map = lastEditActivityRef.current;
    for (const [tid, ts] of map) {
      if (now - ts >= EDIT_ACTIVITY_WINDOW_MS) {
        map.delete(tid);
        editingTaskIdsRef.current.delete(tid);
      }
    }
    return now - lastActivity < EDIT_ACTIVITY_WINDOW_MS;
  }, []);

  // 同步 tasks 到 ref（給 Firebase listener 用，避免 stale closure）
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // ── Shared List State ───────────────────────────────────
  const [sharedLists, setSharedLists] = useState<Record<string, SharedListData>>({});
  const [ownedSharedListIds, _setOwnedSharedListIds] = useState<string[]>([]);
  const ownedSharedListIdsRef = useRef<string[]>([]);
  const setOwnedSharedListIds = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    _setOwnedSharedListIds((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      ownedSharedListIdsRef.current = next;
      saveOwnedSharedListIds(next);
      return next;
    });
  }, []);
  const [acceptedSharedListIds, setAcceptedSharedListIds] = useState<string[]>([]);
  const sharedListUnsubscribeRefs = useRef<Record<string, () => void>>({});
  const remoteSharedTasksRef = useRef<Record<string, Task[]>>({});
  const lastSyncedHashRef = useRef<Record<string, string>>({});
  const lastSyncedTaskCountRef = useRef<Record<string, number>>({});
  const snapshotReadyRef = useRef<Record<string, boolean>>({});
  const snapshotTasksRef = useRef<Record<string, Task[]>>({});
  const isWritingRef = useRef<Record<string, boolean>>({});
  const fbUnsubRef = useRef<(() => void) | null>(null);
  const listsUnsubRef = useRef<(() => void) | null>(null);
  const myEchoIdsRef = useRef<Set<string>>(new Set<string>()); // 自己剛寫入的 task.id，下次收到 Firebase 推送時跳過
  const tasksRef = useRef<Task[]>([]); // 給 Firebase callback 用，避免 stale closure
  const fbSyncDebug = false; // 由 window.__FB_SYNC_DEBUG__ 控制

  // 我在每個 shared list 的角色
  const [myRoleByList, setMyRoleByList] = useState<Record<string, MemberRole>>({});

  // members 列表（給 ShareListModal 顯示用）
  const [membersBySharedList, setMembersBySharedList] = useState<Record<string, SharedMember[]>>({});

  // ── Init ─────────────────────────────────────────────────
  useEffect(() => {
    const storedLists = initDefaultLists();
    setLists(storedLists);
    setTasks(getTasks());
    setHabits(getHabits());
    setTodayFocusMinutes(getTodayFocusMinutes());
    const storedOwnedIds = getOwnedSharedListIds();
    if (storedOwnedIds.length > 0) {
      _setOwnedSharedListIds(storedOwnedIds);
      ownedSharedListIdsRef.current = storedOwnedIds;
    }
    const storedSharedLists = getSharedLists();
    setSharedLists(storedSharedLists);

    if (typeof Notification !== "undefined") {
      setNotificationPermission(Notification.permission);
    }

    // ── 跨設備同步：Supabase Realtime 訂閱個人任務 + 清單 ──────
    if (user) {
      if (fbUnsubRef.current) fbUnsubRef.current();
      subscribeTasks(user.uid, (fbTasks) => {
        // 跳過第一次（空的初始資料），避免覆蓋本地尚未同步的任務
        if (!firstTasksLoadDone.current) {
          firstTasksLoadDone.current = true;
          return;
        }
        if (fbSyncDebug) console.log("[SUP SYNC] tasks 推送:", fbTasks.length);
        // Merge 而非覆蓋：本地剛寫入（Firestore 還沒同步抵達）時，本地版本優先
        // 避免樂觀更新被雲端舊快照蓋回去（子任務 toggle / 任務狀態切換 第一次 tap 看似跳回）
        setTasks((prev) => {
          const localById = new Map(prev.map((t) => [t.id, t]));
          const fbIds = new Set<string>();
          const merged = fbTasks.map((fbT) => {
            fbIds.add(fbT.id);
            const local = localById.get(fbT.id);
            if (local) {
              // 本地剛寫入（5 秒內）→ 一律保留本地，避免 supabase commit 前即時的回音 / 跨分頁 echo 覆蓋樂觀更新
              if (isWithinRecentWriteWindow(fbT.id)) {
                return local;
              }
              // 持續輸入保護：詳情面板開啟中且最近 30 秒有 keystroke → 一律保留本地
              // 避免「打 50 字描述,打到第 30 字時別人同步一個更新把字蓋掉」
              if (isWithinEditingActivityWindow(fbT.id)) {
                return local;
              }
              // 本地 updatedAt 較新 → 保留本地（樂觀更新尚未被雲端推送覆蓋）
              if (new Date(local.updatedAt).getTime() > new Date(fbT.updatedAt).getTime()) {
                return local;
              }
            }
            return fbT;
          });
          // 補回雲端尚未收到的本地任務（剛新增的）
          const localOnly = prev.filter((t) => !fbIds.has(t.id));
          const result = [...merged, ...localOnly];
          console.log(`[SUP SYNC] setTasks merge: fb=${fbTasks.length}, merged=${merged.length}, localOnly=${localOnly.length}, result=${result.length}, deleted=${deletedTaskIdsRef.current.size}`);
          saveTasks(result);
          return result;
        });
      }, deletedTaskIdsRef.current).then((unsub) => {
        fbUnsubRef.current = unsub;
        if (fbSyncDebug) console.log("[SUP SYNC] 已訂閱 tasks uid:", user.uid);
      }).catch((err) => {
        console.warn("[SUP SYNC] 訂閱任務失敗:", err);
      });

      //      listsUnsubRef.current?.();
      let lastCloudLists: TaskList[] = [];
      subscribeListsSync(user.uid, (fbLists) => {
        // 跳過第一次（空的初始資料），避免覆蓋本地尚未同步的清單
        if (!firstListsLoadDone.current) {
          firstListsLoadDone.current = true;
          return;
        }
        if (fbSyncDebug) console.log("[SUP SYNC] lists 推送:", fbLists.length);
        // 去重：同名的預設清單只保留一份（保留固定 id 那份，合併任務）
        const deduped = dedupeDuplicateLists(fbLists);
        // 修補：本地任務若指向被丟棄的清單 id，改指到 keeper，並回寫雲端
        rebindTasksToKeptLists(fbLists, deduped);
        lastCloudLists = deduped;
        setLists(deduped);
        saveLists(deduped);
      }).then((unsub) => {
        listsUnsubRef.current = unsub;
      }).catch((err) => {
        console.warn("[SUP SYNC] 訂閱清單失敗:", err);
      });

      // 首次登入：把本地 localStorage 任務上傳到 Supabase（只上傳不在雲端的）
      void migrateLocalToSupabase(user.uid);
    }

    // ── 一次性遷移：把 localStorage 既有資料上傳到 Supabase ──
    async function migrateLocalToSupabase(uid: string): Promise<void> {
      try {
        // 標記避免重複遷移
        const MIGRATE_KEY = `__migrated_to_supabase_${uid}`;
        if (localStorage.getItem(MIGRATE_KEY)) {
          // 即使已遷移過，仍跑一次雲端去重（用戶可能遷移時還沒去重）
          await cleanupDuplicateListsInCloud(uid);
          return;
        }

        const localTasks = getTasks();
        const localLists = dedupeDuplicateLists(getLists());

        if (localTasks.length > 0) {
          await batchSaveTasksFirebase(uid, localTasks);
          console.log(`[SUP SYNC] 遷移 ${localTasks.length} 筆任務到雲端`);
        }
        if (localLists.length > 0) {
          await batchSaveListsFirebase(uid, localLists);
          console.log(`[SUP SYNC] 遷移 ${localLists.length} 筆清單到雲端`);
        }
        localStorage.setItem(MIGRATE_KEY, "1");

        // 跑完本地遷移後，額外做一次雲端去重（其他設備可能也上傳過「收集箱」）
        await cleanupDuplicateListsInCloud(uid);
      } catch (err) {
        console.warn("[SUP SYNC] 遷移失敗（不影響現有功能）:", err);
      }
    }

    // ── 雲端去重：合併雲端所有同名預設清單，固定 id 是 init:inbox ──
    async function cleanupDuplicateListsInCloud(uid: string): Promise<void> {
      try {
        const { loadLists, deleteList: delList } = await import("./personalListSync");
        const { loadTasks } = await import("./personalTaskSync");
        const cloudLists = await loadLists(uid);
        if (cloudLists.length === 0) return;

        // 用「預設清單 key (init:inbox)」分組
        const groups = new Map<string, TaskList[]>();
        for (const l of cloudLists) {
          const key = DEFAULT_LIST_IDS[l.name] ?? l.id;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(l);
        }

        for (const [, group] of groups) {
          if (group.length <= 1) continue;
          // 保留固定 id 那個；若都沒有，保留最早建立的
          group.sort((a, b) => {
            const aFixed = a.id.startsWith("init:") ? 0 : 1;
            const bFixed = b.id.startsWith("init:") ? 0 : 1;
            if (aFixed !== bFixed) return aFixed - bFixed;
            return a.createdAt.localeCompare(b.createdAt);
          });
          const keeper = group[0];
          const dupIds = group.slice(1).map((l) => l.id);

          // 把任務從被刪除的清單指向 keeper
          const cloudTasks = await loadTasks(uid);
          const rebuilt = cloudTasks.map((t) =>
            t.listId && dupIds.includes(t.listId) ? { ...t, listId: keeper.id } : t
          );
          if (rebuilt.some((t, i) => t !== cloudTasks[i])) {
            await batchSaveTasksFirebase(uid, rebuilt);
          }
          // 刪除多餘清單
          for (const dupId of dupIds) {
            await delList(uid, dupId);
            console.log(`[SUP SYNC] 清理重複清單: ${dupId}（保留 ${keeper.id}）`);
          }
        }

        // 同步本地到雲端最終狀態，避免下次訂閱又讀回舊版 id
        const finalCloudLists = await loadLists(uid);
        const finalDeduped = dedupeDuplicateLists(finalCloudLists);
        setLists(finalDeduped);
        saveLists(finalDeduped);
      } catch (err) {
        console.warn("[SUP SYNC] 雲端去重失敗:", err);
      }
    }

    setIsLoaded(true);
  }, [user, reloadKey]);

  useEffect(() => {
    if (!isLoaded) return;
    const storedSharedLists = getSharedLists();
    const acceptedIds = Object.keys(storedSharedLists).filter(
      (id) => !ownedSharedListIds.includes(id)
    );
    setAcceptedSharedListIds(acceptedIds);
  }, [isLoaded, reloadKey]);

  // ── Webhook outbound：當 tasks/habits/lists 任一變動,debounce 500ms 發一次 batch payload ──
  useEffect(() => {
    if (!isLoaded) return;
    const last = lastEmittedSizesRef.current;
    if (
      last.tasks === tasks.length &&
      last.habits === habits.length &&
      last.lists === lists.length
    ) {
      return; // 無變動,免觸發
    }
    lastEmittedSizesRef.current = { tasks: tasks.length, habits: habits.length, lists: lists.length };
    triggerWebhook({
      timestamp: new Date().toISOString(),
      event: "batch",
      source: user?.uid ?? "anonymous",
      data: {
        taskCount: tasks.length,
        habitCount: habits.length,
        listCount: lists.length,
        // 節錄最近 5 筆任務標題（避免 payload 太大拖累 Zapier）
        recentTaskTitles: tasks.slice(-5).map((t) => ({ id: t.id, title: t.title, status: t.status })),
      },
    });
  }, [isLoaded, tasks, habits, lists, user]);

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

  // ── 任務排序（個人） ─────────────────────────────────────
  const getFilteredTasks = useCallback((): Task[] => {
    // Lazy migration：老 priority 值（urgent/high/medium/low）即時轉換成新 4 值（do-now/schedule/delegate/none）
    // 同步寫回 store，保證下次讀取不會再跑這段
    let migrated = false;
    const migratedTasks = tasks.map((t) => {
      const newP = migratePriority(t.priority);
      if (newP !== t.priority) {
        migrated = true;
        return { ...t, priority: newP };
      }
      return t;
    });
    if (migrated) {
      // 推到下一個 tick 避免遞迴 setState 警告
      queueMicrotask(() => saveTasks(migratedTasks));
    }

    const active = migratedTasks.filter((t) => !t.isArchived);
    let result = active;
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const weekEndDate = new Date(now.getTime() + 7 * 86400000);
    const localWeekEnd = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth()+1).padStart(2,"0")}-${String(weekEndDate.getDate()).padStart(2,"0")}`;

    if (currentView === "today") {
      result = result.filter((t) => t.dueDate === localToday);
    } else if (currentView === "next7days") {
      result = result.filter((t) => t.dueDate && t.dueDate >= localToday && t.dueDate <= localWeekEnd);
    } else if (currentView === "list" && currentListId) {
      result = result.filter((t) => t.listId === currentListId);
    } else if (currentView === "inbox") {
      result = result.filter((t) => !t.listId);
    } else if (currentView === "pinned") {
      result = result.filter((t) => t.isPinned);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          t.subTasks?.some((s) => s.title.toLowerCase().includes(q))
      );
    }
    if (activeFilter.priority) result = result.filter((t) => t.priority === activeFilter.priority);
    if (activeFilter.status)   result = result.filter((t) => t.status === activeFilter.status);
    if (activeFilter.tag)      result = result.filter((t) => t.tags.includes(activeFilter.tag!));

    return result.sort((a, b) => {
      // 置頂優先（排除已封存 / 已完成）
      if (!a.isArchived && a.status !== "done" && a.isPinned && !(b.isPinned && !b.isArchived && b.status !== "done")) return -1;
      if (!b.isArchived && b.status !== "done" && b.isPinned && !(a.isPinned && !a.isArchived && a.status !== "done")) return 1;
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      const po = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (po !== 0) return po;
      return a.order - b.order;
    });
  }, [tasks, currentView, currentListId, searchQuery, activeFilter]);

  const viewCounts = useMemo(() => {
    const active = tasks.filter((t) => !t.isArchived);
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const weekEndDate = new Date(now.getTime() + 7 * 86400000);
    const localWeekEnd = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth()+1).padStart(2,"0")}-${String(weekEndDate.getDate()).padStart(2,"0")}`;
    return {
      inbox: active.filter((t) => !t.listId).length,
      today: active.filter((t) => t.dueDate === localToday).length,
      next7days: active.filter((t) => t.dueDate && t.dueDate >= localToday && t.dueDate <= localWeekEnd).length,
      // Eisenhower 四象限計數 — 使用既有 priority 字段(已包含自動 Q1 提升規則由 getEisenhowerVisual 處理)
      // 視圖層渲染時呼叫 getEisenhowerVisual 取實時象限
      q1: active.filter((t) => t.priority === "do-now").length,
      q2: active.filter((t) => t.priority === "schedule").length,
      q3: active.filter((t) => t.priority === "delegate").length,
      q4: active.filter((t) => t.priority === "none").length,
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

  // ── 工具：清單去重（同名預設清單合併，並把所有任務的 listId 指向保留的那份）──
  function dedupeDuplicateLists(lists: TaskList[]): TaskList[] {
    const seen = new Map<string, TaskList>();
    const dupIds: string[] = [];
    for (const l of lists) {
      // 預設清單的 key 用名字，否則用 id 自己
      const key = DEFAULT_LIST_IDS[l.name] ?? l.id;
      const existing = seen.get(key);
      if (existing) {
        dupIds.push(l.id); // 這份是多餘的，記下來 id
      } else {
        seen.set(key, l);
      }
    }
    if (dupIds.length === 0) return lists;
    const result = Array.from(seen.values());
    // 把任務裡指向「多餘清單」的 listId 改指向保留那筆
    const dupIdSet = new Set(dupIds);
    const rebuiltTasks = tasksRef.current.map((t) => {
      if (t.listId && dupIdSet.has(t.listId)) {
        const keeper = result.find((l) => l.name === lists.find((x) => x.id === t.listId)?.name);
        return { ...t, listId: keeper?.id ?? t.listId };
      }
      return t;
    });
    if (rebuiltTasks.some((t, i) => t !== tasksRef.current[i])) {
      setTasks(rebuiltTasks);
      saveTasks(rebuiltTasks);
      if (user) batchSaveTasksFirebase(user.uid, rebuiltTasks).catch(console.warn);
    }
    return result;
  }

  // ── 工具：把本地任務裡指向「已不存在的清單 id」的 listId 改指到保留那份並回寫雲端 ──
  function rebindTasksToKeptLists(rawLists: TaskList[], deduped: TaskList[]) {
    if (!user) return;
    // 找出 dedupe 後被丟掉的 id 對應到哪個 keeper
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
      batchSaveTasksFirebase(user.uid, rebuilt).catch((err) =>
        console.warn("[SUP SYNC] rebind tasks failed:", err)
      );
    }
  }

  const addTask = useCallback((
    data: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">
  ): string => {
    const id = generateId();
    const task: Task = {
      ...data, id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      focusMinutes: 0,
      isArchived: false,
      order: tasks.filter((t) => !t.isArchived).length,
    };
    const updated = [task, ...tasks];
    setTasks(updated);
    saveTasks(updated);
    markRecentlyWritten(id);
    if (user) batchSaveTasksFirebase(user.uid, [task]).catch((err) => console.error("[SUP SYNC] 新增失敗:", err));
    return id;
  }, [tasks, user, markRecentlyWritten]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    setTasks(updated);
    saveTasks(updated);
    markRecentlyWritten(id);
    if (user) {
      const task = updated.find((t) => t.id === id);
      if (task) batchSaveTasksFirebase(user.uid, [task]).catch((err) => console.error("[SUP SYNC] 更新失敗:", err));
    }
  }, [tasks, user, markRecentlyWritten]);

  // ── Soft Delete + Undo ────────────────────────────────
  const UNDO_WINDOW_MS = 5_000;

  const undoDelete = useCallback((taskId: string) => {
    const previous = previousTasksRef.current;
    const task = previous.find((t) => t.id === taskId);
    if (!task) return;
    const updated = [task, ...tasks];
    setTasks(updated);
    saveTasks(updated);
    if (user) batchSaveTasksFirebase(user.uid, [task]).catch((err) => console.error("[SUP SYNC] undo 寫入失敗:", err));
    toast.success(`已恢復「${task.title}」`);
  }, [tasks, user]);

  const deleteTask = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // 刪除任務時，一併清理 Firebase Storage 中的附件
    if (task.attachments && task.attachments.length > 0) {
      for (const attachment of task.attachments) {
        if (attachment.storagePath) {
          deleteFile(attachment.storagePath).catch((err) => {
            console.warn("[AppContext] Failed to delete attachment:", err);
          });
        }
      }
    }

    // 儲存快照用於 Undo
    previousTasksRef.current = tasks;
    // 立即從 UI 移除（optimistic）
    deletedTaskIdsRef.current.add(id);
    const updated = tasks.filter((t) => t.id !== id);
    console.log(`[AppContext] 刪除任務 ${id}，時間: ${Date.now()}`);
    setTasks(updated);
    saveTasks(updated);

    // 顯示 Toast，5 秒後自動真正刪除
    toast.success(
      <div className="flex items-center gap-3">
        <span className="flex-1">已刪除「{task.title}」</span>
        <button
          onClick={() => undoDelete(id)}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-[13px] font-medium transition-all hover:scale-[1.05] active:scale-[0.97]"
          style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
        >
          ↩️ 復原
        </button>
      </div>,
      { duration: UNDO_WINDOW_MS + 500, id }
    );

    // 5 秒後真正刪除（若未 Undo）
    setTimeout(() => {
      if (deletedTaskIdsRef.current.has(id)) {
        deletedTaskIdsRef.current.delete(id);
        if (user) {
          deleteTaskFirebase(user.uid, id).catch((err) => {
            console.warn("[SUP SYNC] 延後刪除失敗:", err);
          });
        }
      }
    }, UNDO_WINDOW_MS);
  }, [tasks, user, undoDelete]);

  const toggleTaskStatus = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    // 任務完成按鈕：直接切換 todo <-> done（跳過 in-progress）
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
    // Aha Moment 偵測：使用者首次把任務從 todo → done 觸發
    if (newStatus === "done" && task.status === "todo") {
      const hasAnyDoneBefore = tasks.some((t) => t.id !== id && t.status === "done");
      if (!hasAnyDoneBefore) {
        // 延遲到下一個 frame 讓 confetti 先跑,避免 Modal 與動畫打架
        setTimeout(() => dispatchFirstTaskDone(), 600);
        // 創業者多巴胺：首個任務完成通知 Discord
        if (user?.email) {
          void notifyFirstTaskDone(user.email, task.title, getKnownUserCount());
        }
      }
    }
    if (user) {
      const updatedTask = updated.find((t) => t.id === id);
      if (updatedTask) batchSaveTasksFirebase(user.uid, [updatedTask]).catch((err) => console.error("[SUP SYNC] toggle 失敗:", err));
    }
    // 完成任務時更新 lastActiveAt（節流 30 秒）
    if (newStatus === "done" && user?.uid) {
      const now = Date.now();
      const last = lastActiveWriteAtRef.current[user.uid] ?? 0;
      if (now - last >= ACTIVE_THROTTLE_MS) {
        lastActiveWriteAtRef.current[user.uid] = now;
        void updateLastActive(user.uid);
      }
    }
  }, [tasks, user, markRecentlyWritten]);

  const archiveTask = useCallback((id: string) => updateTask(id, { isArchived: true }), [updateTask]);
  const unarchiveTask = useCallback((id: string) => updateTask(id, { isArchived: false }), [updateTask]);

  // ── 子任務 ──────────────────────────────────────────────
  const addSubTask = useCallback((parentId: string, title: string) => {
    const task = tasks.find((t) => t.id === parentId);
    if (!task) return;
    const subTask: SubTask = { id: generateId(), title, status: "todo", createdAt: new Date().toISOString() };
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

  // ── 週期任務 ────────────────────────────────────────────
  const completeRecurringAndClone = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task?.recurrence) return;
    const nextDate = getNextRecurrenceDate(task.dueDate || new Date().toISOString().split("T")[0], task.recurrence);
    if (task.recurrence.endDate && nextDate > task.recurrence.endDate) return;
    const updatedRecurrence = { ...task.recurrence, completedCount: task.recurrence.completedCount + 1 };
    const updated = tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: "todo" as const, dueDate: nextDate, recurrence: updatedRecurrence, updatedAt: new Date().toISOString() }
        : t
    );
    setTasks(updated);
    saveTasks(updated);
  }, [tasks]);

  // ── 清單 CRUD ────────────────────────────────────────────
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
    if (user) batchSaveListsFirebase(user.uid, [newList]).catch(console.warn);
    return newList.id;
  }, [lists, user]);

  const updateList = useCallback((id: string, updates: Partial<TaskList>) => {
    const updated = lists.map((l) =>
      l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
    );
    setLists(updated);
    saveLists(updated);
    if (user) {
      const list = updated.find((l) => l.id === id);
      if (list) batchSaveListsFirebase(user.uid, [list]).catch(console.warn);
    }
  }, [lists, user]);

  const deleteList = useCallback((id: string) => {
    const updated = lists.filter((l) => l.id !== id);
    setLists(updated);
    saveLists(updated);
    if (user) deleteListFirebase(user.uid, id).catch(console.warn);
    const taskUpdated = tasks.map((t) => t.listId === id ? { ...t, listId: undefined } : t);
    setTasks(taskUpdated);
    saveTasks(taskUpdated);
  }, [lists, tasks, user]);

  // ── 習慣 CRUD ─────────────────────────────────────────
  const addHabit = useCallback((data: Omit<Habit, "id" | "createdAt" | "updatedAt" | "checkins" | "streak" | "longestStreak">) => {
    const newHabit: Habit = {
      ...data, id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checkins: [], streak: 0, longestStreak: 0,
    };
    const updated = [...habits, newHabit];
    setHabits(updated);
    saveHabits(updated);
  }, [habits]);

  const updateHabit = useCallback((id: string, updates: Partial<Habit>) => {
    const updated = habits.map((h) => h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h);
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

  // ── Shared List 主函式 ───────────────────────────────────
  const shareList = useCallback(async (listId: string): Promise<string | null> => {
    if (!user) return null;
    const list = lists.find((l) => l.id === listId);
    if (!list) return null;
    const listTasks = tasks.filter((t) => t.listId === listId);
    const ownerName = user.displayName || user.email || undefined;
    try {
      const sharedListId = await createSharedList(list, listTasks, user.uid, ownerName, user.email);
      const updatedList = { ...list, sharedId: sharedListId, ownerId: user.uid };
      const updatedLists = lists.map((l) => l.id === listId ? updatedList : l);
      setLists(updatedLists);
      saveLists(updatedLists);
      setOwnedSharedListIds((prev) =>
        prev.includes(sharedListId) ? prev : [...prev, sharedListId]
      );
      // 新建立的清單 → 我是 owner
      setMyRoleByList((prev) => ({ ...prev, [sharedListId]: "owner" }));
      return sharedListId;
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error("[AppContext.shareList] createSharedList failed:", error);
      // 把詳細錯誤拋出 modal 而不是 swallow
      throw error;
    }
  }, [user, lists, tasks]);

  const unshareList = useCallback(async (sharedListId: string): Promise<void> => {
    if (!user) return;
    try {
      await deleteSharedList(sharedListId);
      const updatedLists = lists.map((l) =>
        l.sharedId === sharedListId ? { ...l, sharedId: undefined, ownerId: undefined } : l
      );
      setLists(updatedLists);
      saveLists(updatedLists);
      setOwnedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));
      if (sharedListUnsubscribeRefs.current[sharedListId]) {
        sharedListUnsubscribeRefs.current[sharedListId]();
        delete sharedListUnsubscribeRefs.current[sharedListId];
      }
    } catch (error) {
      console.error("Failed to unshare list:", error);
    }
  }, [user, lists]);

  /** 收件人點開連結 → 後端 RPC 把 email uid 綁到 members */
  const acceptSharedList = useCallback(async (sharedListId: string, _data: SharedListSnapshot): Promise<void> => {
    if (!user) return;
    // 先在後端把自己 uid 綁上去（補釘 #3 — 後端檢查 email 一致）
    try {
      await bindCurrentUserToSharedList({
        sharedListId,
        memberUid: user.uid,
        memberEmail: user.email || "",
      });
    } catch (err) {
      console.error("[Shared] accept invite failed (likely not invited):", err);
      return;
    }
    // 再從 server 抓 snapshot 一次當作 initial 資料
    const snapshot = await getSharedSnapshot(sharedListId);
    if (!snapshot) return;

    const ownerId = snapshot.ownerId || snapshot.list.ownerId;
    const listWithDefaults: TaskList = {
      ...snapshot.list, ownerId,
      icon: snapshot.list.icon || "📋",
      color: snapshot.list.color || "#3B82F6",
    };
    const sharedData: SharedListData = {
      list: listWithDefaults,
      tasks: snapshot.tasks,
      ownerName: snapshot.ownerName,
    };
    saveSharedList(sharedListId, sharedData);
    setSharedLists(getSharedLists());

    const myRole = await getMyRoleInSharedList(sharedListId, user.uid);
    if (myRole) {
      setMyRoleByList((prev) => ({ ...prev, [sharedListId]: myRole }));
    }

    if (!acceptedSharedListIds.includes(sharedListId)) {
      setAcceptedSharedListIds((prev) => [...prev, sharedListId]);
    }
  }, [user, acceptedSharedListIds]);

  const removeAcceptedSharedList = useCallback((sharedListId: string): void => {
    removeSharedList(sharedListId);
    setSharedLists(getSharedLists());
    setAcceptedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));
    setOwnedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));
    setMyRoleByList((prev) => {
      const { [sharedListId]: _, ...rest } = prev;
      return rest;
    });
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
    window.history.replaceState({}, "", window.location.pathname);
    try {
      const snapshot = await getSharedSnapshot(shareParam);
      if (snapshot) return { sharedListId: shareParam, snapshot };
    } catch (error) {
      console.error("Failed to fetch shared list:", error);
    }
    return null;
  }, []);

  // ── 共用：寫入權限 gate ─────────────────────────────────
  const canEditSharedList = useCallback((sharedListId: string): boolean => {
    const role = myRoleByList[sharedListId];
    return role === "owner" || role === "editor";
  }, [myRoleByList]);

  // ── 共用寫入 helper：包 isWriting / 寫後清旗標 ──────────
  const guardWrite = useCallback((sharedListId: string, fn: () => Promise<void>) => {
    isWritingRef.current[sharedListId] = true;
    return fn().finally(() => {
      isWritingRef.current[sharedListId] = false;
    });
  }, []);

  // ── 訂閱：owned shared list（owner 端可看到他人即時更新）──
  useEffect(() => {
    if (!user || ownedSharedListIds.length === 0) return;

    const ownedSet = new Set(ownedSharedListIds);
    const promises: Promise<void>[] = [];
    ownedSharedListIds.forEach((sharedId) => {
      if (sharedListUnsubscribeRefs.current[sharedId]) return;
      const promise = subscribeToSharedSnapshot(
        sharedId,
        (snapshot) => {
          if (!snapshot) return;
          const isFirstSnapshot = !snapshotReadyRef.current[sharedId];
          snapshotReadyRef.current[sharedId] = true;
          const snapshotOwnerId = snapshot.ownerId || snapshot.list.ownerId;
          const updatedData: SharedListData = {
            list: { ...snapshot.list, ownerId: snapshotOwnerId },
            tasks: snapshot.tasks,
            ownerName: snapshot.ownerName,
          };

          if (isWritingRef.current[sharedId]) {
            snapshotTasksRef.current[sharedId] = snapshot.tasks;
            return;
          }
          const snapshotHash = JSON.stringify(snapshot.tasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
          if (lastSyncedHashRef.current[sharedId] === snapshotHash) return;
          lastSyncedHashRef.current[sharedId] = snapshotHash;
          lastSyncedTaskCountRef.current[sharedId] = snapshot.tasks.length;

          setSharedLists((prev) => ({ ...prev, [sharedId]: updatedData }));

          const remoteTasks = snapshot.tasks.filter((t) => t.createdBy && t.createdBy !== user.uid);
          remoteSharedTasksRef.current[sharedId] = remoteTasks;
          snapshotTasksRef.current[sharedId] = snapshot.tasks;

          setTasks((prev) => {
            const prevMap = new Map(prev.map((t) => [t.id, t]));
            const merged = [...prev];
            let changed = false;
            for (const st of snapshot.tasks) {
              const existing = prevMap.get(st.id);
              if (!existing) { merged.push(st); changed = true; }
              else if (st.updatedAt > existing.updatedAt) {
                const idx = merged.findIndex((t) => t.id === st.id);
                if (idx >= 0) { merged[idx] = st; changed = true; }
              }
            }
            return changed ? merged : prev;
          });

          void isFirstSnapshot; // suppress unused
        },
        () => {
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
      ).then((unsub) => {
        sharedListUnsubscribeRefs.current[sharedId] = unsub;
      }).catch(() => {});
      promises.push(promise);
    });

    return () => {
      Object.keys(sharedListUnsubscribeRefs.current).forEach((id) => {
        if (!ownedSet.has(id)) {
          sharedListUnsubscribeRefs.current[id]();
          delete sharedListUnsubscribeRefs.current[id];
          delete remoteSharedTasksRef.current[id];
          delete lastSyncedHashRef.current[id];
          delete snapshotReadyRef.current[id];
        }
      });
    };
  }, [user, ownedSharedListIds]);

  // ── 訂閱：accepted shared list（recipient 端） ──────────
  useEffect(() => {
    if (!user || acceptedSharedListIds.length === 0) return;
    const acceptedSet = new Set(acceptedSharedListIds);
    const promises: Promise<void>[] = [];
    acceptedSharedListIds.forEach((sharedListId) => {
      if (sharedListUnsubscribeRefs.current[sharedListId]) return;
      const promise = subscribeToSharedSnapshot(
        sharedListId,
        (snapshot) => {
          if (!snapshot) return;
          const snapshotOwnerId = snapshot.ownerId || snapshot.list.ownerId;
          const snapshotListWithDefaults: TaskList = {
            ...snapshot.list, ownerId: snapshotOwnerId,
            icon: snapshot.list.icon || "📋",
            color: snapshot.list.color || "#3B82F6",
          };
          const updatedData: SharedListData = {
            list: snapshotListWithDefaults,
            tasks: snapshot.tasks,
            ownerName: snapshot.ownerName,
          };
          if (!snapshotReadyRef.current[sharedListId]) {
            saveSharedList(sharedListId, updatedData);
          }
          snapshotReadyRef.current[sharedListId] = true;
          setSharedLists((prev) => ({ ...prev, [sharedListId]: updatedData }));
          setTasks((prev) => {
            const prevMap = new Map(prev.map((t) => [t.id, t]));
            const merged = [...prev];
            let changed = false;
            for (const st of snapshot.tasks) {
              const existing = prevMap.get(st.id);
              if (!existing) { merged.push(st); changed = true; }
              else if (st.updatedAt > existing.updatedAt) {
                const idx = merged.findIndex((t) => t.id === st.id);
                if (idx >= 0) { merged[idx] = st; changed = true; }
              }
            }
            return changed ? merged : prev;
          });
          setSharedLists(getSharedLists());
        },
        () => {
          removeSharedList(sharedListId);
          setSharedLists(getSharedLists());
          setAcceptedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));
          if (sharedListUnsubscribeRefs.current[sharedListId]) {
            delete sharedListUnsubscribeRefs.current[sharedListId];
          }
        }
      ).then((unsub) => {
        sharedListUnsubscribeRefs.current[sharedListId] = unsub;
      }).catch(() => {});
      promises.push(promise);
    });

    return () => {
      Object.keys(sharedListUnsubscribeRefs.current).forEach((id) => {
        if (!acceptedSet.has(id)) {
          sharedListUnsubscribeRefs.current[id]();
          delete sharedListUnsubscribeRefs.current[id];
        }
      });
    };
  }, [user, acceptedSharedListIds]);

  // ── 拉回自己身份（收件人第一次進入時） ─────────────────
  useEffect(() => {
    if (!user) return;
    const allIds = Array.from(new Set([...ownedSharedListIds, ...acceptedSharedListIds]));
    allIds.forEach(async (sid) => {
      if (myRoleByList[sid]) return;
      const r = await getMyRoleInSharedList(sid, user.uid);
      if (r) setMyRoleByList((prev) => ({ ...prev, [sid]: r }));
    });
  }, [user, ownedSharedListIds, acceptedSharedListIds, myRoleByList]);

  // ── Quick Add（個人） ──────────────────────────────────
  const quickAdd = useCallback((input: string, currentView?: string): string | null => {
    if (!input.trim()) return null;
    const parsed = parseNaturalLanguage(input);
    const dueDate = parsed.dueDate ?? (currentView === "today" ? new Date().toLocaleDateString("en-CA") : undefined);
    return addTask({
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority,
      status: "todo",
      dueDate,
      dueTime: parsed.dueTime,
      tags: parsed.tags,
      listId: currentListId,
      recurrence: parsed.recurrence,
      reminder: parsed.reminder,
      subTasks: [],
    });
  }, [addTask, currentListId]);

  // ── Shared List 任務操作（權限 gate） ─────────────────
  const ensureSharedListData = useCallback(async (sharedListId: string): Promise<SharedListData | null> => {
    const existing = sharedLists[sharedListId];
    if (existing) return existing;
    const snapshot = await getSharedSnapshot(sharedListId);
    if (!snapshot) return null;
    const data: SharedListData = {
      list: { ...snapshot.list, ownerId: snapshot.ownerId || snapshot.list.ownerId },
      tasks: snapshot.tasks,
      ownerName: snapshot.ownerName,
    };
    saveSharedList(sharedListId, data);
    setSharedLists(getSharedLists());
    return data;
  }, [sharedLists]);

  const quickAddToShared = useCallback((sharedListId: string, input: string): string | null => {
    if (!input.trim()) return null;
    if (!canEditSharedList(sharedListId)) {
      console.warn("[Shared] Viewer cannot add tasks");
      return null;
    }
    const parsed = parseNaturalLanguage(input);
    const id = generateId();
    const now = new Date().toISOString();
    const task: Task = {
      id, title: parsed.title, description: parsed.description,
      priority: parsed.priority, status: "todo",
      dueDate: parsed.dueDate, dueTime: parsed.dueTime,
      tags: parsed.tags, listId: sharedListId,
      recurrence: parsed.recurrence, reminder: parsed.reminder,
      subTasks: [], createdAt: now, updatedAt: now,
      focusMinutes: 0, isArchived: false, order: 0,
      createdBy: user?.uid,
    };

    const data = sharedLists[sharedListId];
    if (!data) {
      void ensureSharedListData(sharedListId).then((fetchedData) => {
        if (!fetchedData) return;
        const updatedTasks = [task, ...fetchedData.tasks];
        const updatedData: SharedListData = { ...fetchedData, tasks: updatedTasks };
        saveSharedList(sharedListId, updatedData);
        setSharedLists(getSharedLists());
        const ownerId = fetchedData.list.ownerId ?? "";
        isWritingRef.current[sharedListId] = true;
        const pendingHash = JSON.stringify(updatedTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
        lastSyncedHashRef.current[sharedListId] = pendingHash;
        lastSyncedTaskCountRef.current[sharedListId] = updatedTasks.length;
        updateSharedSnapshot(sharedListId, updatedData.list, updatedTasks, ownerId, fetchedData.ownerName, (sid, writtenTasks) => {
          const u = { ...fetchedData, tasks: writtenTasks };
          saveSharedList(sid, u);
          setSharedLists((prev) => ({ ...prev, [sid]: u }));
          snapshotTasksRef.current[sid] = writtenTasks;
          const hash = JSON.stringify(writtenTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
          lastSyncedHashRef.current[sid] = hash;
          lastSyncedTaskCountRef.current[sid] = writtenTasks.length;
          isWritingRef.current[sid] = false;
        }).catch((err) => {
          console.error("[SharedList] Failed to save task:", err);
          isWritingRef.current[sharedListId] = false;
          const revertedData: SharedListData = { ...fetchedData, tasks: fetchedData.tasks };
          saveSharedList(sharedListId, revertedData);
          setSharedLists(getSharedLists());
        });
      });
      return id;
    }

    const updatedTasks = [task, ...data.tasks];
    const updatedData: SharedListData = { ...data, tasks: updatedTasks };
    saveSharedList(sharedListId, updatedData);
    setSharedLists(getSharedLists());
    const ownerId = data.list.ownerId ?? "";
    isWritingRef.current[sharedListId] = true;
    const pendingHash = JSON.stringify(updatedTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
    lastSyncedHashRef.current[sharedListId] = pendingHash;
    lastSyncedTaskCountRef.current[sharedListId] = updatedTasks.length;
    updateSharedSnapshot(sharedListId, updatedData.list, updatedTasks, ownerId, data.ownerName, (sid, writtenTasks) => {
      const u = { ...data, tasks: writtenTasks };
      saveSharedList(sid, u);
      setSharedLists((prev) => ({ ...prev, [sid]: u }));
      snapshotTasksRef.current[sid] = writtenTasks;
      const hash = JSON.stringify(writtenTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
      lastSyncedHashRef.current[sid] = hash;
      lastSyncedTaskCountRef.current[sid] = writtenTasks.length;
      isWritingRef.current[sid] = false;
    }).catch((err) => {
      console.error("[SharedList] Failed to save task:", err);
      isWritingRef.current[sharedListId] = false;
      const revertedData: SharedListData = { ...data };
      saveSharedList(sharedListId, revertedData);
      setSharedLists(getSharedLists());
    });
    return id;
  }, [sharedLists, user, ensureSharedListData, canEditSharedList]);

  const updateSharedTask = useCallback((sharedListId: string, taskId: string, updates: Partial<Task>) => {
    if (!canEditSharedList(sharedListId)) {
      console.warn("[Shared] Viewer cannot edit tasks");
      return;
    }
    const data = sharedLists[sharedListId];
    if (!data) return;
    const updatedTasks = data.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    const updatedData: SharedListData = { ...data, tasks: updatedTasks };
    saveSharedList(sharedListId, updatedData);
    setSharedLists(getSharedLists());
    const ownerId = data.list.ownerId ?? "";
    isWritingRef.current[sharedListId] = true;
    const pendingHash = JSON.stringify(updatedTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
    lastSyncedHashRef.current[sharedListId] = pendingHash;
    lastSyncedTaskCountRef.current[sharedListId] = updatedTasks.length;
    updateSharedSnapshot(sharedListId, updatedData.list, updatedTasks, ownerId, data.ownerName, (sid, writtenTasks) => {
      setSharedLists((prev) => ({ ...prev, [sid]: { ...prev[sid], tasks: writtenTasks } }));
      saveSharedList(sid, { ...sharedLists[sid], tasks: writtenTasks });
      snapshotTasksRef.current[sid] = writtenTasks;
      const hash = JSON.stringify(writtenTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
      lastSyncedHashRef.current[sid] = hash;
      lastSyncedTaskCountRef.current[sid] = writtenTasks.length;
      isWritingRef.current[sid] = false;
    }).catch((err) => {
      console.error("[SharedList] Failed to update task:", err);
      isWritingRef.current[sharedListId] = false;
      saveSharedList(sharedListId, data);
      setSharedLists(getSharedLists());
    });
  }, [sharedLists, canEditSharedList]);

  const deleteSharedTask = useCallback((sharedListId: string, taskId: string) => {
    if (!canEditSharedList(sharedListId)) {
      console.warn("[Shared] Viewer cannot delete tasks");
      return;
    }
    const data = sharedLists[sharedListId];
    if (!data) return;
    const updatedTasks = data.tasks.filter((t) => t.id !== taskId);
    const updatedData: SharedListData = { ...data, tasks: updatedTasks };
    saveSharedList(sharedListId, updatedData);
    setSharedLists(getSharedLists());
    const ownerId = data.list.ownerId ?? "";
    isWritingRef.current[sharedListId] = true;
    const pendingHash = JSON.stringify(updatedTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
    lastSyncedHashRef.current[sharedListId] = pendingHash;
    lastSyncedTaskCountRef.current[sharedListId] = updatedTasks.length;
    updateSharedSnapshot(sharedListId, updatedData.list, updatedTasks, ownerId, data.ownerName, (sid, writtenTasks) => {
      setSharedLists((prev) => ({ ...prev, [sid]: { ...prev[sid], tasks: writtenTasks } }));
      saveSharedList(sid, { ...sharedLists[sid], tasks: writtenTasks });
      snapshotTasksRef.current[sid] = writtenTasks;
      const hash = JSON.stringify(writtenTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
      lastSyncedHashRef.current[sid] = hash;
      lastSyncedTaskCountRef.current[sid] = writtenTasks.length;
      isWritingRef.current[sid] = false;
    }).catch((err) => {
      console.error("[SharedList] Failed to delete task:", err);
      isWritingRef.current[sharedListId] = false;
      saveSharedList(sharedListId, data);
      setSharedLists(getSharedLists());
    });
  }, [sharedLists, canEditSharedList]);

  /** 拖曳任務更新 position（RLS 為 can_write_list） */
  const reorderSharedTask = useCallback(async (sharedListId: string, taskId: string, position: number) => {
    if (!canEditSharedList(sharedListId)) return;
    try {
      await setSharedTaskPosition(sharedListId, taskId, position);
    } catch (err) {
      console.warn("[SharedList] reorder failed:", err);
    }
  }, [canEditSharedList]);

  // ── Members API ─────────────────────────────────────
  const listSharedMembersFn = useCallback(async (sharedListId: string) => {
    const members = await listSharedMembers(sharedListId);
    setMembersBySharedList((prev) => ({ ...prev, [sharedListId]: members }));
    return members;
  }, []);

  const inviteToSharedListFn = useCallback(async (sharedListId: string, email: string, role: MemberRole) => {
    const myRole = myRoleByList[sharedListId];
    if (myRole !== "owner") throw new Error("Only owner can invite");
    const { supabase } = await import("./supabase");
    if (!supabase) throw new Error("Supabase not configured");
    const { error } = await supabase.from("shared_list_members").upsert(
      {
        shared_list_id: sharedListId,
        member_email: email.toLowerCase(),
        role: role === "owner" ? "editor" : role, // 不能透過邀請把對方升成 owner
        status: "pending",
        invited_at: new Date().toISOString(),
      },
      { onConflict: "shared_list_id,member_email" }
    );
    if (error) throw error;
    await listSharedMembersFn(sharedListId);
  }, [myRoleByList, listSharedMembersFn]);

  const kickFromSharedListFn = useCallback(async (sharedListId: string, email: string) => {
    const myRole = myRoleByList[sharedListId];
    if (myRole !== "owner") throw new Error("Only owner can remove members");
    await kickFromSharedList(sharedListId, email);
    await listSharedMembersFn(sharedListId);
  }, [myRoleByList, listSharedMembersFn]);

  const changeSharedMemberRole = useCallback(async (sharedListId: string, email: string, role: MemberRole) => {
    const myRole = myRoleByList[sharedListId];
    if (myRole !== "owner") throw new Error("Only owner can change roles");
    const { supabase } = await import("./supabase");
    if (!supabase) return;
    await supabase
      .from("shared_list_members")
      .update({ role })
      .eq("shared_list_id", sharedListId)
      .eq("member_email", email.toLowerCase());
    await listSharedMembersFn(sharedListId);
  }, [myRoleByList, listSharedMembersFn]);

  const getMyRole = useCallback((sharedListId: string): MemberRole | null => {
    return myRoleByList[sharedListId] ?? null;
  }, [myRoleByList]);

  // 進入 shared list → 自動拉成員名單（給 UI 顯示）
  useEffect(() => {
    if (currentSharedListId) {
      void listSharedMembersFn(currentSharedListId);
    }
  }, [currentSharedListId, listSharedMembersFn]);

  // ── 自動清理：完成超過 7 天的任務，釋放雲端空間 ──────────────
  const COMPLETED_TASK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
  useEffect(() => {
    if (!tasks.length || !user) return;
    const now = Date.now();
    const toDelete = tasks.filter(
      (t) => t.status === "done" && t.completedAt && now - new Date(t.completedAt).getTime() > COMPLETED_TASK_RETENTION_MS
    );
    if (!toDelete.length) return;
    void (async () => {
      for (const task of toDelete) {
        await deleteTask(task.id);
      }
    })();
  }, [tasks, user, deleteTask]);

  // ── 通知 ─────────────────────────────────────────────
  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === "undefined") return false;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    return result === "granted";
  }, []);

  // ── Provider value ─────────────────────────────────────
  const value: AppContextValue = {
    tasks, lists, habits, todayFocusMinutes,
    currentView, currentListId, setCurrentView,
    currentSharedListId, setCurrentSharedList,
    searchQuery, setSearchQuery,
    activeFilter, setActiveFilter,
    addTask, updateTask, deleteTask, toggleTaskStatus, archiveTask, unarchiveTask,
    addSubTask, toggleSubTask, deleteSubTask,
    completeRecurringAndClone,
    addList, updateList, deleteList,
    addHabit, updateHabit, deleteHabit, checkinHabit: checkinHabitFn,
    quickAdd,
    requestNotificationPermission, notificationPermission,
    sharedLists, sharedListIds: Object.keys(sharedLists),
    shareList, unshareList, acceptSharedList, removeAcceptedSharedList,
    checkIncomingShareLink, quickAddToShared, updateSharedTask, deleteSharedTask,
    reorderSharedTask,
    listSharedMembers: listSharedMembersFn,
    inviteToSharedList: inviteToSharedListFn,
    kickFromSharedList: kickFromSharedListFn,
    changeSharedMemberRole,
    getMyRole,
    membersBySharedList,
    getFilteredTasks, viewCounts, getListTaskCount, getTagCounts,
    forceReload: () => setReloadKey((k) => k + 1),
    markEditingActivity,
    clearEditingActivity,
  };

  if (!isLoaded) return <AppShellSkeleton />;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// ─── helpers ─────────────────────────────────────────────────
function computeHabitStreak(habit: Habit, checkins: Habit["checkins"]): number {
  if (checkins.length === 0) return 0;
  const localToday = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const doneDates = checkins.filter((c) => c.completed).map((c) => c.date).sort().reverse();
  if (doneDates.length === 0) return 0;
  if (doneDates[0] !== localToday && doneDates[0] !== yesterday) return 0;
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
    case "daily": d.setDate(d.getDate() + recurrence.interval); break;
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
    case "yearly": d.setFullYear(d.getFullYear() + recurrence.interval); break;
    case "custom": d.setDate(d.getDate() + recurrence.interval); break;
  }
  return d.toISOString().split("T")[0];
}
