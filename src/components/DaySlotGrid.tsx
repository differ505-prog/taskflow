"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { toast } from "sonner";
import type { DaySlot, Task } from "@/lib/types";
import { useRhythmSettings } from "@/hooks/useRhythmSettings";
import { buildDaySlots, findSlotIndex } from "@/lib/daySlots";
import {
  formatMinutesToHHmm,
  formatTaskTimeRange,
  groupTasksBySlot,
  groupUnassignedTasks,
} from "@/lib/taskSlots";
import { DaySlotCard } from "@/components/DaySlotCard";
import { SlotTaskRow } from "@/components/SlotTaskRow";
import { SLOT_GRID_TITLE, SLOT_UNASSIGNED_COPY } from "@/lib/slotCopy";
import { haptic } from "@/lib/haptics";

interface DaySlotGridProps {
  tasks: Task[];             // 已篩選為「今天」且未完成的任務
  onToggleStatus?: (taskId: string) => void;
  /** 將任務放入時段槽（dueTime = HH:mm）或移回這段之外（dueTime = undefined） */
  onAssignTaskTime?: (taskId: string, dueTime: string | undefined) => void;
  /** 按需開啟任務詳情與附件 */
  onOpenDetail?: (taskId: string) => void;
}

const DRAG_DATA_KEY = "text/x-vibelist-slot-task-id";

/**
 * 一天的節奏槽網格。
 *
 * 槽位邊界由作息錨點（起床 / 熄屏）自動推導，任務依 dueTime 落進對應槽。
 * 支援方案 1：桌面原生拖曳 ＋ 全平台點選放置（Tap-to-Place），零額外按鈕、不開 modal。
 * 設計紀律：
 *  - 不開 modal、不改視圖、不改 order（§5a）
 *  - 不做「現在要做什麼」的自動跳轉，當下槽只加一個靜態小圓點
 */
export function DaySlotGrid({ tasks, onToggleStatus, onAssignTaskTime, onOpenDetail }: DaySlotGridProps) {
  const { settings, isHydrated } = useRhythmSettings();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

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

  // 若選取的任務已完成或離開今日清單，自動清除選取態
  const activeSelectedId = useMemo(
    () => (selectedTaskId && tasks.some((t) => t.id === selectedTaskId) ? selectedTaskId : null),
    [selectedTaskId, tasks]
  );

  // Esc 鍵取消 Tap-to-Place 選取態
  useEffect(() => {
    if (!activeSelectedId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTaskId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSelectedId]);

  const moveTaskToSlot = useCallback(
    (taskId: string, targetSlot: DaySlot | null) => {
      if (!onAssignTaskTime) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const prevDueTime = task.dueTime;
      const nextDueTime = targetSlot ? formatMinutesToHHmm(targetSlot.startMin) : undefined;

      setSelectedTaskId(null);
      setDraggingTaskId(null);
      setDragOverTarget(null);

      if (prevDueTime === nextDueTime) return;

      onAssignTaskTime(taskId, nextDueTime);
      haptic("selection");

      const message = targetSlot
        ? `已放入「${targetSlot.label}」（${nextDueTime}）`
        : `已移回「${SLOT_UNASSIGNED_COPY}」`;

      toast.success(message, {
        duration: 5000,
        action: {
          label: "復原",
          onClick: () => onAssignTaskTime(taskId, prevDueTime),
        },
      });
    },
    [onAssignTaskTime, tasks]
  );

  const handleSelectTaskForMove = useCallback(
    (taskId: string) => {
      if (!onAssignTaskTime) return;
      setSelectedTaskId((prev) => (prev === taskId ? null : taskId));
      haptic("selection");
    },
    [onAssignTaskTime]
  );

  const handleTaskDragStart = useCallback(
    (taskId: string, e: DragEvent<HTMLDivElement>) => {
      if (!onAssignTaskTime) return;
      setDraggingTaskId(taskId);
      setSelectedTaskId(null);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(DRAG_DATA_KEY, taskId);
      e.dataTransfer.setData("text/plain", taskId);
    },
    [onAssignTaskTime]
  );

  const handleTaskDragEnd = useCallback(() => {
    setDraggingTaskId(null);
    setDragOverTarget(null);
  }, []);

  const readDraggedTaskId = (e: DragEvent<HTMLDivElement>): string | null => {
    return (
      e.dataTransfer.getData(DRAG_DATA_KEY) ||
      e.dataTransfer.getData("text/plain") ||
      draggingTaskId
    );
  };

  // 沒有任務時整段不渲染（讓版面保持乾淨）
  if (tasks.length === 0 || slots.length === 0) return null;

  const isInteractive = Boolean(onAssignTaskTime);
  const isDropModeActive = isInteractive && Boolean(activeSelectedId || draggingTaskId);
  const selectedTaskHasTime = Boolean(
    activeSelectedId && tasks.find((t) => t.id === activeSelectedId)?.dueTime
  );
  const showUnassignedBox =
    unassigned.length > 0 || (isDropModeActive && (selectedTaskHasTime || Boolean(draggingTaskId)));

  return (
    <section aria-label={SLOT_GRID_TITLE} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {SLOT_GRID_TITLE}
        </span>
        {activeSelectedId && (
          <button
            type="button"
            onClick={() => setSelectedTaskId(null)}
            className="text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--brand)" }}
          >
            點任一時段放入 · 取消
          </button>
        )}
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
          onOpenDetail={onOpenDetail}
          isDropTargetActive={isDropModeActive}
          isDragOver={dragOverTarget === slot.id}
          onPlaceSelected={
            activeSelectedId ? () => moveTaskToSlot(activeSelectedId, slot) : undefined
          }
          onDragOver={
            isInteractive
              ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverTarget !== slot.id) setDragOverTarget(slot.id);
                }
              : undefined
          }
          onDragLeave={
            isInteractive
              ? () => {
                  if (dragOverTarget === slot.id) setDragOverTarget(null);
                }
              : undefined
          }
          onDrop={
            isInteractive
              ? (e) => {
                  e.preventDefault();
                  const taskId = readDraggedTaskId(e);
                  if (taskId) moveTaskToSlot(taskId, slot);
                }
              : undefined
          }
          selectedTaskId={activeSelectedId}
          onSelectTaskForMove={isInteractive ? handleSelectTaskForMove : undefined}
          onTaskDragStart={isInteractive ? handleTaskDragStart : undefined}
          onTaskDragEnd={isInteractive ? handleTaskDragEnd : undefined}
        />
      ))}

      {showUnassignedBox && (
        <div
          onDragOver={
            isInteractive
              ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverTarget !== "unassigned") setDragOverTarget("unassigned");
                }
              : undefined
          }
          onDragLeave={
            isInteractive
              ? () => {
                  if (dragOverTarget === "unassigned") setDragOverTarget(null);
                }
              : undefined
          }
          onDrop={
            isInteractive
              ? (e) => {
                  e.preventDefault();
                  const taskId = readDraggedTaskId(e);
                  if (taskId) moveTaskToSlot(taskId, null);
                }
              : undefined
          }
          onClick={
            activeSelectedId && selectedTaskHasTime
              ? () => moveTaskToSlot(activeSelectedId, null)
              : undefined
          }
          className={`px-3 py-2.5 rounded-xl space-y-1 transition-colors ${
            activeSelectedId && selectedTaskHasTime ? "cursor-pointer" : ""
          }`}
          style={{
            background:
              dragOverTarget === "unassigned" ? "var(--brand-tint)" : "var(--surface-muted)",
            border:
              dragOverTarget === "unassigned"
                ? "1.5px dashed var(--brand)"
                : activeSelectedId && selectedTaskHasTime
                ? "1.5px dashed color-mix(in srgb, var(--brand) 45%, transparent)"
                : "1px solid transparent",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              {SLOT_UNASSIGNED_COPY}
            </span>
            {activeSelectedId && selectedTaskHasTime && (
              <span
                className="text-[11px] font-medium"
                style={{ color: "var(--brand)" }}
              >
                點此移回這段之外
              </span>
            )}
          </div>
          {unassigned.map((task) => (
            <SlotTaskRow
              key={task.id}
              task={task}
              timeLabel={formatTaskTimeRange(task)}
              isDone={task.status === "done"}
              onToggleStatus={
                onToggleStatus ? () => onToggleStatus(task.id) : undefined
              }
              onOpenDetail={
                onOpenDetail ? () => onOpenDetail(task.id) : undefined
              }
              isSelectedForMove={activeSelectedId === task.id}
              onSelectForMove={
                isInteractive ? () => handleSelectTaskForMove(task.id) : undefined
              }
              draggable={isInteractive}
              onDragStart={
                isInteractive ? (e) => handleTaskDragStart(task.id, e) : undefined
              }
              onDragEnd={isInteractive ? handleTaskDragEnd : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
