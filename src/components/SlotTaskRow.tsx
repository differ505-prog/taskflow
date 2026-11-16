"use client";

import type { Task } from "@/lib/types";

interface SlotTaskRowProps {
  task: Task;
  timeLabel: string;      // 由 formatTaskTimeRange 產生，可能為 ""
  isDone: boolean;
  onToggleStatus?: () => void;
}

/**
 * 節奏槽內的任務列。
 *
 * 設計紀律（§5 情緒保護 / §5a 流程鎖定）：
 *  - 不畫 priority 圓點（do-now 是紅色 #D70015，會製造焦慮）
 *  - 整列不可點擊（Zen 沒有詳情面板，開 modal 會阻擋後續操作）
 *  - 唯一可點的是完成勾選圓圈
 */
export function SlotTaskRow({ task, timeLabel, isDone, onToggleStatus }: SlotTaskRowProps) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
      style={{ background: "var(--surface-muted)" }}
    >
      <button
        type="button"
        onClick={onToggleStatus}
        disabled={!onToggleStatus}
        aria-label={isDone ? `標記「${task.title}」為待辦` : `完成「${task.title}」`}
        className="flex-shrink-0 w-[16px] h-[16px] rounded-full transition-colors"
        style={
          isDone
            ? { background: "var(--status-success)" }
            : { border: "2px solid var(--border-hover)" }
        }
      >
        <span className="sr-only">{isDone ? "已完成" : "尚未完成"}</span>
      </button>

      <span
        className={`flex-1 min-w-0 truncate text-[13px] ${isDone ? "line-through" : ""}`}
        style={{ color: isDone ? "var(--text-tertiary)" : "var(--text-primary)" }}
        title={task.title}
      >
        {task.title}
      </span>

      {timeLabel && (
        <span
          className="flex-shrink-0 text-[11px] tabular-nums whitespace-nowrap"
          style={{ color: "var(--text-tertiary)" }}
        >
          {timeLabel}
        </span>
      )}
    </div>
  );
}
