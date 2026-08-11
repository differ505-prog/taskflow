"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import { useStatusWindow } from "@/hooks/useStatusWindow";
import { useProgressStatus } from "@/hooks/useProgressStatus";
import { useLevelUpNotification } from "@/components/LevelUpNotification";
import { BASE_HABIT_PP } from "@/lib/progressRank";
import { getLocalToday } from "@/lib/dateUtils";
import { Heart, X, ChevronLeft, ChevronRight, Flame, Check } from "lucide-react";

interface WarmupFlowProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const DEFAULT_DAILY_CAP = 3;

/**
 * §26 B 評分表 9.1 暖身全螢幕抽卡模式
 *
 * 設計哲學(對齊 §1 多巴胺不焦慮):
 * - 一次只看到 1 個 habit(焦點收斂)
 * - 點擊卡牌任意位置 = 完成當前 + 抽下一張(物理卡牌翻面感)
 * - 左右箭頭自由來回跳轉，跳過後仍可回頭完成
 * - 底部縮圖欄：視覺化所有卡狀態，可隨意切換
 * - 每日上限 3 個(寫死 + 顯示)，符合 3-tiny-wins 啟動學
 * - 「暖身完 → focus mode」由 onComplete callback 處理
 */
export function WarmupFlow({ open, onClose, onComplete }: WarmupFlowProps) {
  const { habits, checkinHabit } = useApp();
  const showWindow = useStatusWindow();
  const { addPp } = useProgressStatus();
  const levelUp = useLevelUpNotification();

  const today = getLocalToday();
  const allPending = useMemo(() => {
    return habits.filter(
      (h) => !h.archivedAt && !h.checkins?.some((c) => c.date === today)
    );
  }, [habits, today]);

  // 最多顯示 DEFAULT_DAILY_CAP 個habit，保持穩定順序（由 list order 決定）
  const cap = Math.min(allPending.length, DEFAULT_DAILY_CAP);
  const visibleHabits = useMemo(
    () => allPending.slice(0, cap),
    [allPending, cap]
  );

  // 已完成 / 已跳過的 id 集合
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  // 當前顯示的 index（在 visibleHabits 內）
  const [index, setIndex] = useState(0);
  const [showFinish, setShowFinish] = useState(false);
  const current = visibleHabits[index];

  // 已完成數量
  const doneCount = completedIds.size;
  const totalCount = visibleHabits.length;

  // 所有可見 habit 都是「可用」的（pending/skipped 都算，completed 也算）
  // 進度描述：已完成 / 總數
  const doneLabel = `${doneCount}/${totalCount}`;

  // ESC 關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // open 變化時重置所有狀態
  useEffect(() => {
    if (open) {
      setIndex(0);
      setShowFinish(false);
      setCompletedIds(new Set());
      setSkippedIds(new Set());
    }
  }, [open]);

  // 檢查是否全部處理完（每張卡都 completed 或 skipped）
  const allProcessed = useMemo(() => {
    if (visibleHabits.length === 0) return true;
    return visibleHabits.every(
      (h) => completedIds.has(h.id) || skippedIds.has(h.id)
    );
  }, [visibleHabits, completedIds, skippedIds]);

  // 當全部處理完且不在 finish 畫面時，顯示完成畫面
  useEffect(() => {
    if (allProcessed && !showFinish && visibleHabits.length > 0) {
      setShowFinish(true);
    }
  }, [allProcessed, showFinish, visibleHabits.length]);

  const handleCompleteCurrent = useCallback(() => {
    if (!current) return;
    if (completedIds.has(current.id)) return; // 已完成不可重複
    checkinHabit(current.id, today);
    setCompletedIds((prev) => new Set([...prev, current.id]));
    showWindow({
      title: "暖身完成",
      message: current.title,
      xpDelta: BASE_HABIT_PP,
      icon: "✨",
    });
    const { leveledUpTo } = addPp(BASE_HABIT_PP);
    if (leveledUpTo) window.setTimeout(() => levelUp.show(leveledUpTo), 2700);
  }, [current, completedIds, checkinHabit, today, showWindow, addPp, levelUp]);

  const handleSkip = useCallback(() => {
    if (!current) return;
    if (skippedIds.has(current.id)) return; // 已跳過不可重複
    if (completedIds.has(current.id)) return; // 已完成也不需要跳過
    setSkippedIds((prev) => new Set([...prev, current.id]));
  }, [current, skippedIds, completedIds]);

  // 任意跳轉
  const handleGoTo = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= visibleHabits.length) return;
      setIndex(targetIndex);
    },
    [visibleHabits.length]
  );

  const handlePrev = useCallback(() => {
    handleGoTo(index - 1);
  }, [index, handleGoTo]);

  const handleNext = useCallback(() => {
    handleGoTo(index + 1);
  }, [index, handleGoTo]);

  const handleLaunch = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // 單張卡狀態
  type CardState = "pending" | "completed" | "skipped";
  const getCardState = useCallback(
    (habitId: string): CardState => {
      if (completedIds.has(habitId)) return "completed";
      if (skippedIds.has(habitId)) return "skipped";
      return "pending";
    },
    [completedIds, skippedIds]
  );

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
        {/* 頂部:進度 + 跳過按鈕 + 關閉 */}
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-rose-400" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-widest text-rose-400">
              {showFinish ? "已就緒" : `暖身 ${doneLabel}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 跳過按鈕 — 當前卡未完成且未跳過時顯示 */}
            {!showFinish && current && !completedIds.has(current.id) && !skippedIds.has(current.id) && (
              <button
                type="button"
                onClick={handleSkip}
                aria-label="跳過這個習慣，稍後再完成"
                className="rounded-full px-3 py-1.5 text-[11px] font-medium text-slate-400 ring-1 ring-slate-200/60 transition-all hover:bg-white/60 hover:text-slate-600 active:scale-95"
              >
                跳過
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉暖身"
              className="rounded-full p-2 transition-colors duration-200 hover:bg-white/60 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              style={{ color: "var(--text-tertiary)" }}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </header>

        {/* 進度點 */}
        {totalCount > 0 && (
          <div className="flex justify-center gap-1.5 px-6 pb-2">
            {visibleHabits.map((h, i) => {
              const state = getCardState(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => handleGoTo(i)}
                  aria-label={`跳到 ${h.title}`}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    state === "completed"
                      ? "w-5 bg-rose-400"
                      : state === "skipped"
                      ? "w-5 bg-slate-300"
                      : i === index
                      ? "w-8 bg-rose-500"
                      : "w-5 bg-slate-200"
                  }`}
                />
              );
            })}
          </div>
        )}

        {/* 中央:卡牌 or 完畢特效 */}
        <main className="flex flex-1 items-center justify-center px-6 pb-4">
          <AnimatePresence mode="wait">
            {!showFinish ? (
              current ? (
                <motion.div
                  key={`card-${current.id}-${index}`}
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -90, opacity: 0 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="flex w-full max-w-sm flex-col items-center gap-7"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* 卡牌 — 整張可點擊 */}
                  <button
                    type="button"
                    onClick={handleCompleteCurrent}
                    disabled={completedIds.has(current.id) || skippedIds.has(current.id)}
                    aria-label={`完成：${current.title}`}
                    className={`relative flex h-48 w-full max-w-xs items-center justify-center rounded-3xl bg-white shadow-lg ring-1 transition-all duration-200 sm:h-56 ${
                      completedIds.has(current.id)
                        ? "ring-2 ring-rose-300 bg-rose-50/50 cursor-default"
                        : skippedIds.has(current.id)
                        ? "ring-1 ring-slate-200/40 opacity-50 cursor-default"
                        : "ring-rose-200/60 hover:-translate-y-1 hover:shadow-xl active:scale-95"
                    }`}
                  >
                    {/* 完成打勾疊加層 */}
                    {completedIds.has(current.id) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="absolute inset-0 flex items-center justify-center rounded-3xl bg-rose-400/10"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-400 shadow-sm">
                          <Check className="h-6 w-6 text-white" aria-hidden />
                        </div>
                      </motion.div>
                    )}
                    {/* 跳過斜線疊加層 */}
                    {skippedIds.has(current.id) && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 flex items-center justify-center rounded-3xl bg-slate-100/60"
                      >
                        <div className="text-5xl font-light text-slate-300 sm:text-6xl">
                          {current.title.slice(0, 1)}
                        </div>
                        <div
                          className="absolute inset-0 rounded-3xl"
                          aria-hidden
                          style={{
                            background: "repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(148,163,184,0.08) 10px, rgba(148,163,184,0.08) 12px)",
                          }}
                        />
                      </motion.div>
                    )}
                    {/* 正常卡片內容 */}
                    {!completedIds.has(current.id) && !skippedIds.has(current.id) && (
                      <span className="text-6xl font-light text-rose-400 sm:text-7xl">
                        {current.title.slice(0, 1)}
                      </span>
                    )}
                    {/* 底部狀態標籤 */}
                    {completedIds.has(current.id) && (
                      <div className="absolute bottom-3 rounded-full bg-rose-400 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-white">
                        已完成
                      </div>
                    )}
                    {skippedIds.has(current.id) && (
                      <div className="absolute bottom-3 rounded-full bg-slate-300 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-white">
                        稍後再完成
                      </div>
                    )}
                  </button>

                  {/* habit 名稱 */}
                  <div className="space-y-1.5 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                      {completedIds.has(current.id)
                        ? "已完成 ✨"
                        : skippedIds.has(current.id)
                        ? "稍後再完成"
                        : "完成暖身"}
                    </p>
                    <h2 className="text-balance text-2xl font-medium text-slate-800 sm:text-3xl">
                      {current.title}
                    </h2>
                  </div>

                  {/* 導航 + 完成按鈕 */}
                  {!completedIds.has(current.id) && !skippedIds.has(current.id) && (
                    <div className="flex w-full max-w-xs items-center gap-3">
                      <button
                        type="button"
                        onClick={handlePrev}
                        disabled={index === 0}
                        aria-label="上一張"
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/60 text-slate-400 shadow-sm ring-1 ring-slate-200/60 transition-all hover:bg-white hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                      </button>

                      <button
                        type="button"
                        onClick={handleCompleteCurrent}
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-rose-400 py-3 text-sm font-medium text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-rose-500 hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
                      >
                        <Heart className="h-4 w-4" aria-hidden />
                        完成
                      </button>

                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={index === totalCount - 1}
                        aria-label="下一張"
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/60 text-slate-400 shadow-sm ring-1 ring-slate-200/60 transition-all hover:bg-white hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  )}

                  {/* 已完成或已跳過：顯示「回到這張」按鈕 */}
                  {(completedIds.has(current.id) || skippedIds.has(current.id)) && (
                    <p className="text-xs text-slate-400">
                      {completedIds.has(current.id)
                        ? "已記錄完成 ✓ 從底部切換其他習慣"
                        : "已跳過，從底部可以再回來"}
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="no-pending"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <p className="text-balance text-slate-500">今天沒有待暖身的習慣</p>
                  <p className="mt-1 text-balance text-xs text-slate-400">
                    直接進入今天，從最重要的事開始。
                  </p>
                </motion.div>
              )
            ) : (
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
                  {doneCount === 0
                    ? "跳過了所有習慣，沒關係，直接進入今天。"
                    : doneCount === 1
                    ? "一顆螺絲已上，主引擎就緒。"
                    : `${doneCount} 個小螺絲都上緊了，主引擎就緒。`}
                </motion.p>
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                  onClick={handleLaunch}
                  className="mt-4 flex items-center gap-2 rounded-full bg-rose-400 px-8 py-3 text-sm font-medium uppercase tracking-widest text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-rose-500 hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
                >
                  進入今天
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* 底部縮圖欄 */}
        {totalCount > 0 && (
          <div className="flex justify-center gap-2 px-5 pb-8 sm:px-10">
            {visibleHabits.map((h, i) => {
              const state = getCardState(h.id);
              const isCurrent = i === index;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => handleGoTo(i)}
                  aria-label={
                    state === "completed"
                      ? `${h.title}，已完成`
                      : state === "skipped"
                      ? `${h.title}，稍後再完成`
                      : h.title
                  }
                  className={`relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-2xl font-light shadow-sm transition-all duration-200 ${
                    isCurrent
                      ? "ring-2 ring-rose-400 scale-105"
                      : "ring-1 ring-slate-200/60 hover:scale-105"
                  } ${
                    state === "completed"
                      ? "bg-rose-100"
                      : state === "skipped"
                      ? "bg-slate-100 opacity-60"
                      : "bg-white"
                  }`}
                >
                  {h.title.slice(0, 1)}
                  {/* 完成打勾小徽章 */}
                  {state === "completed" && (
                    <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-400">
                      <Check className="h-2.5 w-2.5 text-white" aria-hidden />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
