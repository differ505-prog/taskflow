"use client";

import { Task } from "@/lib/types";
import {
  CheckCircle2, Circle,
} from "lucide-react";

interface TaskListItemProps {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
  onToggleStatus: (id: string) => void;
  onToggleSubTask?: (taskId: string, subId: string) => void;
}

export function TaskListItem({
  task,
  isSelected,
  onClick,
  onToggleStatus,
  onToggleSubTask,
}: TaskListItemProps) {
  const subTasks = task.subTasks || [];
  const isDone = task.status === "done";

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStatus(task.id);
  };

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-2xl cursor-pointer
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

        {/* Sub-task titles with quick-check */}
        {subTasks.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-1">
            {subTasks.map((sub) => (
              <li
                key={sub.id}
                className="flex items-center gap-2 group/sub"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSubTask?.(task.id, sub.id);
                  }}
                  className="flex-shrink-0 transition-transform duration-200 hover:scale-110 active:scale-90"
                  aria-label={sub.status === "done" ? "標記未完成" : "標記完成"}
                >
                  {sub.status === "done" ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
                  ) : (
                    <Circle className="w-4 h-4 text-[var(--text-tertiary)] group-hover/sub:text-[var(--text-secondary)]" />
                  )}
                </button>
                <span
                  className="text-[12px] truncate flex-1"
                  style={{
                    color: sub.status === "done" ? "var(--text-tertiary)" : "var(--text-secondary)",
                    textDecoration: sub.status === "done" ? "line-through" : "none",
                  }}
                >
                  {sub.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
