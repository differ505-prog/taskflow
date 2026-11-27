"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Leaf, X, RotateCcw } from "lucide-react";
import { getLocalToday } from "@/lib/dateUtils";
import { haptic } from "@/lib/haptics";
import type { Task } from "@/lib/types";
import {
  DAILY_CAP_OPTIONS,
  computeSelectedSmartSchedulePlan,
  formatShortDateLabel,
  type SmartRescheduleAssignment,
} from "@/lib/smartReschedule";

/**
 * InboxSmartPicker — 收集箱「挑幾件這週來做」批量撈取排程面板
 *
 * 核心原則（Pull-based 防呆）：
 * - 預設全不選（selectedIds = []），零自動排程、絕不預設全選
 * - 只為使用者親手點選的任務排程，沒點到的永遠留在收集箱
 * - 零 red 色系、零驚嘆號、零責備語氣（§5 情緒保護）
 * - 不改視圖、不搶 Zen 焦點、不開 Modal（§5a 流程鎖定）
 *
 * 視覺：全面採用 DESIGN_SYSTEM.md 的 CSS Token（var(--surface*) / var(--border*) /
 * var(--text*) / var(--brand*)），以支援 <html data-theme="dark"> 手動切換。
 */

export interface InboxSmartPickerProps {
  unscheduledTasks: Task[];
  allTasks: Task[];
  isOpen: boolean;
  dailyCap: number;
  onChangeDailyCap: (cap: number) => void;
  onClose: () => void;
  onScheduleSelected: (assignments: SmartRescheduleAssignment[]) => void;
  onArchiveTask: (task: Task) => void;
}

export function InboxSmartPicker({
  unscheduledTasks,
  allTasks,
  isOpen,
  dailyCap,
  onChangeDailyCap,
  onClose,
  onScheduleSelected,
  onArchiveTask,
}: InboxSmartPickerProps) {
  // 預設必須全不選 —— 零自動排程
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const today = getLocalToday();

  /** 每次收起後重開必須重置選取狀態 */
  useEffect(() => {
    if (!isOpen) setSelectedIds([]);
  }, [isOpen]);

  /** 過濾掉已不在候選清單內的殘留 ID */
  const activeSelectedIds = useMemo(() => {
    const validIds = new Set(unscheduledTasks.map((t) => t.id));
    return selectedIds.filter((id) => validIds.has(id));
  }, [selectedIds, unscheduledTasks]);

  const selectedPlan = useMemo(
    () =>
      computeSelectedSmartSchedulePlan(
        activeSelectedIds,
        unscheduledTasks,
        allTasks,
        today,
        { dailyCap }
      ),
    [activeSelectedIds, unscheduledTasks, allTasks, today, dailyCap]
  );

  const assignmentById = useMemo(
    () => new Map(selectedPlan.map((item) => [item.task.id, item])),
    [selectedPlan]
  );

  /** Tap-to-Pick & Rank：已選則移除，未選則 append 到尾端（1→2→3） */
  const togglePick = useCallback((taskId: string) => {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
    haptic("selection");
  }, []);

  // Esc 關閉面板（僅在開啟時監聽）
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  /** 已點選的依點選順序浮在最上方，未點選的維持原順序接在後面 */
  const orderedTasks = useMemo(() => {
    const selected = activeSelectedIds
      .map((id) => unscheduledTasks.find((t) => t.id === id))
      .filter((t): t is Task => Boolean(t));
    const pickedSet = new Set(activeSelectedIds);
    const rest = unscheduledTasks.filter((t) => !pickedSet.has(t.id));
    return [...selected, ...rest];
  }, [activeSelectedIds, unscheduledTasks]);

  if (!isOpen || unscheduledTasks.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mb-4 overflow-hidden rounded-2xl border"
      style={{ background: "var(--surface-muted)", borderColor: "var(--border)" }}
      aria-labelledby="inbox-smart-picker-title"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles
            className="h-4 w-4 flex-shrink-0"
            style={{ color: "var(--text-tertiary)" }}
            aria-hidden
          />
          <h2
            id="inbox-smart-picker-title"
            className="text-sm font-medium flex-shrink-0"
            style={{ color: "var(--text-primary)" }}
          >
            挑幾件這週來做
          </h2>
          <span
            className="text-xs truncate"
            style={{ color: "var(--text-tertiary)" }}
            aria-live="polite"
          >
            {activeSelectedIds.length > 0
              ? `· 已選 ${activeSelectedIds.length} 件，其餘留在收集箱`
              : "· 點選想排的項目，沒點到的留在收集箱"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
          {/* 每日上限切換器 */}
          <div
            className="inline-flex items-center rounded-full border p-0.5 shadow-sm"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            role="group"
            aria-label="每日硬排程上限"
            title="調整每天最多填滿幾件硬排程，滿了自動往後溢流"
          >
            <span className="px-1.5 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              每日
            </span>
            {DAILY_CAP_OPTIONS.map((cap) => {
              const active = dailyCap === cap;
              return (
                <button
                  key={cap}
                  type="button"
                  onClick={() => onChangeDailyCap(cap)}
                  aria-pressed={active}
                  className="min-w-[32px] h-[28px] sm:min-w-[24px] sm:h-[22px] rounded-full px-1.5 text-[11px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                  style={
                    active
                      ? { background: "var(--brand)", color: "var(--brand-foreground)" }
                      : { color: "var(--text-secondary)" }
                  }
                >
                  {cap}
                </button>
              );
            })}
          </div>

          {/* 重置（僅在有選取時顯示） */}
          {activeSelectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                haptic("selection");
              }}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                color: "var(--text-secondary)",
                borderColor: "var(--border)",
              }}
              title="清除自訂編號，恢復預設排序"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              重置
            </button>
          )}

          {/* 主 CTA：只排入使用者親手點選的任務 */}
          <button
            type="button"
            onClick={() => {
              if (selectedPlan.length === 0) return;
              onScheduleSelected(selectedPlan);
              setSelectedIds([]);
            }}
            disabled={selectedPlan.length === 0}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-all duration-200 ease-out active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
            title={`依點選順序填滿未來空檔，每天最多 ${dailyCap} 件`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            <span>排入所選 ({selectedPlan.length})</span>
          </button>

          {/* 收起 */}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            style={{
              background: "var(--surface)",
              color: "var(--text-secondary)",
              borderColor: "var(--border)",
            }}
            title="收起面板"
          >
            <X className="h-3 w-3" aria-hidden />
            收起
          </button>
        </div>
      </header>

      {/* 清單區 */}
      <ul className="px-2 pb-2 max-h-[360px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {orderedTasks.map((task) => {
            const rankIndex = activeSelectedIds.indexOf(task.id);
            const isPicked = rankIndex !== -1;
            const assignment = assignmentById.get(task.id);

            return (
              <motion.li
                key={task.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between gap-2.5 px-2 py-2.5">
                  {/* 左側：點擊即標記 1→2→3 */}
                  <button
                    type="button"
                    onClick={() => togglePick(task.id)}
                    aria-pressed={isPicked}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded-lg py-0.5 transition-opacity hover:opacity-90 active:scale-[0.99] min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    title={isPicked ? `目前第 ${rankIndex + 1} 優先，點擊取消編號` : "點擊標記為想排的任務"}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 transition-colors tabular-nums"
                      style={
                        isPicked
                          ? { background: "var(--brand)", color: "var(--brand-foreground)" }
                          : {
                              border: "1.5px dashed var(--border-hover)",
                              color: "var(--text-tertiary)",
                              background: "var(--surface)",
                            }
                      }
                    >
                      {isPicked ? rankIndex + 1 : ""}
                    </span>
                    <span
                      className={
                        isPicked
                          ? "line-clamp-2 break-words text-sm font-medium"
                          : "line-clamp-2 break-words text-sm"
                      }
                      style={{ color: isPicked ? "var(--text-primary)" : "var(--text-secondary)" }}
                    >
                      {task.title}
                    </span>
                  </button>

                  {/* 右側：落點預覽 或 溫柔放著 */}
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {assignment ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs shadow-sm"
                        style={{
                          background: "var(--surface)",
                          color: "var(--text-secondary)",
                          borderColor: "var(--border)",
                        }}
                        title={`該日原 ${assignment.existingLoadBefore} 件硬排程`}
                      >
                        <Sparkles className="h-3.5 w-3.5" aria-hidden />
                        <span>排 {formatShortDateLabel(assignment.targetDate, today)}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onArchiveTask(task)}
                        aria-label={`無罪赦免「${task.title}」`}
                        title="無罪赦免 — 移到封存"
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                        style={{
                          background: "var(--surface)",
                          color: "var(--text-secondary)",
                          borderColor: "var(--border)",
                        }}
                      >
                        <Leaf className="h-3.5 w-3.5" aria-hidden />
                        放著
                      </button>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}

export default InboxSmartPicker;
