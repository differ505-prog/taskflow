"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import { useStatusWindow } from "@/hooks/useStatusWindow";
import { useProgressStatus } from "@/hooks/useProgressStatus";
import { useLevelUpNotification } from "@/components/LevelUpNotification";
import { BASE_HABIT_PP } from "@/lib/progressRank";
import { getLocalToday } from "@/lib/dateUtils";
import { Heart, X, ChevronLeft, ChevronRight, Flame } from "lucide-react";

interface WarmupFlowProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const DEFAULT_DAILY_CAP = 3;

/**
 * §26 B 評分表 9.3 暖身全螢幕抽卡模式
 *
 * 設計哲學(對齊 §1 多巴胺不焦慮):
 * - 一次只看到 1 個 habit(焦點收斂)
 * - 點擊 = 完成當前 + 抽下一張(物理卡牌翻面感)
 * - 全螢幕 gradient + 「引擎啟動 🚀」作結
 * - 每日上限 3 個(寫死 + 顯示),符合 3-tiny-wins 啟動學
 * - 「暖身完 → focus mode」由 onComplete callback 處理
 */
export function WarmupFlow({ open, onClose, onComplete }: WarmupFlowProps) {
  const { habits, checkinHabit } = useApp();
  const showWindow = useStatusWindow();
  const { addPp } = useProgressStatus();
  const levelUp = useLevelUpNotification();

  // 計算今日 pending(未 checkin)habits
  const today = getLocalToday();
  const pendingHabits = useMemo(() => {
    return habits.filter(
      (h) => !h.archivedAt && !h.checkins?.some((c) => c.date === today)
    );
  }, [habits, today]);

  // 抽卡進度
  const [index, setIndex] = useState(0);
  const [showFinish, setShowFinish] = useState(false);
  const cap = Math.min(pendingHabits.length, DEFAULT_DAILY_CAP);
  const visible = pendingHabits.slice(0, cap);
  const current = visible[index];

  // ESC 關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // open 變化時重置
  useEffect(() => {
    if (open) {
      setIndex(0);
      setShowFinish(false);
    }
  }, [open]);

  const handleCompleteCurrent = useCallback(() => {
    if (!current) return;
    checkinHabit(current.id, today);
    showWindow({
      title: "暖身完成",
      message: current.title,
      xpDelta: BASE_HABIT_PP,
      icon: "✨",
    });
    const { leveledUpTo } = addPp(BASE_HABIT_PP);
    if (leveledUpTo) window.setTimeout(() => levelUp.show(leveledUpTo), 2700);

    // 下一張 or 完畢
    if (index + 1 < visible.length) {
      setIndex((i) => i + 1);
    } else {
      setShowFinish(true);
    }
  }, [current, checkinHabit, today, showWindow, addPp, levelUp, index, visible.length]);

  const handleSkip = useCallback(() => {
    if (index + 1 < visible.length) {
      setIndex((i) => i + 1);
    } else {
      setShowFinish(true);
    }
  }, [index, visible.length]);

  const handleLaunch = useCallback(() => {
    onComplete();
  }, [onComplete]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="warmup-flow"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-rose-50 via-white to-amber-50"
        role="dialog"
        aria-modal="true"
        aria-label="暖身抽卡流程"
      >
        {/* 頂部:進度 + 關閉 */}
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-rose-400">
            <Flame className="h-3.5 w-3.5" aria-hidden />
            <span>
              {showFinish ? "已就緒" : `暖身 ${Math.min(index + 1, cap)} / ${cap}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉暖身"
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {/* 進度點 */}
        <div className="flex justify-center gap-1.5 px-6">
          {visible.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i < index || showFinish
                  ? "w-6 bg-rose-400"
                  : i === index
                  ? "w-8 bg-rose-500"
                  : "w-6 bg-slate-200"
              }`}
              aria-hidden
            />
          ))}
        </div>

        {/* 中央:卡牌 or 完畢特效 */}
        <main className="flex flex-1 items-center justify-center px-6 pb-24">
          <AnimatePresence mode="wait">
            {!showFinish ? (
              current ? (
                <motion.div
                  key={`card-${index}`}
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -90, opacity: 0 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="flex flex-col items-center gap-8 text-center"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* 卡牌 */}
                  <div className="flex h-48 w-48 items-center justify-center rounded-3xl bg-white shadow-lg ring-1 ring-rose-200/60 sm:h-56 sm:w-56">
                    <span className="text-6xl font-light text-rose-400 sm:text-7xl">
                      {current.title.slice(0, 1)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                      完成暖身
                    </p>
                    <h2 className="text-balance text-2xl font-medium text-slate-800 sm:text-3xl">
                      {current.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSkip}
                      className="flex items-center gap-1 rounded-full bg-white/60 px-4 py-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200/60 transition-all hover:bg-white hover:text-slate-700 active:scale-95"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                      跳過
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteCurrent}
                      className="flex items-center gap-2 rounded-full bg-rose-400 px-6 py-3 text-sm font-medium text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-rose-500 hover:shadow-lg active:scale-95"
                    >
                      <Heart className="h-4 w-4" aria-hidden />
                      完成
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="no-pending"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <p className="text-balance text-slate-500">沒有暖身任務</p>
                </motion.div>
              )
            ) : (
              // §26 B 評分表 9.3 全螢幕 gradient + 引擎啟動
              <motion.div
                key="finish"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
                className="flex flex-col items-center gap-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0.4, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: 0.2,
                    duration: 0.8,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  className="text-7xl sm:text-8xl"
                  aria-hidden
                >
                  🚀
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="text-balance text-3xl font-medium text-slate-800 sm:text-4xl"
                >
                  引擎啟動
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.6 }}
                  className="text-balance max-w-md text-sm text-slate-500"
                >
                  {visible.length} 個暖身任務完成。今天最重要的事在等你。
                </motion.p>
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                  onClick={handleLaunch}
                  className="mt-4 flex items-center gap-2 rounded-full bg-rose-400 px-8 py-3 text-sm font-medium uppercase tracking-widest text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-rose-500 hover:shadow-lg active:scale-95"
                >
                  進入今天
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* 底部:第 1 張的鼓勵文案 */}
        {!showFinish && current && (
          <footer className="px-6 pb-8 text-center sm:px-10">
            <p className="text-balance text-xs text-slate-400">
              一次一個小動作,慢慢來就好。
            </p>
          </footer>
        )}
      </motion.div>
    </AnimatePresence>
  );
}