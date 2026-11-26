"use client";

import type { DragEvent } from "react";
import type { Task } from "@/lib/types";

interface SlotTaskRowProps {
  task: Task;
  timeLabel: string;      // 由 formatTaskTimeRange 產生，可能為 ""
  isDone: boolean;
  onToggleStatus?: () => void;
  /** Tap-to-Place：目前是否被選取等待放入時段槽 */
  isSelectedForMove?: boolean;
  /** 點擊標題區切換選取態（不開 modal，只用於歸槽放置） */
  onSelectForMove?: () => void;
  /** 桌面拖曳支援 */
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}

/**
 * 節奏槽內的任務列。
 *
 * 設計紀律（§5 情緒保護 / §5a 流程鎖定）：
 *  - 不畫 priority 圓點（do-now 是紅色 #D70015，會製造焦慮）
 *  - 不開 modal（點標題僅用於輕選取歸槽，不阻擋後續操作）
 *  - 左側圓圈永遠保留給完成勾選
 */
export function SlotTaskRow({
  task,
  timeLabel,
  isDone,
  onToggleStatus,
  isSelectedForMove = false,
  onSelectForMove,
  draggable = false,
  onDragStart,
  onDragEnd,
}: SlotTaskRowProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      } ${
        isSelectedForMove
          ? ""
          : "bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)]"
      }`}
      style={
        isSelectedForMove
          ? {
              background: "var(--brand-tint)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--brand) 45%, transparent)",
            }
          : undefined
      }
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleStatus?.();
        }}
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

      {onSelectForMove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectForMove();
          }}
          aria-pressed={isSelectedForMove}
          className={`flex-1 min-w-0 text-left truncate text-[13px] ${isDone ? "line-through" : ""}`}
          style={{
            color: isSelectedForMove
              ? "var(--brand)"
              : isDone
              ? "var(--text-tertiary)"
              : "var(--text-primary)",
            fontWeight: isSelectedForMove ? 500 : undefined,
          }}
          title={isSelectedForMove ? "點擊取消選取，或點擊上方任一時段放入" : `${task.title}（點擊或拖曳可放入時段）`}
        >
          {task.title}
        </button>
      ) : (
        <span
          className={`flex-1 min-w-0 truncate text-[13px] ${isDone ? "line-through" : ""}`}
          style={{ color: isDone ? "var(--text-tertiary)" : "var(--text-primary)" }}
          title={task.title}
        >
          {task.title}
        </span>
      )}

      {isSelectedForMove ? (
        <span
          className="flex-shrink-0 text-[10px] font-medium whitespace-nowrap"
          style={{ color: "var(--brand)" }}
        >
          點時段放入
        </span>
      ) : timeLabel ? (
        <span
          className="flex-shrink-0 text-[11px] tabular-nums whitespace-nowrap"
          style={{ color: "var(--text-tertiary)" }}
        >
          {timeLabel}
        </span>
      ) : null}
    </div>
  );
}
