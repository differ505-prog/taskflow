"use client";

import { useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { useRhythmSettings } from "@/hooks/useRhythmSettings";
import { buildDaySlots, findSlotIndex } from "@/lib/daySlots";
import { formatTaskTimeRange, groupTasksBySlot, groupUnassignedTasks } from "@/lib/taskSlots";
import { DaySlotCard } from "@/components/DaySlotCard";
import { SlotTaskRow } from "@/components/SlotTaskRow";
import { SLOT_GRID_TITLE, SLOT_UNASSIGNED_COPY } from "@/lib/slotCopy";

interface DaySlotGridProps {
  tasks: Task[];             // 已篩選為「今天」且未完成的任務
  onToggleStatus?: (taskId: string) => void;
}

/**
 * 一天的節奏槽網格。
 *
 * 槽位邊界由作息錨點（起床 / 熄屏）自動推導，任務依 dueTime 落進對應槽。
 * 設計紀律：
 *  - 不開 modal、不改視圖、不改 order（§5a）
 *  - 不做「現在要做什麼」的自動跳轉，當下槽只加一個靜態小圓點
 */
export function DaySlotGrid({ tasks, onToggleStatus }: DaySlotGridProps) {
  const { settings, isHydrated } = useRhythmSettings();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const slots = useMemo(
    () => (isHydrated ? buildDaySlots(settings) : []),
    [isHydrated, settings]
  );

  const assignments = useMemo(() => groupTasksBySlot(tasks, slots), [tasks, slots]);
  const unassigned = useMemo(() => groupUnassignedTasks(tasks, slots), [tasks, slots]);

  const currentIndex = useMemo(() => {
    if (slots.length === 0) return -1;
    const now = new Date();
    return findSlotIndex(slots, now.getHours() * 60 + now.getMinutes());
  }, [slots]);

  // 沒有任務時整段不渲染（讓版面保持乾淨）
  if (tasks.length === 0 || slots.length === 0) return null;

  return (
    <section aria-label={SLOT_GRID_TITLE} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {SLOT_GRID_TITLE}
        </span>
      </div>

      {slots.map((slot, i) => (
        <DaySlotCard
          key={slot.id}
          slot={slot}
          tasks={assignments[i] ?? []}
          isCurrent={i === currentIndex}
          isCollapsed={collapsed[slot.id] ?? false}
          onToggleCollapsed={() =>
            setCollapsed((prev) => ({ ...prev, [slot.id]: !(prev[slot.id] ?? false) }))
          }
          onToggleStatus={onToggleStatus}
        />
      ))}

      {unassigned.length > 0 && (
        <div
          className="px-3 py-2.5 rounded-xl space-y-1"
          style={{ background: "var(--surface-muted)" }}
        >
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {SLOT_UNASSIGNED_COPY}
          </span>
          {unassigned.map((task) => (
            <SlotTaskRow
              key={task.id}
              task={task}
              timeLabel={formatTaskTimeRange(task)}
              isDone={task.status === "done"}
              onToggleStatus={
                onToggleStatus ? () => onToggleStatus(task.id) : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
