"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import { useStatusWindow } from "@/hooks/useStatusWindow";
import { useHunterStatus } from "@/hooks/useHunterStatus";
import { useRankUpNotification } from "@/components/RankUpNotification";
import { BASE_HABIT_EXP } from "@/lib/hunterRank";
import { Heart, ArrowRight } from "lucide-react";

/**
 * WarmupSection — 禪模式暖身區塊（角落固定）
 *
 * 設計哲學（對應提示詞 §1 + §10.3 9.2 方案）：
 * - **視覺降噪**:極小圓形 icon + 預設未完成狀態用 slate-300 灰色
 * - **完成轉色**:點擊後變為 habit.color 但淡化 alpha（避免色彩喧賓奪主）
 * - **無 streak / 進度條**:完全符合「輕鬆完成」精神
 * - **不顯示習慣名稱**:icon 點擊即可,降低認知負擔
 * - **碰撞邏輯**:只顯示「今日尚未 checkin」且「未封存」的 Habit
 * - **Cold Start**:0 個 Habit → 顯示 CTA 跳轉 Habit 頁
 *
 * 為什麼放角落（fixed bottom-left）：
 * - 不干擾中央焦點卡片（§3 視覺層級）
 * - 「暖身」的本質是「主任務前的輔助」,位置隱蔽符合語意
 * - 與右下角 mobile FAB 不衝突(手機由 FAB 主演,WarmupSection 手機隱藏)
 *
 * §23 同步層:直接呼叫既有 checkinHabit(id, today) 即可
 *         不要重建 habit 寫入邏輯,既有機制已處理 sync + streak
 * §26 reuse:沿用 useStatusWindow + useHunterStatus + useApp.checkinHabit
 */

function getToday(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD（本地時區）
}

export function WarmupSection() {
  const { habits, checkinHabit, setCurrentView } = useApp();
  const showWindow = useStatusWindow();
  const { addExp } = useHunterStatus();
  const rankUp = useRankUpNotification();

  // 過濾：今日尚未 checkin + 未封存
  const today = getToday();
  const pendingHabits = useMemo(() => {
    return habits.filter((h) => {
      if (h.archivedAt) return false;
      const todayCheckin = h.checkins.find((c) => c.date === today);
      return !todayCheckin?.completed;
    });
  }, [habits, today]);

  const handleComplete = (habitId: string, habitTitle: string) => {
    checkinHabit(habitId, today);
    // 多巴胺回饋:toast + 微量 EXP
    showWindow({
      title: "暖身完成",
      message: habitTitle,
      xpDelta: BASE_HABIT_EXP,
      icon: "✨",
    });
    const { leveledUpTo } = addExp(BASE_HABIT_EXP);
    // 暖身也可升級,但因 EXP 較低,跨門檻機率小
    // 為避免 toast 競爭,序列播放
    if (leveledUpTo) {
      window.setTimeout(() => rankUp.show(leveledUpTo), 2700);
    }
  };

  // Cold Start:零個 Habit → CTA 跳轉 Habit 頁
  if (habits.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
        className="hidden sm:flex fixed bottom-6 left-6 z-20 flex-col items-start gap-2"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <p className="text-balance text-[11px] font-medium uppercase tracking-widest text-slate-400">
          Warmup
        </p>
        <button
          type="button"
          onClick={() => setCurrentView("habits")}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-xs font-medium text-slate-500 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-slate-700 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          aria-label="前往習慣頁建立第一個暖身習慣"
        >
          <Heart className="h-3.5 w-3.5" aria-hidden />
          <span>建立第一個暖身</span>
          <ArrowRight className="h-3 w-3" aria-hidden />
        </button>
      </motion.div>
    );
  }

  // 有 Habit 但今日全部完成 → 顯示「今日暖身完成」安靜訊息
  if (pendingHabits.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
        className="hidden sm:flex fixed bottom-6 left-6 z-20 items-center gap-2 rounded-full bg-white/70 px-3 py-2 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <span className="text-lg" aria-hidden>
          ✓
        </span>
        <span className="text-xs font-medium text-slate-400">今日暖身已就位</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
      className="hidden sm:flex fixed bottom-6 left-6 z-20 flex-col items-start gap-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="group"
      aria-label="暖身習慣：點擊完成今日打卡"
    >
      <p className="text-balance text-[11px] font-medium uppercase tracking-widest text-slate-400">
        Warmup
      </p>
      <div className="flex items-center gap-2">
        {pendingHabits.map((habit, idx) => (
          <motion.button
            key={habit.id}
            type="button"
            onClick={() => handleComplete(habit.id, habit.title)}
            aria-label={`完成暖身：${habit.title}`}
            className="group flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-400 shadow-sm ring-1 ring-slate-200/60 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            whileTap={{ scale: 0.92 }}
            animate={{ opacity: 1 }}
            initial={{ opacity: 0, y: 6 }}
            transition={{ delay: 0.4 + idx * 0.05, duration: 0.3 }}
          >
            {/* 圓形 icon — 預設用第一個字符當 icon fallback */}
            <span
              className="text-base font-medium transition-colors duration-200 group-hover:opacity-100"
              aria-hidden
            >
              {habit.title.slice(0, 1)}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}