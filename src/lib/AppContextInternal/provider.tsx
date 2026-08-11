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
  AppView,
  TaskFilter,
  SubTask,
  Recurrence,
  SharedListSnapshot,
  DEFAULT_LIST_IDS,
  migratePriority,
  PRIORITY_RANK,
} from "../types";
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
  deduplicateSharedLists,
  saveOwnedSharedListIds,
  getOwnedSharedListIds,
  getMyRoleByList,
  saveMyRoleByList,
} from "../storage";
import { deleteFile } from "../storageUpload";
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
} from "../firestore";
import {
  subscribeTasks,
  saveTask as saveTaskFirebase,
  batchSaveTasks as batchSaveTasksFirebase,
  deleteTask as deleteTaskFirebase,
} from "../personalTaskSync";
import {
  subscribeLists as subscribeListsSync,
  batchSaveLists as batchSaveListsFirebase,
  deleteList as deleteListFirebase,
} from "../personalListSync";
import {
  subscribeHabits,
  batchSaveHabits,
} from "../personalHabitSync";
import { SharedMember, MemberRole } from "../sharedSync";
import { parseNaturalLanguage } from "../nlp";
import { useAuth } from "../AuthContext";
import { updateLastActive } from "@/lib/userProfiles";
import { triggerWebhook } from "@/lib/useWebhook";
import { notifyFirstTaskDone } from "@/lib/useDiscordNotifier";
import { getKnownUserCount } from "@/lib/useNewUserDetection";
import { toast } from "sonner";
import { getLocalToday, toLocalDateString } from "../dateUtils";
import { AppShellSkeleton } from "@/components/Skeleton";
import { dispatchPwaInstallPrompt } from "@/components/PwaPrompts";
import type { AppContextValue } from "./types";

// ── Context ─────────────────────────────────────────────────────
const AppContext = createContext<AppContextValue | null>(null);

export { AppContext };

// ── Provider ────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  console.log(`[Breadcrumb] 100. AppProvider 渲染開始 - ${Date.now()}`);
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayFocusMinutes, setTodayFocusMinutes] = useState(0);
  const lastEmittedSizesRef = useRef({ tasks: 0, habits: 0, lists: 0 });

  useEffect(() => {
    console.log(`[UI RENDER] tasks updated: count=${tasks.length} at ${new Date().toISOString()}`);
  }, [tasks]);

  const [currentView, setCurrentViewState] = useState<AppView>("inbox");
  const [currentListId, setCurrentListId] = useState<string | undefined>(undefined);
  const [currentSharedListId, setCurrentSharedListIdState] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TaskFilter>({});
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "default">("default");
  const [isLoaded, setIsLoaded] = useState(false);
  const [tasksInitialized, setTasksInitialized] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const lastActiveWriteAtRef = useRef<Record<string, number>>({});
  const deletedTaskIdsRef = useRef<Set<string>>(new Set());
  const syncedTaskIdsRef = useRef<Set<string>>(new Set());
  const syncedHabitIdsRef = useRef<Set<string>>(new Set());
  const previousTasksRef = useRef<Task[]>([]);
  const recentlyWrittenRef = useRef<Map<string, number>>(new Map());
  const RECENT_WRITE_WINDOW_MS = 5_000;
  const editingTaskIdsRef = useRef<Set<string>>(new Set());
  const lastEditActivityRef = useRef<Map<string, number>>(new Map());
  const EDIT_ACTIVITY_WINDOW_MS = 30_000;
  const firstTasksLoadDone = useRef(false);
  const firstListsLoadDone = useRef(false);
  const firstHabitsLoadDone = useRef(false);
  const recentlyWrittenHabitsRef = useRef<Map<string, number>>(new Map());
  const recentlyWrittenListsRef = useRef<Map<string, number>>(new Map());
  const ACTIVE_THROTTLE_MS = 30_000;

  const markRecentlyWritten = useCallback((id: string) => {
    recentlyWrittenRef.current.set(id, Date.now());
  }, []);

  const markEditingActivity = useCallback((id: string) => {
    editingTaskIdsRef.current.add(id);
    lastEditActivityRef.current.set(id, Date.now());
  }, []);

  const clearEditingActivity = useCallback((id: string) => {
    editingTaskIdsRef.current.delete(id);
    lastEditActivityRef.current.delete(id);
  }, []);

  const isWithinRecentWriteWindow = useCallback((id: string): boolean => {
    const map = recentlyWrittenRef.current;
    const now = Date.now();
    for (const [tid, ts] of map) {
      if (now - ts >= RECENT_WRITE_WINDOW_MS) map.delete(tid);
    }
    const ts = map.get(id);
    return ts !== undefined && now - ts < RECENT_WRITE_WINDOW_MS;
  }, []);

  const isWithinRecentWriteWindowHabit = useCallback((id: string): boolean => {
    const map = recentlyWrittenHabitsRef.current;
    const now = Date.now();
    for (const [tid, ts] of map) {
      if (now - ts >= RECENT_WRITE_WINDOW_MS) map.delete(tid);
    }
    const ts = map.get(id);
    return ts !== undefined && now - ts < RECENT_WRITE_WINDOW_MS;
  }, []);

  const isWithinEditingActivityWindow = useCallback((id: string): boolean => {
    if (!editingTaskIdsRef.current.has(id)) return false;
    const lastActivity = lastEditActivityRef.current.get(id);
    if (lastActivity === undefined) return false;
    const now = Date.now();
    const map = lastEditActivityRef.current;
    for (const [tid, ts] of map) {
      if (now - ts >= EDIT_ACTIVITY_WINDOW_MS) {
        map.delete(tid);
        editingTaskIdsRef.current.delete(tid);
      }
    }
    return now - lastActivity < EDIT_ACTIVITY_WINDOW_MS;
  }, []);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // ── Shared List State ───────────────────────────────────
  const [sharedLists, setSharedLists] = useState<Record<string, SharedListData>>({});
  const [ownedSharedListIds, _setOwnedSharedListIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") return getOwnedSharedListIds();
    return [];
  });
  const ownedSharedListIdsRef = useRef<string[]>([]);
  useEffect(() => {
    ownedSharedListIdsRef.current = ownedSharedListIds;
  }, [ownedSharedListIds]);
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
  const habitsUnsubRef = useRef<(() => void) | null>(null);
  const myEchoIdsRef = useRef<Set<string>>(new Set<string>());
  const tasksRef = useRef<Task[]>([]);
  const fbSyncDebug = false;

  const [myRoleByList, _setMyRoleByList] = useState<Record<string, MemberRole>>(() => {
    if (typeof window !== "undefined") return getMyRoleByList();
    return {};
  });
  const setMyRoleByList = useCallback((updater: Record<string, MemberRole> | ((prev: Record<string, MemberRole>) => Record<string, MemberRole>)) => {
    _setMyRoleByList((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveMyRoleByList(next);
      return next;
    });
  }, []);

  const [membersBySharedList, setMembersBySharedList] = useState<Record<string, SharedMember[]>>({});

  // ── Init ─────────────────────────────────────────────────
  useEffect(() => {
    const storedLists = initDefaultLists();
    setLists(storedLists);
    const localTasks = getTasks();
    setTasks(localTasks);
    console.log(`[APP INIT] localStorage tasks=${localTasks.length} user=${user?.uid ?? "null"}`);
    setHabits(getHabits());
    setTodayFocusMinutes(getTodayFocusMinutes());
    const removed = deduplicateSharedLists();
    if (removed > 0) {
      void fetch("/api/push/test-self", { method: "POST" }).catch(() => {});
    }
    const storedSharedLists = getSharedLists();
    setSharedLists(storedSharedLists);

    if (user) {
      const storedOwnedIds = getOwnedSharedListIds();
      const storedAcceptedIds = storedSharedLists ? Object.keys(storedSharedLists) : [];
      const allIds = [...new Set([...storedOwnedIds, ...storedAcceptedIds])];
      if (allIds.length > 0) {
        void (async () => {
          const roleEntries: Record<string, MemberRole> = {};
          for (const sid of allIds) {
            const r = await getMyRoleInSharedList(sid, user.uid);
            if (r) roleEntries[sid] = r;
          }
          if (Object.keys(roleEntries).length > 0) {
            setMyRoleByList(roleEntries);
          }
        })();
      }
    }

    if (typeof Notification !== "undefined") {
      setNotificationPermission(Notification.permission);
    }

    // ── Supabase Realtime 訂閱 ──────
    if (user) {
      console.log(`[APP INIT] subscribing to uid=${user.uid}`);
      if (fbUnsubRef.current) fbUnsubRef.current();
      subscribeTasks(user.uid, (fbTasks, deletedId, pendingDeletions) => {
        if (fbSyncDebug) console.log("[SUP SYNC] tasks 推送:", fbTasks.length);
        setTasks((prev) => {
          const deleted = new Set(deletedTaskIdsRef.current);
          if (deletedId) deleted.add(deletedId);
          if (pendingDeletions) pendingDeletions.forEach((id) => deleted.add(id));
          const prevWithoutDeleted = prev.filter((t) => !deleted.has(t.id));
          const localById = new Map(prevWithoutDeleted.map((t) => [t.id, t]));
          const fbIds = new Set<string>();
          const merged = fbTasks.map((fbT) => {
            fbIds.add(fbT.id);
            syncedTaskIdsRef.current.add(fbT.id);
            const local = localById.get(fbT.id);
            if (local) {
              if (isWithinRecentWriteWindow(fbT.id)) return local;
              if (isWithinEditingActivityWindow(fbT.id)) return local;
              if (new Date(local.updatedAt).getTime() > new Date(fbT.updatedAt).getTime()) return local;
            }
            return fbT;
          });
          const localOnly = prevWithoutDeleted.filter(
            (t) => !fbIds.has(t.id) && (!t.listId || !getSharedLists()[t.listId])
          );
          const trueLocalOnly = localOnly.filter((t) => !syncedTaskIdsRef.current.has(t.id));
          const result = [...merged, ...trueLocalOnly];
          console.log(`[SUP SYNC] setTasks result: merged=${merged.length} trueLocalOnly=${trueLocalOnly.length} deleted=${deleted.size} result=${result.length}`);
          saveTasks(result);
          if (trueLocalOnly.length > 0 && user) {
            const orphans = trueLocalOnly.filter((t) => !isWithinRecentWriteWindow(t.id));
            if (orphans.length > 0) {
              console.log(`[SUP SYNC] 自動補推 ${orphans.length} 個孤兒任務上雲`);
              batchSaveTasksFirebase(user.uid, orphans).catch((err) =>
                console.error("[SUP SYNC] 孤兒補推失敗:", err)
              );
            }
          }
          return result;
        });
      }, deletedTaskIdsRef.current).then((unsub) => {
        fbUnsubRef.current = unsub;
        setTasksInitialized(true);
        if (fbSyncDebug) console.log("[SUP SYNC] 已訂閱 tasks uid:", user.uid);
      }).catch((err) => {
        console.warn("[SUP SYNC] 訂閱任務失敗:", err);
      });

      let lastCloudLists: TaskList[] = [];
      subscribeListsSync(user.uid, (fbLists) => {
        if (!firstListsLoadDone.current) {
          firstListsLoadDone.current = true;
          return;
        }
        if (fbSyncDebug) console.log("[SUP SYNC] lists 推送:", fbLists.length);
        const deduped = dedupeDuplicateLists(fbLists);
        rebindTasksToKeptLists(fbLists, deduped);
        lastCloudLists = deduped;
        setLists((prev) => {
          const localById = new Map(prev.map((l) => [l.id, l]));
          const merged = deduped.map((fbL) => {
            const local = localById.get(fbL.id);
            const ts = recentlyWrittenListsRef.current.get(fbL.id);
            if (ts !== undefined && Date.now() - ts >= 5_000) {
              recentlyWrittenListsRef.current.delete(fbL.id);
            }
            if (local && ts !== undefined && Date.now() - ts < 5_000) {
              return { ...fbL, order: local.order, updatedAt: local.updatedAt };
            }
            return fbL;
          });
          return merged;
        });
        saveLists(deduped);
      }).then((unsub) => {
        listsUnsubRef.current = unsub;
      }).catch((err) => {
        console.warn("[SUP SYNC] 訂閱清單失敗:", err);
      });

      habitsUnsubRef.current?.();
      subscribeHabits(user.uid, (fbHabits) => {
        console.log(`[SUBSCRIBE HABITS] callback uid=${user.uid} fbHabits=${fbHabits.length} firstLoadDone=${firstHabitsLoadDone.current}`);
        if (!firstHabitsLoadDone.current) {
          firstHabitsLoadDone.current = true;
          return;
        }
        if (fbSyncDebug) console.log("[SUP SYNC] habits 推送:", fbHabits.length);
        setHabits((prev) => {
          const localById = new Map(prev.map((h) => [h.id, h]));
          const fbIds = new Set<string>();
          const merged = fbHabits.map((fbH) => {
            fbIds.add(fbH.id);
            syncedHabitIdsRef.current.add(fbH.id);
            const local = localById.get(fbH.id);
            if (local) {
              if (isWithinRecentWriteWindowHabit(fbH.id)) return local;
              if (new Date(local.updatedAt).getTime() > new Date(fbH.updatedAt).getTime()) return local;
            }
            return fbH;
          });
          const localOnly = prev.filter((h) => !fbIds.has(h.id));
          const trueLocalOnly = localOnly.filter((h) => !syncedHabitIdsRef.current.has(h.id));
          const result = [...merged, ...trueLocalOnly];
          saveHabits(result);
          if (trueLocalOnly.length > 0 && user) {
            const orphans = trueLocalOnly.filter((h) => !isWithinRecentWriteWindowHabit(h.id));
            if (orphans.length > 0) {
              console.log(`[SUP SYNC] 自動補推 ${orphans.length} 個孤兒 habit 上雲`);
              batchSaveHabits(user.uid, orphans).catch((err) =>
                console.error("[SUP SYNC] 孤兒 habit 補推失敗:", err)
              );
            }
          }
          return result;
        });
      }).then((unsub) => {
        habitsUnsubRef.current = unsub;
        if (fbSyncDebug) console.log("[SUP SYNC] 已訂閱 habits uid:", user.uid);
      }).catch((err) => {
        console.warn("[SUP SYNC] 訂閱習慣失敗:", err);
      });

      firstTasksLoadDone.current = false;
      firstListsLoadDone.current = false;
      firstHabitsLoadDone.current = false;
      if (user.uid) {
        const { updateLastUserUid } = require("../storage");
        updateLastUserUid(user.uid);
      }

      void migrateLocalToSupabase(user.uid);
    } else {
      setTasks(getTasks());
      setTasksInitialized(true);
      setIsLoaded(true);
      return;
    }

    async function migrateLocalToSupabase(uid: string): Promise<void> {
      try {
        const MIGRATE_KEY = `__migrated_to_supabase_${uid}`;
        if (localStorage.getItem(MIGRATE_KEY)) {
          await cleanupDuplicateListsInCloud(uid);
          return;
        }
        const localTasks = getTasks();
        const localLists = dedupeDuplicateLists(getLists());
        const localHabits = getHabits();
        if (localTasks.length > 0) {
          await batchSaveTasksFirebase(uid, localTasks);
          console.log(`[SUP SYNC] 遷移 ${localTasks.length} 筆任務到雲端`);
        }
        if (localLists.length > 0) {
          await batchSaveListsFirebase(uid, localLists);
          console.log(`[SUP SYNC] 遷移 ${localLists.length} 筆清單到雲端`);
        }
        if (localHabits.length > 0) {
          await batchSaveHabits(uid, localHabits);
          console.log(`[SUP SYNC] 遷移 ${localHabits.length} 筆習慣到雲端`);
        }
        localStorage.setItem(MIGRATE_KEY, "1");
        await cleanupDuplicateListsInCloud(uid);
      } catch (err) {
        console.warn("[SUP SYNC] 遷移失敗（不影響現有功能）:", err);
      }
    }

    async function cleanupDuplicateListsInCloud(uid: string): Promise<void> {
      try {
        const { loadLists, deleteList: delList } = await import("../personalListSync");
        const { loadTasks } = await import("../personalTaskSync");
        const cloudLists = await loadLists(uid);
        if (cloudLists.length === 0) return;
        const groups = new Map<string, TaskList[]>();
        for (const l of cloudLists) {
          const key = DEFAULT_LIST_IDS[l.name] ?? l.id;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(l);
        }
        for (const [, group] of groups) {
          if (group.length <= 1) continue;
          group.sort((a, b) => {
            const aFixed = a.id.startsWith("init:") ? 0 : 1;
            const bFixed = b.id.startsWith("init:") ? 0 : 1;
            if (aFixed !== bFixed) return aFixed - bFixed;
            return a.createdAt.localeCompare(b.createdAt);
          });
          const keeper = group[0];
          const dupIds = group.slice(1).map((l) => l.id);
          const cloudTasks = await loadTasks(uid);
          const rebuilt = cloudTasks.map((t) =>
            t.listId && dupIds.includes(t.listId) ? { ...t, listId: keeper.id } : t
          );
          if (rebuilt.some((t, i) => t !== cloudTasks[i])) {
            await batchSaveTasksFirebase(uid, rebuilt);
          }
          for (const dupId of dupIds) {
            await delList(uid, dupId);
            console.log(`[SUP SYNC] 清理重複清單: ${dupId}（保留 ${keeper.id}）`);
          }
        }
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
    console.log(`[Breadcrumb] 101. AppProvider useEffect (user=${user?.uid}) - ${Date.now()}`);
    if (!isLoaded || !user) return;
    const storedSharedLists = getSharedLists();
    const acceptedIds = Object.keys(storedSharedLists).filter(
      (id) => !ownedSharedListIds.includes(id)
    );
    setAcceptedSharedListIds(acceptedIds);

    const discoverNewSharedLists = async () => {
      try {
        const { fetchMySharedListIds } = await import("../sharedSync");
        const { ownedIds, joinedIds } = await fetchMySharedListIds(user.uid);
        const orphanOwnedIds = ownedSharedListIds.filter(id => !ownedIds.includes(id));
        if (orphanOwnedIds.length > 0) {
          console.log("[SharedList] Removing orphan owned lists:", orphanOwnedIds);
          orphanOwnedIds.forEach(id => removeSharedList(id));
          setSharedLists(getSharedLists());
        }
        if (JSON.stringify([...ownedSharedListIds].sort()) !== JSON.stringify([...ownedIds].sort())) {
          setOwnedSharedListIds(ownedIds);
          import("../storage").then(({ saveOwnedSharedListIds }) => saveOwnedSharedListIds(ownedIds));
        }
        const newAcceptedIds = joinedIds.filter(
          (id) => !ownedIds.includes(id) && !acceptedIds.includes(id)
        );
        const orphanJoinedIds = acceptedIds.filter(id => !joinedIds.includes(id));
        if (newAcceptedIds.length > 0 || orphanJoinedIds.length > 0) {
          console.log("[SharedList] Syncing joined lists. New:", newAcceptedIds, "Orphans to remove:", orphanJoinedIds);
          if (orphanJoinedIds.length > 0) {
            orphanJoinedIds.forEach(id => removeSharedList(id));
            setSharedLists(getSharedLists());
          }
          setAcceptedSharedListIds(prev => {
            const next = new Set([...prev, ...newAcceptedIds]);
            orphanJoinedIds.forEach(id => next.delete(id));
            return Array.from(next);
          });
        }
      } catch (err) {
        console.warn("[SharedList] Failed to discover new shared lists:", err);
      }
    };
    discoverNewSharedLists();
  }, [isLoaded, reloadKey, user, ownedSharedListIds]);

  // ── Webhook ────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    const last = lastEmittedSizesRef.current;
    if (
      last.tasks === tasks.length &&
      last.habits === habits.length &&
      last.lists === lists.length
    ) {
      return;
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
      queueMicrotask(() => saveTasks(migratedTasks));
    }
    const active = migratedTasks.filter((t) => !t.isArchived && (!t.listId || !sharedLists[t.listId]));
    const activeShared = Object.values(sharedLists).flatMap(l => l.tasks).filter(t => !t.isArchived);
    let result = [...active, ...activeShared];
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const weekEndDate = new Date(now.getTime() + 7 * 86400000);
    const localWeekEnd = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth()+1).padStart(2,"0")}-${String(weekEndDate.getDate()).padStart(2,"0")}`;
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
      result = result.filter((t) => !t.listId || (t.listId && !lists.find(l => l.id === t.listId) && !sharedLists[t.listId]));
    } else if (currentView === "pinned") {
      result = result.filter((t) => t.isPinned);
    } else if (currentView === "shared") {
      result = [];
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
      if (!a.isArchived && a.status !== "done" && a.isPinned && !(b.isPinned && !b.isArchived && b.status !== "done")) return -1;
      if (!b.isArchived && b.status !== "done" && b.isPinned && !(a.isPinned && !a.isArchived && a.status !== "done")) return 1;
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      const po = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (po !== 0) return po;
      return a.order - b.order;
    });
  }, [tasks, currentView, currentListId, searchQuery, activeFilter, sharedLists]);

  const viewCounts = useMemo(() => {
    const active = tasks.filter((t) => !t.isArchived);
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const weekEndDate = new Date(now.getTime() + 7 * 86400000);
    const localWeekEnd = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth()+1).padStart(2,"0")}-${String(weekEndDate.getDate()).padStart(2,"0")}`;
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

  const getListTaskCount = useCallback((listId: string) => {
    const list = lists.find((l) => l.id === listId);
    if (list?.sharedId && sharedLists[list.sharedId]) {
      return sharedLists[list.sharedId].tasks.filter((t) => !t.isArchived && t.status !== "done").length;
    }
    return tasks.filter((t) => t.listId === listId && !t.isArchived && t.status !== "done").length;
  }, [tasks, lists, sharedLists]);

  const getTagCounts = useCallback(() => {
    const counts: Record<string, number> = {};
    tasks.filter((t) => !t.isArchived && t.status !== "done").forEach((t) => {
      t.tags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return counts;
  }, [tasks]);

  // ── 清單去重 ────────────────────────────────────────────
  function dedupeDuplicateLists(lists: TaskList[]): TaskList[] {
    const seen = new Map<string, TaskList>();
    const dupIds: string[] = [];
    for (const l of lists) {
      const key = DEFAULT_LIST_IDS[l.name] ?? l.id;
      const existing = seen.get(key);
      if (existing) {
        dupIds.push(l.id);
      } else {
        seen.set(key, l);
      }
    }
    if (dupIds.length === 0) return lists;
    const result = Array.from(seen.values());
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

  function rebindTasksToKeptLists(rawLists: TaskList[], deduped: TaskList[]) {
    if (!user) return;
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

  // ── 任務 CRUD ────────────────────────────────────────────
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
      ownerUid: user?.uid,
    };
    const updated = [task, ...tasks];
    setTasks(updated);
    saveTasks(updated);
    markRecentlyWritten(id);
    if (user) {
      const { updateLastUserUid: ulu } = require("../storage");
      ulu(user.uid);
      batchSaveTasksFirebase(user.uid, [task]).catch((err) => console.error("[SUP SYNC] 新增失敗:", err));
    }
    return id;
  }, [tasks, user, markRecentlyWritten]);

  const addTaskLocalOnly = useCallback((
    datas: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order" | "ownerUid">[]
  ): string[] => {
    if (datas.length === 0) return [];
    const now = new Date().toISOString();
    const newTasks: Task[] = [];
    const ids: string[] = [];
    let nextOrder = tasks.filter((t) => !t.isArchived).length;
    for (const data of datas) {
      const id = generateId();
      ids.push(id);
      newTasks.push({ ...data, id, createdAt: now, updatedAt: now, focusMinutes: 0, isArchived: false, order: nextOrder++ });
    }
    const updated = [...newTasks, ...tasks];
    setTasks(updated);
    saveTasks(updated);
    return ids;
  }, [tasks]);

  const batchAddTasks = useCallback((
    datas: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">[]
  ): string[] => {
    if (datas.length === 0) return [];
    const now = new Date().toISOString();
    const newTasks: Task[] = [];
    const ids: string[] = [];
    let nextOrder = tasks.filter((t) => !t.isArchived).length;
    for (const data of datas) {
      const id = generateId();
      ids.push(id);
      newTasks.push({ ...data, id, createdAt: now, updatedAt: now, focusMinutes: 0, isArchived: false, order: nextOrder++, ownerUid: user?.uid });
    }
    const updated = [...newTasks, ...tasks];
    setTasks(updated);
    saveTasks(updated);
    ids.forEach((id) => markRecentlyWritten(id));
    if (user) {
      const { updateLastUserUid: ulu } = require("../storage");
      ulu(user.uid);
      batchSaveTasksFirebase(user.uid, newTasks).catch((err) =>
        console.error("[SUP SYNC] 批次新增失敗:", err)
      );
    }
    return ids;
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

  const UNDO_WINDOW_MS = 5_000;

  const undoDelete = useCallback((taskId: string) => {
    const previous = previousTasksRef.current;
    const task = previous.find((t) => t.id === taskId);
    if (!task) return;
    const updated = [task, ...tasks];
    setTasks(updated);
    saveTasks(updated);
    syncedTaskIdsRef.current.delete(taskId);
    if (user) batchSaveTasksFirebase(user.uid, [task]).catch((err) => console.error("[SUP SYNC] undo 寫入失敗:", err));
    toast.success(`已恢復「${task.title}」`);
  }, [tasks, user]);

  const deleteTask = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.attachments && task.attachments.length > 0) {
      for (const attachment of task.attachments) {
        if (attachment.storagePath) {
          deleteFile(attachment.storagePath).catch((err) => {
            console.warn("[AppContext] Failed to delete attachment:", err);
          });
        }
      }
    }
    previousTasksRef.current = tasks;
    deletedTaskIdsRef.current.add(id);
    const updated = tasks.filter((t) => t.id !== id);
    console.log(`[AppContext] 刪除任務 ${id}，時間: ${Date.now()}`);
    setTasks(updated);
    saveTasks(updated);
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
    if (user) {
      deleteTaskFirebase(user.uid, id)
        .then(() => {
          deletedTaskIdsRef.current.delete(id);
        })
        .catch((err) => {
          console.warn("[SUP SYNC] 刪除失敗:", err);
          deletedTaskIdsRef.current.delete(id);
        });
    } else {
      deletedTaskIdsRef.current.delete(id);
    }
  }, [tasks, user, undoDelete]);

  const toggleTaskStatus = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newStatus: Task["status"] = task.status === "done" ? "todo" : "done";
    const updated = tasks.map((t) =>
      t.id === id
        ? { ...t, status: newStatus, updatedAt: new Date().toISOString(), completedAt: newStatus === "done" ? new Date().toISOString() : undefined }
        : t
    );
    setTasks(updated);
    saveTasks(updated);
    markRecentlyWritten(id);
    if (newStatus === "done" && task.status === "todo") {
      const hasAnyDoneBefore = tasks.some((t) => t.id !== id && t.status === "done");
      if (!hasAnyDoneBefore) {
        setTimeout(() => dispatchPwaInstallPrompt(), 600);
        if (user?.email) {
          void notifyFirstTaskDone(user.email, task.title, getKnownUserCount());
        }
      }
    }
    if (user) {
      const updatedTask = updated.find((t) => t.id === id);
      if (updatedTask) batchSaveTasksFirebase(user.uid, [updatedTask]).catch((err) => console.error("[SUP SYNC] toggle 失敗:", err));
    }
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

  const escapeTask = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.recurrence) {
      const baseFrom = task.dueDate || new Date().toISOString().split("T")[0];
      const { dueDate: nextDate, startDate: nextStartDate } = getNextRecurrenceDate(
        baseFrom, task.recurrence, task.startDate
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
  }, [tasks, updateTask]);

  // ── 子任務 ──────────────────────────────────────────────
  const addSubTask = useCallback((parentId: string, title: string) => {
    const task = tasks.find((t) => t.id === parentId);
    if (!task) return;
    const existingSubs = task.subTasks || [];
    const subTask: SubTask = {
      id: generateId(), title, status: "todo",
      createdAt: new Date().toISOString(), order: existingSubs.length,
    };
    updateTask(parentId, { subTasks: [...existingSubs, subTask] });
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

  const reorderSubTasks = useCallback((parentId: string, newTodoSubs: SubTask[]) => {
    const task = tasks.find((t) => t.id === parentId);
    if (!task) return;
    const existingSubs = task.subTasks || [];
    const doneSubs = existingSubs.filter((s) => s.status === "done");
    const renumbered: SubTask[] = newTodoSubs.map((s, idx) => ({ ...s, order: idx }));
    const merged = [...renumbered, ...doneSubs];
    updateTask(parentId, { subTasks: merged });
  }, [tasks, updateTask]);

  // ── 週期 ──────────────────────────────────────────────
  const completeRecurringAndClone = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task?.recurrence) return;
    const baseFrom = task.dueDate || new Date().toISOString().split("T")[0];
    const { dueDate: nextDate, startDate: nextStartDate } = getNextRecurrenceDate(
      baseFrom, task.recurrence, task.startDate
    );
    if (task.recurrence.endDate && nextDate > task.recurrence.endDate) {
      toggleTaskStatusRef.current?.(taskId);
      return;
    }
    const updatedRecurrence = { ...task.recurrence, completedCount: task.recurrence.completedCount + 1 };
    const updated = tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: "todo" as const, dueDate: nextDate, startDate: nextStartDate ?? t.startDate, recurrence: updatedRecurrence, updatedAt: new Date().toISOString() }
        : t
    );
    setTasks(updated);
    saveTasks(updated);
    markRecentlyWritten(taskId);
    if (user) {
      const updatedTask = updated.find((t) => t.id === taskId);
      if (updatedTask) batchSaveTasksFirebase(user.uid, [updatedTask]).catch((err) => console.error("[SUP SYNC] rec 失敗:", err));
    }
  }, [tasks, user, markRecentlyWritten]);

  const toggleTaskStatusRef = useRef<(id: string) => void>(() => {});
  toggleTaskStatusRef.current = toggleTaskStatus;

  const completeTask = useCallback((id: string) => {
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
  }, [tasks, completeRecurringAndClone]);

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
    const affectedTasks = tasks.filter((t) => t.listId === id);
    const taskUpdated = tasks.map((t) => t.listId === id ? { ...t, listId: undefined } : t);
    setTasks(taskUpdated);
    saveTasks(taskUpdated);
    if (user && affectedTasks.length > 0) {
      batchSaveTasksFirebase(user.uid, affectedTasks.map((t) => ({ ...t, listId: undefined }))).catch(console.warn);
    }
  }, [lists, tasks, user]);

  const markListRecentlyWritten = useCallback((listId: string) => {
    recentlyWrittenListsRef.current.set(listId, Date.now());
  }, []);

  const isListWithinRecentWriteWindow = useCallback((listId: string): boolean => {
    const map = recentlyWrittenListsRef.current;
    const ts = map.get(listId);
    if (ts === undefined) return false;
    const now = Date.now();
    if (now - ts >= 5_000) { map.delete(listId); return false; }
    return true;
  }, []);

  const reorderLists = useCallback((newListOrder: TaskList[]) => {
    const now = new Date().toISOString();
    const updated: TaskList[] = newListOrder.map((l, idx) => {
      const existing = lists.find((cur) => cur.id === l.id);
      return existing
        ? { ...existing, order: idx, updatedAt: now }
        : { ...l, order: idx, updatedAt: now };
    });
    setLists(updated);
    saveLists(updated);
    updated.forEach((l) => recentlyWrittenListsRef.current.set(l.id, Date.now()));
    if (user) batchSaveListsFirebase(user.uid, updated).catch(console.warn);
  }, [lists, user]);

  const reorderTasks = useCallback((reorderedTasks: Task[]) => {
    if (reorderedTasks.length === 0) return;
    const now = new Date().toISOString();
    const updated: Task[] = reorderedTasks.map((t, idx) => ({ ...t, order: idx, updatedAt: now }));
    const ids = new Set(updated.map((t) => t.id));
    const merged = tasks.map((t) => ids.has(t.id) ? updated.find((u) => u.id === t.id)! : t);
    setTasks(merged);
    saveTasks(merged);
    updated.forEach((t) => recentlyWrittenRef.current.set(t.id, Date.now()));
    if (user) batchSaveTasksFirebase(user.uid, updated).catch((err) => console.error("[SUP SYNC] reorder 寫入失敗:", err));
  }, [tasks, user]);

  const saveTasksDirectly = useCallback((updatedTasks: Task[]) => {
    if (updatedTasks.length === 0) return;
    const ids = new Set(updatedTasks.map((t) => t.id));
    const merged = tasks.map((t) => ids.has(t.id) ? updatedTasks.find((u) => u.id === t.id)! : t);
    setTasks(merged);
    saveTasks(merged);
    updatedTasks.forEach((t) => recentlyWrittenRef.current.set(t.id, Date.now()));
    if (user) {
      batchSaveTasksFirebase(user.uid, updatedTasks).catch(console.error);
    }
  }, [tasks, user]);

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
    recentlyWrittenHabitsRef.current.set(newHabit.id, Date.now());
    if (user) batchSaveHabits(user.uid, [newHabit]).catch((err) => console.error("[SUP SYNC] addHabit 寫入失敗:", err));
  }, [habits, user]);

  const updateHabit = useCallback((id: string, updates: Partial<Habit>) => {
    const updated = habits.map((h) => h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h);
    setHabits(updated);
    saveHabits(updated);
    recentlyWrittenHabitsRef.current.set(id, Date.now());
    if (user) {
      const changed = updated.find((h) => h.id === id);
      if (changed) batchSaveHabits(user.uid, [changed]).catch((err) => console.error("[SUP SYNC] updateHabit 寫入失敗:", err));
    }
  }, [habits, user]);

  const archiveHabit = useCallback((id: string) => {
    const updated = habits.map((h) =>
      h.id === id ? { ...h, archivedAt: new Date().toISOString() } : h
    );
    setHabits(updated);
    saveHabits(updated);
    recentlyWrittenHabitsRef.current.set(id, Date.now());
    if (user) {
      const changed = updated.find((h) => h.id === id);
      if (changed) batchSaveHabits(user.uid, [changed]).catch((err) => console.error("[SUP SYNC] archiveHabit 寫入失敗:", err));
    }
  }, [habits, user]);

  const unarchiveHabit = useCallback((id: string) => {
    const updated = habits.map((h) => {
      if (h.id !== id) return h;
      const { archivedAt, ...rest } = h;
      return rest;
    });
    setHabits(updated);
    saveHabits(updated);
    recentlyWrittenHabitsRef.current.set(id, Date.now());
    if (user) {
      const changed = updated.find((h) => h.id === id);
      if (changed) batchSaveHabits(user.uid, [changed]).catch((err) => console.error("[SUP SYNC] unarchiveHabit 寫入失敗:", err));
    }
  }, [habits, user]);

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
    recentlyWrittenHabitsRef.current.set(id, Date.now());
    if (user) {
      const changed = updated.find((h) => h.id === id);
      if (changed) batchSaveHabits(user.uid, [changed]).catch((err) => console.error("[SUP SYNC] checkinHabit 寫入失敗:", err));
    }
  }, [habits, user]);

  const uncheckHabitFn = useCallback((id: string, date: string) => {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    const remaining = habit.checkins.filter((c) => c.date !== date);
    if (remaining.length === habit.checkins.length) return;
    const streak = computeHabitStreak(habit, remaining);
    const longestStreak = Math.max(habit.longestStreak, streak);
    const updated = habits.map((h) =>
      h.id === id ? { ...h, checkins: remaining, streak, longestStreak, updatedAt: new Date().toISOString() } : h
    );
    setHabits(updated);
    saveHabits(updated);
    recentlyWrittenHabitsRef.current.set(id, Date.now());
    if (user) {
      const changed = updated.find((h) => h.id === id);
      if (changed) batchSaveHabits(user.uid, [changed]).catch((err) => console.error("[SUP SYNC] uncheckHabit 寫入失敗:", err));
    }
  }, [habits, user]);

  // ── Shared List 主函式 ───────────────────────────────────
  const shareList = useCallback(async (listId: string): Promise<string | null> => {
    if (!user) return null;
    const list = lists.find((l) => l.id === listId);
    if (!list) return null;
    const listTasks = tasks.filter((t) => t.listId === listId);
    const ownerName = user.displayName || user.email || undefined;
    try {
      const sharedListId = await createSharedList(list, listTasks, user.uid, ownerName, user.email);
      const updatedList = { ...list, sharedId: sharedListId, ownerId: user.uid, updatedAt: new Date().toISOString() };
      const updatedLists = lists.map((l) => l.id === listId ? updatedList : l);
      setLists(updatedLists);
      saveLists(updatedLists);
      recentlyWrittenListsRef.current.set(listId, Date.now());
      batchSaveListsFirebase(user.uid, [updatedList]).catch(console.warn);
      setOwnedSharedListIds((prev) =>
        prev.includes(sharedListId) ? prev : [...prev, sharedListId]
      );
      setMyRoleByList((prev) => ({ ...prev, [sharedListId]: "owner" }));
      return sharedListId;
    } catch (error: any) {
      console.error("[AppContext.shareList] createSharedList failed:", error);
      throw error;
    }
  }, [user, lists, tasks]);

  const unshareList = useCallback(async (sharedListId: string): Promise<void> => {
    if (!user) return;
    try {
      await deleteSharedList(sharedListId);
      const changedList = lists.find(l => l.sharedId === sharedListId);
      const updatedLists = lists.map((l) =>
        l.sharedId === sharedListId ? { ...l, sharedId: undefined, ownerId: undefined, updatedAt: new Date().toISOString() } : l
      );
      setLists(updatedLists);
      saveLists(updatedLists);
      if (changedList) {
        recentlyWrittenListsRef.current.set(changedList.id, Date.now());
        batchSaveListsFirebase(user.uid, [{ ...changedList, sharedId: undefined, ownerId: undefined, updatedAt: new Date().toISOString() }]).catch(console.warn);
      }
      setOwnedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));
      if (sharedListUnsubscribeRefs.current[sharedListId]) {
        sharedListUnsubscribeRefs.current[sharedListId]();
        delete sharedListUnsubscribeRefs.current[sharedListId];
      }
    } catch (error) {
      console.error("Failed to unshare list:", error);
    }
  }, [user, lists]);

  const acceptSharedList = useCallback(async (sharedListId: string, _data: SharedListSnapshot): Promise<void> => {
    if (!user) return;
    try {
      await bindCurrentUserToSharedList({ sharedListId, memberUid: user.uid, memberEmail: user.email || "" });
    } catch (err) {
      console.error("[Shared] accept invite failed (likely not invited):", err);
      return;
    }
    const snapshot = await getSharedSnapshot(sharedListId);
    if (!snapshot) return;
    const existing = getSharedLists();
    const duplicate = Object.entries(existing).find(
      ([id, d]) =>
        id !== sharedListId && d.list.name === snapshot.list.name &&
        d.list.ownerId === (snapshot.ownerId || snapshot.list.ownerId)
    );
    if (duplicate) {
      console.warn("[Shared] 跳過重複加入：", snapshot.list.name, "(已有)", duplicate[0]);
      return;
    }
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

  const canEditSharedList = useCallback((sharedListId: string): boolean => {
    if (ownedSharedListIds.includes(sharedListId)) return true;
    const role = myRoleByList[sharedListId];
    return role === "owner" || role === "editor";
  }, [myRoleByList, ownedSharedListIds]);

  const guardWrite = useCallback((sharedListId: string, fn: () => Promise<void>) => {
    isWritingRef.current[sharedListId] = true;
    return fn().finally(() => { isWritingRef.current[sharedListId] = false; });
  }, []);

  // ── 訂閱 owned shared list ──────────────────────────────
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
          void isFirstSnapshot;
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

  // ── 訂閱 accepted shared list ─────────────────────────
  useEffect(() => {
    if (!user || acceptedSharedListIds.length === 0) return;
    const acceptedSet = new Set(acceptedSharedListIds);
    acceptedSharedListIds.forEach((sharedListId) => {
      if (sharedListUnsubscribeRefs.current[sharedListId]) return;
      subscribeToSharedSnapshot(
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

  // ── 拉回自己身份 ───────────────────────────────
  useEffect(() => {
    if (!user) return;
    const listSharedIds = lists.map(l => l.sharedId).filter(Boolean) as string[];
    const allIds = Array.from(new Set([...ownedSharedListIds, ...acceptedSharedListIds, ...listSharedIds]));
    allIds.forEach(async (sid) => {
      if (myRoleByList[sid]) return;
      const r = await getMyRoleInSharedList(sid, user.uid);
      if (r) setMyRoleByList((prev) => ({ ...prev, [sid]: r }));
    });
  }, [user, ownedSharedListIds, acceptedSharedListIds, lists, myRoleByList]);

  // ── Quick Add ──────────────────────────────────────────
  const quickAdd = useCallback((input: string, currentView?: string): string | null => {
    if (!input.trim()) return null;
    const parsed = parseNaturalLanguage(input);
    const dueDate = parsed.dueDate ?? (currentView === "today" ? getLocalToday() : undefined);
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

  // ── Shared List 任務操作 ─────────────────────────────
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
      createdBy: user?.uid, ownerUid: user?.uid,
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
          saveSharedList(sharedListId, fetchedData);
          setSharedLists(getSharedLists());
        });
      });
      return id;
    }
    const updatedTasks = [task, ...data.tasks];
    // @ts-ignore
    window.appDebug?.(`updateSharedTask inside: found data, updated ${updatedTasks.length} tasks`);
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
      saveSharedList(sharedListId, data);
      setSharedLists(getSharedLists());
    });
    return id;
  }, [sharedLists, user, ensureSharedListData, canEditSharedList]);

  const updateSharedTask = useCallback((sharedListId: string, taskId: string, updates: Partial<Task>) => {
    if (!canEditSharedList(sharedListId)) {
      // @ts-ignore
      window.appDebug?.(`canEditSharedList returned FALSE for ${sharedListId}`);
      console.warn("[Shared] Viewer cannot edit tasks");
      return;
    }
    const currentSharedLists = getSharedLists();
    const data = currentSharedLists[sharedListId] || sharedLists[sharedListId];
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
    const { supabase } = await import("../supabase");
    if (!supabase) throw new Error("Supabase not configured");
    const { error } = await supabase.from("shared_list_members").upsert(
      { shared_list_id: sharedListId, member_email: email.toLowerCase(), role: role === "owner" ? "editor" : role, status: "pending", invited_at: new Date().toISOString() },
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
    const { supabase } = await import("../supabase");
    if (!supabase) return;
    await supabase.from("shared_list_members").update({ role }).eq("shared_list_id", sharedListId).eq("member_email", email.toLowerCase());
    await listSharedMembersFn(sharedListId);
  }, [myRoleByList, listSharedMembersFn]);

  const getMyRole = useCallback((sharedListId: string): MemberRole | null => {
    return myRoleByList[sharedListId] ?? null;
  }, [myRoleByList, ownedSharedListIds]);

  useEffect(() => {
    if (currentSharedListId) {
      void listSharedMembersFn(currentSharedListId);
    }
  }, [currentSharedListId, listSharedMembersFn]);

  // ── 自動清理 7 天前已完成任務 ───────────────────────────
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
    addTask, addTaskLocalOnly, batchAddTasks, updateTask, deleteTask, toggleTaskStatus, archiveTask, unarchiveTask, escapeTask,
    addSubTask, toggleSubTask, deleteSubTask, reorderSubTasks,
    completeRecurringAndClone, completeTask,
    addList, updateList, deleteList, reorderLists, reorderTasks, saveTasksDirectly,
    addHabit, updateHabit, archiveHabit, unarchiveHabit, checkinHabit: checkinHabitFn,
    uncheckHabit: uncheckHabitFn,
    quickAdd,
    requestNotificationPermission, notificationPermission, setNotificationPermission,
    sharedLists, sharedListIds: Object.keys(sharedLists), acceptedSharedListIds,
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
    isAppReady: isLoaded,
    tasksInitialized,
    markEditingActivity,
    clearEditingActivity,
  };

  if (!isLoaded) return <AppShellSkeleton />;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ── useApp ──────────────────────────────────────────────────────
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// ─── helpers ─────────────────────────────────────────────────
function computeHabitStreak(habit: Habit, checkins: Habit["checkins"]): number {
  if (checkins.length === 0) return 0;
  const localToday = getLocalToday();
  const yesterday = toLocalDateString(new Date(Date.now() - 86400000));
  const doneDates = checkins.filter((c) => c.completed).map((c) => c.date).sort().reverse();
  if (doneDates.length === 0) return 0;
  if (doneDates[0] !== localToday && doneDates[0] !== yesterday) return 0;
  let streak = 0;
  let iterations = 0;
  const dateSet = new Set(doneDates);
  const d = new Date(doneDates[0]);
  while (dateSet.has(toLocalDateString(d)) && iterations < 1000) {
    streak++;
    d.setDate(d.getDate() - 1);
    iterations++;
  }
  return streak;
}

function getNextRecurrenceDate(from: string, recurrence: Recurrence, startFrom?: string): { dueDate: string; startDate?: string } {
  const d = new Date(from);
  switch (recurrence.pattern) {
    case "daily":
      d.setDate(d.getDate() + recurrence.interval);
      break;
    case "weekly":
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        d.setDate(d.getDate() + 1);
        let iterations = 0;
        const validDays = recurrence.daysOfWeek.map(Number);
        while (!validDays.includes(d.getDay()) && iterations < 7) {
          d.setDate(d.getDate() + 1);
          iterations++;
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
  const nextDueDate = d.toISOString().split("T")[0];
  if (startFrom) {
    const s = new Date(startFrom);
    const fromDate = new Date(from);
    const daysDelta = Math.round((fromDate.getTime() - s.getTime()) / 86400000);
    const nextStartDate = new Date(d.getTime());
    nextStartDate.setDate(nextStartDate.getDate() - daysDelta);
    return { dueDate: nextDueDate, startDate: nextStartDate.toISOString().split("T")[0] };
  }
  return { dueDate: nextDueDate };
}
