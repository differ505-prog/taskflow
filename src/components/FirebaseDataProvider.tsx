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
    const unsubTasks = subscribeTasks(userId, (fsTasks) => {
      saveTasks(fsTasks);
      forceReload();
    });
    const unsubLists = subscribeLists(userId, (fsLists) => {
      saveLists(fsLists);
      forceReload();
    });
    const unsubHabits = subscribeHabits(userId, (fsHabits) => {
      saveHabits(fsHabits);
      forceReload();
    });
    const unsubPomodoro = subscribePomodoro(userId, (fsSessions) => {
      savePomodoroSessions(fsSessions);
    });

    unsubs.current = [unsubTasks, unsubLists, unsubHabits, unsubPomodoro];

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
    newTasks.forEach((t) => saveTask(userId, t).catch(() => {}));

    const deletedTasks = prevTasks.current.filter(
      (pt) => !tasks.find((t) => t.id === pt.id)
    );
    deletedTasks.forEach((t) => fsDeleteTask(userId, t.id).catch(() => {}));

    // 清單新增
    const newLists = lists.filter(
      (l) => !prevLists.current.find((pl) => pl.id === l.id)
    );
    newLists.forEach((l) => saveList(userId, l).catch(() => {}));

    const deletedLists = prevLists.current.filter(
      (pl) => !lists.find((l) => l.id === pl.id)
    );
    deletedLists.forEach((l) => fsDeleteList(userId, l.id).catch(() => {}));

    // 習慣新增
    const newHabits = habits.filter(
      (h) => !prevHabits.current.find((ph) => ph.id === h.id)
    );
    newHabits.forEach((h) => saveHabit(userId, h).catch(() => {}));

    const deletedHabits = prevHabits.current.filter(
      (ph) => !habits.find((h) => h.id === ph.id)
    );
    deletedHabits.forEach((h) => fsDeleteHabit(userId, h.id).catch(() => {}));

    prevTasks.current = tasks;
    prevLists.current = lists;
    prevHabits.current = habits;
  }, [tasks, lists, habits, userId]);

  return null;
}
