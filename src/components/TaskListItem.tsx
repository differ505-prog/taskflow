"use client";

import { useMemo, useRef } from "react";
import { Task, Priority } from "@/lib/types";
import { TaskQuickActions } from "./TaskQuickActions";
import { TextWithLinks } from "./TextWithLinks";
import { Clock } from "lucide-react";
import { getDeadlineStatus } from "@/lib/deadlineEngine";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, ListChecks,
} from "lucide-react";

interface TaskListItemProps {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
  onToggleStatus: (id: string) => void;
  onToggleSubTask?: (taskId: string, subId: string) => void;
  onUpdatePriority?: (id: string, p: Priority) => void;
  onUpdateTags?: (id: string, tags: string[]) => void;
  onTogglePin?: (id: string) => void;
  allTags?: string[];
  // 批次多選模式（PRO 專屬）
  batchMode?: boolean;
  batchSelected?: boolean;
  onLongPress?: () => void; // 長按 600ms 進入批次模式
  onBatchToggle?: () => void; // 在批次模式下點擊,切換勾選
}

import { sortSubTasks } from "@/utils/subtaskSort";
import { useSubTaskCollapse } from "@/utils/useSubTaskCollapse";
import { fireTaskDoneConfetti } from "@/lib/confetti";

export function TaskListItem({
  task,
  isSelected,
  onClick,
  onToggleStatus,
  onToggleSubTask,
  onUpdatePriority,
  onUpdateTags,
  onTogglePin,
  allTags = [],
  batchMode = false,
  batchSelected = false,
  onLongPress,
  onBatchToggle,
}: TaskListItemProps) {
  const subTasks = task.subTasks || [];
  const sortedSubTasks = sortSubTasks(subTasks);
  const isDone = task.status === "done";
  const { isCollapsed: isDoneCollapsed, toggle: toggleDoneCollapse } = useSubTaskCollapse(task.id, subTasks);
  const deadlineStatus = getDeadlineStatus(task.dueDate, task.dueTime, isDone);

  const todoSubTasks = sortedSubTasks.filter((s) => s.status !== "done");
  const doneSubTasks = sortedSubTasks.filter((s) => s.status === "done");
  const doneCount = useMemo(
    () => doneSubTasks.length,
    [doneSubTasks],
  );

  const handleCheckboxClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (batchMode && onBatchToggle) { onBatchToggle(); return; }
    const wasNotDone = !isDone;
    onToggleStatus(task.id);
    // 只有「從未完成 → 完成」轉場才觸發慶祝動畫
    if (wasNotDone) {
      fireTaskDoneConfetti(e.currentTarget);
    }
  };

  // ── 長按偵測：pointerdown 起算 600ms → 觸發 onLongPress ──────
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onLongPress) return;
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPress();
    }, 600);
    // 記錄起始 pointerId 以便後續 cancel
    (e.currentTarget as HTMLElement).dataset.pointerId = String(e.pointerId);
  };
  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  const handlePointerLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // 主體點擊 — 若長按已觸發,則吃掉這次 click 避免雙重操作
  const handleClick = () => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (batchMode && onBatchToggle) { onBatchToggle(); return; }
    onClick();
  };

  return (
    <div
      className={`
        flex items-start gap-2.5 px-3 py-3 rounded-2xl cursor-pointer
        transition-all duration-150 group select-none
        ${isSelected ? "bg-[var(--brand-tint)] shadow-sm" : "hover:bg-[var(--surface-hover)]"}
        ${batchSelected ? "ring-2 ring-[var(--brand)] bg-[var(--brand-tint)]/40" : ""}
        ${batchMode ? "active:scale-[0.98]" : ""}
        ${isDone ? "opacity-60" : ""}
      `}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerUp}
      role="button"
      aria-label={`任務: ${task.title}`}
      aria-pressed={batchSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Checkbox */}
      <button
        onClick={handleCheckboxClick}
        className="flex-shrink-0 mt-1 transition-transform hover:scale-110 z-10"
        aria-label={isDone ? "標記未完成" : "標記完成"}
      >
        {isDone ? (
          <CheckCircle2 className="w-[18px] h-[18px] text-[var(--status-success)]" />
        ) : (
          <Circle className="w-[18px] h-[18px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" />
        )}
      </button>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* 標題行：左標題，右上「旗子 + 標籤 + 附件 + 子任務」三件套 */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`text-[14px] font-medium leading-snug min-w-0 flex-1 ${
              isDone ? "line-through" : ""
            }`}
            style={isDone ? { color: "var(--text-tertiary)" } : { color: "var(--text-primary)" }}
          >
            {task.title}
          </h3>

          {/* 右上角：旗子 / 圖釘 / 標籤 / 附件 / 子任務 圖示區 */}
          {(onUpdatePriority || onUpdateTags || onTogglePin) && (
            <TaskQuickActions
              task={task}
              compact
              onUpdatePriority={(p) => onUpdatePriority?.(task.id, p)}
              onUpdateTags={(tags) => onUpdateTags?.(task.id, tags)}
              onTogglePin={onTogglePin ? () => onTogglePin(task.id) : undefined}
              allTags={allTags}
            />
          )}
        </div>

        {/* 死線引擎：截止緊迫警示（帕金森定律視覺化） */}
        {deadlineStatus && (
          <div
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md"
            style={{ background: `${deadlineStatus.colorVar}15`, color: deadlineStatus.colorVar }}
            title={deadlineStatus.tooltip}
            aria-label={`截止警示:${deadlineStatus.text}`}
          >
            <Clock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            <span>{deadlineStatus.text}</span>
          </div>
        )}

        {/* Sub-task 分群組渲染：未完成永遠展開，已完成預設折疊 */}
        {subTasks.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {/* 未完成群組（永遠展開） */}
            {todoSubTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <ListChecks className="w-3 h-3" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                    子任務 {doneCount}/{subTasks.length}
                  </span>
                  {doneCount === subTasks.length && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-[var(--status-success)]">
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      全部完成
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-1">
                  {todoSubTasks.map((sub) => (
                    <li
                      key={sub.id}
                      className={`flex items-center gap-2 group/sub ${sub.status === "done" ? "opacity-40" : ""}`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSubTask?.(task.id, sub.id);
                        }}
                        className="flex-shrink-0 -m-1.5 p-1 rounded-full transition-transform hover:scale-110"
                        aria-label={sub.status === "done" ? "標記未完成" : "標記完成"}
                      >
                        <Circle className="w-[18px] h-[18px] text-[var(--text-tertiary)] group-hover/sub:text-[var(--text-secondary)]" />
                      </button>
                      <span
                        className="text-[12px] truncate min-w-0 flex-1 break-words"
                        style={{
                          color: "var(--text-secondary)",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                        }}
                        title={sub.title}
                      >
                        <TextWithLinks
                          text={sub.title}
                          linkStyle={{
                            color: "var(--brand)",
                            textDecoration: "underline",
                          }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 已完成群組（獨立可折疊，預設折疊） */}
            {doneSubTasks.length > 0 && (
              <div className={todoSubTasks.length > 0 ? "pt-1.5 border-t border-dashed" : ""} style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleDoneCollapse(); }}
                  className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-80"
                  style={{ color: "var(--text-tertiary)" }}
                  aria-expanded={!isDoneCollapsed}
                  aria-label={isDoneCollapsed ? `展開 ${doneSubTasks.length} 項已完成子任務` : `摺疊 ${doneSubTasks.length} 項已完成子任務`}
                >
                  {isDoneCollapsed ? (
                    <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-3 h-3" aria-hidden="true" />
                  )}
                  <span>已完成 ({doneSubTasks.length})</span>
                </button>

                {!isDoneCollapsed && (
                  <ul className="mt-1 flex flex-col gap-1">
                    {doneSubTasks.map((sub) => (
                      <li
                        key={sub.id}
                        className="flex items-center gap-2 group/sub opacity-40"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSubTask?.(task.id, sub.id);
                          }}
                          className="flex-shrink-0 -m-1.5 p-1 rounded-full transition-transform hover:scale-110"
                          aria-label={sub.status === "done" ? "標記未完成" : "標記完成"}
                        >
                          <CheckCircle2 className="w-[18px] h-[18px] text-[var(--status-success)]" />
                        </button>
                        <span
                          className="text-[12px] truncate min-w-0 flex-1 break-words"
                          style={{
                            color: "var(--text-tertiary)",
                            textDecoration: "line-through",
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                          }}
                          title={sub.title}
                        >
                          <TextWithLinks
                            text={sub.title}
                            linkStyle={{
                              color: "var(--brand)",
                              textDecoration: "underline",
                            }}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
