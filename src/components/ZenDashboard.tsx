"use client";

import { useMemo, useRef, useState } from "react";
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
import { useHunterStatus } from "@/hooks/useHunterStatus";
import { useRankUpNotification, RankUpNotification } from "@/components/RankUpNotification";
import { HunterStatusBadge } from "@/components/HunterStatusBadge";
import { WarmupSection } from "@/components/WarmupSection";
import { FeedbackButton } from "@/components/FeedbackButton";
import PresenceDot from "@/components/PresenceDot";
import { BASE_TASK_EXP } from "@/lib/hunterRank";
import { QuickCaptureTrigger } from "@/components/QuickCaptureTrigger";
import { GhostButton } from "@/components/GhostButton";
import { ProWaitlistModal } from "@/components/ProWaitlistModal";
import { useGhostButton } from "@/hooks/useGhostButton";
import { Hourglass, Users } from "lucide-react";
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

  // §10.3 9.5 方案:QuickCaptureModal 受控,ZenDashboard 管 open state
  // - Cmd/Ctrl+K 召喚(桌機快捷鍵)
  // - 底部 FAB 點擊召喚(手機入口)
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  useQuickCaptureShortcut(
    () => setQuickCaptureOpen(true),
    true,
  );

  // §10.3 9.2 方案:獵人公會 — 完成任務累計 EXP + 升級動畫序列
  // (toast 2.5s → 結束瞬間 → 全螢幕晉升動畫 3s)
  const { addExp } = useHunterStatus();
  const rankUp = useRankUpNotification();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // §假門測試 A:時間盲防禦條 — 禪模式焦點卡片上的幽靈按鈕
  // 驗證 ADHD 用戶對「將抽象時間具象化」的需求強弱
  const timebarGhost = useGhostButton({ buttonId: "timebar" });

  // §假門測試 D:無聲討伐營地 (body_doubling) — Zen toolbar 右側入口
  // 與 time_bar 分區,訊號清晰,進入「我要專注」的高意圖時刻自然看到
  const bodyDoublingGhost = useGhostButton({ buttonId: "body_doubling" });

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

    // 0.5s — 狀態窗降臨 + 累計 EXP(同步觸發升級判斷)
    // §10.3 9.2 方案:addExp 回傳 leveledUpTo,序列化播放晉升動畫
    window.setTimeout(() => {
      showWindow({
        title: "任務完成",
        message: `已討伐「${completedTask.title}」`,
        xpDelta: BASE_TASK_EXP,
        icon: "⚔️",
      });
      const { leveledUpTo } = addExp(BASE_TASK_EXP);
      // 序列化播放:StatusWindow 2.5s + 動畫緩衝 → 緊接著觸發晉升動畫
      // 避免兩個動畫同時出現造成視覺競爭
      if (leveledUpTo) {
        window.setTimeout(() => {
          rankUp.show(leveledUpTo);
        }, 2700); // 略長於 StatusWindow 自動 dismiss 時間(2.5s)
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

      {/* RankUpNotification — 全螢幕階級晉升動畫(§10.3 9.2 方案)
          透過 useRankUpNotification() 觸發;序列化播放確保不與 StatusWindow 衝突 */}
      <RankUpNotification />

      {/* 頂部工具列 — §10.3 9.5 方案:
          左群組(身份):Logo + Zen Mode 標題
          右群組(導航):獵人徽章 + 任務大廳
          - 桌機:完整 Logo(色塊 + 「VibeList」文字)
          - 手機:Logo 自動縮成只有色塊,避免擠壓「任務大廳」按鈕
          - 從原本 floating 重構為 inline,不再遮擋內容 */}
      <div
        className="mx-auto flex max-w-2xl items-center justify-between gap-3"
        style={{ marginTop: "max(0px, env(safe-area-inset-top, 0px))" }}
      >
        {/* 左群組:Logo + Zen Mode 標題(身份歸屬) */}
        <div className="flex items-center gap-3">
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
          {/* Zen Mode 標題跟 Logo 群組(桌機才顯示),用極淡分隔線點出群組關係 */}
          <span className="hidden text-balance text-sm font-medium uppercase tracking-widest text-slate-300 sm:inline">
            ·
          </span>
          <span className="hidden text-balance text-sm font-medium uppercase tracking-widest text-slate-400 sm:inline">
            Zen Mode
          </span>
        </div>

        {/* 右群組:獵人徽章 + 任務大廳(導航歸屬) */}
        <div className="flex items-center gap-3">
          {/* QuickCaptureTrigger §10.3 9.1 → §C2 9.2:桌機專用 CTA(品牌色)
              ⌘K 提示 hover 才揭示,符合「按鈕為主、熱鍵為輔」雙平台一致原則 */}
          <QuickCaptureTrigger
            variant="desktop"
            onClick={() => setQuickCaptureOpen(true)}
          />
          <HunterStatusBadge />
          {/* §假門測試 D — 無聲討伐營地 (body_doubling)
              位置:任務大廳 icon 左側,獨立入口,與 time_bar(右上角焦點卡片)分區
              訊號清晰:用戶在「我要專注」時看到,直覺路徑 1 click 內 */}
          <GhostButton
            onClick={bodyDoublingGhost.handleClick}
            variant="glowing"
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
                ghostButton={
                  <GhostButton
                    onClick={timebarGhost.handleClick}
                    variant="muted"
                    icon={Hourglass}
                    featureId="time_bar"
                    dismissed={timebarGhost.dismissed}
                  >
                    啟動魔力消耗條
                  </GhostButton>
                }
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
      <WarmupSection />

      {/* 陪伴指示燈 — 右下角,跟左下 WarmupSection 對稱
          §品牌承諾「真實與脆弱」:顯示估算範圍 + hover tooltip 揭露
          桌機手機都顯示,右側無其他 fixed 元素競爭 */}
      <PresenceDot />

      {/* Mobile FAB — §C2 9.2:共用 QuickCaptureTrigger 元件,桌機手機視覺強度對齊
          §15.4 mobile safe area:bottom padding 避 iOS home indicator */}
      <QuickCaptureTrigger
        variant="mobile"
        onClick={() => setQuickCaptureOpen(true)}
      />

      {/* 假門測試 A — 時間盲防禦條 Modal (幽靈按鈕點擊後彈出) */}
      <ProWaitlistModal
        open={timebarGhost.open}
        onClose={timebarGhost.handleDismiss}
        onJoin={timebarGhost.handleJoin}
        featureId="time_bar"
      />

      {/* 假門測試 D — 無聲討伐營地 Modal */}
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
}: {
  task: Task;
  isSlashing: boolean;
  isCrashing: boolean;
  onComplete: () => void;
  ghostButton?: React.ReactNode;
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
      className="group relative w-full rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200/60"
      aria-label={`當前焦點任務: ${task.title}`}
    >
      <SlashOverlay active={isSlashing} />

      {/* 幽靈按鈕 — 絕對定位於卡片右上,§假門測試用 */}
      {ghostButton && (
        <div className="absolute right-4 top-4">{ghostButton}</div>
      )}

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
