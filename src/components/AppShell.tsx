"use client";
import { getLocalToday } from "@/lib/dateUtils";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { useConfirm } from "@/hooks/useConfirm";
import { useProactiveClosure } from "@/hooks/useProactiveClosure";
import { useAddToToday } from "@/hooks/useAddToToday";
import { useTaskHotkeys } from "@/hooks/useTaskHotkeys";
import { Task, AppView, TaskList, TaskStatus } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { TaskSwipeWrapper } from "./SwipeableTaskCard";
import { TaskForm } from "./TaskForm";
import { EmptyState } from "./EmptyState";
import { TaskListItem } from "./TaskListItem";
import { TaskListSkeleton } from "./TaskListSkeleton";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, LayoutGrid, List,
  Plus, Archive, Zap, ChevronRight, Timer,
  Share2, Shield, RotateCcw, Trash2, CheckCheck, Sparkles,
} from "lucide-react";
import { isComposingKey } from "@/utils/imeGuard";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  KeyboardSensor, MouseSensor, TouchSensor, closestCenter,
  useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableTaskItem } from "./SortableTaskItem";
import LostAndFound from "@/components/LostAndFound";

const VIEW_LABELS: Record<AppView, string> = {
  inbox: "收集箱",
  today: "今天",
  next7days: "未來 7 天",
  all: "全部任務",
  calendar: "日曆",
  habits: "習慣打卡",
  tags: "標籤",
  list: "清單",
  stats: "統計",
  shared: "共用清單",
  archived: "已封存",
  pinned: "置頂",
  quadrant: "緩急圖",
  "command-center": "Command Center",
};

interface AppShellProps {
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onOpenSettings: () => void;
  onOpenListForm: () => void;
  onEditList: (list: TaskList) => void;
  onDeleteList: (id: string) => void;
  onOpenFlowTimer: () => void;
  onOpenMobileSidebar?: () => void;
  onOpenShareModal?: (list: TaskList, tasks: Task[]) => void;
  userMenu?: React.ReactNode;
  // ── 批次多選模式（PRO 專屬）─────────────────────
  batchMode?: boolean;
  batchSelectedIds?: Set<string>;
  onEnterBatchMode?: (firstSelectedId?: string) => void;
  onToggleBatchSelect?: (id: string) => void;
  onExitBatchMode?: () => void;
  onBatchComplete?: () => void;
  onBatchDelete?: () => void;
}

export function AppShell({
  selectedTaskId, onSelectTask, onOpenSettings, onOpenListForm,
  onEditList, onDeleteList, onOpenFlowTimer, onOpenMobileSidebar,
  onOpenShareModal, userMenu,
  batchMode = false, batchSelectedIds, onEnterBatchMode, onToggleBatchSelect,
  onExitBatchMode, onBatchComplete, onBatchDelete,
}: AppShellProps) {
  const {
    tasks, currentView, currentListId, currentSharedListId, sharedLists,
    lists,
    activeFilter, setActiveFilter,
    addTask, updateTask, deleteTask, toggleTaskStatus,
    quickAdd, getFilteredTasks, viewCounts,
    getTagCounts,
    toggleSubTask, addSubTask, deleteSubTask, completeRecurringAndClone, completeTask,
    quickAddToShared, updateSharedTask, deleteSharedTask,
    getMyRole,
    reorderTasks,
  } = useApp();
  const router = useRouter();
  const confirm = useConfirm();
  // 「加入今日」共用動作（§Sonner 固定 id + updateTask 自動 markRecentlyWritten）
  const { addToToday, dismissAddToTodayToast } = useAddToToday();

  const listTasks = currentListId ? tasks.filter(t => t.listId === currentListId) : [];

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  // L6.5「已完成任務預設折疊」：展開狀態持久化到 localStorage
  // SSR/CSR 一致性:預設 true（折疊 = 安全預設）,mount 後從 localStorage 同步
  const [completedExpanded, setCompletedExpanded] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("completed-collapsed");
      if (stored === "false") setCompletedExpanded(true);
      else setCompletedExpanded(false);
    } catch { /* 維持預設 */ }
  }, []);
  const toggleCompletedExpanded = useCallback(() => {
    setCompletedExpanded((prev) => {
      const next = !prev;
      try { localStorage.setItem("completed-collapsed", String(!next)); } catch {}
      return next;
    });
  }, []);
  // T2「已過期任務」折疊區：預設展開（提醒使用者債務），可折疊,偏好持久化
  const [overdueExpanded, setOverdueExpanded] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("overdue-collapsed");
      if (stored === "true") setOverdueExpanded(false);
    } catch { /* 維持預設 */ }
  }, []);
  const toggleOverdueExpanded = useCallback(() => {
    setOverdueExpanded((prev) => {
      const next = !prev;
      try { localStorage.setItem("overdue-collapsed", String(!next)); } catch {}
      return next;
    });
  }, []);
  const [quickAddInput, setQuickAddInput] = useState("");
  const [quickAddHint, setQuickAddHint] = useState(false);
  const [sharedQuickAddInput, setSharedQuickAddInput] = useState("");
  // 全域 hover 任務 id:供 useTaskHotkeys 判斷「T 鍵作用於哪個任務」
  // - 桌機 hover、focus 都會設定;觸控裝置 hover 不會觸發(本來就無 hover)
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  // 「進行中」空白區的新增按鈕，點進來預設建立 in-progress 任務
  const [formInitialStatus, setFormInitialStatus] = useState<"todo" | "in-progress">("todo");
  const sharedQuickAddRef = useRef<HTMLInputElement>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const brainDumpRef = useRef<HTMLTextAreaElement>(null);

  // T2-b「加入今日」:桌面版與手機版行為統一
  // - 已廢除舊「一鍵入禪 (Focus NOW)」機制(設 order = -1 + router.push 會搶 Zen 焦點 + 跳頁,違反多選場景)
  // - 桌面 hover 按鈕 + 手機左滑 = 呼叫同一個 addToToday hook(只設 dueDate=today)
  // - today 視圖:不需要(任務已在 today);archived:不啟用(避免已完成任務被拉回)
  // - shared list:addToToday 內部已處理(updateSharedTask)
  const showAddToToday = currentView !== "today" && currentView !== "archived";

  // 觀看者模式：Viewer 在 shared list 是唯讀的
  const sharedRole = currentSharedListId ? getMyRole(currentSharedListId) : null;
  const isReadOnlyShared = !!currentSharedListId && sharedRole === "viewer";

  // Keyboard shortcut: Cmd+K for quick add
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        quickAddRef.current?.focus();
        setQuickAddHint(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Keyboard shortcut: T = 「加入今日」(需 hover 任務)
  useTaskHotkeys({
    hoveredTaskId,
    onAddToToday: addToToday,
  });

  const handleQuickAdd = useCallback(() => {
    if (!quickAddInput.trim()) return;
    quickAdd(quickAddInput, currentView);
    setQuickAddInput("");
    // L3.5「無摩擦連擊輸入」：Enter 建立任務後，游標留在輸入框，可盲打連續新增
    // 收集箱空狀態時 focus textarea，其他狀態 focus input
    if (currentView === "inbox" && brainDumpRef.current) {
      brainDumpRef.current.focus();
      brainDumpRef.current.style.height = "auto";
    } else {
      quickAddRef.current?.focus();
    }
  }, [quickAdd, quickAddInput, currentView]);

  const handleSharedQuickAdd = useCallback(() => {
    if (!sharedQuickAddInput.trim() || !currentSharedListId) return;
    quickAddToShared(currentSharedListId, sharedQuickAddInput);
    setSharedQuickAddInput("");
    sharedQuickAddRef.current?.blur();
  }, [quickAddToShared, sharedQuickAddInput, currentSharedListId]);

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleSubmit = (data: Parameters<typeof addTask>[0]) => {
    if (editingTask) {
      updateTask(editingTask.id, data);
    } else {
      // Ensure listId is set for new tasks (from list view or shared list)
      const withListId = { ...data, listId: data.listId ?? currentListId };
      addTask(withListId);
    }
    setEditingTask(null);
  };

  const filteredTasks = getFilteredTasks();
  const sharedListTasks = currentSharedListId
    ? sharedLists[currentSharedListId]?.tasks ?? []
    : [];
  const sharedFilteredTasks = activeFilter.status
    ? sharedListTasks.filter((task) => task.status === activeFilter.status)
    : sharedListTasks;
  // 用戶主動點了「已完成」狀態標籤時,只顯示已完成
  const explicitlyShowingDone = activeFilter.status === "done";
  // L6.5:已完成任務一律顯示在底部折疊區,所以 displayTasks 永遠包含全部
  // 例外:用戶主動點「已完成」chip 時,只渲染 done — 此時 activeTasks 借用整個 displayTasks
  // 避免 activeTasks = 0 + completedTasks 被 L6.5 折疊區跳過(!explicitlyShowingDone 條件)而空白
  const displayTasks = explicitlyShowingDone
    ? filteredTasks.filter((t) => t.status === "done")
    : currentView === "today" || currentView === "next7days" || currentView === "list"
      ? filteredTasks
      : filteredTasks;
  const activeTasks = explicitlyShowingDone
    ? displayTasks
    : displayTasks.filter((t) => t.status !== "done");
  const completedTasks = explicitlyShowingDone
    ? []
    : displayTasks.filter((t) => t.status === "done");
  // T2「過期」分流：只對 today 視圖有意義（其他 view 的 overdue 已在 getFilteredTasks 規則裡處理）
  // - today 視圖：dueDate < today & 未完成 → 走 overdue 區
  // - 其他視圖：退化成 0，避免把 next7days 內的昨日任務誤塞到「已過期」
  const overdueTasks = (currentView === "today" && !explicitlyShowingDone)
    ? activeTasks.filter((t) => {
        if (!t.dueDate) return false;
        return t.dueDate < getLocalToday();
      })
    : [];
  // T2 today 主區僅顯示「今日 + 未過期」的任務
  const todayActiveTasks = (currentView === "today" && !explicitlyShowingDone)
    ? activeTasks.filter((t) => {
        if (!t.dueDate) return true; // 沒設 dueDate 的任務也照常顯示
        return t.dueDate >= getLocalToday();
      })
    : activeTasks;

  const routeUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    const task = [...activeTasks, ...completedTasks].find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      updateSharedTask(task.listId!, taskId, updates);
    } else {
      updateTask(taskId, updates);
    }
  }, [activeTasks, completedTasks, sharedLists, updateSharedTask, updateTask]);

  const routeCompleteTask = useCallback((taskId: string) => {
    const task = [...activeTasks, ...completedTasks].find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      updateSharedTask(task.listId!, taskId, { status: task.status === "done" ? "todo" : "done" });
      if (task.status === "todo") {
        import("@/lib/confetti").then(m => { m.fireTaskDoneConfetti(null); m.playTaskDoneSound(); });
      }
    } else {
      completeTask(taskId);
    }
  }, [activeTasks, completedTasks, sharedLists, updateSharedTask, completeTask]);

  const routeDeleteTask = useCallback((taskId: string) => {
    const task = [...activeTasks, ...completedTasks].find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      deleteSharedTask(task.listId!, taskId);
    } else {
      deleteTask(taskId);
    }
  }, [activeTasks, completedTasks, sharedLists, deleteSharedTask, deleteTask]);

  const routeToggleSubTask = useCallback((taskId: string, subId: string) => {
    const task = [...activeTasks, ...completedTasks].find(t => t.id === taskId);
    if (!task) return;
    const isShared = task.listId && sharedLists[task.listId];
    if (isShared) {
      const sub = task.subTasks?.find(s => s.id === subId);
      if (!sub) return;
      const updatedSubtasks = task.subTasks!.map(s => s.id === subId ? { ...s, status: s.status === "done" ? "todo" : "done" as "todo" | "done" } : s);
      updateSharedTask(task.listId!, taskId, { subTasks: updatedSubtasks });
    } else {
      toggleSubTask(taskId, subId);
    }
  }, [activeTasks, completedTasks, sharedLists, updateSharedTask, toggleSubTask]);

  const stats = {
    total: tasks.filter((t) => !t.isArchived).length,
    today: tasks.filter((t) => {
      if (!t.dueDate || t.isArchived || t.status === "done") return false;
      return t.dueDate === new Date().toISOString().split("T")[0] || t.dueDate < new Date().toISOString().split("T")[0];
    }).length,
    overdue: tasks.filter((t) => {
      if (!t.dueDate || t.isArchived || t.status === "done") return false;
      return t.dueDate < new Date().toISOString().split("T")[0];
    }).length,
  };

  const currentListName = currentSharedListId
    ? sharedLists[currentSharedListId]?.list.name
    : currentListId
      ? lists.find((l) => l.id === currentListId)?.name
      : VIEW_LABELS[currentView];

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

// O-007：拖曳排序 ─────────────────────────────────────
// 僅同清單內（簡單版範圍）；shared list 跳過拖曳(viewer 唯讀 + 簡單版不跨清單)
// 拖曳中用 DragOverlay 顯示半透明浮起卡片,完成後從 activeTasks 算新 order 寫入 store
// L6.5:已完成任務不可拖曳（它們已折疊於獨立區段,不參與 active 排序）
// Bug C #014 第 4 輪:手機 PWA 環境下,即便 sensors 已改 MouseSensor+TouchSensor,
// dnd-kit SortableContext 仍可能干擾 touch event 路由(尤其 iOS PWA 在 background
// freeze 解除後 React state stale 期間)。
// 解法:手機版直接 disable sortable(也不掛 SortableContext),治標但可靠;
// 桌面版維持 sortable 完整功能。
const [isMobile, setIsMobile] = useState(false);
useEffect(() => {
  const mql = window.matchMedia("(max-width: 767px)");
  const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
  handler(mql);
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}, []);

const canDrag = !currentSharedListId && !isMobile;
  // MouseSensor + TouchSensor(取代 PointerSensor)
  // 原因:PointerSensor 在 iOS Safari 上已知限制 — touchmove 期間無法可靠 preventDefault,
  // 導致 sortable item 抓走所有 touch event,內層 scroll container 收不到向上 pan,
  // 出現「向下滑正常、向上滑只看到頁面 rubber band」的症狀(Bug C #014 第 3 輪 root cause)
  // TouchSensor + delay: 250ms + tolerance: 8px:scroll 可立即開始,
  // hold 250ms 才進入拖曳意圖,避免誤觸。
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // 「今天先這樣」按鈕透過 useProactiveClosure 統一資料流
  // 與 Zen 模式 TodayWrapUpButton 共用 hook,行為鎖死一致
  // §Hooks-Rules:hook 必須在條件外呼叫;按鈕本身用條件渲染控制可見性
  const { wrapUp: proactiveWrap, wrapping: proactiveWrapping } = useProactiveClosure({
    onBeforeWrap: async (pending) => {
      const ok = await confirm({
        title: "今天先這樣？",
        message: `把 ${pending.length} 項未完成的任務收起來,明天又是新的開始。`,
        confirmText: "好,明天再說",
        cancelText: "再想想",
        tone: "info",
      });
      return ok;
    },
  });
  const showWrapUpButton =
    !["today", "next7days", "list", "archived"].includes(currentView) &&
    filteredTasks.some((t) => t.status !== "done");
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = activeTasks.findIndex((t) => t.id === active.id);
    const newIdx = activeTasks.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(activeTasks, oldIdx, newIdx);
    reorderTasks(reordered);
  };
  const activeDragTask = activeDragId ? activeTasks.find((t) => t.id === activeDragId) : null;

  // Clear selection if selected task is deleted
  useEffect(() => {
    // 只有 tasks 已載入後才檢查,避免初始空陣列時 selectedTaskId
    // 被誤判為「無效 task」而 toggle off,造成桌面版任務詳情打不開
    if (selectedTaskId && tasks.length > 0) {
      const isPersonalTask = tasks.some((t) => t.id === selectedTaskId);
      const isSharedTask = Object.values(sharedLists).flatMap(list => list.tasks).some(t => t.id === selectedTaskId);
      if (!isPersonalTask && !isSharedTask) {
        onSelectTask(selectedTaskId); // toggle off
      }
    }
  }, [tasks, sharedLists, selectedTaskId, onSelectTask]);

  const handleSelectTask = (taskId: string) => {
    onSelectTask(taskId);
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Top Header */}
      <header className="flex-shrink-0 glass sticky top-0 z-30">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Title */}
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              {onOpenMobileSidebar && (
                <button
                  onClick={onOpenMobileSidebar}
                  className="flex md:hidden p-2.5 rounded-xl press-effect touch-target flex-shrink-0"
                  style={{ color: "var(--text-primary)", background: "var(--surface-muted)" }}
                  aria-label="開啟側邊欄"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              {currentSharedListId && sharedLists[currentSharedListId] && (
                <span className="text-2xl">{sharedLists[currentSharedListId].list.icon}</span>
              )}
              {currentListId && !currentSharedListId && lists.find((l) => l.id === currentListId) && (
                <span className="text-2xl">{lists.find((l) => l.id === currentListId)!.icon}</span>
              )}
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] md:text-[18px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {currentListName}
                </h1>
                {currentListId && onOpenShareModal && (
                  <button
                    onClick={() => {
                      const list = lists.find(l => l.id === currentListId)!;
                      onOpenShareModal(list, listTasks);
                    }}
                    className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                    title="分享此清單"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
                {currentView !== "inbox" && stats.today > 0 && (
                  <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {stats.today} 項今天到期
                    {stats.overdue > 0 && <span style={{ color: "var(--status-danger)" }}> · {stats.overdue} 項逾期</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Header actions — desktop only (mobile uses FAB) */}
            <div className="hidden md:flex items-center gap-2">
              {userMenu}
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 hover:opacity-80"
                style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
                aria-label="進入禪模式：一次只做一件事"
              >
                <Sparkles className="w-4 h-4" />
                <span>禪模式</span>
              </Link>
              <button
                onClick={onOpenFlowTimer}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150"
                style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                aria-label="開啟心流計時器"
              >
                <Timer className="w-4 h-4" />
                <span title="心流計時器">心流計時器</span>
              </button>
              {!currentSharedListId && (
              <button
                onClick={() => { setFormInitialStatus("todo"); setIsFormOpen(true); }}
                className="btn-primary"
                aria-label="新增任務"
              >
                <Plus className="w-4 h-4" />
                <span>新增</span>
              </button>
              )}
            </div>
          </div>

          {/* Quick Add Bar — hidden in shared list view */}
          {!currentSharedListId && (
          <div className="mt-3 relative">
            <div className="relative flex items-center">
              <Zap className="absolute left-3.5 w-4 h-4 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
              <input
                ref={quickAddRef}
                type="text"
                enterKeyHint="send"
                value={quickAddInput}
                onChange={(e) => setQuickAddInput(e.target.value)}
                onKeyDown={(e) => {
                  if (isComposingKey(e)) return;
                  if (e.key === "Enter") { e.preventDefault(); handleQuickAdd(); }
                  if (e.key === "Escape") { setQuickAddInput(""); quickAddRef.current?.blur(); }
                }}
                onFocus={() => setQuickAddHint(true)}
                onBlur={() => setTimeout(() => setQuickAddHint(false), 200)}
                placeholder="快速新增：明天 3pm 開會 p1 #工作"
                className="input pl-10 pr-10 text-[16px]"
                style={{ touchAction: "manipulation" }}
              />
              {quickAddInput && (
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleQuickAdd();
                  }}
                  className="absolute right-2 p-2.5 rounded-lg hover:bg-black/5 active:scale-95 transition-all duration-150 cursor-pointer"
                  style={{ color: "var(--brand)", touchAction: "manipulation" }}
                  aria-label="送出快速新增"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {quickAddHint && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute left-0 top-full mt-1.5 z-20 px-3 py-2 rounded-xl text-[12px] leading-relaxed shadow-md"
                style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", maxWidth: 360, boxShadow: "var(--shadow-md)" }}
              >
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>提示：</span>
                <span>「今天/明天/下週三」設定日期</span>
                <span className="mx-1.5">·</span>
                <span>「p1/p2/p3」設定優先級</span>
                <span className="mx-1.5">·</span>
                <span>「#標籤」加入標籤</span>
                <br />
                <span>「每週三」建立重複任務</span>
              </motion.div>
            )}
          </div>
          )}

            {/* Shared list quick add（viewer 隱藏） */}
            {currentSharedListId && !isReadOnlyShared && (
              <div className="mt-3 relative">
                <div className="relative flex items-center">
                  <Zap className="absolute left-3.5 w-4 h-4 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
                  <input
                    ref={sharedQuickAddRef}
                    type="text"
                    value={sharedQuickAddInput}
                    onChange={(e) => setSharedQuickAddInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (isComposingKey(e)) return;
                      if (e.key === "Enter") { e.preventDefault(); handleSharedQuickAdd(); }
                      if (e.key === "Escape") { setSharedQuickAddInput(""); sharedQuickAddRef.current?.blur(); }
                    }}
                    placeholder="新增任務至共用清單..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[16px] transition-all duration-150 focus-visible:outline-none"
                    style={{
                      background: "var(--surface-muted)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    onClick={handleSharedQuickAdd}
                    className="absolute right-2 p-1.5 rounded-lg transition-all"
                    style={{ background: "var(--brand)", color: "#fff" }}
                    aria-label="送出快速新增"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
        </div>
      </header>

        {/* Main Content — explicit height chain via h-[calc(...)] */}
        <main className={`flex-shrink-0 flex flex-row md:flex-row h-[calc(100dvh-var(--header-height,64px)-var(--search-bar-height,52px)-var(--safe-area-bottom,60px))] md:h-[calc(100vh-var(--header-height,64px)-var(--search-bar-height,52px))] ${selectedTaskId ? "md:max-w-[calc(100vw-480px-1px)]" : ""}`}>
          {/* Scroll wrapper: explicit height so inner overflow-y-auto calculates bounds correctly */}
          <div className="flex flex-col min-h-0 w-full h-full">
          {/* Left: Task list — scroll container */}
          <div
            style={{ WebkitOverflowScrolling: "touch" }}
            className={`flex-1 min-h-0 overflow-y-auto overscroll-contain h-full md:pb-5 ${selectedTaskId ? "hidden md:flex md:flex-col" : "flex flex-col"}`}
          >
          <div className="px-6 py-5 min-w-0 flex flex-col flex-1">
            {/* 失物招領 — 只在 Inbox(任務大廳)頂端顯示
                死守「Today = 神聖專注區」:失物招領永遠不出現在「今天/禪模式」等專注視圖
                避免 ADHD 用戶進入「今天」時被昨天的過期任務焦慮擊垮 */}
            {/* Shared list filter chips — page-level top
                治本修法:當 currentView === "inbox"(預設)時,LostAndFound 會渲染在 shared list fragment 上方,
                把 fragment 內的 chips 擠到畫面中段。把 chips 提到 LostAndFound 之上,
                確保 shared list 篩選器永遠在 page 頂端可見。
                條件守門:`currentView !== "archived"`(archived 不顯示 chips);
                personal list 完全不受影響(個人清單 chips 仍在 toolbar line 693)。 */}
            {currentSharedListId && sharedLists[currentSharedListId] && currentView !== "archived" && (
              <StatusFilterChips
                tasks={sharedListTasks}
                activeStatus={activeFilter.status}
                onStatusChange={(status) => setActiveFilter({ ...activeFilter, status })}
                className="mb-4"
              />
            )}

            {currentView === "inbox" && <LostAndFound />}

            {/* Viewer 唯讀提示 */}
            {isReadOnlyShared && (
              <div
                className="mb-4 px-3 py-2 rounded-xl text-[12px] flex items-center gap-2"
                style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                role="status"
              >
                <Shield className="w-3.5 h-3.5" />
                你目前是 Viewer（唯讀）。如需編輯請聯絡 Owner。
              </div>
            )}

            {/* Shared List View */}
            {currentView === "archived" ? (
              <ArchivedTasksView />
            ) : currentSharedListId && sharedLists[currentSharedListId] ? (
              <>
                {/* chips 已上移到 page top(見上方條件渲染) */}
                <div className="mb-4">
                  <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    由 {sharedLists[currentSharedListId].ownerName ?? "未知"} 分享
                  </p>
                </div>
                {sharedListTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
                      <Zap className="w-8 h-8" style={{ color: "var(--text-tertiary)" }} />
                    </div>
                    <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>此清單還沒有任務</p>
                    <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>使用上方輸入框新增任務</p>
                  </div>
                ) : sharedFilteredTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
                      <CheckCheck className="w-6 h-6" style={{ color: "var(--text-tertiary)" }} />
                    </div>
                    <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>
                      此狀態目前沒有任務
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveFilter({ ...activeFilter, status: undefined })}
                      className="rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
                      style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
                    >
                      顯示全部任務
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <AnimatePresence>
                      {[...sharedFilteredTasks]
                        .filter(t => explicitlyShowingDone || t.status !== "done")
                        .sort((a, b) => {
                        return 0;
                      }).map((task) => (
                        <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}>
                          {isReadOnlyShared ? (
                            <TaskListItem
                              task={task}
                              isSelected={task.id === selectedTaskId}
                              onClick={() => handleSelectTask(task.id)}
                              onToggleStatus={() => {}}
                              onAddToToday={showAddToToday ? addToToday : undefined}
                            />
                          ) : (
                            <TaskSwipeWrapper taskId={task.id} isDone={task.status === "done"} onComplete={() => updateSharedTask(currentSharedListId, task.id, { status: task.status === "done" ? "todo" : "done" })} onDelete={() => deleteSharedTask(currentSharedListId, task.id)} onArchive={() => updateSharedTask(currentSharedListId, task.id, { isArchived: true })} onAddToToday={showAddToToday ? addToToday : undefined}>
                              <TaskListItem
                                task={task}
                                isSelected={task.id === selectedTaskId}
                                onClick={() => handleSelectTask(task.id)}
                                onToggleStatus={() => updateSharedTask(currentSharedListId, task.id, { status: task.status === "done" ? "todo" : "done" })}
                                onDelete={() => deleteSharedTask(currentSharedListId, task.id)}
                                onAddToToday={showAddToToday ? addToToday : undefined}
                                onUpdatePriority={(id, p) => updateSharedTask(currentSharedListId, id, { priority: p })}
                                onUpdateTags={(id, tags) => updateSharedTask(currentSharedListId, id, { tags })}
                                allTags={Object.keys(getTagCounts())}
                              />
                            </TaskSwipeWrapper>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Shared List 已完成任務折疊區 */}
                    {!explicitlyShowingDone && sharedFilteredTasks.filter(t => t.status === "done").length > 0 && (
                      <details
                        className="mt-3 group/completed flex-shrink-0"
                        open={completedExpanded}
                        onToggle={(e) => {
                          const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                          if (isOpen !== completedExpanded) {
                            setCompletedExpanded(isOpen);
                            try { localStorage.setItem("completed-collapsed", String(!isOpen)); } catch {}
                          }
                        }}
                      >
                        <summary
                          className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-colors duration-150 hover:bg-black/[0.03] active:scale-[0.99] list-none [&::-webkit-details-marker]:hidden"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-open/completed:rotate-90" style={{ color: "var(--text-tertiary)" }} />
                            <span className="text-[12px] font-medium">
                              已完成 {sharedFilteredTasks.filter(t => t.status === "done").length} 項
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleCompletedExpanded();
                            }}
                            className="text-[11px] px-2 py-1 rounded-md transition-colors duration-150 hover:bg-black/5"
                            style={{ color: "var(--text-tertiary)" }}
                            aria-label={completedExpanded ? "全部收起" : "全部展開"}
                          >
                            {completedExpanded ? "全部收起" : "全部展開"}
                          </button>
                        </summary>
                        <div className="flex flex-col gap-1 mt-1.5 pl-1">
                          <AnimatePresence mode="popLayout">
                            {sharedFilteredTasks.filter(t => t.status === "done").map((task) => (
                              <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}>
                                {isReadOnlyShared ? (
                                  <TaskListItem
                                    task={task}
                                    isSelected={task.id === selectedTaskId}
                                    onClick={() => handleSelectTask(task.id)}
                                    onToggleStatus={() => {}}
                                    onAddToToday={showAddToToday ? addToToday : undefined}
                                  />
                                ) : (
                                  <TaskSwipeWrapper taskId={task.id} isDone={task.status === "done"} onComplete={() => updateSharedTask(currentSharedListId, task.id, { status: task.status === "done" ? "todo" : "done" })} onDelete={() => deleteSharedTask(currentSharedListId, task.id)} onArchive={() => updateSharedTask(currentSharedListId, task.id, { isArchived: true })} onAddToToday={showAddToToday ? addToToday : undefined}>
                                    <TaskListItem
                                      task={task}
                                      isSelected={task.id === selectedTaskId}
                                      onClick={() => handleSelectTask(task.id)}
                                      onToggleStatus={() => updateSharedTask(currentSharedListId, task.id, { status: task.status === "done" ? "todo" : "done" })}
                                      onDelete={() => deleteSharedTask(currentSharedListId, task.id)}
                                      onAddToToday={showAddToToday ? addToToday : undefined}
                                      onUpdatePriority={(id, p) => updateSharedTask(currentSharedListId, id, { priority: p })}
                                      onUpdateTags={(id, tags) => updateSharedTask(currentSharedListId, id, { tags })}
                                      allTags={Object.keys(getTagCounts())}
                                    />
                                  </TaskSwipeWrapper>
                                )}
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Toolbar — 永遠渲染（避免「點了進行中 → 該清單沒進行中任務 → 整個區塊走向 EmptyState → chip 消失」的陷阱。EmptyState 與 task list 改為 toolbar 下方的 sibling，而非 ternary 的對立分支。） */}
                <div className="flex items-center justify-between gap-2 sm:gap-4 mb-4 min-w-0">
                    <StatusFilterChips
                      tasks={filteredTasks}
                      activeStatus={activeFilter.status}
                      onStatusChange={(status) => setActiveFilter({ ...activeFilter, status })}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {showWrapUpButton && (
                        <button
                          onClick={() => { void proactiveWrap(filteredTasks); }}
                          disabled={proactiveWrapping}
                          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 rounded-full text-[12px] font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ background: "rgba(120,119,198,0.12)", color: "var(--text-secondary)" }}
                          title="把未完成的任務收起來,給自己一個乾淨的開始"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path d="M1 6C1 3.24 3.24 1 6 1s5 2.24 5 5-2.24 5-5 5-5-2.24-5-5Z" stroke="currentColor" strokeWidth="1.2"/>
                            <path d="M4 6l1.5 1.5L8 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          今天先這樣
                        </button>
                      )}
                      <div className="flex items-center gap-0.5 p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.04)" }}>
                        <button onClick={() => setViewMode("list")} className="p-1.5 rounded-lg transition-all duration-150" style={viewMode === "list" ? { background: "var(--surface)", boxShadow: "var(--shadow-xs)", color: "var(--text-primary)" } : { color: "var(--text-tertiary)" }} aria-label="列表檢視">
                          <List className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewMode("grid")} className="p-1.5 rounded-lg transition-all duration-150" style={viewMode === "grid" ? { background: "var(--surface)", boxShadow: "var(--shadow-xs)", color: "var(--text-primary)" } : { color: "var(--text-tertiary)" }} aria-label="網格檢視">
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                </div>
                {/* Task list 區塊 — activeTasks 空時顯示對應空狀態,有任務時渲染清單 */}
                {currentView === "inbox" && activeTasks.length === 0 && completedTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 py-12 px-4">
                    <motion.div
                      className="w-full max-w-md"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                      <div className="text-center mb-8">
                        <h2 className="text-[20px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                          把腦中的東西倒出來
                        </h2>
                        <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>
                          想到什麼就寫什麼,不用組織,不用分類
                        </p>
                      </div>
                      <div className="relative">
                          <textarea
                          ref={(el) => {
                            if (el) {
                              brainDumpRef.current = el;
                              setTimeout(() => el.focus(), 100);
                            }
                          }}
                          value={quickAddInput}
                          onChange={(e) => {
                            setQuickAddInput(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                          }}
                          onKeyDown={(e) => {
                            if (isComposingKey(e)) return;
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleQuickAdd();
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = "auto";
                            }
                          }}
                          placeholder="寫下任何東西... 按 Enter 直接變成任務"
                          rows={3}
                          className="w-full resize-none rounded-2xl px-5 py-4 text-[16px] placeholder:text-[var(--text-tertiary)] focus:outline-none transition-all duration-200"
                          style={{
                            background: "var(--surface-elevated)",
                            border: "2px solid var(--border)",
                            boxShadow: "var(--shadow-md)",
                            color: "var(--text-primary)",
                            lineHeight: 1.5,
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = "var(--brand)";
                            e.target.style.boxShadow = "0 0 0 4px rgba(59,130,246,0.12), var(--shadow-md)";
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "var(--border)";
                            e.target.style.boxShadow = "var(--shadow-md)";
                          }}
                        />
                        <div className="mt-3 flex items-center justify-center gap-2">
                          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                            支援自然語言：明天下午3點 #工作 p1
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ) : todayActiveTasks.length === 0 && overdueTasks.length === 0 && completedTasks.length === 0 ? (
                  <EmptyState
                    onAddTask={() => {
                      // 「進行中」空白 → 預設建立 in-progress 任務，其他維持 todo
                      setFormInitialStatus(activeFilter.status === "in-progress" ? "in-progress" : "todo");
                      setIsFormOpen(true);
                    }}
                    variant={
                      currentView === "today"
                        ? "today"
                        : currentView === "all"
                        ? "all"
                        : currentView === "tags"
                        ? "tags"
                        : currentView === "stats"
                        ? "stats"
                        : "general"
                    }
                  />
                ) : (
                  <div className="flex flex-col gap-1">
                    {canDrag ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={todayActiveTasks.map((t) => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <AnimatePresence mode="popLayout">
                            {todayActiveTasks.map((task) => (
                              <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}>
                                <TaskSwipeWrapper
                                  taskId={task.id}
                                  isDone={task.status === "done"}
                                  onComplete={() => routeCompleteTask(task.id)}
                                  onDelete={(id) => routeDeleteTask(id)}
                                  onAddToToday={showAddToToday ? addToToday : undefined}
                                >
                                  <SortableTaskItem
                                    task={task}
                                    isSelected={task.id === selectedTaskId}
                                    onClick={() => handleSelectTask(task.id)}
                                    onToggleStatus={routeCompleteTask}
                                    onToggleSubTask={routeToggleSubTask}
                                    onUpdatePriority={(id, p) => routeUpdateTask(id, { priority: p })}
                                    onUpdateTags={(id, tags) => routeUpdateTask(id, { tags })}
                                    onTogglePin={(id) => routeUpdateTask(id, { isPinned: !tasks.find(t => t.id === id)?.isPinned })}
                                    onDelete={(id) => routeDeleteTask(id)}
                                    onAddToToday={showAddToToday ? addToToday : undefined}
                                    onHoverEnter={currentSharedListId ? undefined : setHoveredTaskId}
                                    onHoverLeave={currentSharedListId ? undefined : (id) => setHoveredTaskId((prev) => (prev === id ? null : prev))}
                                    allTags={Object.keys(getTagCounts())}
                                    batchMode={batchMode}
                                    batchSelected={!!batchSelectedIds?.has(task.id)}
                                    onLongPress={() => onEnterBatchMode?.(task.id)}
                                    onBatchToggle={() => onToggleBatchSelect?.(task.id)}
                                  />
                                </TaskSwipeWrapper>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </SortableContext>
                        <DragOverlay>
                          {activeDragTask && (
                            <div className="shadow-2xl rounded-2xl ring-2 ring-[var(--brand)] opacity-90">
                              <TaskListItem
                                task={activeDragTask}
                                isSelected={false}
                                onClick={() => {}}
                                onToggleStatus={() => {}}
                                onUpdatePriority={() => {}}
                                onUpdateTags={() => {}}
                                onDelete={() => {}}
                                allTags={Object.keys(getTagCounts())}
                              />
                            </div>
                          )}
                        </DragOverlay>
                      </DndContext>
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {todayActiveTasks.map((task) => (
                          <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}>
                            <TaskSwipeWrapper
                              taskId={task.id}
                              isDone={task.status === "done"}
                              onComplete={() => routeCompleteTask(task.id)}
                              onDelete={(id) => routeDeleteTask(id)}
                              onAddToToday={showAddToToday ? addToToday : undefined}
                            >
                              <TaskListItem
                                task={task}
                                isSelected={task.id === selectedTaskId}
                                onClick={() => handleSelectTask(task.id)}
                                onToggleStatus={routeCompleteTask}
                                onToggleSubTask={routeToggleSubTask}
                                onUpdatePriority={(id, p) => routeUpdateTask(id, { priority: p })}
                                onUpdateTags={(id, tags) => routeUpdateTask(id, { tags })}
                                onTogglePin={(id) => routeUpdateTask(id, { isPinned: !tasks.find(t => t.id === id)?.isPinned })}
                                onDelete={(id) => routeDeleteTask(id)}
                                onAddToToday={showAddToToday ? addToToday : undefined}
                                onHoverEnter={currentSharedListId ? undefined : setHoveredTaskId}
                                onHoverLeave={currentSharedListId ? undefined : (id) => setHoveredTaskId((prev) => (prev === id ? null : prev))}
                                allTags={Object.keys(getTagCounts())}
                                batchMode={batchMode}
                                batchSelected={!!batchSelectedIds?.has(task.id)}
                                onLongPress={() => onEnterBatchMode?.(task.id)}
                                onBatchToggle={() => onToggleBatchSelect?.(task.id)}
                              />
                            </TaskSwipeWrapper>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}

                    {/* T2「已過期任務」折疊區 — 頂部獨立呈現,預設展開(誠實面對債務),可折疊
                          琥珀色 icon（不與卡片紅色「已過期 X 小時」chip 雙重堆疊）
                          過期任務仍可勾選完成 / 刪除 / 拖曳排序 / 進詳情面板
                          與「已完成」折疊區共用 <details> pattern,折疊偏好 localStorage 持久化 */}
                    {!explicitlyShowingDone && overdueTasks.length > 0 && (
                      <details
                        className="mt-3 group/overdue"
                        open={overdueExpanded}
                        onToggle={(e) => {
                          const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                          if (isOpen !== overdueExpanded) {
                            setOverdueExpanded(isOpen);
                            try { localStorage.setItem("overdue-collapsed", String(!isOpen)); } catch {}
                          }
                        }}
                      >
                        <summary
                          className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-colors duration-150 hover:bg-black/[0.03] active:scale-[0.99] list-none [&::-webkit-details-marker]:hidden"
                          style={{ color: "var(--status-warning)" }}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-open/overdue:rotate-90" style={{ color: "var(--status-warning)" }} />
                            <span className="text-[12px] font-medium">
                              已過期 {overdueTasks.length} 項
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleOverdueExpanded();
                            }}
                            className="text-[11px] px-2 py-1 rounded-md transition-colors duration-150 hover:bg-black/5"
                            style={{ color: "var(--status-warning)" }}
                            aria-label={overdueExpanded ? "全部收起" : "全部展開"}
                          >
                            {overdueExpanded ? "全部收起" : "全部展開"}
                          </button>
                        </summary>
                        <div className="flex flex-col gap-1 mt-1.5 pl-1">
                          <AnimatePresence mode="popLayout">
                            {overdueTasks.map((task) => (
                              <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}>
                                <TaskSwipeWrapper
                                  taskId={task.id}
                                  isDone={task.status === "done"}
                                  onComplete={() => routeCompleteTask(task.id)}
                                  onDelete={(id) => routeDeleteTask(id)}
                                >
                                  <TaskListItem
                                    task={task}
                                    isSelected={task.id === selectedTaskId}
                                    onClick={() => handleSelectTask(task.id)}
                                    onToggleStatus={routeCompleteTask}
                                    onToggleSubTask={routeToggleSubTask}
                                    onUpdatePriority={(id, p) => routeUpdateTask(id, { priority: p })}
                                    onUpdateTags={(id, tags) => routeUpdateTask(id, { tags })}
                                    onTogglePin={(id) => routeUpdateTask(id, { isPinned: !tasks.find(t => t.id === id)?.isPinned })}
                                    onDelete={(id) => routeDeleteTask(id)}
                                    onAddToToday={currentSharedListId ? undefined : addToToday}
                                    addToTodayLabel="轉今日任務"
                                    onHoverEnter={currentSharedListId ? undefined : setHoveredTaskId}
                                    onHoverLeave={currentSharedListId ? undefined : (id) => setHoveredTaskId((prev) => (prev === id ? null : prev))}
                                    allTags={Object.keys(getTagCounts())}
                                    batchMode={batchMode}
                                    batchSelected={!!batchSelectedIds?.has(task.id)}
                                    onLongPress={() => onEnterBatchMode?.(task.id)}
                                    onBatchToggle={() => onToggleBatchSelect?.(task.id)}
                                  />
                                </TaskSwipeWrapper>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </details>
                    )}

                    {/* L6.5「已完成任務」折疊區 — 預設 collapse;點 summary 展開 */}
                    {!explicitlyShowingDone && completedTasks.length > 0 && (
                      <details
                        className="mt-3 group/completed"
                        open={completedExpanded}
                        onToggle={(e) => {
                          const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                          if (isOpen !== completedExpanded) {
                            setCompletedExpanded(isOpen);
                            try { localStorage.setItem("completed-collapsed", String(!isOpen)); } catch {}
                          }
                        }}
                      >
                        <summary
                          className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-colors duration-150 hover:bg-black/[0.03] active:scale-[0.99] list-none [&::-webkit-details-marker]:hidden"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-open/completed:rotate-90" style={{ color: "var(--text-tertiary)" }} />
                            <span className="text-[12px] font-medium">
                              已完成 {completedTasks.length} 項
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleCompletedExpanded();
                            }}
                            className="text-[11px] px-2 py-1 rounded-md transition-colors duration-150 hover:bg-black/5"
                            style={{ color: "var(--text-tertiary)" }}
                            aria-label={completedExpanded ? "全部收起" : "全部展開"}
                          >
                            {completedExpanded ? "全部收起" : "全部展開"}
                          </button>
                        </summary>
                        <div className="flex flex-col gap-1 mt-1.5 pl-1">
                          <AnimatePresence mode="popLayout">
                            {completedTasks.map((task) => (
                              <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}>
                                <TaskSwipeWrapper
                                  taskId={task.id}
                                  isDone={task.status === "done"}
                                  onComplete={() => routeCompleteTask(task.id)}
                                  onDelete={(id) => routeDeleteTask(id)}
                                >
                                  <TaskListItem
                                    task={task}
                                    isSelected={task.id === selectedTaskId}
                                    onClick={() => handleSelectTask(task.id)}
                                    onToggleStatus={routeCompleteTask}
                                    onToggleSubTask={routeToggleSubTask}
                                    onUpdatePriority={(id, p) => routeUpdateTask(id, { priority: p })}
                                    onUpdateTags={(id, tags) => routeUpdateTask(id, { tags })}
                                    onTogglePin={(id) => routeUpdateTask(id, { isPinned: !tasks.find(t => t.id === id)?.isPinned })}
                                    onDelete={(id) => routeDeleteTask(id)}
                                    allTags={Object.keys(getTagCounts())}
                                    batchMode={batchMode}
                                    batchSelected={!!batchSelectedIds?.has(task.id)}
                                    onLongPress={() => onEnterBatchMode?.(task.id)}
                                    onBatchToggle={() => onToggleBatchSelect?.(task.id)}
                                  />
                                </TaskSwipeWrapper>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </>
            )}
            {/* 解決 flex scroll 容器 padding-bottom 被忽略的 bug：用 spacer 取代 pb */}
            <div className="h-[calc(72px+env(safe-area-inset-bottom,0px)+16px)] flex-shrink-0" />
          </div>
          </div>
          </div>{/* end scroll wrapper */}
        </main>

      {/* Task Form Modal */}
      <TaskForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingTask(null); }}
        onSubmit={handleSubmit}
        initialData={editingTask}
        currentListId={currentListId}
        currentView={currentView}
        initialStatus={formInitialStatus}
      />

      {/* FAB — Mobile only, hidden in shared list view and when task selected */}
      {!currentSharedListId && !selectedTaskId && (
      <button
        className="md:hidden fab"
        onClick={() => { setFormInitialStatus("todo"); setIsFormOpen(true); setEditingTask(null); }}
        aria-label="新增任務"
        style={{ animation: "fab-pop 300ms cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>
      )}

      {/* 批次動作列（PRO 專屬,僅在 batchMode 顯示） */}
      <AnimatePresence>
        {batchMode && (
          <motion.div
            key="batch-bar"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] md:bottom-6 md:px-0"
            role="region"
            aria-label="批次動作"
          >
            <div
              className="max-w-2xl mx-auto rounded-2xl px-4 py-3 flex items-center gap-2"
              style={{
                background: "var(--surface-elevated)",
                boxShadow: "var(--shadow-xl)",
                backdropFilter: "blur(20px)",
              }}
            >
              <button
                onClick={onExitBatchMode}
                className="p-2 rounded-xl hover:bg-black/5 transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="退出批次模式"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
              <span
                className="text-[13px] font-medium flex-1 min-w-0 truncate"
                style={{ color: "var(--text-primary)" }}
              >
                已選 {batchSelectedIds?.size ?? 0} 項
              </span>
              <button
                onClick={onBatchComplete}
                disabled={!batchSelectedIds || batchSelectedIds.size === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
                style={{ background: "rgba(34, 197, 94, 0.12)", color: "#16A34A" }}
                aria-label="批次標記完成"
              >
                <CheckCheck className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">標記完成</span>
              </button>
              <button
                onClick={onBatchDelete}
                disabled={!batchSelectedIds || batchSelectedIds.size === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
                style={{ background: "rgba(220, 38, 38, 0.12)", color: "#DC2626" }}
                aria-label="批次刪除"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">刪除</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ label: string; value?: TaskStatus }> = [
  { label: "全部" },
  { label: "進行中", value: "in-progress" },
  { label: "待辦中", value: "todo" },
  { label: "已完成", value: "done" },
];

function StatusFilterChips({
  tasks,
  activeStatus,
  onStatusChange,
  className = "",
}: {
  tasks: Task[];
  activeStatus?: TaskStatus;
  onStatusChange: (status?: TaskStatus) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-2 pb-1 touch-scroll ${className}`}
      role="group"
      aria-label="依任務狀態篩選"
    >
      {STATUS_FILTER_OPTIONS.map(({ label, value }) => {
        const isActive = activeStatus === value;
        const count = value
          ? tasks.filter((task) => task.status === value).length
          : tasks.length;

        return (
          <button
            key={value ?? "all"}
            type="button"
            onClick={() => onStatusChange(value)}
            aria-pressed={isActive}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] sm:px-3.5"
            style={isActive
              ? { background: "var(--brand)", color: "var(--brand-foreground)" }
              : { background: "rgba(0,0,0,0.04)", color: "var(--text-secondary)" }}
          >
            <span>{label}</span>
            <span aria-label={`${count} 項`} style={{ opacity: 0.5 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Archived Tasks View ──────────────────────────────────────────
function ArchivedTasksView() {
  const { tasks, unarchiveTask, deleteTask } = useApp();
  const archived = tasks.filter((t) => t.isArchived);

  if (archived.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "var(--surface-muted)" }}
        >
          <Archive className="w-8 h-8" style={{ color: "var(--text-tertiary)" }} />
        </div>
        <p className="text-[14px] font-medium" style={{ color: "var(--text-tertiary)" }}>
          沒有已封存的任務
        </p>
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          向左滑動或點擊任務右上角 ⋮ 來封存任務
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
        {archived.length} 個已封存任務
      </p>
      <AnimatePresence mode="popLayout">
        {archived.map((task) => (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border group transition-all duration-150"
            style={{
              background: "var(--surface-elevated)",
              borderColor: "var(--border)",
            }}
          >
            {/* Status indicator */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background:
                  task.status === "done"
                    ? "var(--status-success)"
                    : task.priority === "do-now" || task.priority === "schedule"
                    ? "var(--status-danger)"
                    : task.priority === "delegate"
                    ? "var(--status-warning)"
                    : "var(--text-tertiary)",
                opacity: 0.6,
              }}
            />

            {/* Title */}
            <span
              className="flex-1 text-[14px] line-through truncate"
              style={{ color: "var(--text-tertiary)" }}
            >
              {task.title}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={() => unarchiveTask(task.id)}
                className="p-2 rounded-xl transition-all duration-150 hover:scale-105 active:scale-95"
                style={{ color: "var(--brand)", background: "var(--brand-tint)" }}
                title="還原任務"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => { if (window.confirm(`「${task.title}」將永久刪除，無法復原。`)) deleteTask(task.id); }}
                className="p-2 rounded-xl transition-all duration-150 hover:scale-105 active:scale-95"
                style={{ color: "var(--status-danger)", background: "rgba(239,68,68,0.1)" }}
                title="永久刪除"
                aria-label="刪除任務"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
