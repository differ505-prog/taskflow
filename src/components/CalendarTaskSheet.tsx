"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight as ChevronRightSm, Maximize2, Minimize2, Plus, X } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { Task } from "@/lib/types";
import { format, isToday, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { SwipeableTaskCard } from "./SwipeableTaskCard";
import { CalendarTaskItem } from "./CalendarView";
import { useBottomSheet } from "@/hooks/useBottomSheet";

interface CalendarTaskSheetProps {
  /** YYYY-MM-DD;null = 不顯示 sheet */
  selectedDate: string | null;
  onClose: () => void;
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
  onQuickAdd: (dateStr: string, title: string) => void;
}

/**
 * CalendarTaskSheet — 從 CalendarView 抽出的底部彈出任務面板(bottom sheet 模式)。
 *
 * 架構:獨立 fixed overlay,不參與日曆 flex chain,
 * 因此不會再撞 §26 類別 B 的 flex 高度塌縮問題。
 *
 * 展開層級:
 *  - closed:完全不渲染
 *  - default(70vh):預設展開,顯示 ~5-6 個任務
 *  - expanded(95vh):全螢幕,適合長任務列表
 */
export function CalendarTaskSheet({
  selectedDate,
  onClose,
  selectedTask,
  onSelectTask,
  onQuickAdd,
}: CalendarTaskSheetProps) {
  const { tasks, toggleTaskStatus, deleteTask } = useApp();
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [doneExpanded, setDoneExpanded] = useState<Record<string, boolean>>({});
  const [isOpen, setIsOpen] = useState(false);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);

  const {
    level,
    toggleExpand,
    heightRatio,
    dragOffset,
    isDragging,
  } = useBottomSheet({
    handleRef,
    sheetRef,
    defaultRatio: 0.7,
    expandedRatio: 0.95,
  });

  // 同步 sheet 開關動畫
  useEffect(() => {
    if (level !== "closed") {
      // 下一幀設為 open,觸發 transition
      requestAnimationFrame(() => setIsOpen(true));
    } else {
      setIsOpen(false);
    }
  }, [level]);

  // 計算當日任務
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

  // selectedDate 變化 → 清空 quickAdd + 聚焦
  useEffect(() => {
    setQuickAddTitle("");
    if (selectedDate && quickAddInputRef.current) {
      // 等 sheet 動畫完成再 focus
      setTimeout(() => quickAddInputRef.current?.focus(), 350);
    }
  }, [selectedDate]);

  if (!selectedDate) return null;

  const todo = selectedDateTasks.filter((t) => t.status !== "done");
  const done = selectedDateTasks.filter((t) => t.status === "done");
  const isDoneOpen = !!doneExpanded[selectedDate];
  const dateObj = parseISO(selectedDate);

  const handleOverlayClick = () => onClose();
  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAddTitle.trim()) {
      onQuickAdd(selectedDate, quickAddTitle);
      setQuickAddTitle("");
    }
  };

  // 拖曳中 sheet 的 translateY(僅套用於展開狀態)
  const translateY = level === "expanded" ? dragOffset : dragOffset > 0 ? dragOffset : 0;
  // 動畫 transition:拖曳時關閉(更跟手)
  const transitionStyle = isDragging
    ? "none"
    : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";

  return (
    <>
      {/* 背景遮罩 */}
      <div
        aria-hidden="true"
        onClick={handleOverlayClick}
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

      {/* Sheet 本體 */}
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
        {/* Drag handle */}
        <div
          ref={handleRef}
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          aria-hidden="true"
        >
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "var(--border)" }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
          <h2 className="text-[15px] font-semibold flex items-center" style={{ color: "var(--text-primary)" }}>
            {format(dateObj, "M 月 d 日", { locale: zhTW })}
            {isToday(dateObj) && (
              <span className="ml-2 text-[12px] font-normal" style={{ color: "var(--brand)" }}>今天</span>
            )}
            <span className="ml-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {selectedDateTasks.length} 項任務
            </span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleExpand}
              className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
              style={{ color: "var(--text-tertiary)" }}
              aria-label={level === "expanded" ? "收起" : "全螢幕展開"}
            >
              {level === "expanded" ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="關閉"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick add form */}
        <form
          onSubmit={handleQuickAddSubmit}
          className="flex items-center gap-2 px-4 mb-3 flex-shrink-0"
        >
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
          <button
            type="submit"
            className="btn-primary py-2.5 px-4 flex items-center gap-1.5 flex-shrink-0"
            aria-label="新增"
          >
            <Plus className="w-4 h-4" />
            新增
          </button>
        </form>

        {/* 任務列表 — 獨立 scroll viewport */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-8">
          {selectedDateTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "var(--surface-muted)" }}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                這天沒有任務
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
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
                <div
                  className={todo.length > 0 ? "pt-2 border-t border-dashed" : ""}
                  style={{ borderColor: "var(--border)" }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setDoneExpanded((prev) => ({
                        ...prev,
                        [selectedDate]: !prev[selectedDate],
                      }))
                    }
                    className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-80"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-expanded={isDoneOpen}
                    aria-label={
                      isDoneOpen
                        ? `摺疊 ${done.length} 項已完成任務`
                        : `展開 ${done.length} 項已完成任務`
                    }
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
          )}
        </div>
      </div>
    </>
  );
}
