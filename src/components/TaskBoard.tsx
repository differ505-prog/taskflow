"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, LayoutGrid, List, Plus, X, SlidersHorizontal } from "lucide-react";
import { Task, TaskStatus } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { TaskForm } from "./TaskForm";
import { EmptyState } from "./EmptyState";
import { getTasks, saveTasks, generateId } from "@/lib/storage";
import { AnimatePresence, motion } from "framer-motion";

const FILTER_TABS: { label: string; value: TaskStatus | "all" }[] = [
  { label: "全部", value: "all" },
  { label: "待辦", value: "todo" },
  { label: "進行中", value: "in-progress" },
  { label: "已完成", value: "done" },
];

const SEED_TASKS: Omit<Task, "id" | "createdAt" | "updatedAt">[] = [
  {
    title: "完成專案提案簡報",
    description: "整理本季 OKR 進度並製作成 15 分鐘簡報",
    priority: "high",
    status: "in-progress",
    dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    tags: ["工作", "簡報"],
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
    title: "設定智慧家庭場景",
    priority: "low",
    status: "done",
    tags: ["生活"],
  },
];

function initSeedTasks(): Task[] {
  return SEED_TASKS.map((t) => ({
    ...t,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="card px-5 py-4 text-center">
      <p className="text-[28px] font-semibold tracking-tight text-[var(--text-primary)] leading-none mb-1">
        {value}
      </p>
      <p className="text-[12px] text-[var(--text-tertiary)] font-medium uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}

export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | TaskStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isSeeded, setIsSeeded] = useState(false);

  useEffect(() => {
    const stored = getTasks();
    if (stored.length === 0) {
      const seeds = initSeedTasks();
      setTasks(seeds);
      saveTasks(seeds);
    } else {
      setTasks(stored);
    }
    setIsSeeded(true);
  }, []);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (activeFilter !== "all") {
      result = result.filter((t) => t.status === activeFilter);
    }

    if (!showCompleted && activeFilter === "all") {
      result = result.filter((t) => t.status !== "done");
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return result.sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [tasks, activeFilter, searchQuery, showCompleted]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const highPriority = tasks.filter((t) => t.priority === "high" && t.status !== "done").length;
    return { total, done, inProgress, highPriority };
  }, [tasks]);

  const filterCount = (value: "all" | TaskStatus) => {
    if (value === "all") return tasks.length;
    return tasks.filter((t) => t.status === value).length;
  };

  const handleToggleStatus = (id: string) => {
    const updated = tasks.map((t) => {
      if (t.id !== id) return t;
      const nextStatus: Record<TaskStatus, TaskStatus> = {
        todo: "in-progress",
        "in-progress": "done",
        done: "todo",
      };
      return { ...t, status: nextStatus[t.status], updatedAt: new Date().toISOString() };
    });
    setTasks(updated);
    saveTasks(updated);
  };

  const handleDelete = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    saveTasks(updated);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleSubmit = (data: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    if (editingTask) {
      const updated = tasks.map((t) =>
        t.id === editingTask.id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
      );
      setTasks(updated);
      saveTasks(updated);
    } else {
      const newTask: Task = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [newTask, ...tasks];
      setTasks(updated);
      saveTasks(updated);
    }
    setEditingTask(null);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTask(null);
  };

  if (!isSeeded) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center">
        <div className="spinner" role="status" aria-label="載入中" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* Header */}
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--brand)] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8L6.5 11.5L13 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">TaskFlow</span>
            </div>

            <button
              onClick={() => setIsFormOpen(true)}
              className="btn-primary"
              aria-label="新增任務"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">新增任務</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* 統計面板 — 單色調大字體 */}
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">任務概覽</h2>
          <div
            className="card px-6 py-5"
            style={{ boxShadow: "var(--shadow-xs)" }}
          >
            <div className="grid grid-cols-4 divide-x divide-[var(--border)]">
              <StatCard value={stats.total} label="全部" />
              <StatCard value={stats.inProgress} label="進行中" />
              <StatCard value={stats.done} label="已完成" />
              <StatCard value={stats.highPriority} label="高優先" />
            </div>
          </div>
        </section>

        {/* 搜尋與篩選區 */}
        <section aria-label="任務搜尋與篩選">
          <div className="flex flex-col gap-4">
            {/* 搜尋列 */}
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋任務、標籤..."
                className="input pl-10 pr-10"
                aria-label="搜尋任務"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-all duration-150"
                  aria-label="清除搜尋"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* 篩選工具列 */}
            <div className="flex items-center justify-between gap-4 min-w-0">
              {/* 篩選標籤 — 單色調克制 */}
              <div className="flex flex-wrap items-center gap-2 overflow-x-auto scrollbar-hide pb-1 touch-scroll flex-1 min-w-0">
                {FILTER_TABS.map((tab) => {
                  const count = filterCount(tab.value);
                  const isActive = activeFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setActiveFilter(tab.value)}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-200 whitespace-nowrap"
                      style={
                        isActive
                          ? {
                              background: "var(--text-primary)",
                              color: "var(--surface)",
                            }
                          : {
                              background: "rgba(0,0,0,0.04)",
                              color: "var(--text-secondary)",
                            }
                      }
                      aria-pressed={isActive}
                    >
                      {tab.label}
                      {count > 0 && (
                        <span
                          className="text-[11px]"
                          style={{ opacity: isActive ? 0.65 : 0.5 }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* 隱藏已完成開關 */}
                {activeFilter === "all" && tasks.some((t) => t.status === "done") && (
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-medium transition-all duration-200 whitespace-nowrap"
                    style={
                      !showCompleted
                        ? {
                            background: "var(--brand-tint)",
                            color: "var(--brand)",
                          }
                        : {
                            background: "rgba(0,0,0,0.04)",
                            color: "var(--text-tertiary)",
                          }
                    }
                    aria-pressed={!showCompleted}
                  >
                    <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
                    {showCompleted ? "隱藏完成" : "顯示完成"}
                  </button>
                )}
              </div>

              {/* 視圖切換 — 僅兩個按鈕 */}
              <div
                className="flex items-center gap-0.5 p-1 rounded-xl flex-shrink-0"
                style={{ background: "rgba(0,0,0,0.04)" }}
              >
                <button
                  onClick={() => setViewMode("list")}
                  className="p-2 rounded-lg transition-all duration-200"
                  style={
                    viewMode === "list"
                      ? { background: "var(--surface)", color: "var(--text-primary)", boxShadow: "var(--shadow-xs)" }
                      : { background: "transparent", color: "var(--text-tertiary)" }
                  }
                  aria-label="列表檢視"
                  aria-pressed={viewMode === "list"}
                >
                  <List className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className="p-2 rounded-lg transition-all duration-200"
                  style={
                    viewMode === "grid"
                      ? { background: "var(--surface)", color: "var(--text-primary)", boxShadow: "var(--shadow-xs)" }
                      : { background: "transparent", color: "var(--text-tertiary)" }
                  }
                  aria-label="網格檢視"
                  aria-pressed={viewMode === "grid"}
                >
                  <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 任務列表 */}
        {tasks.length === 0 ? (
          <EmptyState onAddTask={() => setIsFormOpen(true)} />
        ) : filteredTasks.length === 0 ? (
          <div className="card py-16 text-center">
            <p className="text-[14px] text-[var(--text-tertiary)] mb-3">
              無符合條件的任務
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[13px] text-[var(--brand)] hover:underline"
              >
                清除
              </button>
            )}
          </div>
        ) : (
          <section aria-label="任務列表">
            <div
              className={
                viewMode === "grid"
                  ? "grid gap-3 sm:grid-cols-2"
                  : "flex flex-col gap-2"
              }
            >
              <AnimatePresence mode="popLayout">
                {filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <TaskCard
                      task={task}
                      onToggleStatus={handleToggleStatus}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}
      </main>

      <TaskForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={editingTask}
      />
    </div>
  );
}
