"use client";

import { useMemo, type DragEvent } from "react";
import type { DaySlot } from "@/lib/types";
import type { SlotAssignment } from "@/lib/taskSlots";
import { formatTaskTimeRange } from "@/lib/taskSlots";
import { formatSlotRange } from "@/lib/daySlots";
import { SlotTaskRow } from "@/components/SlotTaskRow";
import { SLOT_EMPTY_COPY, SLOT_FOLDED_HINT, SLOT_UNFOLDED_HINT } from "@/lib/slotCopy";

interface DaySlotCardProps {
  slot: DaySlot;
  tasks: SlotAssignment[];
  isCurrent: boolean;        // 當下時刻是否落在這個槽
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleStatus?: (taskId: string) => void;
  onOpenDetail?: (taskId: string) => void;
  /** 拖曳或 Tap-to-Place 進行中 */
  isDropTargetActive?: boolean;
  /** 是否正有任務拖曳懸停於本槽 */
  isDragOver?: boolean;
  /** 點擊本槽以放入已選取任務 */
  onPlaceSelected?: () => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
  selectedTaskId?: string | null;
  onSelectTaskForMove?: (taskId: string) => void;
  onTaskDragStart?: (taskId: string, e: DragEvent<HTMLDivElement>) => void;
  onTaskDragEnd?: () => void;
}

/**
 * 單一節奏槽的外框。
 *
 * 設計紀律：
 *  - 平時點標題列做收合/展開（不改視圖、不改任務順序、不開 modal）
 *  - 當有任務處於 Tap-to-Place 選取態時，點本槽直接放入（不折疊）
 *  - 當下槽只加一個靜態小圓點（無 pulse、無動畫）
 *  - 空槽文案是邀請，不是指控（§5）
 */
export function DaySlotCard({
  slot,
  tasks,
  isCurrent,
  isCollapsed,
  onToggleCollapsed,
  onToggleStatus,
  onOpenDetail,
  isDropTargetActive = false,
  isDragOver = false,
  onPlaceSelected,
  onDragOver,
  onDragLeave,
  onDrop,
  selectedTaskId = null,
  onSelectTaskForMove,
  onTaskDragStart,
  onTaskDragEnd,
}: DaySlotCardProps) {
  const rows = useMemo(
    () =>
      tasks.map((assignment) => ({
        id: assignment.task.id,
        task: assignment.task,
        timeLabel: formatTaskTimeRange(assignment.task),
        isDone: assignment.task.status === "done",
      })),
    [tasks]
  );

  const canPlaceOnClick = Boolean(selectedTaskId && onPlaceSelected);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={canPlaceOnClick ? () => onPlaceSelected?.() : undefined}
      className={`rounded-xl px-3 py-2.5 transition-colors ${
        canPlaceOnClick ? "cursor-pointer" : ""
      }`}
      style={{
        background: isDragOver ? "var(--brand-tint)" : "var(--surface)",
        border: isDragOver
          ? "1.5px dashed var(--brand)"
          : isDropTargetActive
          ? "1.5px dashed color-mix(in srgb, var(--brand) 45%, transparent)"
          : "1px solid var(--border)",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          if (canPlaceOnClick) {
            e.stopPropagation();
            onPlaceSelected?.();
            return;
          }
          onToggleCollapsed();
        }}
        title={
          canPlaceOnClick
            ? `點擊將選取的任務放入${slot.label}`
            : isCollapsed
            ? SLOT_FOLDED_HINT
            : SLOT_UNFOLDED_HINT
        }
        aria-expanded={!isCollapsed}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {isCurrent && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: "var(--brand)" }}
              aria-hidden
            />
          )}
          <span
            className="text-[12px] font-medium truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {slot.label}
          </span>
          <span
            className="text-[11px] tabular-nums whitespace-nowrap"
            style={{ color: "var(--text-tertiary)" }}
          >
            · {formatSlotRange(slot)}
          </span>
        </span>

        {canPlaceOnClick ? (
          <span
            className="flex-shrink-0 text-[11px] font-medium rounded-full px-2 py-0.5"
            style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
          >
            放入{slot.label}
          </span>
        ) : rows.length > 0 ? (
          <span
            className="flex-shrink-0 text-[10px] font-semibold tabular-nums rounded-full px-1.5"
            style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
          >
            {rows.length}
          </span>
        ) : null}
      </button>

      {!isCollapsed && (
        <div className="mt-2 space-y-1">
          {rows.length > 0 ? (
            rows.map((row) => (
              <SlotTaskRow
                key={row.id}
                task={row.task}
                timeLabel={row.timeLabel}
                isDone={row.isDone}
                onToggleStatus={
                  onToggleStatus ? () => onToggleStatus(row.task.id) : undefined
                }
                onOpenDetail={
                  onOpenDetail ? () => onOpenDetail(row.task.id) : undefined
                }
                isSelectedForMove={selectedTaskId === row.task.id}
                onSelectForMove={
                  onSelectTaskForMove ? () => onSelectTaskForMove(row.task.id) : undefined
                }
                draggable={Boolean(onTaskDragStart)}
                onDragStart={
                  onTaskDragStart ? (e) => onTaskDragStart(row.task.id, e) : undefined
                }
                onDragEnd={onTaskDragEnd}
              />
            ))
          ) : (
            <p
              className="text-[12px] px-2"
              style={{ color: isDragOver ? "var(--brand)" : "var(--text-tertiary)" }}
            >
              {isDragOver ? `放開即可排入${slot.label}` : SLOT_EMPTY_COPY}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
