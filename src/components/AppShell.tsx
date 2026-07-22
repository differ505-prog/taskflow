"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { useConfirm } from "@/hooks/useConfirm";
import { Task, AppView, TaskList } from "@/lib/types";
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
  Share2, Shield, RotateCcw, Trash2, CheckCheck,
} from "lucide-react";
import { isComposingKey } from "@/utils/imeGuard";

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
};

interface AppShellProps {
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onOpenSettings: () => void;
  onOpenListForm: () => void;
  onEditList: (list: TaskList) => void;
  onDeleteList: (id: string) => void;
  onOpenPomodoro: () => void;
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
  onEditList, onDeleteList, onOpenPomodoro, onOpenMobileSidebar,
  onOpenShareModal, userMenu,
  batchMode = false, batchSelectedIds, onEnterBatchMode, onToggleBatchSelect,
  onExitBatchMode, onBatchComplete, onBatchDelete,
}: AppShellProps) {
  const {
    tasks, currentView, currentListId, currentSharedListId, sharedLists,
    lists,
    activeFilter, setActiveFilter,
    addTask, updateTask, deleteTask, toggleTaskStatus,
    archiveTask, quickAdd, getFilteredTasks, viewCounts,
    getTagCounts,
    toggleSubTask, addSubTask, deleteSubTask, completeRecurringAndClone,
    quickAddToShared, updateSharedTask, deleteSharedTask,
    getMyRole,
  } = useApp();
  const confirm = useConfirm();

  const listTasks = currentListId ? tasks.filter(t => t.listId === currentListId) : [];

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [quickAddInput, setQuickAddInput] = useState("");
  const [quickAddHint, setQuickAddHint] = useState(false);
  const [sharedQuickAddInput, setSharedQuickAddInput] = useState("");
  const sharedQuickAddRef = useRef<HTMLInputElement>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const brainDumpRef = useRef<HTMLTextAreaElement>(null);

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
  // 用戶主動點了「已完成」狀態標籤時，強制顯示已完成（忽略 showCompleted 開關）
  const explicitlyShowingDone = activeFilter.status === "done";
  const displayTasks = showCompleted || explicitlyShowingDone || currentView === "today" || currentView === "next7days" || currentView === "list"
    ? filteredTasks
    : filteredTasks.filter((t) => t.status !== "done");

  const stats = {
    total: tasks.filter((t) => !t.isArchived).length,
    today: tasks.filter((t) => !t.isArchived && t.dueDate === new Date().toISOString().split("T")[0]).length,
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

  // Clear selection if selected task is deleted
  useEffect(() => {
    // 只有 tasks 已載入後才檢查,避免初始空陣列時 selectedTaskId
    // 被誤判為「無效 task」而 toggle off,造成桌面版任務詳情打不開
    if (selectedTaskId && tasks.length > 0 && !tasks.find((t) => t.id === selectedTaskId)) {
      onSelectTask(selectedTaskId); // toggle off
    }
  }, [tasks, selectedTaskId, onSelectTask]);

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
              <button
                onClick={onOpenPomodoro}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150"
                style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                aria-label="開啟番茄鐘"
              >
                <Timer className="w-4 h-4" />
                <span title="番茄工作法 (Pomodoro Technique)">番茄鐘</span>
              </button>
              {!currentSharedListId && (
              <button
                onClick={() => setIsFormOpen(true)}
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
                className="input pl-10 pr-10"
                style={{ fontSize: 14 }}
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[14px] transition-all duration-150 focus-visible:outline-none"
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
          <div className="flex flex-col min-h-0 w-full h-full overflow-hidden">
          {/* Left: Task list — scroll container */}
          <div
            style={{ WebkitOverflowScrolling: "touch" }}
            className={`flex-1 min-h-0 overflow-y-auto overscroll-contain h-full md:pb-5 ${selectedTaskId ? "hidden md:flex md:flex-col" : "flex flex-col"}`}
          >
          <div className="px-6 py-5 pb-[calc(72px+env(safe-area-inset-bottom,0px)+16px)] min-w-0 flex flex-col flex-1">
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
                <div className="mb-4">
                  <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    由 {sharedLists[currentSharedListId].ownerName ?? "未知"} 分享
                  </p>
                </div>
                {sharedLists[currentSharedListId].tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
                      <Zap className="w-8 h-8" style={{ color: "var(--text-tertiary)" }} />
                    </div>
                    <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>此清單還沒有任務</p>
                    <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>使用上方輸入框新增任務</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <AnimatePresence>
                      {[...sharedLists[currentSharedListId].tasks].sort((a, b) => {
                        if (a.status === "done" && b.status !== "done") return 1;
                        if (a.status !== "done" && b.status === "done") return -1;
                        return 0;
                      }).map((task) => (
                        <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}>
                          {isReadOnlyShared ? (
                            <TaskCard task={task} onToggleStatus={() => {}} onEdit={() => {}} onDelete={() => {}} onArchive={() => {}} />
                          ) : (
                            <TaskSwipeWrapper taskId={task.id} isDone={task.status === "done"} onComplete={() => updateSharedTask(currentSharedListId, task.id, { status: task.status === "done" ? "todo" : "done" })} onDelete={() => deleteSharedTask(currentSharedListId, task.id)} onArchive={() => updateSharedTask(currentSharedListId, task.id, { isArchived: true })}>
                              <TaskCard
                                task={task}
                                onToggleStatus={() => updateSharedTask(currentSharedListId, task.id, { status: task.status === "done" ? "todo" : "done" })}
                                onEdit={() => {}}
                                onDelete={() => deleteSharedTask(currentSharedListId, task.id)}
                                onArchive={() => updateSharedTask(currentSharedListId, task.id, { isArchived: true })}
                                onUpdatePriority={(id, p) => updateSharedTask(currentSharedListId, id, { priority: p })}
                                onUpdateTags={(id, tags) => updateSharedTask(currentSharedListId, id, { tags })}
                              />
                            </TaskSwipeWrapper>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Toolbar — 永遠渲染（inbox 視圖除外：保留 Brain-dump 哲學）
                    避免「點了進行中 → 該清單沒進行中任務 → 整個區塊走向 EmptyState → chip 消失」的陷阱。
                    EmptyState 與 task list 改為 toolbar 下方的 sibling,而非 ternary 的對立分支。 */}
                {currentView !== "inbox" && (
                  <div className="flex items-center justify-between gap-2 sm:gap-4 mb-4 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 pb-1 touch-scroll min-w-0 flex-1">
                      {["全部", "待辦", "進行中", "已完成"].map((label, i) => {
                        const statuses = ["all", "todo", "in-progress", "done"] as const;
                        const val = statuses[i];
                        const isActive = activeFilter.status === val || (val === "all" && !activeFilter.status);
                        const count = val === "all" ? filteredTasks.length : filteredTasks.filter((t) => t.status === val).length;
                        return (
                          <button key={val} onClick={() => setActiveFilter({ ...activeFilter, status: val === "all" ? undefined : val as any })} className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 rounded-full text-[12px] font-medium transition-all duration-150"
                            style={isActive ? { background: "var(--brand)", color: "var(--brand-foreground)" } : { background: "rgba(0,0,0,0.04)", color: "var(--text-secondary)" }}>
                            {label} <span style={{ opacity: 0.5 }}>{count}</span>
                          </button>
                        );
                      })}
                      {!["today", "next7days", "list"].includes(currentView) &&
                        tasks.some((t) => t.status === "done" && !t.isArchived) && (
                        <button onClick={() => { setShowCompleted(!showCompleted); setActiveFilter({ ...activeFilter, status: undefined }); }} className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 rounded-full text-[12px] font-medium transition-all duration-150"
                          style={!showCompleted ? { background: "var(--brand-tint)", color: "var(--brand)" } : { background: "rgba(0,0,0,0.04)", color: "var(--text-tertiary)" }}>
                          <Archive className="w-3 h-3" />
                          {showCompleted ? "隱藏完成" : "顯示完成"}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!["today", "next7days", "list", "archived"].includes(currentView) &&
                        filteredTasks.some((t) => t.status !== "done") && (
                        <button
                          onClick={async () => {
                            const pendingCount = filteredTasks.filter((t) => t.status !== "done").length;
                            const ok = await confirm({
                              title: "今天先這樣？",
                              message: `把 ${pendingCount} 項未完成的任務收起來,明天又是新的開始。`,
                              confirmText: "好,明天再說",
                              cancelText: "再想想",
                              tone: "info",
                            });
                            if (ok) {
                              filteredTasks
                                .filter((t) => t.status !== "done")
                                .forEach((t) => archiveTask(t.id));
                            }
                          }}
                          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 rounded-full text-[12px] font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
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
                )}
                {/* Task list 區塊 — displayTasks 空時顯示對應空狀態,有任務時渲染清單 */}
                {currentView === "inbox" && displayTasks.length === 0 ? (
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
                ) : displayTasks.length === 0 ? (
                  <EmptyState
                    onAddTask={() => setIsFormOpen(true)}
                    variant="general"
                  />
                ) : (
                  <div className="flex flex-col gap-1">
                    <AnimatePresence mode="popLayout">
                      {displayTasks.map((task) => (
                        <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}>
                          <TaskSwipeWrapper
                            taskId={task.id}
                            isDone={task.status === "done"}
                            onComplete={() => updateTask(task.id, { status: task.status === "done" ? "todo" : "done" })}
                            onDelete={(id) => deleteTask(id)}
                          >
                            <TaskListItem
                              task={task}
                              isSelected={task.id === selectedTaskId}
                              onClick={() => handleSelectTask(task.id)}
                              onToggleStatus={toggleTaskStatus}
                              onToggleSubTask={toggleSubTask}
                              onUpdatePriority={(id, p) => updateTask(id, { priority: p })}
                              onUpdateTags={(id, tags) => updateTask(id, { tags })}
                              onTogglePin={(id) => updateTask(id, { isPinned: !tasks.find(t => t.id === id)?.isPinned })}
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
                )}
              </>
            )}
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
      />

      {/* FAB — Mobile only, hidden in shared list view and when task selected */}
      {!currentSharedListId && !selectedTaskId && (
      <button
        className="md:hidden fab"
        onClick={() => { setIsFormOpen(true); setEditingTask(null); }}
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
