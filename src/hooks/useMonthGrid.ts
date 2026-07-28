"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
  parseISO,
} from "date-fns";
import type { Task } from "@/lib/types";

/**
 * useMonthGrid — 共享月視圖邏輯 (§10 三層次 Layer 1)
 * 給 CalendarView(月曆) 與 CommandCenter(排程) 共用
 *
 * 設計原則：
 * 1. 零 UI:只回傳資料 + 動作,不渲染任何 DOM
 * 2. 拖放統一規則:區間任務保留 lengthDays;單日任務保持 dueDate;無日期任務設 dueDate
 * 3. 單月 + 跨月 padding:CalendarView 用的「精準第一格 = 月首日」+ 「末格 = 月末日」邏輯
 *    (§26-K fix 已併入)
 * 4. 搜尋高亮:呼叫端傳 searchQuery,hook 自動算出 matchedDayHas 判定
 * 5. 手機 swipe 換月:80px 門檻 + 方向鎖定,沿用 CalendarView 已驗證邏輯
 */

export interface UseMonthGridOptions {
  /** 所有任務(從 useApp().tasks) */
  tasks: Task[];
  /** 搜尋字串(可空) */
  searchQuery?: string;
  /** 拖放變更日期時呼叫 — 統一規則見上方 */
  onUpdateTaskDates: (taskId: string, startDate: string, dueDate: string) => void;
  /** 是否啟用手機 swipe 換月(預設 true,若 view 內已有自訂換月可關閉) */
  enableSwipe?: boolean;
}

export interface UseMonthGridReturn {
  /** 當月 + 前後 padding 補齊的日期陣列(7×N 網格用) */
  days: Date[];
  /** 當月 Date 物件 */
  currentMonth: Date;
  /** 月份切換 */
  setCurrentMonth: (d: Date) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  resetMonth: () => void;
  /** 拿指定日期的任務清單(含區間任務判定) */
  getTasksForDay: (date: Date) => Task[];
  /** 日期是否被搜尋字串命中(用於高亮) */
  matchedDayHas: (dayTasks: Task[]) => boolean;
  /** 拖放動作:呼叫端在 onDragOver/onDrop 傳入 */
  handleDragStart: (taskId: string) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (date: Date) => void;
  draggingTaskId: string | null;
  /** 手機 swipe 換月觸發器(給最外層 onTouchStart/Move/End 綁) */
  swipeTouchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  /** 工具 */
  toDateKey: (d: Date) => string;
  isTodayDate: (d: Date) => boolean;
  isSameMonthDate: (d: Date) => boolean;
}

const SWIPE_THRESHOLD = 80; // px(沿用 CalendarView L52)

export function useMonthGrid({
  tasks,
  searchQuery = "",
  onUpdateTaskDates,
  enableSwipe = true,
}: UseMonthGridOptions): UseMonthGridReturn {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  // ─── 月份 padding 計算(沿用 CalendarView 邏輯,§26-K fix 已併入)───
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });

    const startDay = start.getDay();
    const padBefore = Array.from({ length: startDay }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() - (startDay - i));
      return d;
    });

    const endDay = end.getDay();
    const padAfterLen = (7 - endDay) % 7;
    const padAfter = Array.from({ length: padAfterLen }, (_, i) => {
      const d = new Date(end);
      d.setDate(d.getDate() + i + 1);
      return d;
    });

    return [...padBefore, ...allDays, ...padAfter];
  }, [currentMonth]);

  const getTasksForDay = useCallback(
    (date: Date): Task[] => {
      const dateStr = format(date, "yyyy-MM-dd");
      return tasks.filter((t) => {
        if (t.isArchived) return false;
        const start = t.startDate;
        const end = t.dueDate;
        if (start && end) return dateStr >= start && dateStr <= end;
        if (!start && end) return dateStr === end;
        if (start && !end) return dateStr === start;
        return false;
      });
    },
    [tasks],
  );

  const matchedDayHas = useCallback(
    (dayTasks: Task[]): boolean => {
      if (!searchQuery.trim()) return false;
      const q = searchQuery.toLowerCase();
      return dayTasks.some(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          t.subTasks?.some((s) => s.title.toLowerCase().includes(q)),
      );
    },
    [searchQuery],
  );

  // ─── 拖放動作(統一規則)───
  const handleDragStart = useCallback((taskId: string) => {
    setDraggingTaskId(taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (date: Date) => {
      if (!draggingTaskId) return;
      const dateStr = format(date, "yyyy-MM-dd");
      const task = tasks.find((t) => t.id === draggingTaskId);
      if (!task) {
        setDraggingTaskId(null);
        return;
      }
      // 統一規則:有 startDate 區間任務保留 lengthDays;無 startDate 只設 dueDate
      const oldStart = task.startDate || task.dueDate || dateStr;
      const oldEnd = task.dueDate || task.startDate || dateStr;
      const lengthDays = Math.round(
        (parseISO(oldEnd).getTime() - parseISO(oldStart).getTime()) / 86400000,
      );
      const newStart = dateStr;
      const newEndDate = new Date(parseISO(newStart).getTime() + lengthDays * 86400000);
      const newEnd = format(newEndDate, "yyyy-MM-dd");
      onUpdateTaskDates(draggingTaskId, newStart, newEnd);
      setDraggingTaskId(null);
    },
    [draggingTaskId, tasks, onUpdateTaskDates],
  );

  // ─── 月份切換 ───
  const prevMonth = useCallback(() => {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }, []);
  const nextMonth = useCallback(() => {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }, []);
  const resetMonth = useCallback(() => {
    setCurrentMonth(new Date());
  }, []);

  // ─── 手機 swipe 換月(沿用 CalendarView 邏輯)───
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastDeltaRef = useRef<{ dx: number; dy: number } | null>(null);
  const directionLockedRef = useRef<"h" | "v" | null>(null);

  const onSwipeTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enableSwipe) return;
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastDeltaRef.current = null;
      directionLockedRef.current = null;
    },
    [enableSwipe],
  );

  const onSwipeTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enableSwipe || !touchStartRef.current) return;
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      lastDeltaRef.current = { dx, dy };

      if (directionLockedRef.current !== null) return;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        directionLockedRef.current = "h";
      } else if (Math.abs(dy) > Math.abs(dx) * 1.5) {
        directionLockedRef.current = "v";
      }
    },
    [enableSwipe],
  );

  const onSwipeTouchEnd = useCallback(() => {
    if (!enableSwipe) return;
    const locked = directionLockedRef.current;
    const delta = lastDeltaRef.current;
    touchStartRef.current = null;
    lastDeltaRef.current = null;
    directionLockedRef.current = null;

    if (locked !== "h" || !delta) return;
    if (Math.abs(delta.dx) < SWIPE_THRESHOLD) return;
    if (delta.dx < 0) {
      nextMonth();
    } else {
      prevMonth();
    }
  }, [enableSwipe, nextMonth, prevMonth]);

  const swipeTouchHandlers = enableSwipe
    ? {
        onTouchStart: onSwipeTouchStart,
        onTouchMove: onSwipeTouchMove,
        onTouchEnd: onSwipeTouchEnd,
      }
    : {
        onTouchStart: () => {},
        onTouchMove: () => {},
        onTouchEnd: () => {},
      };

  // ─── 工具 ───
  const toDateKey = useCallback((d: Date) => format(d, "yyyy-MM-dd"), []);
  const isTodayDate = useCallback((d: Date) => isToday(d), []);
  const isSameMonthDate = useCallback(
    (d: Date) => isSameMonth(d, currentMonth),
    [currentMonth],
  );

  return {
    days,
    currentMonth,
    setCurrentMonth,
    prevMonth,
    nextMonth,
    resetMonth,
    getTasksForDay,
    matchedDayHas,
    handleDragStart,
    handleDragOver,
    handleDrop,
    draggingTaskId,
    swipeTouchHandlers,
    toDateKey,
    isTodayDate,
    isSameMonthDate,
  };
}
