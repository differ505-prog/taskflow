"use client";

/**
 * AppProvider — 組合層（Composition Root）
 *
 * 職責：
 * 1. 管理所有全域狀態
 * 2. 提供 boot/load/subscribe 邏輯
 * 3. 組合 AppRouterProvider → ListsProvider → TasksProvider → HabitsProvider → SharedListsProvider
 * 4. 維持 useApp() 向後相容 API
 *
 * 所有具體 CRUD 邏輯已抽至獨立的 *_Provider.tsx。
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  Task,
  TaskList,
  Habit,
  AppView,
  TaskFilter,
  SubTask,
  DEFAULT_LIST_IDS,
  migratePriority,
  PRIORITY_RANK,
  SharedListSnapshot,
} from "../types";
import {
  getTasks,
  saveTasks,
  getLists,
  saveLists,
  getHabits,
  saveHabits,
  initDefaultLists,
  getTodayFocusMinutes,
  SharedListData,
  getSharedLists,
  deduplicateSharedLists,
  saveOwnedSharedListIds,
  getOwnedSharedListIds,
  getMyRoleByList,
} from "../storage";
import { deleteFile } from "../storageUpload";
import {
  subscribeTasks,
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
import { useWriteGuard } from "@/hooks/useWriteGuard";
import { updateLastActive } from "@/lib/userProfiles";
import { triggerWebhook } from "@/lib/useWebhook";
import { notifyFirstTaskDone } from "@/lib/useDiscordNotifier";
import { getKnownUserCount } from "@/lib/useNewUserDetection";
import { toast } from "sonner";
import { AppShellSkeleton } from "@/components/Skeleton";
import { dispatchPwaInstallPrompt } from "@/components/PwaPrompts";
import { appContextLog } from "./utils";
import type { AppContextValue } from "./types";

// ── Providers ────────────────────────────────────────────────
import { AppRouterProvider, useAppRouter } from "./AppRouterProvider";
import { TasksProvider } from "./TasksProvider";
import { ListsProvider } from "./ListsProvider";
import { HabitsProvider } from "./HabitsProvider";
import { SharedListsProvider, useSharedListsContext } from "./SharedListsProvider";
import { useTasksContext } from "./TasksProvider";
import { useListsContext } from "./ListsProvider";

const log = appContextLog("AppProvider");

// ── Context（維持向後相容） ───────────────────────────────
const AppContext = createContext<AppContextValue | null>(null);
export { AppContext };

// ── Provider ────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  log.breadcrumb("100. AppProvider 渲染開始");
  const { user } = useAuth();

  // ── State ────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayFocusMinutes, setTodayFocusMinutes] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TaskFilter>({});
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "default">("default");
  const [isLoaded, setIsLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const lastEmittedSizesRef = useRef({ tasks: 0, habits: 0, lists: 0 });

  // ── Shared List State ───────────────────────────────────
  const [sharedLists, setSharedLists] = useState<Record<string, SharedListData>>({});
  const [ownedSharedListIds, _setOwnedSharedListIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") return getOwnedSharedListIds();
    return [];
  });
  const ownedSharedListIdsRef = useRef<string[]>([]);
  useEffect(() => { ownedSharedListIdsRef.current = ownedSharedListIds; }, [ownedSharedListIds]);
  const setOwnedSharedListIds = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    _setOwnedSharedListIds((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      ownedSharedListIdsRef.current = next;
      saveOwnedSharedListIds(next);
      return next;
    });
  }, []);
  const [acceptedSharedListIds, setAcceptedSharedListIds] = useState<string[]>([]);
  const [myRoleByList, _setMyRoleByList] = useState<Record<string, MemberRole>>(() => {
    if (typeof window !== "undefined") return getMyRoleByList();
    return {};
  });
  const setMyRoleByList = useCallback((updater: Record<string, MemberRole> | ((prev: Record<string, MemberRole>) => Record<string, MemberRole>)) => {
    _setMyRoleByList((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
  }, []);
  const [membersBySharedList, setMembersBySharedList] = useState<Record<string, SharedMember[]>>({});

  // ── Refs ────────────────────────────────────────────────
  const syncedTaskIdsRef = useRef<Set<string>>(new Set());
  const syncedHabitIdsRef = useRef<Set<string>>(new Set());
  const firstTasksLoadDone = useRef(false);
  const firstListsLoadDone = useRef(false);
  const firstHabitsLoadDone = useRef(false);
  const deletedTaskIdsRef_deleteGuards = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const fbUnsubRef = useRef<(() => void) | null>(null);
  const listsUnsubRef = useRef<(() => void) | null>(null);
  const habitsUnsubRef = useRef<(() => void) | null>(null);
  const tasksRef = useRef<Task[]>([]);
  const lastActiveWriteAtRef = useRef<Record<string, number>>({});

  // ── Write Guard ────────────────────────────────────────
  const writeGuard = useWriteGuard();

  // Sync tasksRef
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Log render
  useEffect(() => {
    log.sync(`UI RENDER tasks updated: count=${tasks.length}`);
  }, [tasks]);

  // ── Helper functions (inlined from Providers for boot use) ──
  const dedupeDuplicateLists = useCallback((listsToDedupe: TaskList[]): TaskList[] => {
    const seen = new Map<string, TaskList>();
    const dupIds: string[] = [];
    for (const l of listsToDedupe) {
      const key = DEFAULT_LIST_IDS[l.name] ?? l.id;
      const existing = seen.get(key);
      if (existing) { dupIds.push(l.id); } else { seen.set(key, l); }
    }
    if (dupIds.length === 0) return listsToDedupe;
    const result = Array.from(seen.values());
    const dupIdSet = new Set(dupIds);
    const rebuiltTasks = tasksRef.current.map((t) => {
      if (t.listId && dupIdSet.has(t.listId)) {
        const keeper = result.find((l) => l.name === listsToDedupe.find((x) => x.id === t.listId)?.name);
        return { ...t, listId: keeper?.id ?? t.listId };
      }
      return t;
    });
    if (rebuiltTasks.some((t, i) => t !== tasksRef.current[i])) {
      setTasks(rebuiltTasks);
      saveTasks(rebuiltTasks);
      if (user?.uid) batchSaveListsFirebase(user.uid, rebuiltTasks as unknown as TaskList[]).catch((err) => log.warn("rebind tasks failed", err));
    }
    return result;
  }, [user]);

  const rebindTasksToKeptLists = useCallback((rawLists: TaskList[], deduped: TaskList[]) => {
    if (!user?.uid) return;
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
      batchSaveTasksFirebase(user.uid, rebuilt).catch((err) => log.warn("rebind tasks failed", err));
    }
  }, [user]);

  // ── Init Boot ────────────────────────────────────────────
  useEffect(() => {
    const storedLists = initDefaultLists();
    setLists(storedLists);
    const localTasks = getTasks();
    setTasks(localTasks);
    log.sync(`APP INIT localStorage tasks=${localTasks.length} user=${user?.uid ?? "null"}`);
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
          const { getMyRoleInSharedList: getMyRole } = await import("../firestore");
          const roleEntries: Record<string, MemberRole> = {};
          for (const sid of allIds) {
            const r = await getMyRole(sid, user.uid);
            if (r) roleEntries[sid] = r;
          }
          if (Object.keys(roleEntries).length > 0) {
            _setMyRoleByList(roleEntries);
          }
        })();
      }
    }

    if (typeof Notification !== "undefined") {
      setNotificationPermission(Notification.permission);
    }

    // ── Supabase Realtime 訂閱 ──────
    if (user) {
      log.sync(`APP INIT subscribing to uid=${user.uid}`);
      if (fbUnsubRef.current) fbUnsubRef.current();
      subscribeTasks(user.uid, (fbTasks, deletedId, pendingDeletions) => {
        log.sync(`SUP SYNC tasks 推送: ${fbTasks.length}`);
        setTasks((prev) => {
          const deleted = new Set<string>();
          for (const [id] of writeGuard.recentDeleteTimestamps.current) {
            if (writeGuard.isWithinRecentDeleteWindow(id)) deleted.add(id);
          }
          const guardIds = deletedTaskIdsRef_deleteGuards.current.keys();
          for (const id of guardIds) {
            if (writeGuard.isWithinRecentDeleteWindow(id)) deleted.add(id);
          }
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
              if (writeGuard.isWithinRecentWriteWindow(fbT.id)) return local;
              if (writeGuard.isWithinEditingActivityWindow(fbT.id)) return local;
              if (new Date(local.updatedAt).getTime() > new Date(fbT.updatedAt).getTime()) return local;
            }
            return fbT;
          });
          const localOnly = prevWithoutDeleted.filter((t) => {
            if (fbIds.has(t.id)) return false;
            if (!t.listId) return true;
            const owningList = lists.find((l) => l.id === t.listId);
            return !owningList?.sharedId;
          });
          const trueLocalOnly = localOnly.filter((t) => !syncedTaskIdsRef.current.has(t.id));
          const result = [...merged, ...trueLocalOnly];
          log.sync(`SUP SYNC setTasks: merged=${merged.length} trueLocalOnly=${trueLocalOnly.length} result=${result.length}`);
          saveTasks(result);
          if (trueLocalOnly.length > 0 && user) {
            const orphans = trueLocalOnly.filter((t) => !writeGuard.isWithinRecentWriteWindow(t.id));
            if (orphans.length > 0) {
              log.sync(`自動補推 ${orphans.length} 個孤兒任務上雲`);
              batchSaveTasksFirebase(user.uid, orphans).catch((err) => log.error("孤兒補推失敗", err));
            }
          }
          return result;
        });
      }, new Set()).then((unsub) => {
        fbUnsubRef.current = unsub;
        log.sync(`已訂閱 tasks uid: ${user.uid}`);
      }).catch((err) => {
        log.warn("訂閱任務失敗", err);
      });

      subscribeListsSync(user.uid, (fbLists) => {
        if (!firstListsLoadDone.current) { firstListsLoadDone.current = true; return; }
        log.sync(`SUP SYNC lists 推送: ${fbLists.length}`);
        const deduped = dedupeDuplicateLists(fbLists);
        rebindTasksToKeptLists(fbLists, deduped);
        setLists((prev) => {
          const localById = new Map(prev.map((l) => [l.id, l]));
          return deduped.map((fbL) => {
            const local = localById.get(fbL.id);
            const ts = writeGuard.recentlyWrittenListsRef.current.get(fbL.id);
            if (local && ts !== undefined && Date.now() - ts < 5_000) {
              return { ...fbL, order: local.order, updatedAt: local.updatedAt };
            }
            return fbL;
          });
        });
        saveLists(deduped);
      }).then((unsub) => {
        listsUnsubRef.current = unsub;
      }).catch((err) => {
        log.warn("訂閱清單失敗", err);
      });

      habitsUnsubRef.current?.();
      subscribeHabits(user.uid, (fbHabits) => {
        if (!firstHabitsLoadDone.current) { firstHabitsLoadDone.current = true; return; }
        log.sync(`SUP SYNC habits 推送: ${fbHabits.length}`);
        setHabits((prev) => {
          const localById = new Map(prev.map((h) => [h.id, h]));
          const fbIds = new Set<string>();
          const merged = fbHabits.map((fbH) => {
            fbIds.add(fbH.id);
            syncedHabitIdsRef.current.add(fbH.id);
            const local = localById.get(fbH.id);
            if (local) {
              if (writeGuard.isWithinRecentWriteWindowHabit(fbH.id)) return local;
              if (new Date(local.updatedAt).getTime() > new Date(fbH.updatedAt).getTime()) return local;
            }
            return fbH;
          });
          const localOnly = prev.filter((h) => !fbIds.has(h.id));
          const trueLocalOnly = localOnly.filter((h) => !syncedHabitIdsRef.current.has(h.id));
          const result = [...merged, ...trueLocalOnly];
          saveHabits(result);
          if (trueLocalOnly.length > 0 && user) {
            const orphans = trueLocalOnly.filter((h) => !writeGuard.isWithinRecentWriteWindowHabit(h.id));
            if (orphans.length > 0) {
              log.sync(`自動補推 ${orphans.length} 個孤兒 habit 上雲`);
              batchSaveHabits(user.uid, orphans).catch((err) => log.error("孤兒 habit 補推失敗", err));
            }
          }
          return result;
        });
      }).then((unsub) => {
        habitsUnsubRef.current = unsub;
        log.sync(`已訂閱 habits uid: ${user.uid}`);
      }).catch((err) => {
        log.warn("訂閱習慣失敗", err);
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
      setIsLoaded(true);
      return;
    }

    async function migrateLocalToSupabase(uid: string): Promise<void> {
      try {
        const MIGRATE_KEY = `__migrated_to_supabase_${uid}`;
        if (localStorage.getItem(MIGRATE_KEY)) { await cleanupDuplicateListsInCloud(uid); return; }
        const localTasks = getTasks();
        const localLists = getLists();
        const localHabits = getHabits();
        if (localTasks.length > 0) { await batchSaveTasksFirebase(uid, localTasks); log.sync(`遷移 ${localTasks.length} 筆任務到雲端`); }
        if (localLists.length > 0) { await batchSaveListsFirebase(uid, localLists); log.sync(`遷移 ${localLists.length} 筆清單到雲端`); }
        if (localHabits.length > 0) { await batchSaveHabits(uid, localHabits); log.sync(`遷移 ${localHabits.length} 筆習慣到雲端`); }
        localStorage.setItem(MIGRATE_KEY, "1");
        await cleanupDuplicateListsInCloud(uid);
      } catch (err) { log.warn("遷移失敗（不影響現有功能）", err); }
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
            log.sync(`清理重複清單: ${dupId}（保留 ${keeper.id}）`);
          }
        }
        const finalCloudLists = await loadLists(uid);
        const finalDeduped = dedupeDuplicateLists(finalCloudLists);
        setLists(finalDeduped);
        saveLists(finalDeduped);
      } catch (err) { log.warn("雲端去重失敗", err); }
    }

    setIsLoaded(true);
  }, [user, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared List Discovery ────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !user) return;
    const discoverNewSharedLists = async () => {
      try {
        const { fetchMySharedListIds } = await import("../sharedSync");
        const { ownedIds, joinedIds } = await fetchMySharedListIds(user.uid);
        const orphanOwnedIds = ownedSharedListIds.filter(id => !ownedIds.includes(id));
        if (orphanOwnedIds.length > 0) {
          log.sync(`Removing orphan owned lists: ${orphanOwnedIds.length}`);
          orphanOwnedIds.forEach(id => { const { removeSharedList: rs } = require("../storage"); rs(id); });
          setSharedLists(getSharedLists());
        }
        if (JSON.stringify([...ownedSharedListIds].sort()) !== JSON.stringify([...ownedIds].sort())) {
          setOwnedSharedListIds(ownedIds);
        }
        const newAcceptedIds = joinedIds.filter(id => !ownedIds.includes(id) && !acceptedSharedListIds.includes(id));
        const orphanJoinedIds = acceptedSharedListIds.filter(id => !joinedIds.includes(id));
        if (newAcceptedIds.length > 0 || orphanJoinedIds.length > 0) {
          log.sync(`Syncing joined lists. New: ${newAcceptedIds.length}, Orphans: ${orphanJoinedIds.length}`);
          if (orphanJoinedIds.length > 0) {
            orphanJoinedIds.forEach(id => { const { removeSharedList: rs } = require("../storage"); rs(id); });
            setSharedLists(getSharedLists());
          }
          setAcceptedSharedListIds(prev => {
            const next = new Set([...prev, ...newAcceptedIds]);
            orphanJoinedIds.forEach(id => next.delete(id));
            return Array.from(next);
          });
        }
      } catch (err) { log.warn("Failed to discover new shared lists", err); }
    };
    discoverNewSharedLists();
  }, [isLoaded, reloadKey, user, ownedSharedListIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Webhook ──────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    const last = lastEmittedSizesRef.current;
    if (last.tasks === tasks.length && last.habits === habits.length && last.lists === lists.length) return;
    lastEmittedSizesRef.current = { tasks: tasks.length, habits: habits.length, lists: lists.length };
    triggerWebhook({
      timestamp: new Date().toISOString(),
      event: "batch",
      source: user?.uid ?? "anonymous",
      data: { taskCount: tasks.length, habitCount: habits.length, listCount: lists.length,
        recentTaskTitles: tasks.slice(-5).map((t) => ({ id: t.id, title: t.title, status: t.status })) },
    });
  }, [isLoaded, tasks, habits, lists, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Owned Shared List IDs from lists ────────────────────
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
  }, [isLoaded, user, lists]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed values ─────────────────────────────────────
  const forceReload = useCallback(() => setReloadKey((k) => k + 1), []);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === "undefined") return false;
    const perm = await Notification.requestPermission();
    if (perm === "granted" && typeof window !== "undefined") {
      const { saveNotificationPermission } = require("../storage");
      saveNotificationPermission(perm);
    }
    return perm === "granted";
  }, []);

  // ── 組合 Providers ──────────────────────────────────────
  return (
    <AppRouterProvider>
      <ListsProvider
        writeGuard={writeGuard}
        lists={lists}
        setLists={setLists}
        tasks={tasks}
        setTasks={setTasks}
        userUid={user?.uid}
      >
        <TasksProvider
          writeGuard={writeGuard}
          tasks={tasks}
          setTasks={setTasks}
          lists={lists}
          sharedLists={sharedLists}
          userUid={user?.uid}
          onSharedListsChange={setSharedLists}
        >
          <HabitsProvider
            writeGuard={writeGuard}
            habits={habits}
            setHabits={setHabits}
            userUid={user?.uid}
          >
            <SharedListsProvider
              writeGuard={writeGuard}
              sharedLists={sharedLists}
              setSharedLists={setSharedLists}
              ownedSharedListIds={ownedSharedListIds}
              setOwnedSharedListIds={setOwnedSharedListIds}
              acceptedSharedListIds={acceptedSharedListIds}
              setAcceptedSharedListIds={setAcceptedSharedListIds}
              myRoleByList={myRoleByList}
              setMyRoleByList={setMyRoleByList}
              membersBySharedList={membersBySharedList}
              setMembersBySharedList={setMembersBySharedList}
              lists={lists}
              setLists={setLists}
              tasks={tasks}
              setTasks={setTasks}
              userUid={user?.uid}
            >
              {isLoaded ? children : <AppShellSkeleton />}
            </SharedListsProvider>
          </HabitsProvider>
        </TasksProvider>
      </ListsProvider>
    </AppRouterProvider>
  );
}

// ── useApp（向後相容鉤子） ─────────────────────────────────
/**
 * useApp — 維持所有既有呼叫點的向後相容。
 * 從各 Provider 的 context 組合完整 API surface。
 */
export function useApp(): AppContextValue {
  const router = useAppRouter();
  const tasksCtx = useTasksContext();
  const listsCtx = useListsContext();
  const sharedCtx = useSharedListsContext();
  const { user } = useAuth();

  const quickAdd = useCallback((input: string): string | null => {
    const parsed = parseNaturalLanguage(input);
    if (!parsed || !parsed.title) return null;
    return tasksCtx.addTask({
      title: parsed.title,
      status: "todo",
      priority: parsed.priority ?? "none",
      dueDate: parsed.dueDate,
      tags: parsed.tags ?? [],
      subTasks: [],
      attachments: [],
      recurrence: parsed.recurrence,
      description: "",
      ownerUid: user?.uid,
    });
  }, [tasksCtx, user]);

  const getFilteredTasks = useCallback(() => {
    return tasksCtx.getFilteredTasks({
      currentView: router.currentView,
      currentListId: router.currentListId,
      searchQuery: router.searchQuery ?? "",
      activeFilter: router.activeFilter ?? {},
    });
  }, [tasksCtx, router]);

  const setCurrentView = useCallback((v: AppView, listId?: string) => {
    router.setCurrentViewState(v);
    router.setCurrentListId(listId);
    router.setCurrentSharedListIdState(undefined);
    router.setSearchQuery("");
    router.setActiveFilter({});
  }, [router]);

  return useMemo(() => {
    const appValue: AppContextValue = {
      tasks: tasksCtx.tasks,
      lists: listsCtx.lists,
      habits: [] as Habit[],
      todayFocusMinutes: 0,
      isAppReady: true,
      tasksInitialized: true,
      forceReload: () => {},

      currentView: router.currentView,
      currentListId: router.currentListId,
      setCurrentView,
      currentSharedListId: router.currentSharedListId,
      setCurrentSharedList: router.setCurrentSharedListIdState,

      searchQuery: router.searchQuery,
      setSearchQuery: router.setSearchQuery,
      activeFilter: router.activeFilter,
      setActiveFilter: router.setActiveFilter,

      // 任務 CRUD
      addTask: tasksCtx.addTask,
      addTaskLocalOnly: tasksCtx.addTaskLocalOnly,
      batchAddTasks: tasksCtx.batchAddTasks,
      updateTask: tasksCtx.updateTask,
      moveTaskToShared: tasksCtx.moveTaskToShared,
      deleteTask: tasksCtx.deleteTask,
      toggleTaskStatus: tasksCtx.toggleTaskStatus,
      markEditingActivity: tasksCtx.markEditingActivity,
      clearEditingActivity: tasksCtx.clearEditingActivity,
      archiveTask: tasksCtx.archiveTask,
      unarchiveTask: tasksCtx.unarchiveTask,
      escapeTask: tasksCtx.escapeTask,
      addSubTask: tasksCtx.addSubTask,
      toggleSubTask: tasksCtx.toggleSubTask,
      deleteSubTask: tasksCtx.deleteSubTask,
      reorderSubTasks: tasksCtx.reorderSubTasks,
      completeRecurringAndClone: tasksCtx.completeRecurringAndClone,
      completeTask: tasksCtx.completeTask,
      reorderTasks: tasksCtx.reorderTasks,
      saveTasksDirectly: tasksCtx.saveTasksDirectly,
      undoDelete: tasksCtx.undoDelete,

      // 清單 CRUD
      addList: listsCtx.addList,
      updateList: listsCtx.updateList,
      deleteList: listsCtx.deleteList,
      reorderLists: listsCtx.reorderLists,

      // 任務工具
      getFilteredTasks: (() => tasksCtx.getFilteredTasks({
        currentView: router.currentView,
        currentListId: router.currentListId,
        searchQuery: router.searchQuery,
        activeFilter: router.activeFilter,
      })) as unknown as AppContextValue["getFilteredTasks"],
      viewCounts: tasksCtx.viewCounts,
      getListTaskCount: tasksCtx.getListTaskCount,
      getTagCounts: tasksCtx.getTagCounts,
      addHabit: () => {},
      updateHabit: () => {},
      archiveHabit: () => {},
      unarchiveHabit: () => {},
      checkinHabit: () => {},
      uncheckHabit: () => {},

      // Quick Add
      quickAdd,
      requestNotificationPermission: async () => false,
      notificationPermission: "default" as NotificationPermission | "default",
      setNotificationPermission: () => {},

      // Shared Lists（占位，待整合）
      sharedLists: sharedCtx.sharedLists,
      sharedListIds: [...sharedCtx.ownedSharedListIds, ...sharedCtx.acceptedSharedListIds],
      acceptedSharedListIds: sharedCtx.acceptedSharedListIds,
      shareList: sharedCtx.shareList,
      unshareList: sharedCtx.unshareList,
      acceptSharedList: sharedCtx.acceptSharedList,
      removeAcceptedSharedList: sharedCtx.removeAcceptedSharedList,
      checkIncomingShareLink: sharedCtx.checkIncomingShareLink,
      quickAddToShared: sharedCtx.quickAddToShared,
      updateSharedTask: sharedCtx.updateSharedTask,
      deleteSharedTask: sharedCtx.deleteSharedTask,
      reorderSharedTask: sharedCtx.reorderSharedTask,
      listSharedMembers: sharedCtx.listSharedMembers,
      inviteToSharedList: sharedCtx.inviteToSharedList,
      kickFromSharedList: sharedCtx.kickFromSharedList,
      changeSharedMemberRole: sharedCtx.changeSharedMemberRole,
      getMyRole: sharedCtx.getMyRole,
      membersBySharedList: sharedCtx.membersBySharedList,
    };
    return appValue;
  }, [router, tasksCtx, listsCtx, sharedCtx, user, setCurrentView, quickAdd]);
}
