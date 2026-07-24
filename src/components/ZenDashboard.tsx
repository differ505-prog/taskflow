"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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
import { SlashOverlay } from "@/components/SlashOverlay";
import { StatusWindow } from "@/components/StatusWindow";
import { useStatusWindow } from "@/hooks/useStatusWindow";
import { useApp } from "@/lib/AppContext";
import type { Task } from "@/lib/types";

/** 禪模式看的任務樣態：嚴格「今日討伐清單 (The Today Rule)」
 *  - 排除已封存、已完成、子任務
 *  - dueDate === 今天的本地日期（YYYY-MM-DD）
 * 避免 ADHD 用戶一次性看到全部 backlog 觸發「啟動癱瘓」；
 * 軍機處負責「把任務排到今天」，禪模式只專注「今天」。
 */
function selectZenTasks(tasks: Task[]): Task[] {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD（本地時區）
  return tasks.filter(
    (t) =>
      !t.isArchived &&
      t.status === "todo" &&
      !t.parentId &&
      t.dueDate === today,
  );
}

export default function ZenDashboard() {
  const { tasks, toggleTaskStatus, reorderTasks } = useApp();
  const visibleTasks = useMemo(() => selectZenTasks(tasks), [tasks]);

  const [activeId, setActiveId] = useState<string | null>(null);
  // 斬擊 / 崩解狀態 — 嚴格對齊規格時間軸
  const [isSlashing, setIsSlashing] = useState(false);
  const [isCrashing, setIsCrashing] = useState(false);
  const showWindow = useStatusWindow();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const focus = visibleTasks[0];
  const queue = visibleTasks.slice(1);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    // 禪模式拖曳需持久化（不然下次進禪模式焦點又跳回原 order）。
    // reorderTasks 只對傳入陣列重編 order,其餘任務的 order 保留,
    // 所以必須把「todayTasks 新順序 + 其他任務」串成全域陣列再傳,
    // 才能讓 today 範圍內的順序變更反映到主清單,同時不打亂其他任務。
    const queueIds = queue.map((t) => t.id);
    const oldIndex = queueIds.indexOf(active.id as string);
    const newIndex = queueIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newQueue = arrayMove(queue, oldIndex, newIndex);
    const todayIds = new Set(visibleTasks.map((t) => t.id));
    const otherTasks = tasks.filter((t) => !todayIds.has(t.id));
    reorderTasks([...newQueue, ...otherTasks]);
  };

  const handleComplete = async (taskId: string) => {
    const completedTask = visibleTasks.find((t) => t.id === taskId);
    if (!completedTask) return;

    // 0.0s — 斬擊啟動
    setIsSlashing(true);

    // 0.3s — 斬擊結束,同時觸發崩解 + 呼叫 toggleTaskStatus(status: todo → done)
    window.setTimeout(() => {
      setIsSlashing(false);
      setIsCrashing(true);
      // 真實狀態切換 — 同步層會處理 supabase realtime echo 與保護窗(§26-A)
      toggleTaskStatus(taskId);
    }, 300);

    // 0.5s — 狀態窗降臨
    window.setTimeout(() => {
      showWindow({
        title: "任務完成",
        message: `已討伐「${completedTask.title}」`,
        xpDelta: 100,
        icon: "⚔️",
      });
    }, 500);

    // 2.75s — 崩解動畫結束
    window.setTimeout(() => {
      setIsCrashing(false);
    }, 2750);
  };

  const activeTask = activeId ? visibleTasks.find((t) => t.id === activeId) : null;

  return (
    <main className="relative min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
      {/* StatusWindow — 禪模式獨立路由不經 AppLayout,需自掛一份 */}
      <StatusWindow />

      {/* 退出禪模式 — floating 右上角,符合 §15.4 mobile safe area */}
      <div
        className="fixed right-4 z-10 flex items-center gap-2"
        style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}
      >
        <Link
          href="/command-center"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-2 text-sm font-medium text-slate-400 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/80 hover:text-slate-600 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          aria-label="切換到軍機處：戰略排程"
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
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="hidden sm:inline">軍機處</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-slate-500 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-slate-700 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          aria-label="退出禪模式，回到主頁"
        >
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
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          <span>退出</span>
        </Link>
      </div>
      <div className="mx-auto flex max-w-2xl flex-col gap-12">
        <header className="text-balance text-sm font-medium uppercase tracking-widest text-slate-400">
          Zen Mode
        </header>

        {/* 焦點區 */}
        <section aria-labelledby="focus-heading" className="flex flex-col items-center gap-6">
          <h1 id="focus-heading" className="sr-only">
            當前焦點
          </h1>
          <AnimatePresence mode="wait">
            {focus ? (
              <FocusCard
                key={focus.id}
                task={focus}
                isSlashing={isSlashing}
                isCrashing={isCrashing}
                onComplete={() => handleComplete(focus.id)}
              />
            ) : (
              <EmptyState key="empty" />
            )}
          </AnimatePresence>
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

function FocusCard({
  task,
  isSlashing,
  isCrashing,
  onComplete,
}: {
  task: Task;
  isSlashing: boolean;
  isCrashing: boolean;
  onComplete: () => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{
        opacity: isCrashing ? 0 : 1,
        y: 0,
        scale: isCrashing ? 0.92 : 1,
        transition: {
          opacity: { duration: 0.3, ease: "easeOut" },
          scale: { duration: 0.3, ease: "easeOut" },
        },
      }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.3 } }}
      className="group relative w-full rounded-3xl bg-white p-12 shadow-sm ring-1 ring-slate-200/60"
      aria-label={`當前焦點任務: ${task.title}`}
    >
      <SlashOverlay active={isSlashing} />

      <p className="text-balance text-2xl font-medium leading-snug text-slate-800 sm:text-3xl">
        {task.title}
      </p>
      <button
        type="button"
        onClick={onComplete}
        disabled={isSlashing || isCrashing}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-800 px-6 py-3 text-sm font-medium text-slate-50 transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-slate-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        <span aria-hidden>⚔️ 討伐</span>
        <span className="sr-only">完成任務</span>
      </button>
    </motion.article>
  );
}

function SortableQueueItem({ task }: { task: Task }) {
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
      className={`flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 opacity-75 ring-1 ring-slate-200/40 transition-all duration-200 hover:opacity-90 ${
        isDragging ? "!opacity-30" : ""
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

function QueueItemCard({ task, isDragging = false }: { task: Task; isDragging?: boolean }) {
  return (
    <span
      className={`flex-1 truncate text-sm text-slate-600 ${isDragging ? "rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200" : ""}`}
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
      <p className="text-balance text-base font-medium text-slate-600">今日討伐已全數淨空</p>
      <p className="text-balance text-sm text-slate-400">戰場很安靜，慢呼吸一下</p>
      <Link
        href="/command-center"
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-800 px-6 py-3 text-sm font-medium text-slate-50 transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-slate-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        <span aria-hidden>👁️</span>
        <span>前往軍機處籌備任務</span>
      </Link>
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
