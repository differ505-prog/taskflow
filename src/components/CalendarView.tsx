"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { Task } from "@/lib/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, X, ChevronDown, ChevronRight as ChevronRightSm, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { SwipeableTaskCard } from "./SwipeableTaskCard";
import { TaskForm } from "./TaskForm";
import { useBottomSheet } from "@/hooks/useBottomSheet";
import { useRef } from "react";
import { haptic } from "@/lib/haptics";

interface CalendarViewProps {
  /** YYYY-MM-DD;null = 不顯示 sheet。由 AppLayout 統一管理(§26 O' ESC 死鎖防護)。 */
  selectedDate: string | null;
  /** 點日期時呼叫,由 AppLayout 提供 setter(狀態提升,避免與 useBottomSheet 雙 state 死鎖) */
  onSelectDate: (dateStr: string | null) => void;
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
  /** 從 AppLayout 傳入,區分 desktop/mobile 渲染策略 */
  isMobile: boolean;
}

interface CalendarViewCallbacks {
  /** 開啟新增任務 TaskForm 的 setter（由外層持有,§13 最小變更 — 避免把 state 上抬到 AppLayout） */
  onOpenTaskForm: () => void;
  /** 是否已選定日期 — 用來讓 CTA 在已選日期時預填該日期 */
  hasSelectedDate: boolean;
}

export function CalendarView({
  selectedDate,
  onSelectDate,
  selectedTask,
  onSelectTask,
  isMobile,
}: CalendarViewProps) {
  const { tasks, updateTask, toggleTaskStatus, addTask, deleteTask, searchQuery } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  // 本地 TaskForm state — 與 QuadrantRadarView 同樣 own-state pattern
  // 已選定日期 → 預填 dueDate = selectedDate;否則 = 今日
  const initialDate = selectedDate ?? new Date().toISOString().slice(0, 10);
  const [quickFormPrefillDueDate, setQuickFormPrefillDueDate] = useState(initialDate);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const openTaskForm = useCallback(() => {
    setQuickFormPrefillDueDate(selectedDate ?? new Date().toISOString().slice(0, 10));
    setIsFormOpen(true);
  }, [selectedDate]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // selectedDate 持久化 (從 AppLayout 接手 — 之前在這裡 useState,因 §26 O' 死鎖改提升到 AppLayout)
  useEffect(() => {
    if (selectedDate) {
      localStorage.setItem("calendar_selectedDate", selectedDate);
    } else {
      localStorage.removeItem("calendar_selectedDate");
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
  };

  const prevMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

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
    onSelectDate(dateStr);
  };

  // ─── Desktop 三欄佈局 ───────────────────────────────
  if (!isMobile) {
    return (
      <>
      <DesktopCalendarLayout
        days={days}
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        tasks={tasks}
        selectedTask={selectedTask}
        onSelectDate={onSelectDate}
        onSelectTask={onSelectTask}
        onToggleStatus={toggleTaskStatus}
        onDelete={deleteTask}
        onQuickAdd={submitQuickAdd}
        onOpenTaskForm={openTaskForm}
        prevMonth={prevMonth}
        nextMonth={nextMonth}
        resetMonth={() => setCurrentMonth(new Date())}
        getTasksForDay={getTasksForDay}
        matchedDayHas={matchedDayHas}
        searchQuery={searchQuery}
      />
      {/* Desktop 新增任務 TaskForm — 與 mobile layout 共用同一個 isOpen state */}
      <TaskForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={(data) => { addTask(data); setIsFormOpen(false); }}
        initialData={null}
        currentView="calendar"
        initialStatus="todo"
      />
      </>
    );
  }

  // ─── Mobile: 維持原有日曆 + bottom sheet ────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 p-4 md:p-6 flex flex-col overflow-hidden flex-shrink-0">
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
            {/* 新增任務 CTA — Calendar view 永遠有入口（與 Quadrant header 一致） */}
            <button
              type="button"
              onClick={openTaskForm}
              className="p-2 rounded-xl hover:bg-black/5 transition-colors"
              style={{ color: "var(--brand)" }}
              aria-label="新增任務"
              title="新增任務"
            >
              <Plus className="w-5 h-5" />
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
            const pendingTasks = dayTasks.filter((t) => t.status !== "done");
            const pendingCount = pendingTasks.length;

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
                <div className="flex flex-row items-center justify-between px-1 pt-0.5">
                  <span
                    className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-medium"
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
                {pendingCount > 0 && (
                  <div className="flex-1 min-h-0 px-1 pb-0.5 flex items-start justify-center">
                    <span
                      className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-semibold px-1"
                      style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                      aria-label={`${pendingCount} 項未完成任務`}
                    >
                      {pendingCount}
                    </span>
                  </div>
                )}
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

      {/* Mobile bottom sheet — 僅 mobile 渲染 */}
      <CalendarTaskSheetMobile
        selectedDate={mounted ? selectedDate : null}
        onClose={() => onSelectDate(null)}
        selectedTask={selectedTask}
        onSelectTask={onSelectTask}
        onQuickAdd={submitQuickAdd}
      />

      {/* 新增任務 TaskForm（與 quickAdd 的 selectedDate 預填邏輯一致：
          - 已選日期 → 預填 dueDate = selectedDate
          - 未選 → 預填今日 */}
      <TaskForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={(data) => { addTask(data); setIsFormOpen(false); }}
        initialData={null}
        currentView="calendar"
        initialStatus="todo"
      />
    </div>
  );
}

// ─── Desktop 三欄佈局 ──────────────────────────────────────
interface DesktopCalendarLayoutProps {
  days: Date[];
  currentMonth: Date;
  selectedDate: string | null;
  tasks: Task[];
  selectedTask: Task | null;
  onSelectDate: (d: string | null) => void;
  onSelectTask: (task: Task) => void;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onQuickAdd: (dateStr: string, title: string) => void;
  onOpenTaskForm: () => void;
  prevMonth: () => void;
  nextMonth: () => void;
  resetMonth: () => void;
  getTasksForDay: (d: Date) => Task[];
  matchedDayHas: (tasks: Task[]) => boolean;
  searchQuery: string;
}

function DesktopCalendarLayout({
  days,
  currentMonth,
  selectedDate,
  selectedTask,
  onSelectDate,
  onSelectTask,
  onToggleStatus,
  onDelete,
  onQuickAdd,
  onOpenTaskForm,
  prevMonth,
  nextMonth,
  resetMonth,
  getTasksForDay,
  matchedDayHas,
}: DesktopCalendarLayoutProps) {

  const selectedDateTasks = useMemo(() => {
    if (!selectedDate) return [];
    return getTasksForDay(parseISO(selectedDate));
  }, [selectedDate, getTasksForDay]);

  const todo = selectedDateTasks.filter((t) => t.status !== "done");
  const done = selectedDateTasks.filter((t) => t.status === "done");

  const [doneExpanded, setDoneExpanded] = useState<Record<string, boolean>>({});
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAddTitle.trim() && selectedDate) {
      onQuickAdd(selectedDate, quickAddTitle);
      setQuickAddTitle("");
    }
  };

  // selectedDate 變化 → 清空 quickAdd + 聚焦
  useEffect(() => {
    setQuickAddTitle("");
    if (selectedDate && quickAddInputRef.current) {
      setTimeout(() => quickAddInputRef.current?.focus(), 100);
    }
  }, [selectedDate]);

  const dateObj = selectedDate ? parseISO(selectedDate) : null;

  return (
    <div className="flex flex-row h-full overflow-hidden">
      {/* 左欄：日曆 */}
      <div className="flex-shrink-0 border-r overflow-y-auto overscroll-contain p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {/* Month header */}
        <div className="flex items-center justify-between mb-5">
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
              onClick={resetMonth}
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
            {/* Calendar 新增任務 CTA — 開 TaskForm（已選日期預填 dueDate；未選 = 今日） */}
            <button
              type="button"
              onClick={onOpenTaskForm}
              className="p-2 rounded-xl hover:bg-black/5 transition-colors"
              style={{ color: "var(--brand)" }}
              aria-label="新增任務"
              title="新增任務"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
            <div key={d} className="text-center text-[12px] font-medium py-2" style={{ color: "var(--text-tertiary)" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div
          className="grid grid-cols-7 gap-px"
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
            const pendingTasks = dayTasks.filter((t) => t.status !== "done");
            const pendingCount = pendingTasks.length;

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
                onClick={() => onSelectDate(dateStr)}
              >
                <div className="flex flex-row items-center justify-between px-1 pt-0.5">
                  <span
                    className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-medium"
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
                {pendingCount > 0 && (
                  <div className="flex-1 min-h-0 px-1 pb-0.5 flex items-start justify-center">
                    <span
                      className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-semibold px-1"
                      style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                      aria-label={`${pendingCount} 項未完成任務`}
                    >
                      {pendingCount}
                    </span>
                  </div>
                )}
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

      {/* 中欄：任務列表 */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden" style={{ background: "var(--surface)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          {dateObj ? (
            <h2 className="text-[15px] font-semibold flex items-center" style={{ color: "var(--text-primary)" }}>
              {format(dateObj, "M 月 d 日", { locale: zhTW })}
              {isToday(dateObj) && (
                <span className="ml-2 text-[12px] font-normal" style={{ color: "var(--brand)" }}>今天</span>
              )}
              <span className="ml-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {selectedDateTasks.length} 項任務
              </span>
            </h2>
          ) : (
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              選擇一個日期
            </h2>
          )}
          {selectedDate && (
            <button
              onClick={() => onSelectDate(null)}
              className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="關閉任務列"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick add */}
        {selectedDate && (
          <form onSubmit={handleQuickAddSubmit} className="flex items-center gap-2 px-5 mb-3 flex-shrink-0">
            <input
              ref={quickAddInputRef}
              type="text"
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              placeholder="新增任務…"
              className="input flex-1"
              style={{ fontSize: 14, padding: "10px 14px" }}
              aria-label="新增任務"
            />
            <button type="submit" className="btn-primary py-2.5 px-4 flex items-center gap-1.5 flex-shrink-0" aria-label="新增">
              <Plus className="w-4 h-4" />
              新增
            </button>
          </form>
        )}

        {/* Task list */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6">
          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-tertiary)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                點選日期查看任務
              </p>
            </div>
          ) : selectedDateTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-tertiary)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                這天沒有任務
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {todo.map((task) => (
                <SwipeableTaskCard key={task.id} taskId={task.id} hideComplete onDelete={onDelete}>
                  <CalendarTaskItem
                    task={task}
                    isSelected={selectedTask?.id === task.id}
                    onClick={() => onSelectTask(task)}
                    onToggleStatus={() => onToggleStatus(task.id)}
                    onDelete={() => onDelete(task.id)}
                  />
                </SwipeableTaskCard>
              ))}
              {done.length > 0 && (
                <div className={todo.length > 0 ? "pt-2 border-t border-dashed" : ""} style={{ borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setDoneExpanded((prev) => ({ ...prev, [selectedDate!]: !prev[selectedDate!] }))}
                    className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-80"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {doneExpanded[selectedDate!] ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRightSm className="w-3 h-3" />
                    )}
                    <span>已完成 ({done.length})</span>
                  </button>
                  {doneExpanded[selectedDate!] && (
                    <div className="mt-2 space-y-2">
                      {done.map((task) => (
                        <SwipeableTaskCard key={task.id} taskId={task.id} hideComplete onDelete={onDelete}>
                          <CalendarTaskItem
                            task={task}
                            isSelected={selectedTask?.id === task.id}
                            onClick={() => onSelectTask(task)}
                            onToggleStatus={() => onToggleStatus(task.id)}
                            onDelete={() => onDelete(task.id)}
                          />
                        </SwipeableTaskCard>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 右欄：任務詳情面板 */}
      {selectedTask && (
        <div className="w-[480px] flex-shrink-0 border-l overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="h-full overflow-y-auto overscroll-contain">
            <TaskDetailPanel
              task={selectedTask}
              onClose={() => onSelectTask(selectedTask)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mobile Bottom Sheet（從原 CalendarTaskSheet 拆分）───────
function CalendarTaskSheetMobile({
  selectedDate,
  onClose,
  selectedTask,
  onSelectTask,
  onQuickAdd,
}: {
  selectedDate: string | null;
  onClose: () => void;
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
  onQuickAdd: (dateStr: string, title: string) => void;
}) {
  const { tasks, toggleTaskStatus, deleteTask } = useApp();
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [doneExpanded, setDoneExpanded] = useState<Record<string, boolean>>({});
  const [isOpen, setIsOpen] = useState(false);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);

  const { level, open, toggleExpand, heightRatio, dragOffset, isDragging } = useBottomSheet({
    handleRef,
    sheetRef,
    defaultRatio: 0.7,
    expandedRatio: 0.95,
  });

  useEffect(() => {
    if (level !== "closed") {
      requestAnimationFrame(() => setIsOpen(true));
    } else {
      setIsOpen(false);
    }
  }, [level]);

  useEffect(() => {
    if (selectedDate) {
      open();
    }
  }, [selectedDate, open]);

  const selectedDateTasks = useMemo(() => {
    if (!selectedDate) return [];
    return tasks.filter((t) => {
      if (t.isArchived) return false;
      const start = t.startDate;
      const end = t.dueDate;
      if (start && end) return selectedDate >= start && selectedDate <= end;
      if (!start && end) return selectedDate === end;
      if (start && !end) return selectedDate === start;
      return false;
    });
  }, [tasks, selectedDate]);

  useEffect(() => {
    setQuickAddTitle("");
    if (selectedDate && quickAddInputRef.current) {
      setTimeout(() => quickAddInputRef.current?.focus(), 350);
    }
  }, [selectedDate]);

  if (!selectedDate) return null;

  const todo = selectedDateTasks.filter((t) => t.status !== "done");
  const done = selectedDateTasks.filter((t) => t.status === "done");
  const isDoneOpen = !!doneExpanded[selectedDate];
  const dateObj = parseISO(selectedDate);

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAddTitle.trim()) {
      onQuickAdd(selectedDate, quickAddTitle);
      setQuickAddTitle("");
    }
  };

  const translateY = level === "expanded" ? dragOffset : dragOffset > 0 ? dragOffset : 0;
  const transitionStyle = isDragging ? "none" : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{
          background: "rgba(15, 23, 42, 0)",
          backdropFilter: isOpen ? "blur(2px)" : "blur(0px)",
          WebkitBackdropFilter: isOpen ? "blur(2px)" : "blur(0px)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "background 0.3s ease-out, backdrop-filter 0.3s ease-out, opacity 0.3s ease-out",
        }}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${format(dateObj, "M 月 d 日", { locale: zhTW })}的任務`}
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          background: "var(--surface)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          height: `${heightRatio * 100}vh`,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: `translateY(${translateY}px)`,
          transition: transitionStyle,
          willChange: "transform",
          boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.08)",
        }}
      >
        <div ref={handleRef} className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none" aria-hidden="true">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
          <h2 className="text-[15px] font-semibold flex items-center" style={{ color: "var(--text-primary)" }}>
            {format(dateObj, "M 月 d 日", { locale: zhTW })}
            {isToday(dateObj) && <span className="ml-2 text-[12px] font-normal" style={{ color: "var(--brand)" }}>今天</span>}
            <span className="ml-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>{selectedDateTasks.length} 項任務</span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleExpand}
              className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
              style={{ color: "var(--text-tertiary)" }}
              aria-label={level === "expanded" ? "收起" : "全螢幕展開"}
            >
              {level === "expanded" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors" style={{ color: "var(--text-tertiary)" }} aria-label="關閉">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <form onSubmit={handleQuickAddSubmit} className="flex items-center gap-2 px-4 mb-3 flex-shrink-0">
          <input
            ref={quickAddInputRef}
            type="text"
            value={quickAddTitle}
            onChange={(e) => setQuickAddTitle(e.target.value)}
            placeholder="新增任務…"
            className="input flex-1"
            style={{ fontSize: 14, padding: "10px 14px" }}
            aria-label="新增任務"
          />
          <button type="submit" className="btn-primary py-2.5 px-4 flex items-center gap-1.5 flex-shrink-0" aria-label="新增">
            <Plus className="w-4 h-4" />
            新增
          </button>
        </form>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-8">
          {selectedDateTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-tertiary)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>這天沒有任務</p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {todo.map((task) => (
                <SwipeableTaskCard key={task.id} taskId={task.id} hideComplete onDelete={(id) => deleteTask(id)}>
                  <CalendarTaskItem
                    task={task}
                    isSelected={selectedTask?.id === task.id}
                    onClick={() => { onSelectTask(task); onClose(); }}
                    onToggleStatus={() => toggleTaskStatus(task.id)}
                    onDelete={() => deleteTask(task.id)}
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
                  >
                    {isDoneOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRightSm className="w-3 h-3" />}
                    <span>已完成 ({done.length})</span>
                  </button>
                  {isDoneOpen && (
                    <div className="mt-2 space-y-2">
                      {done.map((task) => (
                        <SwipeableTaskCard key={task.id} taskId={task.id} hideComplete onDelete={(id) => deleteTask(id)}>
                          <CalendarTaskItem
                            task={task}
                            isSelected={selectedTask?.id === task.id}
                            onClick={() => { onSelectTask(task); onClose(); }}
                            onToggleStatus={() => toggleTaskStatus(task.id)}
                            onDelete={() => deleteTask(task.id)}
                          />
                        </SwipeableTaskCard>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── 共用工具函式 ──────────────────────────────────────
function getPriorityColor(priority: string): string {
  switch (priority) {
    case "do-now": return "#D70015";
    case "schedule": return "#F97316";
    case "delegate": return "#EAB308";
    default: return "#9CA3AF";
  }
}

// 日曆任務卡片 - 可點擊打開詳情
export function CalendarTaskItem({
  task,
  isSelected,
  onClick,
  onToggleStatus,
  onDelete,
}: {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
  onToggleStatus: () => void;
  onDelete?: () => void;
}) {
  const isDone = task.status === "done";
  const priorityColor = getPriorityColor(task.priority);

  return (
    <div
      onClick={onClick}
      className={`
        group relative flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer
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
      {/* 桌面 hover 刪除入口 — 對齊 TaskListItem L222-232 / QuadrantRadarView L188-203 pattern;mobile 仍走 swipe */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptic("medium");
            onDelete();
          }}
          className="flex-shrink-0 -mr-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-50 transition-all duration-150 active:scale-90"
          style={{ color: "var(--text-tertiary)" }}
          aria-label="刪除任務"
          title="刪除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="flex-shrink-0 mt-1" style={{ color: "var(--text-tertiary)" }}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
