"use client";

import type { DragEvent } from "react";
import { FileText, Paperclip } from "lucide-react";
import type { Task } from "@/lib/types";

interface SlotTaskRowProps {
  task: Task;
  timeLabel: string;      // 由 formatTaskTimeRange 產生，可能為 ""
  isDone: boolean;
  onToggleStatus?: () => void;
  /** 開啟任務詳情與附件抽屜（獨立右側小入口，不影響標題點選歸槽） */
  onOpenDetail?: () => void;
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
 *  - 左側圓圈永遠保留給完成勾選；標題保留給 Tap-to-Place 歸槽；右側微淡圖示可按需展開詳情與附件
 */
export function SlotTaskRow({
  task,
  timeLabel,
  isDone,
  onToggleStatus,
  onOpenDetail,
  isSelectedForMove = false,
  onSelectForMove,
  draggable = false,
  onDragStart,
  onDragEnd,
}: SlotTaskRowProps) {
  const attachmentCount = task.attachments?.length ?? 0;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group/slotrow flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
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

      {onOpenDetail && !isSelectedForMove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
          aria-label={`查看「${task.title}」詳情與附件`}
          title={attachmentCount > 0 ? `${attachmentCount} 個附件 · 點擊查看詳情` : "查看詳情與附件"}
          className={`flex-shrink-0 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] transition-opacity hover:bg-black/5 ${
            attachmentCount > 0
              ? "opacity-85"
              : "opacity-45 sm:opacity-0 sm:group-hover/slotrow:opacity-70 sm:focus-visible:opacity-100"
          }`}
          style={{ color: attachmentCount > 0 ? "var(--brand)" : "var(--text-tertiary)" }}
        >
          {attachmentCount > 0 ? (
            <>
              <Paperclip className="w-3 h-3" aria-hidden="true" />
              <span className="tabular-nums font-medium">{attachmentCount}</span>
            </>
          ) : (
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
