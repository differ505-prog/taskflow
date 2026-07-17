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
 * Race condition 解法（pendingExpected 比對）：
 * - SyncWriter 寫 Firestore 前，把當前任務存進 module-level ref
 * - subscribeTasks 回調比較：若 Firestore 任務已包含期望的新任務，說明是自己寫的，跳過覆蓋
 * - 否則信任 Firestore（別的客戶端寫的）
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

// ─── 期望狀態比對 ref ───────────────────────────────────────
// 避免 SyncWriter 寫 Firestore 時，subscription 舊資料覆蓋 localStorage
// 策略：寫 Firestore 前存期望狀態，回調時比對 Firestore 是否已包含新任務
const pendingExpected = {
  tasks: null as Task[] | null,
  lists: null as TaskList[] | null,
  habits: null as Habit[] | null,
};

// 檢查 fsItems 是否已包含 expected 中所有新項目（即是自己寫的）
function fsContainsExpected<T extends { id: string }>(
  fsItems: T[],
  expected: T[] | null
): boolean {
  if (!expected) return false;
  return expected.every((e) => fsItems.some((f) => f.id === e.id));
}

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
      if (fsContainsExpected(fsTasks, pendingExpected.tasks)) {
        pendingExpected.tasks = null;
        return; // 自己寫的 Firestore，跳過覆蓋 localStorage
      }
      pendingExpected.tasks = null;
      saveTasks(fsTasks);
      forceReload();
    }).then((unsub) => { unsubs.current.push(unsub); }).catch(() => {});
    subscribeLists(userId, (fsLists) => {
      if (fsContainsExpected(fsLists, pendingExpected.lists)) {
        pendingExpected.lists = null;
        return;
      }
      pendingExpected.lists = null;
      saveLists(fsLists);
      forceReload();
    }).then((unsub) => { unsubs.current.push(unsub); }).catch(() => {});
    subscribeHabits(userId, (fsHabits) => {
      if (fsContainsExpected(fsHabits, pendingExpected.habits)) {
        pendingExpected.habits = null;
        return;
      }
      pendingExpected.habits = null;
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

  return <>{children}</>;
}

/**
 * SyncWriter — 包在 AppContext 外，攔截所有寫入操作並同步到 Firestore
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

    // 任務新增：寫 Firestore 前存入期望狀態
    const newTasks = tasks.filter(
      (t) => !prevTasks.current.find((pt) => pt.id === t.id)
    );
    if (newTasks.length > 0) {
      pendingExpected.tasks = [...tasks];
      saveTask(userId, newTasks[0]).then(() => {
        // 任務寫入成功後，期望狀態在下次回調時自動清除
      }).catch(() => {
        pendingExpected.tasks = null;
      });
    }

    // 清單新增
    const newLists = lists.filter(
      (l) => !prevLists.current.find((pl) => pl.id === l.id)
    );
    if (newLists.length > 0) {
      pendingExpected.lists = [...lists];
      saveList(userId, newLists[0]).catch(() => {
        pendingExpected.lists = null;
      });
    }

    const deletedLists = prevLists.current.filter(
      (pl) => !lists.find((l) => l.id === pl.id)
    );
    deletedLists.forEach((l) => {
      fsDeleteList(userId, l.id).catch(() => {});
    });

    // 習慣新增
    const newHabits = habits.filter(
      (h) => !prevHabits.current.find((ph) => ph.id === h.id)
    );
    if (newHabits.length > 0) {
      pendingExpected.habits = [...habits];
      saveHabit(userId, newHabits[0]).catch(() => {
        pendingExpected.habits = null;
      });
    }

    const deletedHabits = prevHabits.current.filter(
      (ph) => !habits.find((h) => h.id === ph.id)
    );
    deletedHabits.forEach((h) => {
      fsDeleteHabit(userId, h.id).catch(() => {});
    });

    prevTasks.current = tasks;
    prevLists.current = lists;
    prevHabits.current = habits;
  }, [tasks, lists, habits, userId]);

  return null;
}
