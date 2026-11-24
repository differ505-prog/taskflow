"use client";

import { useEffect, useState } from "react";
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
      window.setTimeout(() => {
        showWindow({
          title: "今天先這樣",
          message: "剩下的任務已送回大廳。明天又會是新的開始。",
          xpDelta: REST_PP,
          icon: "🌙",
        });
      }, 200);

      // ── 下班閥門接棒：30 秒睡前復盤 ────────────────────────────
      // 條件：存在未封存、今日尚未填寫 note、且屬於「復盤」類型的習慣
      const today = getLocalToday();
      const candidate = habits.find((h) => {
        if (!isReflectionHabit(h)) return false;
        const entry = h.checkins.find((c) => c.date === today);
        return !entry?.note?.trim();
      });
      if (candidate) {
        // 延遲顯示 — 先讓「今天先這樣」的收尾情緒落地，再遞上復盤
        window.setTimeout(() => setReflectionHabit(candidate), 900);
      }
    },
  });

  if (tasks.length === 0) return null;

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
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={handleClick}
          disabled={wrapping}
          className="group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ color: "var(--text-tertiary)" }}
          aria-label="今天先這樣 — 把剩餘的今日任務送回任務大廳"
        >
          <span aria-hidden className="transition-transform duration-300 group-hover:rotate-12">
            🌙
          </span>
          <span>{offDuty ? "今天先這樣・下班閥門" : "今天先這樣"}</span>
        </button>
      </div>

      <WrapUpReflectionSheet
        open={!!reflectionHabit}
        habitTitle={reflectionHabit?.title ?? ""}
        onDismiss={() => setReflectionHabit(null)}
        onSubmit={handleReflectionSubmit}
      />
    </>
  );
}
