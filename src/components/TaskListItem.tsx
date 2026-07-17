"use client";

import { useMemo } from "react";
import { Task, Priority } from "@/lib/types";
import { TaskQuickActions } from "./TaskQuickActions";
import { TextWithLinks } from "./TextWithLinks";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight,
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
}

import { sortSubTasks } from "@/utils/subtaskSort";
import { useSubTaskCollapse } from "@/utils/useSubTaskCollapse";

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
}: TaskListItemProps) {
  const subTasks = task.subTasks || [];
  const sortedSubTasks = sortSubTasks(subTasks);
  const isDone = task.status === "done";
  const { isCollapsed, isAutoCollapsing, toggle } = useSubTaskCollapse(task.id, subTasks);

  const doneCount = useMemo(
    () => subTasks.filter((s) => s.status === "done").length,
    [subTasks],
  );

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStatus(task.id);
  };

  return (
    <div
      className={`
        flex items-start gap-2.5 px-3 py-3 rounded-2xl cursor-pointer
        transition-all duration-150 group select-none
        ${isSelected ? "bg-[var(--brand-tint)] shadow-sm" : "hover:bg-[var(--surface-hover)]"}
        ${isDone ? "opacity-60" : ""}
      `}
      onClick={onClick}
      role="button"
      aria-label={`任務: ${task.title}`}
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

        {/* Sub-task header — chevron + 計數（永遠顯示，點 chevron 摺疊/展開） */}
        {subTasks.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            className="mt-1.5 flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--text-tertiary)" }}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `展開 ${subTasks.length} 項子任務` : `摺疊 ${subTasks.length} 項子任務`}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            )}
            <span>子任務 {doneCount}/{subTasks.length}</span>
            {isCollapsed && doneCount === subTasks.length && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-[var(--status-success)]">
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                全部完成
              </span>
            )}
            {isAutoCollapsing && !isCollapsed && (
              <span className="ml-1 text-[10px] opacity-60">（3 秒後自動摺疊）</span>
            )}
          </button>
        )}

        {/* Sub-task titles with quick-check — 只在展開時渲染 */}
        {!isCollapsed && subTasks.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-1">
            {sortedSubTasks.map((sub) => (
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
                  {sub.status === "done" ? (
                    <CheckCircle2 className="w-[18px] h-[18px] text-[var(--status-success)]" />
                  ) : (
                    <Circle className="w-[18px] h-[18px] text-[var(--text-tertiary)] group-hover/sub:text-[var(--text-secondary)]" />
                  )}
                </button>
                <span
                  className="text-[12px] truncate min-w-0 flex-1 break-words"
                  style={{
                    color: sub.status === "done" ? "var(--text-tertiary)" : "var(--text-secondary)",
                    textDecoration: sub.status === "done" ? "line-through" : "none",
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
    </div>
  );
}
