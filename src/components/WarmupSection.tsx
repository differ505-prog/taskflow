"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import { useStatusWindow } from "@/hooks/useStatusWindow";
import { useProgressStatus } from "@/hooks/useProgressStatus";
import { useLevelUpNotification } from "@/components/LevelUpNotification";
import { getLocalToday } from "@/lib/dateUtils";
import { Heart, Check, Plus, Flame } from "lucide-react";

/**
 * WarmupSection — 禪模式暖身區塊（角落固定）
 *
 * 設計哲學（對應提示詞 §1 + §10.3 9.2 方案）：
 * - **視覺降噪**:極小圓形 icon + 預設未完成狀態用 slate-300 灰色
 * - **完成轉色**:點擊後變為 habit.color 但淡化 alpha（避免色彩喧賓奪主）
 * - **無 streak / 進度條**:完全符合「輕鬆完成」精神
 * - **不顯示習慣名稱**:icon 點擊即可,降低認知負擔
 * - **碰撞邏輯**:只顯示「今日尚未 checkin」且「未封存」的 Habit
 * - **Cold Start**:0 個 Habit → 角落原地顯示「+」按鈕，點擊後原地展開極簡輸入框，建立並完成後自動消失，完全不打斷心流
 *
 * 雙平台呈現（對齊 C2 9.2 方案）：
 * - 桌機 (sm+):完整卡片「Warmup」標題 + 圓形 icon 群(原貌不變)
 * - 手機 (<sm):單顆 40x40 compact icon,避開底部中央 FAB
 *   - 點擊直接完成(§ADHD 最小摩擦,不開中間 sheet)
 *   - z-20 < FAB z-30,被蓋住時不擋 FAB
 *
 * 為什麼放角落（fixed bottom-left）：
 * - 不干擾中央焦點卡片（§3 視覺層級）
 * - 「暖身」的本質是「主任務前的輔助」,位置隱蔽符合語意
 * - 與右下角 mobile FAB 不衝突:手機改為單顆 icon,錯開版面
 *
 * §23 同步層:直接呼叫既有 checkinHabit(id, today) 即可
 *         不要重建 habit 寫入邏輯,既有機制已處理 sync + streak
 * §26 reuse:沿用 useStatusWindow + useHunterStatus + useApp.checkinHabit
 */

const HABIT_DAILY_CAP = 3;
const BASE_HABIT_PP = 5;

interface WarmupSectionProps {
  onEnterFlow?: () => void;
}

export function WarmupSection({ onEnterFlow }: WarmupSectionProps = {}) {
  const { habits, checkinHabit, addHabit } = useApp();
  const showWindow = useStatusWindow();
  const { addPp } = useProgressStatus();
  const levelUp = useLevelUpNotification();

  const [isCreating, setIsCreating] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const titleRef = useRef(newHabitTitle);
  const habitsLenRef = useRef(habits.length);
  titleRef.current = newHabitTitle;
  habitsLenRef.current = habits.length;

  // 過濾：今日尚未 checkin + 未封存
  const today = getLocalToday();
  const pendingHabits = useMemo(() => {
    return habits.filter((h) => {
      if (h.archivedAt) return false;
      const todayCheckin = h.checkins.find((c) => c.date === today);
      return !todayCheckin?.completed;
    });
  }, [habits, today]);

  const handleComplete = (habitId: string, habitTitle: string) => {
    checkinHabit(habitId, today);
    // 多巴胺回饋:toast + 微量 PP
    showWindow({
      title: "暖身完成",
      message: habitTitle,
      xpDelta: BASE_HABIT_PP,
      icon: "✨",
    });
    const { leveledUpTo } = addPp(BASE_HABIT_PP);
    // 暖身也可升級,因 PP 較低,跨門檻機率小
    // 為避免 toast 競爭,序列播放
    if (leveledUpTo) {
      window.setTimeout(() => levelUp.show(leveledUpTo), 2700);
    }
  };

  // Cold Start:零個 Habit → 角落原地建立，完成後立即消失（不打斷心流）
  // §Bugfix:桌機版原設計 Branch 1 只渲染 sm:hidden,使用者反映「桌面版暖身按鈕不見了」
  //         改為 sm:flex 雙平台都顯示,避免桌面使用者看不到入口
  if (habits.length === 0) {
    const handleCreateAndComplete = () => {
      const title = titleRef.current.trim();
      if (!title) return;
      addHabit({ title, color: "rose", frequency: "daily", targetCount: 1 });
      // 新建立的 habit 會在下一個 render 出現，延遲執行完成
      setTimeout(() => {
        const created = habits.find((_, i) => i === habitsLenRef.current);
        if (created) {
          checkinHabit(created.id, today);
          showWindow({ title: "暖身完成", message: title, xpDelta: BASE_HABIT_PP, icon: "✨" });
          const { leveledUpTo } = addPp(BASE_HABIT_PP);
          if (leveledUpTo) window.setTimeout(() => levelUp.show(leveledUpTo), 2700);
        }
      }, 100);
      setIsCreating(false);
      setNewHabitTitle("");
    };

    return (
      <AnimatePresence>
        {!isCreating ? (
          // 雙平台:桌機顯示 inline 文字提示 + icon；手機只顯示 icon
          <motion.button
            key="warmup-cta"
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
            onClick={() => setIsCreating(true)}
            aria-label="建立第一個暖身習慣"
            className="fixed bottom-6 left-6 z-20 flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-rose-400 shadow-sm ring-1 ring-slate-200/60 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
            whileTap={{ scale: 0.92 }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden text-xs font-medium uppercase tracking-widest sm:inline">
              建立暖身
            </span>
          </motion.button>
        ) : (
          <motion.div
            key="warmup-create"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-6 left-6 z-20 rounded-2xl bg-white/90 p-3 shadow-lg ring-1 ring-slate-200/60 backdrop-blur"
            style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-slate-400">
              Warmup
            </p>
            <input
              autoFocus
              type="text"
              value={newHabitTitle}
              onChange={(e) => setNewHabitTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateAndComplete();
                if (e.key === "Escape") { setIsCreating(false); setNewHabitTitle(""); }
              }}
              placeholder="例如：喝一口水"
              maxLength={20}
              className="mb-2 w-full rounded-lg border border-slate-200 bg-white/60 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-1 focus:ring-rose-300"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreateAndComplete}
                disabled={!newHabitTitle.trim()}
                className="flex-1 rounded-lg bg-rose-400 px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-40"
              >
                完成暖身
              </button>
              <button
                type="button"
                onClick={() => { setIsCreating(false); setNewHabitTitle(""); }}
                className="flex-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200"
              >
                取消
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // 有 Habit 但今日全部完成 → 顯示「今日暖身完成」安靜訊息
  if (pendingHabits.length === 0) {
    return (
      <>
        {/* 桌機:原貌 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
          className="hidden sm:flex fixed bottom-6 left-6 z-20 items-center gap-2 rounded-full bg-white/70 px-3 py-2 backdrop-blur"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <span className="text-lg" aria-hidden>
            ✓
          </span>
          <span className="text-xs font-medium text-slate-400">今日暖身已就位</span>
        </motion.div>

        {/* 手機:compact ✓ icon(靜默,不可點) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
          className="sm:hidden fixed bottom-6 left-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 shadow-sm ring-1 ring-emerald-200/60 backdrop-blur"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
          aria-label="今日暖身已就位"
          role="status"
        >
          <Check className="h-4 w-4" aria-hidden />
        </motion.div>
      </>
    );
  }

  return (
    <>
      {/* 桌機:原貌 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
        className="hidden sm:flex fixed bottom-6 left-6 z-20 flex-col items-start gap-2"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
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

      {/* §26 B 評分表 9.1:「開始暖身」入口 — 點擊進入全螢幕抽卡流程
          只在 ≥2 個 pending 時出現,避免與「快速完成」競爭點擊目標 */}
      {pendingHabits.length >= 2 && onEnterFlow && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.5 }}
          onClick={onEnterFlow}
          aria-label="開始暖身儀式"
          className="fixed bottom-6 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-full bg-rose-400 px-4 py-2 text-xs font-medium uppercase leading-none tracking-widest text-white shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-rose-500 hover:shadow-lg active:scale-95 sm:flex"
          whileTap={{ scale: 0.92 }}
        >
          <Flame className="h-3.5 w-3.5" aria-hidden />
          <span className="leading-none">開始暖身</span>
        </motion.button>
      )}

      {/* 手機:單顆 compact icon(只取第一個 pending habit 作為捷徑),點擊直接完成
          §ADHD 最小摩擦:不開中間 sheet,輕點即完成(符合 §1 焦點不中斷) */}
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
        onClick={() => {
          const first = pendingHabits[0];
          if (first) handleComplete(first.id, first.title);
        }}
        aria-label={`完成暖身：${pendingHabits[0]?.title ?? ""}`}
        className="sm:hidden fixed bottom-6 left-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-400 shadow-sm ring-1 ring-slate-200/60 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        whileTap={{ scale: 0.92 }}
      >
        <span className="text-base font-medium" aria-hidden>
          {pendingHabits[0]?.title.slice(0, 1) ?? "·"}
        </span>
      </motion.button>
    </>
  );
}