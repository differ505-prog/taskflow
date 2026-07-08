"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { Task } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const CELL_SIZE = 110;

export function CalendarView() {
  const { tasks, setCurrentView, updateTask, toggleTaskStatus, addTask } = useApp();
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
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex-shrink-0 border-l overflow-y-auto"
            style={{ borderColor: "var(--border)", background: "var(--surface)", width: 320 }}
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
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      className="p-3 rounded-xl border"
                      style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => toggleTaskStatus(task.id)}
                          className="flex-shrink-0 mt-0.5"
                          aria-label={task.status === "done" ? "標記未完成" : "標記完成"}
                        >
                          {task.status === "done" ? (
                            <div className="w-4 h-4 rounded-full" style={{ background: "var(--status-success)" }} />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: "var(--border-hover)" }} />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-[13px] font-medium"
                            style={{ color: task.status === "done" ? "var(--text-tertiary)" : "var(--text-primary)", textDecoration: task.status === "done" ? "line-through" : "none" }}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <PriorityBadge priority={task.priority} size="sm" />
                            {task.dueTime && (
                              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{task.dueTime}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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
