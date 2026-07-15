"use client";

import { useState, useEffect } from "react";
import { Task } from "@/lib/types";
import { getTagColors } from "@/lib/storage";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import {
  CheckCircle2, Circle, Clock, Repeat, Timer,
  ListChecks, Paperclip,
} from "lucide-react";

interface TaskListItemProps {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
  onToggleStatus: (id: string) => void;
  onToggleSubTask?: (taskId: string, subId: string) => void;
}

function getDueDateLabel(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return "今天";
    if (isTomorrow(date)) return "明天";
    if (isPast(date) && !isToday(date)) return `逾期 ${format(date, "M/d", { locale: zhTW })}`;
    return format(date, "M/d", { locale: zhTW });
  } catch {
    return null;
  }
}

export function TaskListItem({
  task,
  isSelected,
  onClick,
  onToggleStatus,
  onToggleSubTask,
}: TaskListItemProps) {
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const subTasks = task.subTasks || [];
  const completedSubTasks = subTasks.filter((s) => s.status === "done").length;
  const isDone = task.status === "done";
  const dueLabel = getDueDateLabel(task.dueDate);
  const isOverdue = task.dueDate ? isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate)) && !isDone : false;

  useEffect(() => {
    setTagColors(getTagColors());
  }, []);

  const priorityColor =
    task.priority === "high"
      ? "var(--priority-high)"
      : task.priority === "medium"
      ? "var(--priority-medium)"
      : "var(--priority-low)";

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStatus(task.id);
  };

  const handleSubTaskClick = (e: React.MouseEvent, subId: string) => {
    e.stopPropagation();
    onToggleSubTask?.(task.id, subId);
  };

  return (
    <div
      className={`
        relative flex items-start gap-3 px-4 py-3 rounded-2xl cursor-pointer
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
      {/* Priority left accent */}
      {!isDone && (
        <div
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
          style={{ background: priorityColor }}
        />
      )}

      {/* Checkbox */}
      <button
        onClick={handleCheckboxClick}
        className="flex-shrink-0 mt-0.5 transition-transform duration-200 hover:scale-110 active:scale-90 z-10"
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
        {/* Title */}
        <h3
          className={`text-[14px] font-medium leading-snug truncate ${
            isDone ? "line-through" : ""
          }`}
          style={isDone ? { color: "var(--text-tertiary)" } : { color: "var(--text-primary)" }}
        >
          {task.title}
        </h3>

        {/* Sub-tasks inline progress */}
        {subTasks.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <ListChecks className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              {completedSubTasks}/{subTasks.length}
            </span>
            {/* Inline mini checkboxes */}
            <div className="flex gap-1 ml-1">
              {subTasks.slice(0, 3).map((sub) => (
                <button
                  key={sub.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSubTask?.(task.id, sub.id);
                  }}
                  className="w-3.5 h-3.5 rounded-sm flex items-center justify-center transition-colors"
                  style={{
                    background: sub.status === "done" ? "var(--status-success)" : "var(--surface-muted)",
                    border: `1px solid ${sub.status === "done" ? "var(--status-success)" : "var(--border)"}`,
                  }}
                  aria-label={sub.title}
                >
                  {sub.status === "done" && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
              {subTasks.length > 3 && (
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>+{subTasks.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {dueLabel && (
            <span
              className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-md"
              style={
                isOverdue
                  ? { background: "rgba(239,68,68,0.08)", color: "var(--status-danger)" }
                  : isToday(parseISO(task.dueDate!))
                  ? { background: "var(--brand-tint)", color: "var(--brand)" }
                  : { background: "var(--surface-muted)", color: "var(--text-tertiary)" }
              }
            >
              <Clock className="w-3 h-3" />
              {dueLabel}
            </span>
          )}
          {task.recurrence && (
            <span className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
              <Repeat className="w-3 h-3" />
            </span>
          )}
          {task.focusMinutes > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--surface-muted)", color: "var(--text-tertiary)" }}>
              <Timer className="w-3 h-3" />
              {task.focusMinutes}m
            </span>
          )}
          {task.attachments && task.attachments.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--surface-muted)", color: "var(--text-tertiary)" }}>
              <Paperclip className="w-3 h-3" />
              {task.attachments.length}
            </span>
          )}
          {task.tags.slice(0, 1).map((tag) => {
            const color = tagColors[tag] || "#3B82F6";
            return (
              <span
                key={tag}
                className="text-[11px] px-1.5 py-0.5 rounded-md"
                style={{
                  background: `${color}15`,
                  color: color,
                }}
              >
                {tag}
              </span>
            );
          })}
          {task.tags.length > 1 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--surface-muted)", color: "var(--text-tertiary)" }}>
              +{task.tags.length - 1}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
