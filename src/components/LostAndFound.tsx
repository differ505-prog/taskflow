"use client";
import { getLocalToday } from "@/lib/dateUtils";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Leaf, ArchiveRestore, CalendarClock, RotateCcw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { toast } from "sonner";
import { useApp } from "@/lib/AppContext";
import type { Task } from "@/lib/types";
import {
  DEFAULT_DAILY_HARD_CAP,
  computeSmartReschedulePlan,
  type SmartRescheduleAssignment,
} from "@/lib/smartReschedule";
import { haptic } from "@/lib/haptics";

/**
 * LostAndFound — 失物招領
 *
 * 品牌承諾:真實與脆弱（Authenticity & Vulnerability）
 * - 不稱「過期」、「未完成」、「昨天沒做」等責備語氣
 * - 標題用「失物招領」:把任務視為「被遺忘的念頭」,而非「債務」
 * - 不抖動、不警示色、不催促
 *
 * 溫柔的決策流（原地直接編輯，無重複子面板）:
 * - 原地 Tap-to-Rank：點任一列左側圓圈或標題即依序標記 1→2→3，原地重排並即時重算每筆落點
 * - ✨ 全部智慧排入：依目前順序與未來 14 天每日硬排程負載（每日上限 3 件）一次攤平，附 5 秒復原
 * - ✨ 單筆「排 M/d」：只排入該筆至顯示的最空日，附 5 秒復原
 * - 🍃 無罪赦免：isArchived = true，移到封存頁。情緒包裝永遠與工程實作分離。
 *
 * Anti-pattern 防護（破壞產品核心=死罪）:
 * - 零紅色警告:絕對禁止 bg-red-* / text-red-* / border-red-* 等任何 red 色系 className
 * - 零自動刪除:禁止任何 Cron / setInterval / useEffect 自動刪除或標記
 * - 零焦慮視覺:禁止驚嘆號、抖動動畫等製造恐慌的設計
 * - 零責備語氣:標題與按鈕都正念
 */

function formatShortDateLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return "今天";
  const d = parseISO(dateStr);
  return format(d, "M/d (EEEEE)", { locale: zhTW });
}

export default function LostAndFound() {
  const { tasks, updateTask } = useApp();
  const [rankedIds, setRankedIds] = useState<string[]>([]);

  const today = getLocalToday(); // YYYY-MM-DD（本地時區）

  /**
   * 篩選條件:
   * - dueDate < today (有截止日且已過)
   * - status !== "done" (還沒完成)
   * - !isArchived (沒被封存)
   * - !parentId (不是子任務)
   */
  const lostTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        !t.isArchived &&
        t.status !== "done" &&
        !t.parentId &&
        t.dueDate !== undefined &&
        t.dueDate < today,
    );
  }, [tasks, today]);

  /** 過濾掉已被處理／封存的殘留 ID */
  const activeRankedIds = useMemo(() => {
    const validIds = new Set(lostTasks.map((t) => t.id));
    return rankedIds.filter((id) => validIds.has(id));
  }, [rankedIds, lostTasks]);

  const toggleRank = (taskId: string) => {
    setRankedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
    haptic("selection");
  };

  /** 即時計算每筆的智慧落點（支援原地 Tap-to-Rank 自訂優先順序） */
  const smartPlan = useMemo(
    () =>
      computeSmartReschedulePlan(lostTasks, tasks, today, {
        dailyCap: DEFAULT_DAILY_HARD_CAP,
        customOrderIds: activeRankedIds,
      }),
    [lostTasks, tasks, today, activeRankedIds],
  );

  // 篩選為空 → 不渲染任何東西(零視覺噪音)
  if (lostTasks.length === 0) return null;

  /**
   * 單筆智慧排入：排到該列顯示的目標空檔日，附 5 秒 Undo
   */
  const handleSmartResurrectOne = (assignment: SmartRescheduleAssignment) => {
    const { task, targetDate, newStartDate, existingLoadBefore } = assignment;
    const prevDueDate = task.dueDate;
    const prevStartDate = task.startDate;

    const updates: Partial<Task> = { dueDate: targetDate };
    if (newStartDate !== undefined) {
      updates.startDate = newStartDate;
    }

    updateTask(task.id, updates);
    setRankedIds((prev) => prev.filter((id) => id !== task.id));
    haptic("selection");

    const label = formatShortDateLabel(targetDate, today);
    toast.success(`已排入 ${label}（原 ${existingLoadBefore} 件硬排程）`, {
      duration: 5000,
      action: {
        label: "復原",
        onClick: () => {
          updateTask(task.id, {
            dueDate: prevDueDate,
            ...(prevStartDate !== undefined ? { startDate: prevStartDate } : {}),
          });
        },
      },
    });
  };

  /**
   * 一鍵全部智慧排入：依目前清單顯示的順序與日期落盤，附 5 秒全部 Undo
   */
  const handleConfirmBatchSmartSchedule = () => {
    if (smartPlan.length === 0) return;

    const snapshots = smartPlan.map((item) => ({
      id: item.task.id,
      prevDueDate: item.task.dueDate,
      prevStartDate: item.task.startDate,
    }));

    for (const item of smartPlan) {
      const updates: Partial<Task> = { dueDate: item.targetDate };
      if (item.newStartDate !== undefined) {
        updates.startDate = item.newStartDate;
      }
      updateTask(item.task.id, updates);
    }

    setRankedIds([]);
    haptic("success");

    toast.success(`已將 ${smartPlan.length} 項任務平均排入未來空檔`, {
      duration: 5000,
      action: {
        label: "復原",
        onClick: () => {
          for (const snap of snapshots) {
            updateTask(snap.id, {
              dueDate: snap.prevDueDate,
              ...(snap.prevStartDate !== undefined ? { startDate: snap.prevStartDate } : {}),
            });
          }
        },
      },
    });
  };

  /**
   * 無罪赦免:isArchived = true(移到封存頁)
   * 情緒包裝維持「原諒自己」的儀式感,底層才是工程上的封存操作。
   * §2 spec:不改名為「移至封存」— 前端情緒包裝與後端資料流永遠分離。
   * §3 anti-pattern:沒有自動刪除,Cron,或任何「用戶沒有按鈕就消失」的設計。
   */
  const handleDismiss = (task: Task) => {
    updateTask(task.id, { isArchived: true });
    setRankedIds((prev) => prev.filter((id) => id !== task.id));
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mb-4 overflow-hidden rounded-2xl border border-zinc-200/70 bg-zinc-100/80"
      aria-labelledby="lost-and-found-title"
    >
      {/* 標題列 — 柔和、不責備 + 原地重置與一鍵全部智慧排入 */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <ArchiveRestore className="h-4 w-4 text-zinc-400 flex-shrink-0" aria-hidden />
          <h2
            id="lost-and-found-title"
            className="text-sm font-medium text-zinc-500 flex-shrink-0"
          >
            失物招領
          </h2>
          <span className="text-xs text-zinc-400 truncate" aria-live="polite">
            · {lostTasks.length} 個任務，點左側可標記優先序
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {activeRankedIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setRankedIds([]);
                haptic("selection");
              }}
              className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1.5 text-xs text-zinc-500 shadow-sm transition-colors hover:bg-white"
              title="清除自訂編號，恢復預設排序"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              重置
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirmBatchSmartSchedule}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-all duration-200 ease-out active:scale-[0.97]"
            style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
            title={`依目前順序與未來 14 天每日硬排程數（上限 ${DEFAULT_DAILY_HARD_CAP} 件）一次排入`}
          >
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            <span>全部智慧排入 ({smartPlan.length})</span>
          </button>
        </div>
      </header>

      {/* 單一清單：左側原地 Tap-to-Rank 編號，右側單筆落點與無罪赦免 */}
      <ul className="divide-y divide-zinc-200/60 px-2 pb-2">
        <AnimatePresence initial={false}>
          {smartPlan.map((item) => {
            const { task, targetDate, existingLoadBefore } = item;
            const rankIndex = activeRankedIds.indexOf(task.id);
            const isRanked = rankIndex !== -1;
            const targetLabel = formatShortDateLabel(targetDate, today);

            return (
              <motion.li
                key={task.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex items-center justify-between gap-2.5 px-2 py-2.5"
              >
                {/* 左側：點擊即可原地標記 1→2→3 並即時重排 */}
                <button
                  type="button"
                  onClick={() => toggleRank(task.id)}
                  aria-pressed={isRanked}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded-lg py-0.5 transition-opacity hover:opacity-90 active:scale-[0.99]"
                  title={
                    isRanked
                      ? `目前第 ${rankIndex + 1} 優先，點擊取消編號`
                      : "點擊標記為優先排程"
                  }
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 transition-colors tabular-nums"
                    style={
                      isRanked
                        ? {
                            background: "var(--brand)",
                            color: "var(--brand-foreground)",
                          }
                        : {
                            border: "1.5px dashed #c4c4cc",
                            color: "#a1a1aa",
                            background: "rgba(255,255,255,0.5)",
                          }
                    }
                  >
                    {isRanked ? rankIndex + 1 : ""}
                  </span>
                  <span
                    className={
                      isRanked
                        ? "line-clamp-2 break-words text-sm font-medium text-zinc-700"
                        : "line-clamp-2 break-words text-sm text-zinc-500/90"
                    }
                  >
                    {task.title}
                  </span>
                </button>

                {/* 右側：兩個溫柔的按鈕 */}
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSmartResurrectOne(item)}
                    aria-label={`復活「${task.title}」，排入 ${targetLabel}`}
                    title={`排入 ${targetLabel}（該日原 ${existingLoadBefore} 件硬排程）`}
                    className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-xs text-zinc-600 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    <span>排 {targetLabel}</span>
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
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}
