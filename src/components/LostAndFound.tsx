"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Leaf, ArchiveRestore } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import type { Task } from "@/lib/types";

/**
 * LostAndFound — 失物招領
 *
 * 品牌承諾:真實與脆弱（Authenticity & Vulnerability）
 * - 不稱「過期」、「未完成」、「昨天沒做」等責備語氣
 * - 標題用「失物招領」:把任務視為「被遺忘的念頭」,而非「債務」
 * - 不抖動、不警示色、不催促
 *
 * 溫柔的決策流:
 * - ✨ 復活:dueDate 推到今天,讓任務重新進入今日清單
 * - 🍃 無罪赦免:isArchived = true,移到封存頁。情緒包裝永遠與工程實作分離。
 *
 * Anti-pattern 防護（破壞產品核心=死罪）:
 * - 零紅色警告:絕對禁止 bg-red-* / text-red-* / border-red-* 等任何 red 色系 className
 * - 零自動刪除:禁止任何 Cron / setInterval / useEffect 自動刪除或標記
 * - 零焦慮視覺:禁止驚嘆號、抖動動畫等製造恐慌的設計
 * - 零責備語氣:標題與按鈕都正念
 */

export default function LostAndFound() {
  const { tasks, updateTask } = useApp();

  /**
   * 篩選條件:
   * - dueDate < today (有截止日且已過)
   * - status !== "done" (還沒完成)
   * - !isArchived (沒被封存)
   * - !parentId (不是子任務)
   */
  const lostTasks = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD（本地時區）
    return tasks.filter(
      (t) =>
        !t.isArchived &&
        t.status !== "done" &&
        !t.parentId &&
        t.dueDate !== undefined &&
        t.dueDate < today,
    );
  }, [tasks]);

  // 篩選為空 → 不渲染任何東西(零視覺噪音)
  if (lostTasks.length === 0) return null;

  /**
   * 復活:dueDate 推到今天
   * §25 reuse:沿用 useApp().updateTask,自動同步到 Supabase + Firebase
   * 注意:不動 isArchived — 任務本來就沒被封存
   */
  const handleResurrect = (task: Task) => {
    const today = new Date().toLocaleDateString("en-CA");
    updateTask(task.id, { dueDate: today });
  };

  /**
   * 無罪赦免:isArchived = true(移到封存頁)
   * 情緒包裝維持「原諒自己」的儀式感,底層才是工程上的封存操作。
   * §2 spec:不改名為「移至封存」— 前端情緒包裝與後端資料流永遠分離。
   * §3 anti-pattern:沒有自動刪除,Cron,或任何「用戶沒有按鈕就消失」的設計。
   */
  const handleDismiss = (task: Task) => {
    updateTask(task.id, { isArchived: true });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mb-4 overflow-hidden rounded-2xl border border-zinc-200/70 bg-zinc-100/80"
      aria-labelledby="lost-and-found-title"
    >
      {/* 標題列 — 柔和、不責備 */}
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <ArchiveRestore className="h-4 w-4 text-zinc-400" aria-hidden />
        <h2
          id="lost-and-found-title"
          className="text-sm font-medium text-zinc-500"
        >
          失物招領
        </h2>
        <span className="text-xs text-zinc-400" aria-live="polite">
          · 今天有 {lostTasks.length} 個被遺忘的任務等你決定
        </span>
      </header>

      {/* 任務卡片列表 */}
      <ul className="divide-y divide-zinc-200/60 px-2 pb-2">
        <AnimatePresence initial={false}>
          {lostTasks.map((task) => (
            <motion.li
              key={task.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex items-center justify-between gap-3 px-2 py-3"
            >
              {/* 任務標題 — 灰色 + 柔和,絕不紅色 */}
              <span className="line-clamp-2 break-words text-sm text-zinc-500/90">
                {task.title}
              </span>

              {/* 兩個溫柔的按鈕 */}
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleResurrect(task)}
                  aria-label={`復活「${task.title}」,排入今日`}
                  title="復活 — 排入今日"
                  className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-xs text-zinc-600 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  復活
                </button>
                <button
                  type="button"
                  onClick={() => handleDismiss(task)}
                  aria-label={`無罪赦免「${task.title}」,徹底釋放`}
                  title="無罪赦免 — 徹底放下"
                  className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-xs text-zinc-600 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                >
                  <Leaf className="h-3.5 w-3.5" aria-hidden />
                  無罪赦免
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}