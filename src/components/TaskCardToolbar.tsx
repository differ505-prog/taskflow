"use client";

import { Trash2, Repeat, Timer } from "lucide-react";
import { TaskQuickActions } from "./TaskQuickActions";
import { FocusNowButton } from "./FocusNowButton";
import type { Task, Priority } from "@/lib/types";

interface TaskCardToolbarProps {
  task: Task;
  onDelete: (e: React.MouseEvent) => void;
  onArchive?: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
  onUpdatePriority?: (p: Priority) => void;
  onUpdateTags?: (tags: string[]) => void;
  onFocusNow?: (taskId: string) => void;
  allTags?: string[];
}

export function TaskCardToolbar({
  task,
  onDelete,
  onArchive,
  onEdit,
  onUpdatePriority,
  onUpdateTags,
  onFocusNow,
  allTags = [],
}: TaskCardToolbarProps) {
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(e);
  };
  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive?.(e);
  };
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(e);
  };
  return (
    <>
      {/* §26 「一鍵入禪 (Focus NOW)」 */}
      {onFocusNow && task.status !== "done" && (
        <FocusNowButton onFocusNow={() => onFocusNow(task.id)} />
      )}
      <button
        onClick={handleDeleteClick}
        className="p-1 rounded-lg hover:bg-red-50 transition-all duration-150 active:scale-90"
        style={{ color: "var(--text-tertiary)" }}
        aria-label="刪除任務"
        title="刪除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      {task.recurrence && (
        <span className="p-1 rounded-lg" style={{ color: "var(--brand)" }} title="重複任務">
          <Repeat className="w-3.5 h-3.5" />
        </span>
      )}
      {task.focusMinutes > 0 && (
        <span className="flex items-center gap-0.5 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          <Timer className="w-3 h-3" />
          {task.focusMinutes}m
        </span>
      )}
      <TaskQuickActions
        task={task}
        onUpdatePriority={onUpdatePriority ?? (() => {})}
        onUpdateTags={onUpdateTags ?? (() => {})}
        allTags={allTags}
        readOnly={!onUpdatePriority && !onUpdateTags}
      />
    </>
  );
}
