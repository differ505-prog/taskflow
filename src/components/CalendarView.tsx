"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { Task } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const CELL_SIZE = 110;

export function CalendarView() {
  const { tasks, setCurrentView, updateTask, toggleTaskStatus, addTask, deleteTask } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (quickAddDate && quickAddInputRef.current) {
      quickAddInputRef.current.focus();
    }
  }, [quickAddDate]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });

    // Pad start
    const startDay = start.getDay(); // 0=Sun
    const padBefore = Array.from({ length: startDay }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() - (startDay - i));
      return d;
    });

    // Pad end to complete the last week
    const endDay = end.getDay();
    const padAfter = Array.from({ length: (7 - endDay - 1) % 7 + 1 }, (_, i) => {
      const d = new Date(end);
      d.setDate(d.getDate() + i + 1);
      return d;
    });

    return [...padBefore, ...allDays, ...padAfter];
  }, [currentMonth]);

  const getTasksForDay = (date: Date): Task[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return tasks.filter((t) => {
      if (t.isArchived) return false;
      const start = t.startDate || t.dueDate;
      const end = t.dueDate || t.startDate;
      if (!start || !end) return false;
      return dateStr >= start && dateStr <= end;
    });
  };

  const submitQuickAdd = (dateStr: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) { setQuickAddDate(null); return; }
    addTask({
      title: trimmed,
      priority: "medium",
      status: "todo",
      startDate: dateStr,
      dueDate: dateStr,
      tags: [],
    });
    setQuickAddDate(null);
    setQuickAddTitle("");
  };

  const prevMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const selectedDateTasks = selectedDate
    ? tasks.filter((t) => {
        if (t.isArchived) return false;
        const start = t.startDate || t.dueDate;
        const end = t.dueDate || t.startDate;
        if (!start || !end) return false;
        return selectedDate >= start && selectedDate <= end;
      })
    : [];

  // Drag and drop
  const handleDragStart = (taskId: string) => setDraggingTask(taskId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (date: Date) => {
    if (!draggingTask) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const task = tasks.find((t) => t.id === draggingTask);
    if (task) {
      const oldStart = task.startDate || task.dueDate || dateStr;
      const oldEnd = task.dueDate || task.startDate || dateStr;
      const lengthDays = Math.round(
        (parseISO(oldEnd).getTime() - parseISO(oldStart).getTime()) / 86400000
      );
      const newStart = dateStr;
      const newEndDate = new Date(parseISO(newStart).getTime() + lengthDays * 86400000);
      const newEnd = format(newEndDate, "yyyy-MM-dd");
      updateTask(draggingTask, {
        startDate: newStart,
        dueDate: newEnd,
      });
    } else {
      updateTask(draggingTask, { startDate: dateStr, dueDate: dateStr });
    }
    setDraggingTask(null);
  };

  return (
    <div className="flex h-full">
      {/* Calendar grid */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* Month header */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <h1 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {format(currentMonth, "yyyy 年 M 月", { locale: zhTW })}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-black/5 transition-colors"
              style={{ color: "var(--text-secondary)" }}
              aria-label="上個月"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1.5 rounded-xl text-[13px] font-medium hover:bg-black/5 transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              今天
            </button>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-black/5 transition-colors"
              style={{ color: "var(--text-secondary)" }}
              aria-label="下個月"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2 flex-shrink-0">
          {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
            <div key={d} className="text-center text-[12px] font-medium py-2" style={{ color: "var(--text-tertiary)" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 flex-1 gap-px overflow-y-auto" style={{ background: "var(--border)" }}>
          {days.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const dateStr = format(day, "yyyy-MM-dd");
            const dayTasks = getTasksForDay(day);
            const isSelected = selectedDate === dateStr;
            const isDragOver = draggingTask !== null;

            return (
              <div
                key={i}
                className="group relative flex flex-col overflow-hidden transition-colors duration-100 cursor-pointer"
                style={{
                  background: isSelected
                    ? "var(--brand-tint)"
                    : isCurrentMonth
                    ? "var(--surface)"
                    : "var(--surface-muted)",
                  minHeight: CELL_SIZE,
                }}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(day)}
                onDragLeave={() => {}}
              >
                {/* Day number */}
                <div className="flex items-center justify-between pt-2 pb-1 px-1.5 flex-shrink-0">
                  <span
                    className="w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-medium"
                    style={
                      isTodayDate
                        ? { background: "var(--brand)", color: "var(--brand-foreground)" }
                        : isCurrentMonth
                        ? { color: "var(--text-primary)" }
                        : { color: "var(--text-tertiary)" }
                    }
                  >
                    {format(day, "d")}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setQuickAddDate(dateStr); setQuickAddTitle(""); setSelectedDate(dateStr); }}
                    className="w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/5 transition-all duration-150"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label={`在 ${dateStr} 新增任務`}
                    title="新增任務"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Task dots */}
                <div className="flex flex-col gap-0.5 px-1 overflow-hidden flex-1">
                  {dayTasks.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => handleDragStart(t.id)}
                      onClick={(e) => { e.stopPropagation(); setSelectedDate(dateStr); }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate cursor-grab active:cursor-grabbing"
                      style={{
                        background: t.status === "done"
                          ? "rgba(0,0,0,0.05)"
                          : `rgba(${hexToRgb(getPriorityColor(t.priority))}, 0.12)`,
                        color: t.status === "done" ? "var(--text-tertiary)" : "var(--text-primary)",
                        textDecoration: t.status === "done" ? "line-through" : "none",
                      }}
                      title={t.title}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: getPriorityColor(t.priority) }}
                      />
                      {t.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[10px] px-1.5" style={{ color: "var(--text-tertiary)" }}>
                      +{dayTasks.length - 3} 更多
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day panel */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: expandedTaskId ? 460 : 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex-shrink-0 border-l overflow-y-auto"
            style={{ borderColor: "var(--border)", background: "var(--surface)", width: expandedTaskId ? 460 : 360 }}
          >
            <div className="p-4">
              {/* 快速新增列 — 從日曆點＋或這裡輸入皆可 */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (quickAddDate === selectedDate && quickAddTitle.trim()) {
                    submitQuickAdd(selectedDate, quickAddTitle);
                  } else if (selectedDate) {
                    submitQuickAdd(selectedDate, quickAddTitle || "新任務");
                  }
                }}
                className="mb-4 flex items-center gap-2"
              >
                <input
                  ref={quickAddInputRef}
                  type="text"
                  value={quickAddTitle}
                  onChange={(e) => setQuickAddTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setQuickAddDate(null); setQuickAddTitle(""); }
                  }}
                  placeholder={`在 ${format(parseISO(selectedDate), "M/d", { locale: zhTW })} 新增任務…`}
                  className="input flex-1"
                  style={{ fontSize: 13, padding: "7px 10px" }}
                />
                <button type="submit" className="btn-primary py-1.5 px-3 text-[12px]">新增</button>
              </form>

              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {format(parseISO(selectedDate), "M 月 d 日", { locale: zhTW })}
                  {isToday(parseISO(selectedDate)) && (
                    <span className="ml-2 text-[12px] font-normal" style={{ color: "var(--brand)" }}>今天</span>
                  )}
                </h2>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  ✕
                </button>
              </div>

              {selectedDateTasks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>這天沒有任務</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDateTasks.map((task) => (
                    <TaskPanelCard
                      key={task.id}
                      task={task}
                      expanded={expandedTaskId === task.id}
                      onToggleExpand={() => setExpandedTaskId((id) => (id === task.id ? null : task.id))}
                      onDragStart={() => handleDragStart(task.id)}
                      onToggleStatus={() => toggleTaskStatus(task.id)}
                      onUpdate={(updates) => updateTask(task.id, updates)}
                      onDelete={() => {
                        if (confirm(`刪除「${task.title}」？`)) deleteTask(task.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high": return "#FF3B30";
    case "medium": return "#FF9500";
    case "low": return "#34C759";
    default: return "#AEAEB2";
  }
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

interface TaskPanelCardProps {
  task: Task;
  expanded: boolean;
  onToggleExpand: () => void;
  onDragStart: () => void;
  onToggleStatus: () => void;
  onUpdate: (updates: Partial<Task>) => void;
  onDelete: () => void;
}

const PRIORITY_OPTIONS: Array<{ value: "high" | "medium" | "low"; label: string; color: string }> = [
  { value: "high", label: "高", color: "#FF3B30" },
  { value: "medium", label: "中", color: "#FF9500" },
  { value: "low", label: "低", color: "#34C759" },
];

function TaskPanelCard({ task, expanded, onToggleExpand, onDragStart, onToggleStatus, onUpdate, onDelete }: TaskPanelCardProps) {
  const isDone = task.status === "done";
  const [editTitle, setEditTitle] = useState(task.title);

  // 標題送出時同步到 task
  const commitTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate({ title: trimmed });
    } else {
      setEditTitle(task.title);
    }
  };

  return (
    <div
      draggable={!expanded}
      onDragStart={onDragStart}
      className="rounded-xl border transition-all duration-200"
      style={{
        borderColor: expanded ? "var(--brand)" : "var(--border)",
        background: expanded ? "var(--brand-tint)" : "var(--surface-muted)",
        boxShadow: expanded ? "0 4px 16px rgba(0,0,0,0.04)" : "none",
      }}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          <button
            onClick={onToggleStatus}
            className="flex-shrink-0 mt-0.5"
            aria-label={isDone ? "標記未完成" : "標記完成"}
          >
            {isDone ? (
              <div className="w-4 h-4 rounded-full" style={{ background: "var(--status-success)" }} />
            ) : (
              <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: "var(--border-hover)" }} />
            )}
          </button>
          <button
            onClick={onToggleExpand}
            className="flex-1 min-w-0 text-left"
          >
            <p
              className="text-[13px] font-medium"
              style={{ color: isDone ? "var(--text-tertiary)" : "var(--text-primary)", textDecoration: isDone ? "line-through" : "none" }}
            >
              {task.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <PriorityBadge priority={task.priority} size="sm" />
              {(task.startDate || task.dueDate) && (
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {task.startDate && task.dueDate && task.startDate !== task.dueDate
                    ? `${format(parseISO(task.startDate), "M/d", { locale: zhTW })}～${format(parseISO(task.dueDate), "M/d", { locale: zhTW })}`
                    : task.dueDate && format(parseISO(task.dueDate), "M/d", { locale: zhTW })}
                </span>
              )}
              {task.dueTime && (
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{task.dueTime}</span>
              )}
              {task.tags.length > 0 && (
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>· {task.tags.length} 標籤</span>
              )}
            </div>
          </button>
          <button
            onClick={onToggleExpand}
            className="flex-shrink-0 p-1 rounded-md hover:bg-black/5 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            aria-label={expanded ? "收合" : "展開"}
          >
            <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="p-3 space-y-3">
              {/* 標題編輯 */}
              <div>
                <label className="block mb-1 text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>標題</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                  className="input w-full"
                  style={{ fontSize: 13, padding: "6px 10px" }}
                />
              </div>

              {/* 日期區間 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>開始</label>
                  <input
                    type="date"
                    value={task.startDate || ""}
                    onChange={(e) => onUpdate({ startDate: e.target.value || undefined })}
                    className="input w-full cursor-pointer"
                    style={{ fontSize: 12, padding: "5px 8px" }}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>截止</label>
                  <input
                    type="date"
                    value={task.dueDate || ""}
                    min={task.startDate || undefined}
                    onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
                    className="input w-full cursor-pointer"
                    style={{ fontSize: 12, padding: "5px 8px" }}
                  />
                </div>
              </div>

              {/* 時間 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>時間</label>
                  <input
                    type="time"
                    value={task.dueTime || ""}
                    onChange={(e) => onUpdate({ dueTime: e.target.value || undefined })}
                    className="input w-full cursor-pointer"
                    style={{ fontSize: 12, padding: "5px 8px" }}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>優先級</label>
                  <div className="flex gap-1">
                    {PRIORITY_OPTIONS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => onUpdate({ priority: p.value })}
                        className="flex-1 py-1 rounded-md text-[11px] font-medium transition-all"
                        style={{
                          background: task.priority === p.value ? p.color : "transparent",
                          color: task.priority === p.value ? "#fff" : "var(--text-secondary)",
                          border: `1px solid ${task.priority === p.value ? p.color : "var(--border)"}`,
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 描述（唯讀 — 完整編輯需到任務表單） */}
              {task.description && (
                <div>
                  <label className="block mb-1 text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>描述</label>
                  <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                    {task.description}
                  </p>
                </div>
              )}

              {/* 子任務摘要 */}
              {task.subTasks && task.subTasks.length > 0 && (
                <div>
                  <label className="block mb-1 text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                    子任務 {task.subTasks.filter((s) => s.status === "done").length}/{task.subTasks.length}
                  </label>
                  <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    {task.subTasks.map((s) => s.title).join("、")}
                  </div>
                </div>
              )}

              {/* 操作列 */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={onDelete}
                  className="text-[12px] hover:underline transition-colors"
                  style={{ color: "var(--status-danger)" }}
                >
                  刪除任務
                </button>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  點其他任務收合此卡
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
