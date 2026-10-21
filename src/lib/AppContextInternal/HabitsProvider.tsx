"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Habit } from "../types";
import { saveHabits, generateId } from "../storage";
import { subscribeHabits, batchSaveHabits } from "../personalHabitSync";
import { computeHabitStreak, appContextLog } from "./utils";
import { useWriteGuard } from "@/hooks/useWriteGuard";

const log = appContextLog("HabitsProvider");

// ── Context Types ──────────────────────────────────────────────
export interface HabitsProviderProps {
  writeGuard: ReturnType<typeof useWriteGuard>;
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  userUid?: string;
  children: React.ReactNode;
}

export interface HabitsContextValue {
  habits: Habit[];
  addHabit: (data: Omit<Habit, "id" | "createdAt" | "updatedAt" | "checkins" | "streak" | "longestStreak">) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  archiveHabit: (id: string) => void;
  unarchiveHabit: (id: string) => void;
  checkinHabit: (id: string, date: string, count?: number, note?: string) => void;
  uncheckHabit: (id: string, date: string) => void;
  incrementHabitPomodoro: (id: string, date: string, minutes?: number) => void;
  decrementHabitPomodoro: (id: string, date: string) => void;
  logHabitTime: (id: string, date: string, minutes: number) => void;
}

// ── Context ─────────────────────────────────────────────────────
const HabitsContext = createContext<HabitsContextValue | null>(null);

export function useHabitsContext(): HabitsContextValue {
  const ctx = useContext(HabitsContext);
  if (!ctx) {
    throw new Error("useHabitsContext must be used within HabitsProvider");
  }
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────
export function HabitsProvider({
  writeGuard,
  habits,
  setHabits,
  userUid,
  children,
}: HabitsProviderProps) {
  const { markRecentlyWrittenHabit, isWithinRecentWriteWindowHabit } = writeGuard;

  // Sync-related refs (internal state)
  const syncedHabitIdsRef = useRef<Set<string>>(new Set());
  const firstHabitsLoadDone = useRef(false);
  const habitsUnsubRef = useRef<(() => void) | null>(null);

  // ── 習慣 CRUD ─────────────────────────────────────────
  const addHabit = useCallback(
    (data: Omit<Habit, "id" | "createdAt" | "updatedAt" | "checkins" | "streak" | "longestStreak">) => {
      const newHabit: Habit = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checkins: [],
        streak: 0,
        longestStreak: 0,
      };
      const updated = [...habits, newHabit];
      setHabits(updated);
      saveHabits(updated);
      markRecentlyWrittenHabit(newHabit.id);
      if (userUid) {
        batchSaveHabits(userUid, [newHabit]).catch((err) =>
          log.error("addHabit 寫入失敗", err)
        );
      }
    },
    [habits, setHabits, userUid, markRecentlyWrittenHabit]
  );

  const updateHabit = useCallback(
    (id: string, updates: Partial<Habit>) => {
      const updated = habits.map((h) =>
        h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h
      );
      setHabits(updated);
      saveHabits(updated);
      markRecentlyWrittenHabit(id);
      if (userUid) {
        const changed = updated.find((h) => h.id === id);
        if (changed) {
          batchSaveHabits(userUid, [changed]).catch((err) =>
            log.error("updateHabit 寫入失敗", err)
          );
        }
      }
    },
    [habits, setHabits, userUid, markRecentlyWrittenHabit]
  );

  const archiveHabit = useCallback(
    (id: string) => {
      const updated = habits.map((h) =>
        h.id === id ? { ...h, archivedAt: new Date().toISOString() } : h
      );
      setHabits(updated);
      saveHabits(updated);
      markRecentlyWrittenHabit(id);
      if (userUid) {
        const changed = updated.find((h) => h.id === id);
        if (changed) {
          batchSaveHabits(userUid, [changed]).catch((err) =>
            log.error("archiveHabit 寫入失敗", err)
          );
        }
      }
    },
    [habits, setHabits, userUid, markRecentlyWrittenHabit]
  );

  const unarchiveHabit = useCallback(
    (id: string) => {
      const updated = habits.map((h) => {
        if (h.id !== id) return h;
        const { archivedAt, ...rest } = h;
        return rest;
      });
      setHabits(updated);
      saveHabits(updated);
      markRecentlyWrittenHabit(id);
      if (userUid) {
        const changed = updated.find((h) => h.id === id);
        if (changed) {
          batchSaveHabits(userUid, [changed]).catch((err) =>
            log.error("unarchiveHabit 寫入失敗", err)
          );
        }
      }
    },
    [habits, setHabits, userUid, markRecentlyWrittenHabit]
  );

  const checkinHabit = useCallback(
    (id: string, date: string, count = 1, note?: string) => {
      const habit = habits.find((h) => h.id === id);
      if (!habit) return;
      const existing = habit.checkins.find((c) => c.date === date);
      let checkins: Habit["checkins"];
      if (existing) {
        checkins = habit.checkins.map((c) =>
          c.date === date ? { ...c, count: c.count + count, note: note ?? c.note } : c
        );
      } else {
        checkins = [...habit.checkins, { date, completed: true, count, note, pomodoros: 0 }];
      }
      const sortedCheckins = checkins.sort((a, b) => b.date.localeCompare(a.date));
      const streak = computeHabitStreak(habit, sortedCheckins);
      const longestStreak = Math.max(habit.longestStreak, streak);
      const updated = habits.map((h) =>
        h.id === id
          ? { ...h, checkins: sortedCheckins, streak, longestStreak, updatedAt: new Date().toISOString() }
          : h
      );
      setHabits(updated);
      saveHabits(updated);
      markRecentlyWrittenHabit(id);
      if (userUid) {
        const changed = updated.find((h) => h.id === id);
        if (changed) {
          batchSaveHabits(userUid, [changed]).catch((err) =>
            log.error("checkinHabit 寫入失敗", err)
          );
        }
      }
    },
    [habits, setHabits, userUid, markRecentlyWrittenHabit]
  );

  const uncheckHabit = useCallback(
    (id: string, date: string) => {
      const habit = habits.find((h) => h.id === id);
      if (!habit) return;
      // 保留 entry（不改為刪除），只把 completed 設 false，番茄數保留
      const updatedCheckins = habit.checkins.map((c) =>
        c.date === date ? { ...c, completed: false } : c
      );
      if (
        updatedCheckins.length === habit.checkins.length &&
        updatedCheckins.every((c, i) => c.completed === habit.checkins[i].completed)
      ) {
        return; // 沒有任何變化，直接跳過
      }
      const streak = computeHabitStreak(habit, updatedCheckins);
      const longestStreak = Math.max(habit.longestStreak, streak);
      const updated = habits.map((h) =>
        h.id === id
          ? { ...h, checkins: updatedCheckins, streak, longestStreak, updatedAt: new Date().toISOString() }
          : h
      );
      setHabits(updated);
      saveHabits(updated);
      markRecentlyWrittenHabit(id);
      if (userUid) {
        const changed = updated.find((h) => h.id === id);
        if (changed) {
          batchSaveHabits(userUid, [changed]).catch((err) =>
            log.error("uncheckHabit 寫入失敗", err)
          );
        }
      }
    },
    [habits, setHabits, userUid, markRecentlyWrittenHabit]
  );

  // ── Habit Pomodoro ──────────────────────────────────────────
  const incrementHabitPomodoro = useCallback(
    (id: string, date: string, minutes?: number) => {
      const habit = habits.find((h) => h.id === id);
      if (!habit) return;

      const updates: Partial<Habit> = {};
      if (minutes) {
        updates.pomodoroMinutes = minutes;
      }

      const sessionMins = minutes ?? habit.pomodoroMinutes ?? 25;
      const existing = habit.checkins.find((c) => c.date === date);
      let checkins: Habit["checkins"];
      if (existing) {
        const curMins = existing.minutes ?? ((existing.pomodoros ?? 0) * (habit.pomodoroMinutes ?? 25));
        checkins = habit.checkins.map((c) =>
          c.date === date
            ? {
                ...c,
                pomodoros: (c.pomodoros ?? 0) + 1,
                minutes: curMins + sessionMins,
              }
            : c
        );
      } else {
        // 若當日還沒有任何 checkin entry，先建立一個
        checkins = [...habit.checkins, { date, completed: false, count: 0, pomodoros: 1, minutes: sessionMins }];
      }

      // D4：若設定了 targetPomodoros 且尚未打卡，自動打卡
      const targetPom = habit.targetPomodoros ?? 0;
      const todayPomodoros = checkins.find((c) => c.date === date)?.pomodoros ?? 0;
      const todayCompleted = checkins.find((c) => c.date === date)?.completed ?? false;
      const shouldAutoCheckin =
        targetPom > 0 && !todayCompleted && todayPomodoros >= targetPom;

      if (shouldAutoCheckin) {
        checkins = checkins.map((c) =>
          c.date === date ? { ...c, completed: true } : c
        );
      }

      const streak = computeHabitStreak(habit, checkins);
      const longestStreak = Math.max(habit.longestStreak, streak);

      const updated = habits.map((h) =>
        h.id === id
          ? { ...h, checkins, streak, longestStreak, ...updates, updatedAt: new Date().toISOString() }
          : h
      );

      setHabits(updated);
      saveHabits(updated);
      markRecentlyWrittenHabit(id);
      if (userUid) {
        const changed = updated.find((h) => h.id === id);
        if (changed) {
          batchSaveHabits(userUid, [changed]).catch((err) =>
            log.error("incrementHabitPomodoro 寫入失敗", err)
          );
        }
      }
    },
    [habits, setHabits, userUid, markRecentlyWrittenHabit]
  );

  const decrementHabitPomodoro = useCallback(
    (id: string, date: string) => {
      const habit = habits.find((h) => h.id === id);
      if (!habit) return;

      const existing = habit.checkins.find((c) => c.date === date);
      if (!existing || ((existing.pomodoros ?? 0) <= 0 && (existing.minutes ?? 0) <= 0)) return; // 沒有可減的

      const unitMins = habit.pomodoroMinutes ?? 25;
      const updatedCheckins = habit.checkins.map((c) => {
        if (c.date !== date) return c;
        const curMins = c.minutes ?? ((c.pomodoros ?? 0) * unitMins);
        const nextMins = Math.max(0, curMins - unitMins);
        const nextPoms = Math.max(0, (c.pomodoros ?? 0) - 1);
        return { ...c, pomodoros: nextPoms, minutes: nextMins };
      });

      // D5：若減到 0 且原本有 autoCheckin，需重新計算 completed
      const wasAutoCheckedIn = existing.completed &&
        (habit.targetPomodoros ?? 0) > 0 &&
        (existing.pomodoros ?? 0) === (habit.targetPomodoros ?? 0);

      const finalCheckins = wasAutoCheckedIn
        ? updatedCheckins.map((c) =>
            c.date === date ? { ...c, completed: false } : c
          )
        : updatedCheckins;

      const streak = computeHabitStreak(habit, finalCheckins);
      const longestStreak = Math.max(habit.longestStreak, streak);

      const updated = habits.map((h) =>
        h.id === id
          ? { ...h, checkins: finalCheckins, streak, longestStreak, updatedAt: new Date().toISOString() }
          : h
      );

      setHabits(updated);
      saveHabits(updated);
      markRecentlyWrittenHabit(id);
      if (userUid) {
        const changed = updated.find((h) => h.id === id);
        if (changed) {
          batchSaveHabits(userUid, [changed]).catch((err) =>
            log.error("decrementHabitPomodoro 寫入失敗", err)
          );
        }
      }
    },
    [habits, setHabits, userUid, markRecentlyWrittenHabit]
  );

  // ── 手動補登專注時長（直接累加分鐘數）────────────────────────
  const logHabitTime = useCallback(
    (id: string, date: string, minutesToAdd: number) => {
      if (minutesToAdd <= 0) return;
      const habit = habits.find((h) => h.id === id);
      if (!habit) return;

      const unitMinutes = habit.pomodoroMinutes ?? 25;
      const existing = habit.checkins.find((c) => c.date === date);
      let checkins: Habit["checkins"];

      if (existing) {
        const currentMinutes = existing.minutes ?? ((existing.pomodoros ?? 0) * unitMinutes);
        const newMinutes = currentMinutes + minutesToAdd;
        const addedPoms = Math.max(1, Math.round(minutesToAdd / unitMinutes));
        checkins = habit.checkins.map((c) =>
          c.date === date
            ? {
                ...c,
                minutes: newMinutes,
                pomodoros: (c.pomodoros ?? 0) + addedPoms,
              }
            : c
        );
      } else {
        const addedPoms = Math.max(1, Math.round(minutesToAdd / unitMinutes));
        checkins = [
          ...habit.checkins,
          {
            date,
            completed: false,
            count: 0,
            minutes: minutesToAdd,
            pomodoros: addedPoms,
          },
        ];
      }

      // 自動打卡判斷（若達標）
      const targetPom = habit.targetPomodoros ?? 0;
      const todayPomodoros = checkins.find((c) => c.date === date)?.pomodoros ?? 0;
      const todayCompleted = checkins.find((c) => c.date === date)?.completed ?? false;
      const shouldAutoCheckin =
        targetPom > 0 && !todayCompleted && todayPomodoros >= targetPom;

      if (shouldAutoCheckin) {
        checkins = checkins.map((c) =>
          c.date === date ? { ...c, completed: true } : c
        );
      }

      const streak = computeHabitStreak(habit, checkins);
      const longestStreak = Math.max(habit.longestStreak, streak);

      const updated = habits.map((h) =>
        h.id === id
          ? { ...h, checkins, streak, longestStreak, updatedAt: new Date().toISOString() }
          : h
      );

      setHabits(updated);
      saveHabits(updated);
      markRecentlyWrittenHabit(id);
      if (userUid) {
        const changed = updated.find((h) => h.id === id);
        if (changed) {
          batchSaveHabits(userUid, [changed]).catch((err) =>
            log.error("logHabitTime 寫入失敗", err)
          );
        }
      }
    },
    [habits, setHabits, userUid, markRecentlyWrittenHabit]
  );

  // ── Habit Sync ──────────────────────────────────────────────
  useEffect(() => {
    if (!userUid) return;

    // Cleanup previous subscription
    habitsUnsubRef.current?.();

    subscribeHabits(userUid, (fbHabits) => {
      log.sync(
        `SUBSCRIBE HABITS callback uid=${userUid} fbHabits=${fbHabits.length} firstLoadDone=${firstHabitsLoadDone.current}`
      );
      if (!firstHabitsLoadDone.current) {
        firstHabitsLoadDone.current = true;
        return;
      }
      log.sync(`SUP SYNC habits 推送: ${fbHabits.length}`);
      setHabits((prev) => {
        const localById = new Map(prev.map((h) => [h.id, h]));
        const fbIds = new Set<string>();
        const merged = fbHabits.map((fbH) => {
          fbIds.add(fbH.id);
          syncedHabitIdsRef.current.add(fbH.id);
          const local = localById.get(fbH.id);
          if (local) {
            if (isWithinRecentWriteWindowHabit(fbH.id)) return local;
            if (new Date(local.updatedAt).getTime() > new Date(fbH.updatedAt).getTime())
              return local;
          }
          return fbH;
        });
        const localOnly = prev.filter((h) => !fbIds.has(h.id));
        const trueLocalOnly = localOnly.filter(
          (h) => !syncedHabitIdsRef.current.has(h.id)
        );
        const result = [...merged, ...trueLocalOnly];
        saveHabits(result);
        if (trueLocalOnly.length > 0 && userUid) {
          const orphans = trueLocalOnly.filter(
            (h) => !isWithinRecentWriteWindowHabit(h.id)
          );
          if (orphans.length > 0) {
            log.sync(`自動補推 ${orphans.length} 個孤兒 habit 上雲`);
            batchSaveHabits(userUid, orphans).catch((err) =>
              log.error("孤兒 habit 補推失敗", err)
            );
          }
        }
        return result;
      });
    })
      .then((unsub) => {
        habitsUnsubRef.current = unsub;
        log.sync(`已訂閱 habits uid: ${userUid}`);
      })
      .catch((err) => {
        log.warn("訂閱習慣失敗", err);
      });

    // Reset first load flag when user changes
    firstHabitsLoadDone.current = false;

    return () => {
      habitsUnsubRef.current?.();
    };
  }, [userUid, setHabits, isWithinRecentWriteWindowHabit]);

  const value: HabitsContextValue = {
    habits,
    addHabit,
    updateHabit,
    archiveHabit,
    unarchiveHabit,
    checkinHabit,
    uncheckHabit,
    incrementHabitPomodoro,
    decrementHabitPomodoro,
    logHabitTime,
  };

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}
