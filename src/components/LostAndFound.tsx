"use client";
import { getLocalToday } from "@/lib/dateUtils";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Leaf, ArchiveRestore, CalendarClock, Check, X, RotateCcw } from "lucide-react";
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
 * 溫柔的決策流:
 * - ✨ 智慧排程（批次預覽）：依未來 14 天每日硬排程負載（每日建議上限 3 件）平均攤平，先預覽再確認＋5 秒復原
 * - ✨ 單筆智慧排入：自動挑未來最空日（而非全部塞進今天），附 5 秒復原
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
  const [previewOpen, setPreviewOpen] = useState(false);
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

  /** 預先算好每一筆的智慧落點（與批次預覽共用同一份負載平衡計畫，支援 Tap-to-Rank 自訂順序） */
  const smartPlan = useMemo(
    () =>
      computeSmartReschedulePlan(lostTasks, tasks, today, {
        dailyCap: DEFAULT_DAILY_HARD_CAP,
        customOrderIds: activeRankedIds,
      }),
    [lostTasks, tasks, today, activeRankedIds],
  );

  const planByTaskId = useMemo(() => {
    const map = new Map<string, SmartRescheduleAssignment>();
    for (const item of smartPlan) {
      map.set(item.task.id, item);
    }
    return map;
  }, [smartPlan]);

  // 篩選為空 → 不渲染任何東西(零視覺噪音)
  if (lostTasks.length === 0) return null;

  /**
   * 單筆智慧排入：改排到未來最空日（而非死鎖今日），附 5 秒 Undo
   */
  const handleSmartResurrectOne = (task: Task) => {
    const assignment = planByTaskId.get(task.id);
    const targetDate = assignment?.targetDate ?? today;
    const prevDueDate = task.dueDate;
    const prevStartDate = task.startDate;

    const updates: Partial<Task> = { dueDate: targetDate };
    if (assignment?.newStartDate !== undefined) {
      updates.startDate = assignment.newStartDate;
    }

    updateTask(task.id, updates);
    haptic("selection");

    const label = formatShortDateLabel(targetDate, today);
    toast.success(`已排入 ${label}（原 ${assignment?.existingLoadBefore ?? 0} 件硬排程）`, {
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
   * 批次智慧排程確認：依預覽結果一次落盤，附 5 秒全部 Undo
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

    setPreviewOpen(false);
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
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mb-4 overflow-hidden rounded-2xl border border-zinc-200/70 bg-zinc-100/80"
      aria-labelledby="lost-and-found-title"
    >
      {/* 標題列 — 柔和、不責備 + 右側一鍵智慧排程入口 */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <ArchiveRestore className="h-4 w-4 text-zinc-400 flex-shrink-0" aria-hidden />
          <h2
            id="lost-and-found-title"
            className="text-sm font-medium text-zinc-500"
          >
            失物招領
          </h2>
          <span className="text-xs text-zinc-400 truncate" aria-live="polite">
            · {lostTasks.length} 個被遺忘的任務等你決定
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setPreviewOpen((prev) => !prev);
            haptic("selection");
          }}
          aria-expanded={previewOpen}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-all duration-200 ease-out active:scale-[0.97]"
          style={
            previewOpen
              ? { background: "var(--brand)", color: "var(--brand-foreground)" }
              : { background: "rgba(255,255,255,0.85)", color: "var(--brand)" }
          }
          title={`依未來 14 天每日硬排程數（上限 ${DEFAULT_DAILY_HARD_CAP} 件）平均往後排`}
        >
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          <span>{previewOpen ? "收起預覽" : "智慧排程"}</span>
        </button>
      </header>

      {/* 方案 1：極簡批次排程預覽面板（先確認再落盤） */}
      <AnimatePresence initial={false}>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mx-3 mb-2 overflow-hidden rounded-xl border border-zinc-200/80 bg-white/90"
          >
            <div className="px-3.5 py-2.5 border-b border-zinc-200/60 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-700">
                  建議分配預覽（每日硬排程上限 {DEFAULT_DAILY_HARD_CAP} 件）
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  依輕重緩急點選任務編號（1→2→3），日期會即時重算
                </p>
              </div>
              {activeRankedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRankedIds([]);
                    haptic("selection");
                  }}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors flex-shrink-0"
                  title="清除自訂編號，恢復預設排序"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden />
                  重置順序
                </button>
              )}
            </div>

            <ul className="max-h-56 overflow-y-auto divide-y divide-zinc-100 px-2 py-1">
              {smartPlan.map((item) => {
                const rankIndex = activeRankedIds.indexOf(item.task.id);
                const isRanked = rankIndex !== -1;
                return (
                  <li key={item.task.id}>
                    <button
                      type="button"
                      onClick={() => toggleRank(item.task.id)}
                      aria-pressed={isRanked}
                      className="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg text-left text-xs transition-colors hover:bg-zinc-50 active:scale-[0.99]"
                      title={
                        isRanked
                          ? `目前第 ${rankIndex + 1} 優先，點擊取消編號`
                          : "點擊標記為優先排程"
                      }
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 transition-colors tabular-nums"
                          style={
                            isRanked
                              ? {
                                  background: "var(--brand)",
                                  color: "var(--brand-foreground)",
                                }
                              : {
                                  border: "1.5px dashed #d4d4d8",
                                  color: "#a1a1aa",
                                  background: "transparent",
                                }
                          }
                        >
                          {isRanked ? rankIndex + 1 : ""}
                        </span>
                        <span
                          className={
                            isRanked
                              ? "truncate text-zinc-800 font-medium"
                              : "truncate text-zinc-600"
                          }
                        >
                          {item.task.title}
                        </span>
                      </span>
                      <span className="flex-shrink-0 inline-flex items-center gap-1.5 tabular-nums">
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                        >
                          {formatShortDateLabel(item.targetDate, today)}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          原 {item.existingLoadBefore} 件
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-end gap-2 px-3.5 py-2.5 bg-zinc-50/80 border-t border-zinc-200/60">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-200/60 transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchSmartSchedule}
                className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-medium shadow-sm transition-transform active:scale-[0.97]"
                style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                確認排入（{smartPlan.length} 項）
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 任務卡片列表 */}
      <ul className="divide-y divide-zinc-200/60 px-2 pb-2">
        <AnimatePresence initial={false}>
          {lostTasks.map((task) => {
            const suggestion = planByTaskId.get(task.id);
            const targetLabel = suggestion
              ? formatShortDateLabel(suggestion.targetDate, today)
              : "今天";
            return (
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
                    onClick={() => handleSmartResurrectOne(task)}
                    aria-label={`復活「${task.title}」，排入 ${targetLabel}`}
                    title={`智慧復活 — 排入最空日 ${targetLabel}（原 ${suggestion?.existingLoadBefore ?? 0} 件硬排程）`}
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
