"use client";

import { Circle, CheckCircle2, Trash } from "lucide-react";
import type { SubTask } from "@/lib/types";

interface SubTaskItemProps {
  sub: SubTask;
  onToggle: () => void;
  onDelete: () => void;
}

export function SubTaskItem({ sub, onToggle, onDelete }: SubTaskItemProps) {
  const isDone = sub.status === "done";
  return (
    <div className="flex items-center gap-2.5 py-1.5 group/SubTask">
      <button
        onClick={onToggle}
        className="flex-shrink-0 transition-transform hover:scale-110 active:scale-90"
        aria-label={isDone ? "標記未完成" : "標記完成"}
      >
        {isDone ? (
          <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
        ) : (
          <Circle className="w-4 h-4 text-[var(--text-tertiary)]" />
        )}
      </button>
      <span
        className={`flex-1 text-[13px] leading-snug ${isDone ? "line-through opacity-50" : ""}`}
        style={{ color: isDone ? "var(--text-tertiary)" : "var(--text-secondary)" }}
      >
        {sub.title}
      </span>
      <button
        onClick={onDelete}
        className="flex-shrink-0 opacity-0 group-hover/SubTask:opacity-100 transition-opacity p-1 rounded hover:bg-red-50"
        style={{ color: "var(--text-tertiary)" }}
        aria-label="刪除子任務"
      >
        <Trash className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
