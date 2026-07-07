"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { Task, AppView, TaskList } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { TaskForm } from "./TaskForm";
import { EmptyState } from "./EmptyState";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, X, LayoutGrid, List,
  Plus, Archive, Zap, ChevronRight, Timer,
} from "lucide-react";

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
};

const SEED_TASKS: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">[] = [
  {
    title: "完成專案提案簡報",
    description: "整理本季 OKR 進度並製作成 15 分鐘簡報",
    priority: "high",
    status: "in-progress",
    dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    tags: ["工作", "簡報"],
    subTasks: [
      { id: "st1", title: "收集數據資料", status: "done", createdAt: new Date().toISOString() },
      { id: "st2", title: "設計投影片母片", status: "todo", createdAt: new Date().toISOString() },
    ],
  },
  {
    title: "閱讀《原子習慣》第三章",
    priority: "medium",
    status: "todo",
    dueDate: new Date(Date.now() + 172800000).toISOString().split("T")[0],
    tags: ["閱讀"],
  },
  {
    title: "預約牙醫洗牙",
    description: "半年一次的口腔檢查",
    priority: "low",
    status: "todo",
    dueDate: new Date(Date.now() + 604800000).toISOString().split("T")[0],
    tags: ["健康"],
  },
  {
    title: "每晚冥想 10 分鐘",
    priority: "low",
    status: "todo",
    tags: ["健康", "習慣"],
    recurrence: { pattern: "daily", interval: 1, completedCount: 0 },
  },
];

function initSeedTasks(): Task[] {
  return SEED_TASKS.map((t, i) => ({
    ...t,
    id: `${Date.now()}-seed-${i}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    focusMinutes: 0,
    isArchived: false,
    order: i,
  }));
}

interface AppShellProps {
  onOpenSettings: () => void;
  onOpenListForm: () => void;
  onEditList: (list: TaskList) => void;
  onDeleteList: (id: string) => void;
  onOpenPomodoro: () => void;
}

export function AppShell({ onOpenSettings, onOpenListForm, onEditList, onDeleteList, onOpenPomodoro }: AppShellProps) {
  const {
    tasks, currentView, currentListId, lists,
    searchQuery, setSearchQuery,
    activeFilter, setActiveFilter,
    addTask, updateTask, deleteTask, toggleTaskStatus,
    archiveTask, quickAdd, getFilteredTasks, viewCounts,
    getTagCounts,
  } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [quickAddInput, setQuickAddInput] = useState("");
  const [showQuickAddHint, setShowQuickAddHint] = useState(false);
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Seed tasks on first load
  useEffect(() => {
    if (tasks.length === 0) {
      const seeds = initSeedTasks();
      seeds.forEach((t) => addTask(t));
    }
  }, []); // eslint-disable-line

  // Keyboard shortcut: Cmd+K for quick add
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        quickAddRef.current?.focus();
        setShowQuickAddHint(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleQuickAdd = useCallback(() => {
    if (!quickAddInput.trim()) return;
    quickAdd(quickAddInput);
    setQuickAddInput("");
    quickAddRef.current?.blur();
  }, [quickAdd, quickAddInput]);

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleSubmit = (data: Parameters<typeof addTask>[0]) => {
    if (editingTask) {
      updateTask(editingTask.id, data);
    } else {
      addTask(data);
    }
    setEditingTask(null);
  };

  const filteredTasks = getFilteredTasks();
  const displayTasks = showCompleted || currentView === "today" || currentView === "next7days"
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

  const currentListName = currentListId
    ? lists.find((l) => l.id === currentListId)?.name
    : VIEW_LABELS[currentView];

  return (
    <div className="flex flex-col h-full">
      {/* Top Header */}
      <header className="flex-shrink-0 glass sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Title */}
            <div className="flex items-center gap-3">
              {currentListId && lists.find((l) => l.id === currentListId) && (
                <span className="text-2xl">{lists.find((l) => l.id === currentListId)!.icon}</span>
              )}
              <div>
                <h1 className="text-[18px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {currentListName}
                </h1>
                {currentView !== "inbox" && stats.today > 0 && (
                  <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {stats.today} 項今天到期
                    {stats.overdue > 0 && <span style={{ color: "var(--status-danger)" }}> · {stats.overdue} 項逾期</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenPomodoro}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150"
                style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                aria-label="開啟番茄鐘"
              >
                <Timer className="w-4 h-4" />
                <span className="hidden sm:inline">專注</span>
              </button>
              <button
                onClick={() => setIsFormOpen(true)}
                className="btn-primary"
                aria-label="新增任務"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">新增</span>
              </button>
            </div>
          </div>

          {/* Quick Add Bar */}
          <div className="mt-3 relative">
            <div className="relative flex items-center">
              <Zap className="absolute left-3.5 w-4 h-4 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
              <input
                ref={quickAddRef}
                type="text"
                value={quickAddInput}
                onChange={(e) => setQuickAddInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleQuickAdd();
                  if (e.key === "Escape") { setQuickAddInput(""); quickAddRef.current?.blur(); }
                }}
                onFocus={() => setShowQuickAddHint(true)}
                onBlur={() => setTimeout(() => setShowQuickAddHint(false), 200)}
                placeholder="快速新增：明天 3pm 開會 p1 #工作"
                className="input pl-10 pr-10"
                style={{ fontSize: 14 }}
              />
              {quickAddInput && (
                <button
                  onClick={handleQuickAdd}
                  className="absolute right-3 p-1 rounded-lg hover:bg-black/5 transition-colors"
                  style={{ color: "var(--brand)" }}
                  aria-label="送出快速新增"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {showQuickAddHint && (
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-5">
        {displayTasks.length === 0 ? (
          <EmptyState onAddTask={() => setIsFormOpen(true)} />
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 mb-4 min-w-0">
              {/* Filter pills */}
              <div className="flex flex-wrap items-center gap-2 overflow-x-auto scrollbar-hide pb-1 touch-scroll">
                {["全部", "待辦", "進行中", "已完成"].map((label, i) => {
                  const statuses = ["all", "todo", "in-progress", "done"] as const;
                  const val = statuses[i];
                  const isActive = activeFilter.status === val || (val === "all" && !activeFilter.status);
                  const count = val === "all"
                    ? filteredTasks.length
                    : filteredTasks.filter((t) => t.status === val).length;
                  return (
                    <button
                      key={val}
                      onClick={() => setActiveFilter({ ...activeFilter, status: val === "all" ? undefined : val as any })}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150"
                      style={
                        isActive
                          ? { background: "var(--text-primary)", color: "var(--surface)" }
                          : { background: "rgba(0,0,0,0.04)", color: "var(--text-secondary)" }
                      }
                    >
                      {label}
                      <span style={{ opacity: 0.5 }}>{count}</span>
                    </button>
                  );
                })}

                {/* Hide completed */}
                {currentView === "all" && tasks.some((t) => t.status === "done" && !t.isArchived) && (
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150"
                    style={
                      !showCompleted
                        ? { background: "var(--brand-tint)", color: "var(--brand)" }
                        : { background: "rgba(0,0,0,0.04)", color: "var(--text-tertiary)" }
                    }
                  >
                    <Archive className="w-3 h-3" />
                    {showCompleted ? "隱藏完成" : "顯示完成"}
                  </button>
                )}
              </div>

              {/* View mode + search */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋..."
                    className="input pl-9 pr-4"
                    style={{ fontSize: 13, paddingTop: 7, paddingBottom: 7, width: 140 }}
                  />
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-0.5 p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.04)" }}>
                  <button
                    onClick={() => setViewMode("list")}
                    className="p-1.5 rounded-lg transition-all duration-150"
                    style={viewMode === "list" ? { background: "var(--surface)", boxShadow: "var(--shadow-xs)", color: "var(--text-primary)" } : { color: "var(--text-tertiary)" }}
                    aria-label="列表檢視"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className="p-1.5 rounded-lg transition-all duration-150"
                    style={viewMode === "grid" ? { background: "var(--surface)", boxShadow: "var(--shadow-xs)", color: "var(--text-primary)" } : { color: "var(--text-tertiary)" }}
                    aria-label="網格檢視"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Task list */}
            <div
              className={
                viewMode === "grid"
                  ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  : "flex flex-col gap-2"
              }
            >
              <AnimatePresence mode="popLayout">
                {displayTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <TaskCard
                      task={task}
                      onToggleStatus={toggleTaskStatus}
                      onEdit={handleEdit}
                      onDelete={deleteTask}
                      onArchive={archiveTask}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>

      {/* Task Form Modal */}
      <TaskForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingTask(null); }}
        onSubmit={handleSubmit}
        initialData={editingTask}
      />
    </div>
  );
}
