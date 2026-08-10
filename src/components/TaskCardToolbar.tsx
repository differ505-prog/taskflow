"use client";

import { Trash2, Repeat, Timer } from "lucide-react";
import { TaskQuickActions } from "./TaskQuickActions";
import { FocusNowButton } from "./FocusNowButton";
import type { Task, Priority } from "@/lib/types";

interface TaskCardToolbarProps {
  task: Task;
  onDelete: () => void;
  onArchive?: () => void;
  onEdit: () => void;
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
  return (
    <>
      {/* §26 「一鍵入禪 (Focus NOW)」:極簡閃電按鈕 */}
      {onFocusNow && task.status !== "done" && (
        <FocusNowButton onFocusNow={() => onFocusNow(task.id)} />
      )}
      <button
        onClick={onDelete}
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
      {/* 即使唯讀也顯示旗子視覺（click handler 留空代表不能編輯） */}
      <TaskQuickActions
        task={task}
        onUpdatePriority={onUpdatePriority ? (p) => onUpdatePriority(task.id, p) : () => {}}
        onUpdateTags={onUpdateTags ? (tags) => onUpdateTags(task.id, tags) : () => {}}
        allTags={allTags}
        readOnly={!onUpdatePriority && !onUpdateTags}
      />
    </>
  );
}
