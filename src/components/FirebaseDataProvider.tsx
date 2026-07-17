"use client";

/**
 * FirebaseDataProvider
 *
 * 包在 AppProvider 外面，負責 Firebase 登入後的 Firestore 即時同步。
 *
 * 架構：
 * - localStorage 是所有資料的 source of truth
 * - FirebaseDataProvider 做 sync layer：
 *   → Firebase 登入後，從 Firestore 拉取資料寫入 localStorage，
 *     再呼叫 forceReload() 讓 AppContext 重讀，達成多裝置同步
 *   → 使用者在 AppContext 寫入 localStorage 時，同步寫 Firestore
 *
 * Race condition 解法：
 * - SyncWriter 寫 Firestore 前，設定 skipNext 標記
 * - subscription 回調收到 Firestore 資料時，檢查 skipNext，若已標記則跳過寫入
 * - 避免 SyncWriter 寫入 Firestore 的同時，subscription 舊資料回調覆蓋 localStorage
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useApp } from "@/lib/AppContext";
import {
  subscribeTasks,
  subscribeLists,
  subscribeHabits,
  subscribePomodoro,
  saveTask,
  deleteTask as fsDeleteTask,
  saveList,
  deleteList as fsDeleteList,
  saveHabit,
  deleteHabit as fsDeleteHabit,
  savePomodoroSession,
} from "@/lib/firestore";
import {
  saveTasks,
  saveLists,
  saveHabits,
  savePomodoroSessions,
  getTasks,
  getLists,
  getHabits,
} from "@/lib/storage";
import { Task, TaskList, Habit } from "@/lib/types";
import { Unsubscribe } from "firebase/firestore";

// ─── Skip flag — module-level singleton ────────────────────────
// SyncWriter 和 FirebaseDataProvider 透過此物件溝通
// 避免 SyncWriter 寫 Firestore 時，subscription 舊資料覆蓋 localStorage
const skipNext = {
  tasks: false,
  lists: false,
  habits: false,
};

interface FirebaseDataProviderProps {
  children: React.ReactNode;
}

export function FirebaseDataProvider({ children }: FirebaseDataProviderProps) {
  const { user, loading } = useAuth();
  const { forceReload } = useApp();
  const unsubs = useRef<Unsubscribe[]>([]);
  const prevUserId = useRef<string | undefined>(undefined);
  const userId = user?.uid;

  // ─── 偵測使用者切換 ─────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (userId === prevUserId.current) return;
    prevUserId.current = userId;

    if (!userId) return; // 訪客模式，不同步 Firestore

    // 使用者切換：清空舊監聽，重新訂閱
    unsubs.current.forEach((u) => u?.());
    unsubs.current = [];

    // Firestore → localStorage
    subscribeTasks(userId, (fsTasks) => {
      if (skipNext.tasks) { skipNext.tasks = false; return; }
      saveTasks(fsTasks);
      forceReload();
    }).then((unsub) => { unsubs.current.push(unsub); }).catch(() => {});
    subscribeLists(userId, (fsLists) => {
      if (skipNext.lists) { skipNext.lists = false; return; }
      saveLists(fsLists);
      forceReload();
    }).then((unsub) => { unsubs.current.push(unsub); }).catch(() => {});
    subscribeHabits(userId, (fsHabits) => {
      if (skipNext.habits) { skipNext.habits = false; return; }
      saveHabits(fsHabits);
      forceReload();
    }).then((unsub) => { unsubs.current.push(unsub); }).catch(() => {});
    subscribePomodoro(userId, (fsSessions) => {
      savePomodoroSessions(fsSessions);
    }).then((unsub) => { unsubs.current.push(unsub); }).catch(() => {});

    return () => {
      unsubs.current.forEach((u) => u?.());
      unsubs.current = [];
    };
  }, [userId, loading, forceReload]);

  // ─── localStorage → Firestore 寫回（寫時同步）───────────
  // 這部分由 AppContext 的包裝層在 dispatch action 時同步寫 Firestore
  // 當前實作：在 Firebase 模式下，每次 CRUD 都即時寫 Firestore
  // 見下方的 SyncWriter 元件

  return <>{children}</>;
}

/**
 * SyncWriter — 包在 AppContext 外，攔截所有寫入操作並同步到 Firestore
 * 使用方式：在 AppProvider 內 render 此元件
 */
export function SyncWriter({ userId }: { userId: string }) {
  const { tasks, lists, habits } = useApp();
  const prevTasks = useRef<Task[]>([]);
  const prevLists = useRef<TaskList[]>([]);
  const prevHabits = useRef<Habit[]>([]);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      prevTasks.current = tasks;
      prevLists.current = lists;
      prevHabits.current = habits;
      isFirst.current = false;
      return;
    }

    // 任務新增 / 更新
    const newTasks = tasks.filter(
      (t) => !prevTasks.current.find((pt) => pt.id === t.id)
    );
    newTasks.forEach((t) => {
      skipNext.tasks = true;
      saveTask(userId, t).catch(() => { skipNext.tasks = false; });
    });

    // 個人任務刪除由 AppContext 的 deleteTask (Supabase) 統一處理，
    // Firebase 刪除由 subscribeTasks 回調自動同步，不在這裡另外刪。
    // 否則會造成雙寫/雙刪競爭：Firebase subscription 回調在刪除完成前觸發，
    // 把舊資料寫回 localStorage，覆蓋本地刪除，刷新後又讀回 Firestore 的任務。
    const deletedTasks = prevTasks.current.filter(
      (pt) => !tasks.find((t) => t.id === pt.id)
    );
    // deletedTasks 的刪除由 AppContext.deleteTask → deleteTaskFirebase (Supabase) 處理

    // 清單新增
    const newLists = lists.filter(
      (l) => !prevLists.current.find((pl) => pl.id === l.id)
    );
    newLists.forEach((l) => {
      skipNext.lists = true;
      saveList(userId, l).catch(() => { skipNext.lists = false; });
    });

    const deletedLists = prevLists.current.filter(
      (pl) => !lists.find((l) => l.id === pl.id)
    );
    deletedLists.forEach((l) => {
      skipNext.lists = true;
      fsDeleteList(userId, l.id).catch(() => { skipNext.lists = false; });
    });

    // 習慣新增
    const newHabits = habits.filter(
      (h) => !prevHabits.current.find((ph) => ph.id === h.id)
    );
    newHabits.forEach((h) => {
      skipNext.habits = true;
      saveHabit(userId, h).catch(() => { skipNext.habits = false; });
    });

    const deletedHabits = prevHabits.current.filter(
      (ph) => !habits.find((h) => h.id === ph.id)
    );
    deletedHabits.forEach((h) => {
      skipNext.habits = true;
      fsDeleteHabit(userId, h.id).catch(() => { skipNext.habits = false; });
    });

    prevTasks.current = tasks;
    prevLists.current = lists;
    prevHabits.current = habits;
  }, [tasks, lists, habits, userId]);

  return null;
}
