"use client";

import { useMemo } from "react";
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
}

/**
 * 單一節奏槽的外框。
 *
 * 設計紀律：
 *  - 點標題列只做收合/展開（不改視圖、不改任務順序、不開 modal）
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

  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        title={isCollapsed ? SLOT_FOLDED_HINT : SLOT_UNFOLDED_HINT}
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

        {rows.length > 0 && (
          <span
            className="flex-shrink-0 text-[10px] font-semibold tabular-nums rounded-full px-1.5"
            style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
          >
            {rows.length}
          </span>
        )}
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
              />
            ))
          ) : (
            <p className="text-[12px] px-2" style={{ color: "var(--text-tertiary)" }}>
              {SLOT_EMPTY_COPY}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
