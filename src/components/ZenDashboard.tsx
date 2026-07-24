"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ZenTask = {
  id: string;
  title: string;
};

type ZenDashboardProps = {
  /** 完成任務時呼叫 — 後續可接 SVG 粉碎動畫 hook (見下方預設行為) */
  onComplete?: (taskId: string) => void | Promise<void>;
  /** 初始假資料 (規格要求「先寫死」) */
  initialTasks?: ZenTask[];
};

const DEFAULT_TASKS: ZenTask[] = [
  { id: "t-1", title: "回覆 Wade 寄來的提案信" },
  { id: "t-2", title: "整理書桌，把昨天的雜物歸位" },
  { id: "t-3", title: "讀 30 頁《Deep Work》" },
  { id: "t-4", title: "寫一篇今天的學習筆記" },
  { id: "t-5", title: "練習 15 分鐘呼吸冥想" },
];

export default function ZenDashboard({
  onComplete,
  initialTasks = DEFAULT_TASKS,
}: ZenDashboardProps) {
  const [tasks, setTasks] = useState<ZenTask[]>(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const focus = tasks[0];
  const queue = tasks.slice(1);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    setTasks((items) => {
      const oldIndex = items.findIndex((t) => t.id === active.id);
      const newIndex = items.findIndex((t) => t.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleComplete = async (taskId: string) => {
    if (onComplete) {
      await onComplete(taskId);
    } else {
      // 預設行為：靜默移除 (後續可接 personalTaskSync 或 SVG 粉碎動畫)
      console.log(`[ZenDashboard] complete task: ${taskId}`);
    }
    setTasks((items) => items.filter((t) => t.id !== taskId));
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-12">
        <header className="text-balance text-sm font-medium uppercase tracking-widest text-slate-400">
          Zen Mode
        </header>

        {/* 焦點區 */}
        <section aria-labelledby="focus-heading" className="flex flex-col items-center gap-6">
          <h1 id="focus-heading" className="sr-only">
            當前焦點
          </h1>
          {focus ? (
            <FocusCard task={focus} onComplete={() => handleComplete(focus.id)} />
          ) : (
            <EmptyState />
          )}
        </section>

        {/* 排程區 */}
        {queue.length > 0 && (
          <section aria-labelledby="queue-heading" className="flex flex-col gap-4">
            <h2
              id="queue-heading"
              className="text-balance text-xs font-medium uppercase tracking-widest text-slate-400"
            >
              Upcoming Queue
            </h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={queue.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-2">
                  {queue.map((task) => (
                    <SortableQueueItem key={task.id} task={task} />
                  ))}
                </ul>
              </SortableContext>
              <DragOverlay>
                {activeTask ? <QueueItemCard task={activeTask} isDragging /> : null}
              </DragOverlay>
            </DndContext>
          </section>
        )}
      </div>
    </main>
  );
}

/* ============== 子元件 ============== */

function FocusCard({ task, onComplete }: { task: ZenTask; onComplete: () => void }) {
  return (
    <article
      className="group relative w-full rounded-3xl bg-white p-12 shadow-sm ring-1 ring-slate-200/60 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
      aria-label={`當前焦點任務: ${task.title}`}
    >
      <p className="text-balance text-2xl font-medium leading-snug text-slate-800 sm:text-3xl">
        {task.title}
      </p>
      <button
        type="button"
        onClick={onComplete}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-800 px-6 py-3 text-sm font-medium text-slate-50 transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-slate-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        <span aria-hidden>粉碎</span>
        <span className="sr-only">完成任務</span>
      </button>
    </article>
  );
}

function SortableQueueItem({ task }: { task: ZenTask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-slate-200/40 transition-opacity duration-200 ${
        isDragging ? "opacity-30" : "opacity-100"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`拖曳任務: ${task.title}`}
        className="flex h-8 w-6 cursor-grab touch-none items-center justify-center text-slate-300 transition-colors hover:text-slate-500 active:cursor-grabbing"
      >
        <GripIcon />
      </button>
      <QueueItemCard task={task} />
    </li>
  );
}

function QueueItemCard({ task, isDragging = false }: { task: ZenTask; isDragging?: boolean }) {
  return (
    <span
      className={`flex-1 truncate text-sm text-slate-500 ${isDragging ? "rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200" : ""}`}
    >
      {task.title}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-12 py-16 text-center shadow-sm ring-1 ring-slate-200/60">
      <svg
        aria-hidden
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-300"
      >
        <path d="M12 2v20" />
        <path d="M5 9c2 0 4-1 4-4" />
        <path d="M19 9c-2 0-4-1-4-4" />
        <path d="M5 15c2 0 4 1 4 4" />
        <path d="M19 15c-2 0-4 1-4 4" />
      </svg>
      <p className="text-balance text-base font-medium text-slate-600">所有任務都完成了</p>
      <p className="text-balance text-sm text-slate-400">慢呼吸一下，準備好再出發</p>
    </div>
  );
}

function GripIcon() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </svg>
  );
}
