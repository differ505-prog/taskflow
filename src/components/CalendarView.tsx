"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { Task } from "@/lib/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, ChevronDown, ChevronRight as ChevronRightSm } from "lucide-react";
import { SwipeableTaskCard } from "./SwipeableTaskCard";

interface CalendarViewProps {
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
}

export function CalendarView({ selectedTask, onSelectTask }: CalendarViewProps) {
  const { tasks, updateTask, toggleTaskStatus, addTask, deleteTask, searchQuery } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("calendar_selectedDate");
    }
    return null;
  });
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  // 已完成任務摺疊：key = `${dateStr}`,value = 是否展開（未存 = 已折疊）
  const [doneExpanded, setDoneExpanded] = useState<Record<string, boolean>>({});
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);
  const taskPanelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [taskPanelHeight, setTaskPanelHeight] = useState<number | null>(null);

  useEffect(() => {
    observerRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTaskPanelHeight(entry.contentRect.height);
      }
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const measureTaskPanel = useCallback((node: HTMLDivElement | null) => {
    if (taskPanelRef.current) observerRef.current?.unobserve(taskPanelRef.current);
    if (node) {
      observerRef.current?.observe(node);
      taskPanelRef.current = node;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // selectedDate 持久化
  useEffect(() => {
    if (selectedDate) {
      localStorage.setItem("calendar_selectedDate", selectedDate);
    } else {
      localStorage.removeItem("calendar_selectedDate");
    }
  }, [selectedDate]);

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
    // [§26-K fix] 原 (7 - endDay - 1) % 7 + 1 在 endDay=5 時算 (7-5-1)%7+1 = 2%7+1 = 3,pad 出 3 天但只需要 2 天(7/31 五→8/2 日)
    // 改為 (7 - endDay) % 7: 7/31 五(endDay=5)→(7-5)%7=2 ✓
    const endDay = end.getDay();
    const padAfterLen = (7 - endDay) % 7;
    const padAfter = Array.from({ length: padAfterLen }, (_, i) => {
      const d = new Date(end);
      d.setDate(d.getDate() + i + 1);
      return d;
    });

    return [...padBefore, ...allDays, ...padAfter];
  }, [currentMonth]);

  const getTasksForDay = (date: Date): Task[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    const result = tasks.filter((t) => {
      if (t.isArchived) return false;
      const start = t.startDate;
      const end = t.dueDate;
      // 有日期：顯示在該日期範圍內的任務；沒日期：只要有 dueDate 就顯示在那天
      if (start && end) return dateStr >= start && dateStr <= end;
      if (!start && end) return dateStr === end;
      if (start && !end) return dateStr === start;
      return false;
    });
    return result;
  };

  // [§26-K guard] 搜尋期間:dayTasks 加上「符合搜尋的子集」屬性,用於格子高亮
  // (since searchQuery is "highlight only", we don't filter visible tasks — only mark matching dates)
  const matchedDayHas = (dayTasks: Task[]): boolean => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return dayTasks.some(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.subTasks?.some((s) => s.title.toLowerCase().includes(q))
    );
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
        const start = t.startDate;
        const end = t.dueDate;
        if (start && end) return selectedDate >= start && selectedDate <= end;
        if (!start && end) return selectedDate === end;
        if (start && !end) return selectedDate === start;
        return false;
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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* 日曆區域 - flex-1 佔滿剩餘空間 */}
      <div className="flex-1 min-h-0 p-4 md:p-6 flex flex-col overflow-hidden">
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

        {/* Calendar cells - 動態行數依 days.length 計算,避免 31/8/1 從 grid 下方溢出被「新增任務」輸入框擋住
            [§26-K fix] 原 height: calc(56px * 5) 寫死 5 行,當月跨 6 行時(例 7/26 第一天落在週日)會切到 6 行,grid 被壓縮,row 高度變矮
            改為 gridTemplateRows + auto-rows + overflow-hidden,確保每行固定 56px,多餘內容不外溢 */}
        <div
          className="grid grid-cols-7 grid-rows-6 gap-px overflow-hidden"
          style={{
            background: "var(--border)",
            gridTemplateRows: `repeat(${Math.max(5, Math.ceil(days.length / 7))}, 56px)`,
          }}
        >
          {days.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const dateStr = format(day, "yyyy-MM-dd");
            const dayTasks = getTasksForDay(day);
            const isSelected = selectedDate === dateStr;
            const isSearchMatch = matchedDayHas(dayTasks);
            // [§I 方案 v2] 格子內只顯示「未完成任務」標題 (用戶 1A+2A+3A+4A+5A+6A 全選)
            const pendingTasks = dayTasks.filter((t) => t.status !== "done");
            const pendingCount = pendingTasks.length;
            // 最多渲染前 6 個,格子空間會自動截斷多餘任務
            const visibleTasks = pendingTasks.slice(0, 3);
            const overflowCount = pendingCount - visibleTasks.length;

            return (
              <div
                key={i}
                className="relative flex flex-col transition-colors duration-150 cursor-pointer"
                style={{
                  background: isSelected
                    ? "var(--brand-tint)"
                    : isCurrentMonth
                    ? "var(--surface)"
                    : "var(--surface-muted)",
                  minHeight: 56,
                }}
                onClick={() => handleDayClick(dateStr)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(day)}
              >
                {/* Day number */}
                <div className="flex flex-col items-center pt-1 pb-0.5">
                  <div className="flex items-center justify-center w-full">
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
                </div>

                {/* [§I 方案 v2] 格子內任務標題堆疊: 最多渲染前 6 個未完成任務
                    - text-[11px] + text-tertiary + truncate: 用戶選項 1A+2A+3A
                    - flex-1 + overflow-hidden: 格子空間自動截斷多餘任務 */}
                {visibleTasks.length > 0 && (
                  <div className="flex-1 min-h-0 px-1 overflow-hidden flex flex-col">
                    {visibleTasks.map((task) => (
                      <div
                        key={task.id}
                        className="text-[11px] leading-[14px] truncate"
                        style={{ color: "var(--text-tertiary)" }}
                        title={task.title}
                      >
                        {task.title}
                      </div>
                    ))}
                  </div>
                )}

                {/* [§I 方案 v2] 右下徽章: 純文字 +N (用戶選項 4A+5A)
                    條件: overflowCount > 0 (即未完成總數 > 渲染數)
                    樣式: text-[10px] 無背景無邊框,僅 tabular-nums 等寬數字 */}
                {overflowCount > 0 && (
                  <div
                    className="absolute bottom-0.5 right-1 text-[10px] font-semibold tabular-nums pointer-events-none"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label={`還有 ${overflowCount} 項未完成任務未顯示`}
                  >
                    +{overflowCount}
                  </div>
                )}

                {/* 搜尋高亮「✓ 符合」標記 (即使沒任務也顯示) */}
                {pendingCount === 0 && isSearchMatch && (
                  <div className="flex-1 flex items-start justify-center px-1 pt-0.5">
                    <span className="text-[10px] font-medium" style={{ color: "var(--brand)" }}>✓</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 任務列表展開區域 */}
      {selectedDate && mounted && (
        <div
          ref={measureTaskPanel}
          className="min-h-0 border-t flex flex-col transition-all duration-200 overflow-y-auto"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            maxHeight: taskPanelHeight ? `${taskPanelHeight}px` : "70vh",
          }}
        >
          <div className="p-4 flex flex-col overflow-y-auto overscroll-contain">
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
                <button type="submit" className="btn-primary py-2.5 px-4 flex items-center gap-1.5 flex-shrink-0">
                  <Plus className="w-4 h-4" />
                  新增
                </button>
              </form>

              {/* Task list - 任務可點擊，與日曆格子完全分離 */}
              {selectedDateTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 flex-shrink-0">
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
                  <div className="space-y-2 flex flex-col">
                    {todo.map((task) => (
                      <SwipeableTaskCard
                        key={task.id}
                        taskId={task.id}
                        hideComplete
                        onDelete={(id) => deleteTask(id)}
                      >
                        <CalendarTaskItem
                          task={task}
                          isSelected={selectedTask?.id === task.id}
                          onClick={() => onSelectTask(task)}
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
                                  isSelected={selectedTask?.id === task.id}
                                  onClick={() => onSelectTask(task)}
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
          </div>
        )}
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

// 日曆格子內任務點（小圓點）：色彩鎖定來自 getPriorityColor（同色系統，§3）
function getPriorityDotColor(priority: string): string {
  return getPriorityColor(priority);
}
