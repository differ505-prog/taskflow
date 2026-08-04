"use client";
import { getLocalToday } from "@/lib/dateUtils";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import Image from "next/image";

import { useApp } from "@/lib/AppContext";
import type { Task } from "@/lib/types";
import { WarmupFlow } from "@/components/WarmupFlow";
import { OnboardingTask } from "@/components/OnboardingTask";

/** 禪模式看的任務樣態：嚴格「今日專注清單 (The Today Rule)」
 *  - 排除已封存、已完成、子任務
 *  - dueDate === 今天的本地日期（YYYY-MM-DD）
 *  - **依 `order` 欄位排序**（reorderTasks 會重編 order,這是 SSOT）
 * 避免 ADHD 用戶一次性看到全部 backlog 觸發「啟動癱瘓」；
 * Command Center 負責「把任務排到今天」，禪模式只專注「今天」。
 */
function selectZenTasks(tasks: Task[], sharedLists: Record<string, import("@/lib/storage").SharedListData>): Task[] {
  const today = getLocalToday(); // YYYY-MM-DD（本地時區）
  const isTargetTask = (t: Task) => (
      !t.isArchived &&
      t.status === "todo" &&
      !t.parentId &&
      // §A+ 雙保險:startDate 是未來天 → 該任務今天還沒開始,不應作為焦點
      !(t.startDate && t.startDate > today) &&
      t.dueDate === today
  );
  const personalTasks = tasks.filter(isTargetTask);
  const sharedTasks = Object.values(sharedLists || {}).flatMap(listData => listData.tasks).filter(isTargetTask);
  return [...personalTasks, ...sharedTasks].sort((a, b) => (a.order || 0) - (b.order || 0));
}

export default function ZenDashboard() {
  const { tasks, toggleTaskStatus, completeTask, reorderTasks, updateTask, escapeTask, sharedLists, updateSharedTask } = useApp();
  const visibleTasks = useMemo(() => {
    const res = selectZenTasks(tasks, sharedLists);
    // @ts-ignore
    
    return res;
  }, [tasks, sharedLists]);

  // Helper wrappers to route task actions correctly
  const handleToggleTaskStatus = useCallback((taskId: string) => {
    const task = visibleTasks.find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      updateSharedTask(task.listId!, taskId, { status: task.status === "done" ? "todo" : "done" });
    } else {
      toggleTaskStatus(taskId);
    }
  }, [visibleTasks, sharedLists, updateSharedTask, toggleTaskStatus]);

  const handleCompleteTask = useCallback((taskId: string) => {
    const task = visibleTasks.find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      updateSharedTask(task.listId!, taskId, { status: "done", completedAt: new Date().toISOString() });
    } else {
      completeTask(taskId);
    }
  }, [visibleTasks, sharedLists, updateSharedTask, completeTask]);

  const handleUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    const task = visibleTasks.find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      updateSharedTask(task.listId!, taskId, updates);
    } else {
      updateTask(taskId, updates);
    }
  }, [visibleTasks, sharedLists, updateSharedTask, updateTask]);

  const handleEscapeTask = useCallback((taskId: string) => {
    const task = visibleTasks.find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      // Escape for shared tasks: just remove the dueDate so it leaves Zen Mode
      updateSharedTask(task.listId!, taskId, { dueDate: undefined });
    } else {
      escapeTask(taskId);
    }
  }, [visibleTasks, sharedLists, updateSharedTask, escapeTask]);

  const applyNewVisibleQueue = useCallback((newQueue: Task[]) => {
    // 重新指派連續的 order
    newQueue.forEach((t, i) => { t.order = i; });

    // 分離個人任務與共用任務，分別持久化 order
    const personalQueue = newQueue.filter((t) => !t.listId || !sharedLists[t.listId]);
    const todayPersonalIds = new Set(personalQueue.map((t) => t.id));
    const otherPersonalTasks = tasks.filter((t) => !todayPersonalIds.has(t.id));
    reorderTasks([...personalQueue, ...otherPersonalTasks]);

    // 更新共用任務的 order
    const sharedGroups: Record<string, Task[]> = {};
    newQueue.forEach((t) => {
      if (t.listId && sharedLists[t.listId]) {
        if (!sharedGroups[t.listId]) sharedGroups[t.listId] = [];
        sharedGroups[t.listId].push(t);
      }
    });
    
    Object.entries(sharedGroups).forEach(([listId, sTasks]) => {
      sTasks.forEach(t => updateSharedTask(listId, t.id, { order: t.order }));
    });
  }, [sharedLists, tasks, reorderTasks, updateSharedTask]);

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

    const oldIndex = visibleTasks.findIndex((t) => t.id === active.id);
    const newIndex = visibleTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newQueue = arrayMove(visibleTasks, oldIndex, newIndex);
    applyNewVisibleQueue(newQueue);
  };

  // §A1:輕量「下一個輪值」入口 — 把 visibleTasks[0] 移到清單最尾端,
  // 其他任務往前遞補一格,形成「跑馬燈式循環」:
  //   5 個任務 → 連按 5 次,焦點依序為 F → Q1 → Q2 → Q3 → Q4 → F(回到原點)
  // 視覺上:每次按「下一個輪值」,新的焦點從清單尾巴遞補上來,
  // 原焦點保留在新焦點前方(若使用者按「跳過/完成」才真的離開)。
  // 不寫新 state、不擴 schema、不破壞 escapeTask / toggleTaskStatus /
  // UPCOMING drag 任何既有路徑。復用 reorderTasks + 5 秒保護窗(§26-A)。
  const shiftFocusWithNext = () => {
    if (visibleTasks.length < 2) return;
    const newOrderIds = [
      ...visibleTasks.slice(1).map((t) => t.id),
      visibleTasks[0].id,
    ];
    const todayById = new Map<string, Task>();
    visibleTasks.forEach((t) => todayById.set(t.id, t));
    const reorderedToday = newOrderIds
      .map((id) => todayById.get(id))
      .filter((t): t is Task => Boolean(t));
    applyNewVisibleQueue(reorderedToday);
  };

  const handleComplete = async (taskId: string) => {
    const completedTask = visibleTasks.find((t) => t.id === taskId);
    if (!completedTask) return;

    // 0.0s — 完成特效啟動
    setIsSlashing(true);

    // 0.3s — 完成特效結束,同時觸發崩解 + 呼叫 completeTask
    window.setTimeout(() => {
      setIsSlashing(false);
      setIsCrashing(true);
      // 真實狀態切換 — 同步層會處理 supabase realtime echo 與保護窗(§26-A)
      handleCompleteTask(taskId);
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
    <>
      <div className="fixed top-0 left-0 w-full bg-black text-green-400 z-[9999] p-2 text-xs font-mono">
        ZenDebug: {JSON.stringify(typeof window !== "undefined" ? (window as any).zenDebug : {})}
      </div>
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
            {/* §26 降噪:Logo 預設 slate-100/400(融入背景),hover/focus 才顯示品牌色
                - 桌機:打勾色塊 + 「VibeList」文字
                - 手機:打勾色塊(隱藏文字避免擠壓) */}
            <div
              className="group/logo relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out hover:scale-105 active:scale-95"
              aria-hidden
            >
              <Image
                src="/images/vibe-list-icon.jpeg"
                alt="VibeList Icon"
                fill
                className="object-cover"
                sizes="32px"
              />
            </div>
            <span className="hidden text-[16px] font-semibold tracking-tight text-slate-700 sm:inline">
              VibeList
            </span>
          </div>
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
        <div className="flex items-center justify-end gap-3 sm:gap-4">
          <ProgressBadge />
          {/* §26 降噪:無聲營地 — 移除邊框(虛線/實線),改用極低透明度純色背景融入
              GhostButton 用 inline style 設 border,需用 style prop 覆寫 */}
          <GhostButton
            onClick={bodyDoublingGhost.handleClick}
            variant="muted"
            icon={Users}
            featureId="body_doubling"
            dismissed={bodyDoublingGhost.dismissed}
            className="border-0"
            style={{
              background: "rgba(241, 245, 249, 0.5)", // slate-100/50
              border: "none",
            }}
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
                onSkip={() => handleEscapeTask(focus.id)}
                onShiftNext={shiftFocusWithNext}
                canShiftNext={visibleTasks.length >= 2}
                onUpdateTitle={(id, title) => handleUpdateTask(id, { title })}
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
          <section aria-label="Upcoming Queue" className="flex flex-col gap-4">
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

        {/* 陪伴指示燈 — §26 放在「今天先這樣」正下方置中，統一中軸線 */}
        <div className="mt-8 flex justify-center pb-24">
          <PresenceDot />
        </div>
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

      {/* FeedbackButton — 禪模式下淡化,hover 才完全顯示 */}
      <FeedbackButton isZenMode />

      {/* §Onboarding Task：首次載入且任務清單為空時，自動注入 PWA 安裝教學任務。
         純前端 + localStorage sentinel,見 OnboardingTask.tsx */}
      <OnboardingTask />

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
    </>
  );
}

/* ============== 子元件 ============== */

function FocusCard({
  task,
  isSlashing,
  isCrashing,
  onComplete,
  onSkip,
  onShiftNext,
  canShiftNext,
  ghostButton,
  onUpdateTitle,
}: {
  task: Task;
  isSlashing: boolean;
  isCrashing: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onShiftNext: () => void;
  canShiftNext: boolean;
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
      className="group relative w-full rounded-3xl bg-white px-6 pt-16 pb-8 text-center shadow-sm ring-1 ring-slate-200/60 sm:px-12 sm:pt-20 sm:pb-10"
      aria-label={`當前焦點任務: ${task.title}`}
    >
      <SlashOverlay active={isSlashing} />

      {/* 幽靈按鈕 — 絕對定位於卡片右上,§假門測試用 */}
      {ghostButton && !isEditing && (
        <div className="absolute right-5 top-5 sm:right-6 sm:top-6">{ghostButton}</div>
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

      <div className="mt-8 flex flex-col items-center gap-3">
        {/* §A1 焦點順序微調入口 — 「▶ 下一個」按鈕:
            把今天 task 的 [0] 跟 [1] 對調,讓下一個輪值上來當焦點。
            視覺上 =「下一個任務進場」,不像「跳過」會把任務推到明天。
            設計決策:只放單向「▶」(不放 ◀),因為今日任務只要有下一個,
            對調後都是「下一個進場」,雙向箭頭反而會讓 ADHD 用戶分心。
            - 桌機:group-hover / group-focus-within / focus-visible 才浮現
            - 手機 (sm 以下):常駐可見(hover 不可達)
            - 只有 1 個 today 任務時 disabled(無下一個可輪值) */}
        <button
          type="button"
          onClick={onShiftNext}
          disabled={!canShiftNext || isSlashing || isCrashing || isEditing}
          aria-label="輪值下一個任務為新焦點(今日順序微調,不會跳過或封存)"
          title="下一個輪值上來"
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-4 py-2 text-xs font-medium uppercase tracking-widest text-slate-500 ring-1 ring-inset ring-slate-200/60 transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-slate-200/60 hover:text-slate-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100"
        >
          <ChevronRightIcon />
          <span>下一個輪值</span>
        </button>
        <button
          type="button"
          onClick={onComplete}
          disabled={isSlashing || isCrashing || isEditing}
          className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-6 py-3 text-sm font-medium text-slate-50 transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-slate-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          <span aria-hidden>✓ 完成</span>
          <span className="sr-only">完成任務</span>
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={isSlashing || isCrashing || isEditing}
          className="text-sm text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="跳過此任務 — 區間任務推遲一天、單日任務退回收集箱"
        >
          跳過
        </button>
      </div>
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
      className={`flex items-center gap-3 rounded-2xl bg-white/40 px-4 py-3 opacity-60 ring-1 ring-white/60 backdrop-blur-sm transition-all duration-300 hover:bg-white/80 hover:opacity-100 hover:ring-slate-200/50 ${
        isDragging ? "!opacity-30" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`拖曳任務: ${task.title}`}
        className="flex h-8 w-6 cursor-grab touch-none items-center justify-center text-slate-400 transition-colors hover:text-slate-600 active:cursor-grabbing"
      >
        <GripIcon />
      </button>
      <QueueItemCard task={task} isDragging={isDragging} />
    </li>
  );
}

function QueueItemCard({ task, isDragging = false }: { task: Task; isDragging?: boolean }) {
  return (
    <span
      className={`flex-1 truncate text-[15px] font-medium text-slate-500 mix-blend-multiply ${isDragging ? "rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200" : ""}`}
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
      <p className="text-balance text-sm text-slate-400">戰場很安靜。剩下的，會在大廳等你。</p>
      {/* §26 降噪:全數完成狀態下,按鈕不應侵略性 — 從 Primary(bg-slate-800)降為
         Ghost/Secondary(bg-slate-100/80 + text-slate-600),讓中央主視覺(以上 3 行)獨佔焦點 */}
      <Link
        href="/?board=1"
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-100/80 px-6 py-3 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200/60 transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-slate-200/60 hover:text-slate-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
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

// §A1 焦點輪值按鈕用的 chevron icon(沿用 lucide 風格 24x24 stroke=1.75,
// 跟既有 GripIcon 視覺權重一致)
function ChevronRightIcon() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
