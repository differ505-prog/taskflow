"use client";

import { useEffect, useRef, useState } from "react";
import { useProgressStatus } from "@/hooks/useProgressStatus";
import { useStatusWindow } from "@/hooks/useStatusWindow";
import { useProactiveClosure } from "@/hooks/useProactiveClosure";
import { useRhythmSettings } from "@/hooks/useRhythmSettings";
import { isOffDutyNow } from "@/lib/rhythm";
import { useApp } from "@/lib/AppContext";
import { getLocalToday } from "@/lib/dateUtils";
import { toast } from "sonner";
import { WrapUpReflectionSheet } from "@/components/WrapUpReflectionSheet";
import {
  buildReflectionNote,
  isReflectionHabit,
  type ReflectionFields,
} from "@/lib/compoundHabitPlan";
import type { Habit, Task } from "@/lib/types";

/**
 * 「今天先這樣」 — Zen 模式卡片底部按鈕
 * +5 PP 休息獎勵 — 「懂得休息也是進步」
 * 下班閥門接棒 — 30 秒睡前復盤（可選、不打斷休息）
 */

const REST_PP = 5;

/** 延遲顯示復盤的毫秒數 — 先讓「今天先這樣」的收尾情緒落地 */
const REFLECTION_DELAY_MS = 900;

type Props = {
  tasks: Task[];
};

export function TodayWrapUpButton({ tasks }: Props) {
  const { addPp } = useProgressStatus();
  const showWindow = useStatusWindow();
  const { settings, isHydrated } = useRhythmSettings();
  const [now, setNow] = useState<Date>(() => new Date());
  const { habits, checkinHabit } = useApp();
  const [reflectionHabit, setReflectionHabit] = useState<Habit | null>(null);
  /**
   * 待顯示復盤的旗標
   *
   * 為什麼需要它：`wrapUp(tasks)` 執行後 tasks 立刻被清空 → 舊版
   * `if (tasks.length === 0) return null;` 會直接卸載整個元件，
   * 導致 900ms 後的 `WrapUpReflectionSheet` 永遠無法彈出（上市紅線死路）。
   * 因此在「等待延遲彈窗」與「彈窗開啟」期間都必須保持元件掛載。
   */
  const [pendingReflection, setPendingReflection] = useState(false);

  // 追蹤所有 pending timer，unmount 時清理，避免 setState 洩漏到已卸載元件
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
    };
  }, []);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const offDuty = isHydrated && isOffDutyNow(now, settings);

  const { wrapUp, wrapping } = useProactiveClosure({
    onWrapComplete: () => {
      // +5 PP 休息獎勵
      addPp(REST_PP);

      // 安撫 toast — 200ms 後,讓卡片動畫先演出一瞬再說話
      const toastTimer = setTimeout(() => {
        showWindow({
          title: "今天先這樣",
          message: "剩下的任務已送回大廳。明天又會是新的開始。",
          xpDelta: REST_PP,
          icon: "🌙",
        });
      }, 200);
      timersRef.current.push(toastTimer);

      // ── 下班閥門接棒：30 秒睡前復盤 ────────────────────────────
      // 條件：存在未封存、今日尚未填寫 note、且屬於「復盤」類型的習慣
      const today = getLocalToday();
      const candidate = habits.find((h) => {
        if (!isReflectionHabit(h)) return false;
        const entry = h.checkins.find((c) => c.date === today);
        return !entry?.note?.trim();
      });
      if (candidate) {
        // 先設 pending 旗標 → 元件不會因為 tasks 清空而自我卸載
        setPendingReflection(true);
        const reflectionTimer = setTimeout(() => {
          setReflectionHabit(candidate);
          setPendingReflection(false);
        }, REFLECTION_DELAY_MS);
        timersRef.current.push(reflectionTimer);
      }
    },
  });

  // 關鍵：只有在「沒有任務」且「沒有待彈出的復盤」時才卸載
  if (tasks.length === 0 && !reflectionHabit && !pendingReflection) return null;

  const handleClick = () => {
    void wrapUp(tasks);
  };

  const handleReflectionSubmit = (fields: ReflectionFields) => {
    const habit = reflectionHabit;
    if (!habit) return;
    const today = getLocalToday();
    const note = buildReflectionNote(fields);
    const isAlreadyDone = habit.checkins.some(
      (c) => c.date === today && c.completed
    );
    checkinHabit(habit.id, today, isAlreadyDone ? 0 : 1, note);
    setReflectionHabit(null);
    toast.success("今日復盤已收好 ✓");
  };

  return (
    <>
      {/* 按鈕本身在任務清空後隱藏（避免出現無效按鈕），但復盤 Sheet 持續掛載 */}
      {tasks.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleClick}
            disabled={wrapping}
            className="group inline-flex items-center gap-2 min-h-[44px] rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: "var(--text-tertiary)" }}
            aria-label="今天先這樣 — 把剩餘的今日任務送回任務大廳"
          >
            <span aria-hidden className="transition-transform duration-300 group-hover:rotate-12">
              🌙
            </span>
            <span>{offDuty ? "今天先這樣・下班閥門" : "今天先這樣"}</span>
          </button>
        </div>
      )}

      <WrapUpReflectionSheet
        open={!!reflectionHabit}
        habitTitle={reflectionHabit?.title ?? ""}
        onDismiss={() => setReflectionHabit(null)}
        onSubmit={handleReflectionSubmit}
      />
    </>
  );
}
