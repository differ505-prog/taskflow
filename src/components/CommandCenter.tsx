"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useApp } from "@/lib/AppContext";
import type { Task } from "@/lib/types";

/**
 * Command Center 戰略排程視圖
 *
 * 重構狀態:已抽出 useMonthGrid hook 但 plan 模式拖放未整合(@dnd-kit vs HTML5 不相容)
 * 當前仍用自寫網格 + 拖放,待下一步決策後修齊
 */
type DateCell = {
  date: string;
  day: number;
  month: number;
  year: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isCurrentMonth: boolean;
};

type ScheduledTask = {
  taskId: string;
  title: string;
  status: "done" | "pending";
};

function selectBacklog(tasks: Task[]): Task[] {
  return tasks.filter(
    (t) => !t.isArchived && t.status === "todo" && !t.dueDate && !t.parentId
  );
}

function selectScheduledMap(tasks: Task[]): Record<string, ScheduledTask[]> {
  const map: Record<string, ScheduledTask[]> = {};
  for (const t of tasks) {
    if (!t.dueDate || t.isArchived || t.parentId) continue;
    if (!map[t.dueDate]) map[t.dueDate] = [];
    map[t.dueDate].push({
      taskId: t.id,
      title: t.title,
      status: t.status === "done" ? "done" : "pending",
    });
  }
  return map;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildMonthCells(anchor: Date): DateCell[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = firstOfMonth.getDay();
  const start = new Date(year, month, 1 - firstWeekday);

  const todayKey = toDateKey(new Date());

  const cells: DateCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = toDateKey(d);
    cells.push({
      date: key,
      day: d.getDate(),
      month: d.getMonth(),
      year: d.getFullYear(),
      isToday: key === todayKey,
      isPast: key < todayKey,
      isFuture: key > todayKey,
      isCurrentMonth: d.getMonth() === month,
    });
  }
  return cells;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export function CommandCenter({ onClose }: { onClose: () => void }) {
  const { tasks, sharedLists, updateTask, updateSharedTask, toggleTaskStatus } = useApp();
  const allTasks = useMemo(() => {
    const sharedTasks = Object.values(sharedLists || {}).flatMap((listData) => listData.tasks);
    return [...tasks, ...sharedTasks];
  }, [tasks, sharedLists]);

  const backlog = useMemo(() => selectBacklog(tasks), [tasks]);
  const scheduled = useMemo(() => selectScheduledMap(tasks), [tasks]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const visibleMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const cells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    const inBacklog = backlog.find((t) => t.id === activeId);
    if (inBacklog) return { id: inBacklog.id, title: inBacklog.title, source: "backlog" as const };
    for (const date of Object.keys(scheduled)) {
      const found = scheduled[date].find((s) => s.taskId === activeId);
      if (found) {
        return { id: found.taskId, title: found.title, source: "scheduled" as const, date };
      }
    }
    return null;
  }, [activeId, backlog, scheduled]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const targetDate = over.id as string;
    const activeTaskId = active.id as string;

    const inBacklog = backlog.find((t) => t.id === activeTaskId);
    if (inBacklog) {
      updateTask(inBacklog.id, { dueDate: targetDate });
      return;
    }

    for (const date of Object.keys(scheduled)) {
      const found = scheduled[date].find((s) => s.taskId === activeTaskId);
      if (found && date !== targetDate) {
        updateTask(found.taskId, { dueDate: targetDate });
        return;
      }
    }
  };

  const handleToggleScheduledStatus = (taskId: string) => {
    toggleTaskStatus(taskId);
  };

  const handleUnschedule = (taskId: string) => {
    updateTask(taskId, { dueDate: undefined });
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-6 bg-slate-50/95 p-4 sm:p-6"
      role="region"
      aria-label="Command Center：戰略排程模式"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-4">
          <div className="flex flex-col">
            <h1 className="text-balance text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
              Command Center
            </h1>
            <p className="text-balance text-xs text-slate-400">
              拖曳待命任務到任一日期 · 過去的破關會微微發光,未來模糊無壓
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 ring-1 ring-slate-200/60">
              <button
                type="button"
                onClick={() => setMonthOffset((v) => v - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 active:scale-95"
                aria-label="上個月"
              >
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <span className="min-w-[88px] text-center text-sm font-medium text-slate-600">
                {visibleMonth.getFullYear()} 年 {visibleMonth.getMonth() + 1} 月
              </span>
              <button
                type="button"
                onClick={() => setMonthOffset((v) => v + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 active:scale-95"
                aria-label="下個月"
              >
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMonthOffset(0)}
              className="flex h-8 items-center gap-1 rounded-full bg-white/70 px-3 text-[12px] font-medium text-slate-600 ring-1 ring-slate-200/60 transition-all hover:bg-white hover:text-slate-800 active:scale-95"
              aria-label="跳回今天"
            >
              今天
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              aria-label="返回收件箱"
            >
              <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>返回收件箱</span>
            </button>
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
            <BacklogPanel tasks={backlog} />
            <CalendarGrid
              cells={cells}
              scheduled={scheduled}
              onToggleStatus={handleToggleScheduledStatus}
              onUnschedule={handleUnschedule}
            />
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-xl ring-1 ring-slate-300">
                {activeTask.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

/* ============== 子元件 ============== */

function BacklogPanel({ tasks }: { tasks: Task[] }) {
  return (
    <aside
      className="flex flex-col gap-3 rounded-2xl bg-white/60 p-4 ring-1 ring-slate-200/60 backdrop-blur"
      aria-label="待命任務"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-balance text-xs font-semibold uppercase tracking-widest text-slate-400">
          Backlog
        </h2>
        <span className="text-[11px] text-slate-400">{tasks.length} 個待命</span>
      </div>
      <p className="text-balance text-[11px] leading-relaxed text-slate-400">
        把任務拖到右邊任一日期即可排程
      </p>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200/60 bg-slate-50/60 px-3 py-6 text-center">
          <p className="text-balance text-xs text-slate-400">所有任務都已排程 · 享受清晰</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <BacklogItem key={task.id} task={task} />
          ))}
        </ul>
      )}
    </aside>
  );
}

function BacklogItem({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      className={`group flex cursor-grab touch-none items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200/60 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-40" : "opacity-100"
      }`}
      {...attributes}
      {...listeners}
    >
      <svg
        aria-hidden
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-300 transition-colors group-hover:text-slate-500"
      >
        <circle cx="9" cy="6" r="1" fill="currentColor" />
        <circle cx="9" cy="12" r="1" fill="currentColor" />
        <circle cx="9" cy="18" r="1" fill="currentColor" />
        <circle cx="15" cy="6" r="1" fill="currentColor" />
        <circle cx="15" cy="12" r="1" fill="currentColor" />
        <circle cx="15" cy="18" r="1" fill="currentColor" />
      </svg>
      <span className="flex-1 truncate">{task.title}</span>
    </li>
  );
}

function CalendarGrid({
  cells,
  scheduled,
  onToggleStatus,
  onUnschedule,
}: {
  cells: DateCell[];
  scheduled: Record<string, ScheduledTask[]>;
  onToggleStatus: (taskId: string) => void;
  onUnschedule: (taskId: string) => void;
}) {
  return (
    <section aria-label="月曆排程" className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1.5 px-0.5">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[11px] font-medium uppercase tracking-wider text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => (
          <DateCellView
            key={cell.date}
            cell={cell}
            tasks={scheduled[cell.date] ?? []}
            onToggleStatus={onToggleStatus}
            onUnschedule={onUnschedule}
          />
        ))}
      </div>
    </section>
  );
}

function DateCellView({
  cell,
  tasks,
  onToggleStatus,
  onUnschedule,
}: {
  cell: DateCell;
  tasks: ScheduledTask[];
  onToggleStatus: (taskId: string) => void;
  onUnschedule: (taskId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: cell.date });

  const containerClass = cell.isFuture
    ? "bg-zinc-50/30 ring-zinc-200/30 text-zinc-400"
    : cell.isPast
    ? "bg-white/70 ring-slate-200/60"
    : "bg-white ring-slate-200";

  const todayHighlight = cell.isToday ? "ring-2 ring-slate-700 shadow-sm" : "";
  const nonCurrentMonth = !cell.isCurrentMonth ? "opacity-40" : "";

  return (
    <div
      ref={setNodeRef}
      className={`group relative flex min-h-[88px] flex-col gap-1 rounded-xl p-2 ring-1 transition-all duration-200 ease-out ${containerClass} ${todayHighlight} ${nonCurrentMonth} ${
        isOver ? "scale-[1.02] bg-slate-100 ring-slate-400 shadow-md" : ""
      }`}
      aria-label={`${cell.date}${cell.isToday ? " (今天)" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${
            cell.isToday
              ? "font-semibold text-slate-800"
              : cell.isFuture
              ? "text-zinc-400"
              : cell.isCurrentMonth
              ? "text-slate-700"
              : "text-slate-400"
          }`}
        >
          {cell.day}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {tasks.map((task) => (
          <div
            key={task.taskId}
            className={`group/task flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] ${
              task.status === "done"
                ? "bg-amber-50/60 text-slate-400 line-through"
                : "bg-slate-100/80 text-slate-700"
            }`}
            title={task.title}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(task.taskId);
              }}
              className="flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full border border-slate-300 transition-colors hover:border-slate-500"
              aria-label={task.status === "done" ? "標記為未完成" : "標記為完成"}
            >
              {task.status === "done" && (
                <svg aria-hidden width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
            <span className="flex-1 truncate">{task.title}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUnschedule(task.taskId);
              }}
              className="flex-shrink-0 text-slate-300 opacity-0 transition-opacity hover:text-slate-500 group-hover/task:opacity-100"
              aria-label="取消排程"
              title="取消排程"
            >
              <svg aria-hidden width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        ))}
        {tasks.length === 0 && cell.isPast && (
          <span className="text-[10px] text-amber-500/60">✦</span>
        )}
      </div>
    </div>
  );
}
