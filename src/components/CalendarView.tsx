"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { Task } from "@/lib/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const CELL_SIZE = 110;

interface CalendarViewProps {
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onAddTask?: (date: string) => void;
}

export function CalendarView({ selectedTaskId, onSelectTask, onAddTask }: CalendarViewProps) {
  const { tasks, setCurrentView, updateTask, toggleTaskStatus, addTask, deleteTask } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
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
                      onClick={(e) => { e.stopPropagation(); onSelectTask(t.id); }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate cursor-grab active:cursor-grabbing"
                      style={{
                        background: t.status === "done"
                          ? "rgba(0,0,0,0.05)"
                          : getPriorityColor(t.priority) + "20",
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
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex-shrink-0 border-l overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--surface)", width: 340 }}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
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
                {/* 快速新增 */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (quickAddDate === selectedDate && quickAddTitle.trim()) {
                      submitQuickAdd(selectedDate, quickAddTitle);
                    } else if (selectedDate) {
                      submitQuickAdd(selectedDate, quickAddTitle || "新任務");
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={quickAddInputRef}
                    type="text"
                    value={quickAddTitle}
                    onChange={(e) => setQuickAddTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setQuickAddDate(null); setQuickAddTitle(""); }
                    }}
                    placeholder="新增任務…"
                    className="input flex-1"
                    style={{ fontSize: 13, padding: "7px 10px" }}
                  />
                  <button type="submit" className="btn-primary py-1.5 px-3 text-[12px]">新增</button>
                </form>
              </div>

              {/* Task list */}
              <div className="flex-1 overflow-y-auto">
                {selectedDateTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-2">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-tertiary)" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>這天沒有任務</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {selectedDateTasks.map((task) => (
                      <CalendarTaskItem
                        key={task.id}
                        task={task}
                        isSelected={selectedTaskId === task.id}
                        onClick={() => onSelectTask(task.id)}
                        onToggleStatus={() => toggleTaskStatus(task.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 簡化的日曆任務卡片元件
function CalendarTaskItem({
  task,
  isSelected,
  onClick,
  onToggleStatus,
}: {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
  onToggleStatus: () => void;
}) {
  const isDone = task.status === "done";
  const priorityColor = getPriorityColor(task.priority);

  return (
    <div
      onClick={onClick}
      className={`
        flex items-start gap-3 px-4 py-3 cursor-pointer
        transition-all duration-150 select-none
        ${isSelected ? "bg-[var(--brand-tint)]" : "hover:bg-[var(--surface-hover)]"}
        ${isDone ? "opacity-60" : ""}
      `}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
        className="flex-shrink-0 mt-0.5 transition-transform duration-200 hover:scale-110 active:scale-90"
        aria-label={isDone ? "標記未完成" : "標記完成"}
      >
        {isDone ? (
          <div className="w-[18px] h-[18px] rounded-full" style={{ background: "var(--status-success)" }} />
        ) : (
          <div className="w-[18px] h-[18px] rounded-full border-2" style={{ borderColor: "var(--border-hover)" }} />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={`text-[13px] font-medium truncate ${
            isDone ? "line-through" : ""
          }`}
          style={isDone ? { color: "var(--text-tertiary)" } : { color: "var(--text-primary)" }}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: priorityColor }} />
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              {task.priority === "high" ? "高" : task.priority === "medium" ? "中" : "低"}
            </span>
          </div>
          {task.dueTime && (
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              {task.dueTime}
            </span>
          )}
          {task.subTasks && task.subTasks.length > 0 && (
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              {task.subTasks.filter(s => s.status === "done").length}/{task.subTasks.length}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
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
