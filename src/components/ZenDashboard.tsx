"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { QuickCaptureModal } from "@/components/QuickCaptureModal";
import { useQuickCaptureShortcut } from "@/hooks/useQuickCaptureShortcut";
import { useProgressStatus } from "@/hooks/useProgressStatus";
import { useLevelUpNotification, LevelUpNotification } from "@/components/LevelUpNotification";
import { ProgressBadge } from "@/components/ProgressBadge";
import { WarmupSection } from "@/components/WarmupSection";
import { FeedbackButton } from "@/components/FeedbackButton";
import PresenceDot from "@/components/PresenceDot";
import { FlowTimer } from "@/components/FlowTimer";
import { BASE_TASK_PP } from "@/lib/progressRank";
import { QuickCaptureTrigger } from "@/components/QuickCaptureTrigger";
import { GhostButton } from "@/components/GhostButton";
import { ProWaitlistModal } from "@/components/ProWaitlistModal";
import { TodayWrapUpButton } from "@/components/TodayWrapUpButton";
import { useGhostButton } from "@/hooks/useGhostButton";
import { Hourglass, Users } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import type { Task } from "@/lib/types";
import { WarmupFlow } from "@/components/WarmupFlow";

/** 禪模式看的任務樣態：嚴格「今日專注清單 (The Today Rule)」
 *  - 排除已封存、已完成、子任務
 *  - dueDate === 今天的本地日期（YYYY-MM-DD）
 * 避免 ADHD 用戶一次性看到全部 backlog 觸發「啟動癱瘓」；
 * Command Center 負責「把任務排到今天」，禪模式只專注「今天」。
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
  const { tasks, toggleTaskStatus, reorderTasks, updateTask } = useApp();
  const visibleTasks = useMemo(() => selectZenTasks(tasks), [tasks]);

  const [activeId, setActiveId] = useState<string | null>(null);
  // 專注/崩解狀態
  const [isSlashing, setIsSlashing] = useState(false);
  const [isCrashing, setIsCrashing] = useState(false);
  const showWindow = useStatusWindow();

  // §10.3 9.5 方案:QuickCaptureModal 受控,ZenDashboard 管 open state
  // - Cmd/Ctrl+K 召喚(桌機快捷鍵)
  // - 底部 FAB 點擊召喚(手機入口)
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [warmupFlowOpen, setWarmupFlowOpen] = useState(false);
  useQuickCaptureShortcut(
    () => setQuickCaptureOpen(true),
    true,
  );

  // §Pro 等級系統:完成任務累計 PP + 晉升動畫序列
  // (toast 2.5s → 結束瞬間 → 全螢幕晉升動畫 3s)
  const { addPp } = useProgressStatus();
  const levelUp = useLevelUpNotification();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // §假門測試 A:時間盲防禦條 — 禪模式焦點卡片上的幽靈按鈕
  // 驗證 ADHD 用戶對「將抽象時間具象化」的需求強弱
  const timebarGhost = useGhostButton({ buttonId: "timebar" });

  // §假門測試 D:無聲專注室 (body_doubling) — Zen toolbar 右側入口
  // 與 time_bar 分區,訊號清晰,進入「我要專注」的高意圖時刻自然看到
  const bodyDoublingGhost = useGhostButton({ buttonId: "body_doubling" });

  const focus = visibleTasks[0];
  const queue = visibleTasks.slice(1);

  // §26 B 評分表 9.3:暖身完 → focus mode(視野縮窄)
  // 不 navigate,只隱藏 UPCOMING QUEUE,符合「啟動=收斂視野」
  const [focusMode, setFocusMode] = useState(false);

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

    // 0.0s — 完成特效啟動
    setIsSlashing(true);

    // 0.3s — 完成特效結束,同時觸發崩解 + 呼叫 toggleTaskStatus
    window.setTimeout(() => {
      setIsSlashing(false);
      setIsCrashing(true);
      // 真實狀態切換 — 同步層會處理 supabase realtime echo 與保護窗(§26-A)
      toggleTaskStatus(taskId);
    }, 300);

    // 0.5s — 狀態窗降臨 + 累計 PP
    // §10.3 9.2 方案:addPp 回傳 leveledUpTo,序列化播放晉升動畫
    window.setTimeout(() => {
      showWindow({
        title: "任務完成",
        message: `已完成「${completedTask.title}」`,
        xpDelta: BASE_TASK_PP,
        icon: "⚔️",
      });
      const { leveledUpTo } = addPp(BASE_TASK_PP);
      if (leveledUpTo) {
        window.setTimeout(() => {
          levelUp.show(leveledUpTo);
        }, 2700);
      }
    }, 500);

    // 2.75s — 崩解動畫結束
    window.setTimeout(() => {
      setIsCrashing(false);
    }, 2750);
  };

  const activeTask = activeId ? visibleTasks.find((t) => t.id === activeId) : null;

  return (
    <main className="relative min-h-screen bg-slate-50 px-4 pb-32 pt-10 sm:px-8 sm:pb-28">
      {/* §M §26 命中類別新:P 全域 floating CTA 與 fullscreen 內容區避讓策略
          ZenDashboard 是 full-screen 禪模式,FAB 的 fixed bottom-4 在小視窗會
          飄進 UPCOMING QUEUE 區上方。給 main pb-32(128px)= FAB 飄在 viewport 底
          16px + h-12=48px + 安全緩衝 64px,確保內容區底部留白足以避開。 */}

      {/* StatusWindow — 禪模式獨立路由不經 AppLayout,需自掛一份 */}
      <StatusWindow />

      {/* LevelUpNotification — 全螢幕等級晉升動畫 */}
      <LevelUpNotification />

      {/* 頂部工具列 — §10.3 9.5 方案:
          左群組(身份):Logo + Zen Mode 標題
          右群組(導航):等 badge + 任務大廳
          - 桌機:完整 Logo(色塊 + 「VibeList」文字)
          - 手機:Logo 自動縮成只有色塊,避免擠壓「任務大廳」按鈕
          - 從原本 floating 重構為 inline,不再遮擋內容 */}
      <div
        className="mx-auto grid h-14 max-w-2xl grid-cols-3 items-center gap-3"
        style={{ marginTop: "max(0px, env(safe-area-inset-top, 0px))" }}
      >
        {/* 左群組:Logo + Zen Mode 標題(身份歸屬) */}
        <div className="flex items-center justify-start gap-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: "var(--brand)" }}
              aria-hidden
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8L6.5 11.5L13 4.5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="hidden text-[16px] font-semibold tracking-tight text-slate-700 sm:inline">
              VibeList
            </span>
          </div>
          <span className="hidden text-balance text-sm font-medium uppercase tracking-widest text-slate-300 sm:inline">
            ·
          </span>
          <span className="hidden text-balance text-sm font-medium uppercase tracking-widest text-slate-400 sm:inline">
            Zen Mode
          </span>
        </div>

        {/* 中央 CTA:QuickCaptureTrigger — 桌機顯示在工具列，手機顯示底部 FAB */}
        <div className="flex items-center justify-center">
          {/* 桌機:工具列中央 */}
          <div className="hidden md:flex items-center justify-center">
            <QuickCaptureTrigger
              variant="desktop"
              onClick={() => setQuickCaptureOpen(true)}
            />
          </div>
        </div>

        {/* 手機:Fixed 底部 FAB */}
        <QuickCaptureTrigger
          variant="mobile"
          onClick={() => setQuickCaptureOpen(true)}
        />

        {/* 右群組:等 badge + 無聲專注室 + 任務大廳 */}
        <div className="flex items-center justify-end gap-3">
          <ProgressBadge />
          <GhostButton
            onClick={bodyDoublingGhost.handleClick}
            variant="muted"
            icon={Users}
            featureId="body_doubling"
            dismissed={bodyDoublingGhost.dismissed}
          >
            無聲營地
          </GhostButton>
          <Link
            href="/?board=1"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-sm font-medium text-slate-500 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-slate-700 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 sm:px-4"
            aria-label="進入任務大廳(收件箱) — 整理任務或快速 Brain Dump"
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
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span className="hidden sm:inline">任務大廳</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-2xl flex-col gap-12 pb-12">
        {/* Zen Mode 標題 — 手機才顯示在這裡(桌機已在頂部工具列中央顯示) */}
        <header className="text-balance text-sm font-medium uppercase tracking-widest text-slate-400 sm:hidden">
          Zen Mode
        </header>

        {/* 焦點區 */}
        <section aria-labelledby="focus-heading" className="flex flex-col items-center gap-6">
          {/* §26 B 暖身完焦點模式:頂部加「展開 UPCOMING」按鈕,給逃離路徑 */}
          {focusMode && queue.length > 0 && (
            <button
              type="button"
              onClick={() => setFocusMode(false)}
              className="self-end rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              展開 UPCOMING ↑
            </button>
          )}
          {/* 心流計時器膠囊 — 置於焦點任務卡片上方 */}
          <FlowTimer />
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
                onUpdateTitle={(id, title) => updateTask(id, { title })}
                ghostButton={
                  <GhostButton
                    onClick={timebarGhost.handleClick}
                    variant="muted"
                    icon={Hourglass}
                    featureId="time_bar"
                    dismissed={timebarGhost.dismissed}
                  >
                    啟動專注消耗條
                  </GhostButton>
                }
              />
            ) : (
              <EmptyState key="empty" />
            )}
          </AnimatePresence>
        </section>

        {/* 排程區 — §26 B 暖身完焦點模式:收斂視野,隱藏 UPCOMING QUEUE */}
        {!focusMode && queue.length > 0 && (
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

        {/* 「今天先這樣」 — 禪模式主動封存,只剩焦點卡時也可單獨封存 */}
        <TodayWrapUpButton tasks={visibleTasks} />
      </div>

      {/* §10.3 9.2 方案:Spotlight 風格「大腦傾倒」浮動輸入框
          Cmd/Ctrl+K(桌機)或 mobile FAB(手機)召喚
          沿用 useApp().addTask({ listId: undefined }) → 收件箱路徑 */}
      <QuickCaptureModal
        open={quickCaptureOpen}
        onOpenChange={setQuickCaptureOpen}
      />

      {/* WarmupSection — 暖身區塊(左下角)
          沿用既有 Habit 系統 checkinHabit 同步層
          手機隱藏(sm:flex),避免跟 mobile FAB 搶版面 */}
      <WarmupSection onEnterFlow={() => setWarmupFlowOpen(true)} />
      <WarmupFlow
        open={warmupFlowOpen}
        onClose={() => setWarmupFlowOpen(false)}
        onComplete={() => {
          setWarmupFlowOpen(false);
          setFocusMode(true);
        }}
      />

      {/* 陪伴指示燈 — 右下角,跟左下 WarmupSection 對稱
          §品牌承諾「真實與脆弱」:顯示估算範圍 + hover tooltip 揭露
          桌機手機都顯示,右側無其他 fixed 元素競爭 */}
      <PresenceDot />

      {/* FeedbackButton — 禪模式下淡化,hover 才完全顯示 */}
      <FeedbackButton isZenMode />

      {/* 假門測試 A — 時間盲防禦條 Modal (幽靈按鈕點擊後彈出) */}
      <ProWaitlistModal
        open={timebarGhost.open}
        onClose={timebarGhost.handleDismiss}
        onJoin={timebarGhost.handleJoin}
        featureId="time_bar"
      />

      {/* 假門測試 D — 無聲專注室 Modal */}
      <ProWaitlistModal
        open={bodyDoublingGhost.open}
        onClose={bodyDoublingGhost.handleDismiss}
        onJoin={bodyDoublingGhost.handleJoin}
        featureId="body_doubling"
      />
    </main>
  );
}

/* ============== 子元件 ============== */

function FocusCard({
  task,
  isSlashing,
  isCrashing,
  onComplete,
  ghostButton,
  onUpdateTitle,
}: {
  task: Task;
  isSlashing: boolean;
  isCrashing: boolean;
  onComplete: () => void;
  ghostButton?: React.ReactNode;
  onUpdateTitle: (id: string, title: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartRef = useRef<React.Touch | null>(null);
  const isLongPressRef = useRef(false);

  // 進入編輯模式後自動 focus 並選中文字
  useEffect(() => {
    if (isEditing) {
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
      return () => window.clearTimeout(t);
    }
  }, [isEditing]);

  // 任務內容變化時同步編輯值（避免 focus 任務後編輯值停留在舊值）
  useEffect(() => {
    if (!isEditing) setEditValue(task.title);
  }, [task.title, isEditing]);

  const startEdit = () => {
    setEditValue(task.title);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue(task.title);
  };

  const saveEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdateTitle(task.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Desktop: 雙擊編輯
  const handleDoubleClick = () => {
    startEdit();
  };

  // Mobile: Long Press 500ms 編輯
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0] ?? null;
    isLongPressRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true;
      startEdit();
    }, 500);
  };

  const handleTouchMove = () => {
    // 滑動則取消長按計時
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;
  };

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
      className="group relative w-full rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200/60"
      aria-label={`當前焦點任務: ${task.title}`}
    >
      <SlashOverlay active={isSlashing} />

      {/* 幽靈按鈕 — 絕對定位於卡片右上,§假門測試用 */}
      {ghostButton && !isEditing && (
        <div className="absolute right-4 top-4">{ghostButton}</div>
      )}

      {/* 標題區 — Desktop 雙擊 / Mobile 長按 500ms 觸發編輯 */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={saveEdit}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-label="編輯任務標題"
          className="w-full max-w-full bg-transparent text-center text-2xl font-medium leading-snug text-slate-800 outline-none ring-0 placeholder:text-slate-300 sm:text-3xl"
          style={{
            // 與原本 <p> 完全一致的尺寸與字重
            fontSize: "clamp(1.5rem, 4vw, 1.875rem)",
            fontWeight: 500,
            lineHeight: "1.375",
            textAlign: "center",
            // 消除 input 預設樣式
            border: "none",
            padding: 0,
            margin: 0,
            background: "transparent",
            boxShadow: "none",
            WebkitAppearance: "none",
          }}
        />
      ) : (
        <p
          onDoubleClick={handleDoubleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="cursor-text select-none text-balance text-2xl font-medium leading-snug text-slate-800 sm:text-3xl"
          aria-label={`雙擊或長按編輯標題: ${task.title}`}
          title="雙擊或長按編輯"
        >
          {task.title}
        </p>
      )}

      <button
        type="button"
        onClick={onComplete}
        disabled={isSlashing || isCrashing || isEditing}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-800 px-6 py-3 text-sm font-medium text-slate-50 transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-slate-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        <span aria-hidden>✓ 完成</span>
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
      <p className="text-balance text-base font-medium text-slate-600">今日專注已全數完成</p>
      <p className="text-balance text-sm text-slate-400">戰場很安靜，慢呼吸一下</p>
      <Link
        href="/?board=1"
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-800 px-6 py-3 text-sm font-medium text-slate-50 transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-slate-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        <span aria-hidden>📥</span>
        <span>開啟任務大廳</span>
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
