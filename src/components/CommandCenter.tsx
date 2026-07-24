"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useApp } from "@/lib/AppContext";
import type { Task } from "@/lib/types";

type DateCell = {
  date: string; // YYYY-MM-DD
  day: number;
  month: number; // 0-11
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

/** 未排程任務 = 沒 dueDate 且 status=todo、非封存、非子任務 */
function selectBacklog(tasks: Task[]): Task[] {
  return tasks.filter(
    (t) => !t.isArchived && t.status === "todo" && !t.dueDate && !t.parentId
  );
}

/** 已排程任務 = 有 dueDate */
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

export function CommandCenter() {
  const { tasks, updateTask, toggleTaskStatus } = useApp();
  const router = useRouter();

  const backlog = useMemo(() => selectBacklog(tasks), [tasks]);
  const scheduled = useMemo(() => selectScheduledMap(tasks), [tasks]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const anchorDate = useMemo(() => new Date(), []);
  const visibleMonth = useMemo(() => {
    const d = new Date(anchorDate);
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [anchorDate, monthOffset]);

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

    // 從 backlog 拖到日期 → 設定 dueDate
    const inBacklog = backlog.find((t) => t.id === activeTaskId);
    if (inBacklog) {
      updateTask(inBacklog.id, { dueDate: targetDate });
      return;
    }

    // 從排程區拖到另一日期 → 搬移 dueDate
    for (const date of Object.keys(scheduled)) {
      const found = scheduled[date].find((s) => s.taskId === activeTaskId);
      if (found && date !== targetDate) {
        updateTask(found.taskId, { dueDate: targetDate });
        return;
      }
    }
  };

  const handleToggleScheduledStatus = (taskId: string) => {
    // 透過 useApp.toggleTaskStatus 完成切換(status: todo ↔ done),同步層會持久化
    toggleTaskStatus(taskId);
  };

  const handleUnschedule = (taskId: string) => {
    // 移除 dueDate = 移回 backlog
    updateTask(taskId, { dueDate: undefined });
  };

  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-[70] overflow-y-auto bg-slate-50/95 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="軍機處：戰略排程模式"
    >
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-8">
              {/* ── Header：明顯的關閉/返回禪模式鈕 ── */}
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-4">
                <div className="flex flex-col">
                  <h1 className="text-balance text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
                    軍機處 · 戰略排程
                  </h1>
                  <p className="text-balance text-xs text-slate-400">
                    拖曳待命任務到任一日期 · 過去的破關會微微發光,未來模糊無壓
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* 月份切換 */}
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

                  {/* 返回禪模式 */}
                  <Link
                    href="/zen"
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    aria-label="返回禪模式"
                  >
                    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v3" />
                      <path d="M12 18v3" />
                      <path d="M5 12H2" />
                      <path d="M22 12h-3" />
                      <path d="m19.07 4.93-2.12 2.12" />
                      <path d="M7.05 16.95l-2.12 2.12" />
                      <path d="m19.07 19.07-2.12-2.12" />
                      <path d="M7.05 7.05 4.93 4.93" />
                    </svg>
                    <span>返回禪模式</span>
                  </Link>

                  {/* 關閉 */}
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3 py-2 text-sm font-medium text-slate-500 transition-all duration-200 ease-out hover:bg-white hover:text-slate-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    aria-label="關閉軍機處"
                  >
                    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              </header>

              {/* ── 內容區：左 backlog · 右 月視圖 ── */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
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
    </motion.div>
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
      {/* 週標題 */}
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

      {/* 日期格 */}
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

  // 視覺淡化策略
  const containerClass = cell.isFuture
    ? "bg-zinc-50/30 ring-zinc-200/30 text-zinc-400"
    : cell.isPast
    ? "bg-white/70 ring-slate-200/60"
    : "bg-white ring-slate-200"; // today

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
              ? "font-medium text-slate-600"
              : "text-slate-300"
          }`}
        >
          {cell.day}
        </span>
      </div>

      {/* 過去：暖色多巴胺膠囊 / 未來：模糊低調 / 今天：清晰 */}
      <ul className="flex flex-col gap-1">
        {tasks.map((task, idx) => {
          const warmPalette = ["bg-amber-50/80 text-amber-800 ring-amber-200/50", "bg-violet-50/80 text-violet-800 ring-violet-200/50"];
          const pastColor = warmPalette[idx % warmPalette.length];
          const futureColor = "bg-white/50 text-zinc-500 ring-zinc-200/40";
          const pendingPastColor = "bg-white/60 text-zinc-400 ring-zinc-200/40"; // 過去未完成 → 灰色,絕不紅色

          let chipClass = futureColor;
          if (cell.isPast) {
            chipClass = task.status === "done" ? pastColor : pendingPastColor;
          } else if (cell.isCurrentMonth && !cell.isFuture && !cell.isPast) {
            chipClass = "bg-slate-100 text-slate-700 ring-slate-200";
          }

          return (
            <li
              key={task.taskId}
              className={`group/chip flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] ring-1 transition-all duration-150 ${chipClass}`}
            >
              <button
                type="button"
                onClick={() => onToggleStatus(task.taskId)}
                className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/40"
                aria-label={task.status === "done" ? "標記為未完成" : "標記為完成"}
              >
                {task.status === "done" ? (
                  <svg aria-hidden width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <span className="block h-2 w-2 rounded-full bg-current opacity-30" />
                )}
              </button>
              <span className={`flex-1 truncate ${task.status === "done" ? "line-through opacity-70" : ""}`}>
                {task.title}
              </span>
              <button
                type="button"
                onClick={() => onUnschedule(task.taskId)}
                className="flex-shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-white/40 group-hover/chip:opacity-100"
                aria-label={`從 ${cell.date} 移除: ${task.title}`}
              >
                <svg aria-hidden width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default CommandCenter;
