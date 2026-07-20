"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { Task } from "@/lib/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, ChevronDown, ChevronRight as ChevronRightSm } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SwipeableTaskCard } from "./SwipeableTaskCard";

interface CalendarViewProps {
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
}

export function CalendarView({ selectedTaskId, onSelectTask }: CalendarViewProps) {
  const { tasks, updateTask, toggleTaskStatus, addTask, deleteTask } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  // 已完成任務摺疊：key = `${dateStr}`,value = 是否展開（未存 = 已折疊）
  const [doneExpanded, setDoneExpanded] = useState<Record<string, boolean>>({});
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectedDate && quickAddInputRef.current) {
      quickAddInputRef.current.focus();
    }
  }, [selectedDate]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });

    // Pad start
    const startDay = start.getDay();
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
    if (!trimmed) return;
    addTask({
      title: trimmed,
      priority: "delegate",
      status: "todo",
      startDate: dateStr,
      dueDate: dateStr,
      tags: [],
    });
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

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(selectedDate === dateStr ? null : dateStr);
    setQuickAddTitle("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* 日曆區域 - 純顯示，不可點擊任務 */}
      <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
        {/* Month header */}
        <div className="flex items-center justify-between mb-4 md:mb-5 flex-shrink-0">
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

        {/* Calendar cells - 純顯示，只有日期可點擊 */}
        <div className="grid grid-cols-7 gap-px overflow-hidden" style={{ background: "var(--border)" }}>
          {days.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const dateStr = format(day, "yyyy-MM-dd");
            const dayTasks = getTasksForDay(day);
            const isSelected = selectedDate === dateStr;
            const taskCount = dayTasks.filter((t) => t.status !== "done").length;

            return (
              <div
                key={i}
                className="flex flex-col overflow-hidden transition-colors duration-150 cursor-pointer"
                style={{
                  background: isSelected
                    ? "var(--brand-tint)"
                    : isCurrentMonth
                    ? "var(--surface)"
                    : "var(--surface-muted)",
                  minHeight: 72,
                }}
                onClick={() => handleDayClick(dateStr)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(day)}
              >
                {/* Day number */}
                <div className="flex items-center justify-center pt-2 pb-1">
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
                </div>

                {/* Task indicator - 只顯示數量或優先級指示，不可點擊 */}
                <div className="flex-1 flex flex-col items-center justify-start px-1 pb-1">
                  {taskCount > 0 ? (
                    <div 
                      className="w-full rounded-md py-0.5 px-1 text-center"
                      style={{
                        background: isCurrentMonth ? getIndicatorBg(dayTasks) : 'rgba(0,0,0,0.03)',
                      }}
                    >
                      <span 
                        className="text-[10px] font-medium"
                        style={{ color: isCurrentMonth ? "var(--text-secondary)" : "var(--text-tertiary)" }}
                      >
                        {taskCount} 項
                      </span>
                    </div>
                  ) : (
                    <div className="w-full rounded-md py-0.5 text-center opacity-0">
                      <span className="text-[10px]">-</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 任務列表展開區域 - 完全獨立，點擊任務才會觸發 */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="border-t overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--surface)", maxHeight: "calc(100dvh - 210px)" }}
          >
            <div className="p-4 overflow-y-auto overscroll-contain" style={{ maxHeight: "calc(100dvh - 210px)" }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {format(parseISO(selectedDate), "M 月 d 日", { locale: zhTW })}
                  {isToday(parseISO(selectedDate)) && (
                    <span className="ml-2 text-[12px] font-normal" style={{ color: "var(--brand)" }}>今天</span>
                  )}
                  <span className="ml-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {selectedDateTasks.length} 項任務
                  </span>
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
                  if (quickAddTitle.trim()) {
                    submitQuickAdd(selectedDate, quickAddTitle);
                  }
                }}
                className="flex items-center gap-2 mb-4"
              >
                <input
                  ref={quickAddInputRef}
                  type="text"
                  value={quickAddTitle}
                  onChange={(e) => setQuickAddTitle(e.target.value)}
                  placeholder="新增任務…"
                  className="input flex-1"
                  style={{ fontSize: 14, padding: "10px 14px" }}
                />
                <button type="submit" className="btn-primary py-2.5 px-4 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  新增
                </button>
              </form>

              {/* Task list - 任務可點擊，與日曆格子完全分離 */}
              {selectedDateTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-tertiary)" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>這天沒有任務</p>
                </div>
              ) : (() => {
                const todo = selectedDateTasks.filter((t) => t.status !== "done");
                const done = selectedDateTasks.filter((t) => t.status === "done");
                const isDoneOpen = !!doneExpanded[selectedDate];
                return (
                  <div className="space-y-2">
                    {todo.map((task) => (
                      <SwipeableTaskCard
                        key={task.id}
                        taskId={task.id}
                        hideComplete
                        onDelete={(id) => deleteTask(id)}
                      >
                        <CalendarTaskItem
                          task={task}
                          isSelected={selectedTaskId === task.id}
                          onClick={() => onSelectTask(task.id)}
                          onToggleStatus={() => toggleTaskStatus(task.id)}
                        />
                      </SwipeableTaskCard>
                    ))}
                    {done.length > 0 && (
                      <div className={todo.length > 0 ? "pt-2 border-t border-dashed" : ""} style={{ borderColor: "var(--border)" }}>
                        <button
                          type="button"
                          onClick={() => setDoneExpanded((prev) => ({ ...prev, [selectedDate]: !prev[selectedDate] }))}
                          className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-80"
                          style={{ color: "var(--text-tertiary)" }}
                          aria-expanded={isDoneOpen}
                          aria-label={isDoneOpen ? `摺疊 ${done.length} 項已完成任務` : `展開 ${done.length} 項已完成任務`}
                        >
                          {isDoneOpen ? (
                            <ChevronDown className="w-3 h-3" aria-hidden="true" />
                          ) : (
                            <ChevronRightSm className="w-3 h-3" aria-hidden="true" />
                          )}
                          <span>已完成 ({done.length})</span>
                        </button>
                        {isDoneOpen && (
                          <div className="mt-2 space-y-2">
                            {done.map((task) => (
                              <SwipeableTaskCard
                                key={task.id}
                                taskId={task.id}
                                hideComplete
                                onDelete={(id) => deleteTask(id)}
                              >
                                <CalendarTaskItem
                                  task={task}
                                  isSelected={selectedTaskId === task.id}
                                  onClick={() => onSelectTask(task.id)}
                                  onToggleStatus={() => toggleTaskStatus(task.id)}
                                />
                              </SwipeableTaskCard>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 日曆任務卡片 - 可點擊打開詳情
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
        flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer
        transition-all duration-150 select-none
        ${isSelected ? "shadow-sm" : "hover:shadow-sm"}
      `}
      style={{
        background: isSelected ? "var(--brand-tint)" : "var(--surface-muted)",
      }}
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
          className={`text-[14px] font-medium truncate ${isDone ? "line-through" : ""}`}
          style={isDone ? { color: "var(--text-tertiary)" } : { color: "var(--text-primary)" }}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: priorityColor }} />
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              {task.priority === "do-now" ? "速辦" : task.priority === "schedule" ? "排程" : task.priority === "delegate" ? "轉交" : "暫緩"}
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
      <div className="flex-shrink-0 mt-1" style={{ color: "var(--text-tertiary)" }}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "do-now": return "#D70015";
    case "schedule": return "#F97316";
    case "delegate": return "#EAB308";
    default: return "#9CA3AF";
  }
}

function getIndicatorBg(tasks: Task[]): string {
  // 根據任務優先級顯示不同顏色
  const hasUrgent = tasks.some(t => t.priority === "do-now");
  const hasHigh = tasks.some(t => t.priority === "schedule");
  const hasMedium = tasks.some(t => t.priority === "delegate");

  if (hasUrgent || hasHigh) return "rgba(215, 0, 21, 0.18)";
  if (hasMedium) return "rgba(255, 149, 0, 0.15)";
  return "rgba(52, 199, 89, 0.15)";
}
