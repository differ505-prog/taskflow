"use client";

import { format } from "date-fns";
import type { Task } from "@/lib/types";

/**
 * MonthGrid — 共享月視圖渲染元件 (§10 三層次 Layer 2)
 * 給 CalendarView(月曆) 與 CommandCenter(排程) 共用
 *
 * 設計：純渲染,無 state、無副作用。
 * 支援 @"view" 皮膚(完整日曆功能,顯示任務條列、按優先級著色、搜尋高亮)
 * 與 @"plan" 皮膚(RPG 簡約,只顯示前 N 個任務,待完成淡金光暈)
 *
 * 拖放策略(§10 三層次 Layer 2):
 *  - "html5"(預設):CalendarView 用,onDragOver/onDrop 接 useMonthGrid
 *  - "dndkit":CommandCenter 用,內部用 useDroppable 註冊 droppable
 *    必須包在 DndContext 中(dnd-kit 要求)
 */

export type MonthGridMode = "view" | "plan";
export type DragStrategy = "html5" | "dndkit";

export interface MonthGridProps {
  /** 月視圖日期陣列(從 useMonthGrid().days) */
  days: Date[];
  /** 當月 Date(從 useMonthGrid().currentMonth) */
  currentMonth: Date;
  /** 皮膚 */
  mode: MonthGridMode;
  /** 拿每日任務的方法(從 useMonthGrid().getTasksForDay) */
  getTasksForDay: (date: Date) => Task[];
  /** 搜尋命中判定(從 useMonthGrid().matchedDayHas) */
  matchedDayHas: (dayTasks: Task[]) => boolean;
  /** 日期命中工具(從 useMonthGrid().isTodayDate / isSameMonthDate) */
  isTodayDate: (d: Date) => boolean;
  isSameMonthDate: (d: Date) => boolean;
  /** 點日期(可選 — "plan" 模式不一定需要) */
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string | null;
  /** 點任務(可選 — "view" 模式需要,"plan" 模式通常不需) */
  onSelectTask?: (task: Task) => void;
  /** HTML5 拖放(從 useMonthGrid 的 handler,僅 strategy="html5" 用) */
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (date: Date) => void;
  /** 拖放策略(預設 html5) */
  dragStrategy?: DragStrategy;
  /** "plan" 模式下,日期格最大任務數(預設 3) */
  maxTasksPerCell?: number;
  /** "view" 模式 — 任務 toggle / delete */
  onToggleStatus?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export function MonthGrid({
  days,
  currentMonth,
  mode,
  getTasksForDay,
  matchedDayHas,
  isTodayDate,
  isSameMonthDate,
  onSelectDate,
  selectedDate,
  onSelectTask,
  onDragOver,
  onDrop,
  dragStrategy: _dragStrategy = "html5",
  maxTasksPerCell = 3,
  onToggleStatus,
  onDelete,
}: MonthGridProps) {
  // 兩種皮膚的內部渲染差異如下:
  // - "view":行事曆線框、任務條列、詳情點擊 → ViewDateCell
  // - "plan":RPG 簡約、任務計數、淡金光暈 → PlanDateCell
  // 拖放邏輯保持 HTML5,因為 @dnd-kit 的 useDroppable 在 loop 內呼叫會違反 hooks 規則
  // 詳見 §10 註解 + CommandCenter 的 DndKitPlanGrid 替代實作
  const isPlan = mode === "plan";

  return (
    <section
      className="flex flex-col gap-3"
      aria-label={isPlan ? "月曆排程" : "月曆視圖"}
    >
      {/* 週標題 */}
      <div className={`grid grid-cols-7 ${isPlan ? "gap-1.5 px-0.5" : "mb-2"}`}>
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className={`text-center ${
              isPlan
                ? "text-[11px] font-medium uppercase tracking-wider text-slate-400"
                : "text-[12px] font-medium py-2"
            }`}
            style={!isPlan ? { color: "var(--text-tertiary)" } : undefined}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 日期格 */}
      <div
        className={isPlan ? "grid grid-cols-7 gap-1.5" : ""}
        style={
          !isPlan
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 1,
                background: "var(--border)",
                gridTemplateRows: `repeat(${Math.max(
                  5,
                  Math.ceil(days.length / 7),
                )}, 56px)`,
              }
            : undefined
        }
      >
        {days.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isCurrentMonth = isSameMonthDate(day);
          const isTodayDate_ = isTodayDate(day);
          const dayTasks = getTasksForDay(day);
          const isSelected = selectedDate === dateStr;
          const isSearchMatch = matchedDayHas(dayTasks);
          const isOtherMonth = !isCurrentMonth;

          if (isPlan) {
            return (
              <PlanDateCell
                key={i}
                day={day}
                dateStr={dateStr}
                isCurrentMonth={isCurrentMonth}
                isToday={isTodayDate_}
                isOtherMonth={isOtherMonth}
                tasks={dayTasks}
                maxTasks={maxTasksPerCell}
                onDragOver={onDragOver}
                onDrop={() => onDrop?.(day)}
              />
            );
          }

          return (
            <ViewDateCell
              key={i}
              day={day}
              dateStr={dateStr}
              isCurrentMonth={isCurrentMonth}
              isToday={isTodayDate_}
              isOtherMonth={isOtherMonth}
              isSelected={isSelected}
              isSearchMatch={isSearchMatch}
              tasks={dayTasks}
              onSelectDate={onSelectDate}
              onSelectTask={onSelectTask}
              onDrop={() => onDrop?.(day)}
              onDragOver={onDragOver}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
              currentMonth={currentMonth}
            />
          );
        })}
      </div>
    </section>
  );
}

// ─── "plan" 模式日期格───
function PlanDateCell({
  day,
  dateStr,
  isCurrentMonth,
  isToday,
  isOtherMonth,
  tasks,
  maxTasks,
  onDragOver,
  onDrop,
}: {
  day: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isOtherMonth: boolean;
  tasks: Task[];
  maxTasks: number;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
}) {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const isPast = dateStr < todayKey;
  const isFuture = dateStr > todayKey;

  const containerClass = isFuture
    ? "bg-zinc-50/30 ring-zinc-200/30 text-zinc-400"
    : isPast
      ? "bg-white/70 ring-slate-200/60"
      : "bg-white ring-slate-200";

  const todayHighlight = isToday ? "ring-2 ring-slate-700 shadow-sm" : "";
  const otherMonthOpacity = isOtherMonth ? "opacity-40" : "";
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group relative flex min-h-[88px] flex-col gap-1 rounded-xl p-2 ring-1 transition-all duration-200 ease-out ${containerClass} ${todayHighlight} ${otherMonthOpacity}`}
      aria-label={`${dateStr}${isToday ? " (今天)" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${
            isToday
              ? "font-semibold text-slate-800"
              : isFuture
                ? "text-zinc-400"
                : isCurrentMonth
                  ? "text-slate-700"
                  : "text-slate-400"
          }`}
        >
          {format(day, "d")}
        </span>
        {doneCount > 0 && isPast && (
          <span className="text-[10px] font-medium text-amber-500" aria-label={`已完成 ${doneCount} 個`}>
            ✦ {doneCount}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {tasks.slice(0, maxTasks).map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] ${
              task.status === "done"
                ? "bg-amber-50/60 text-slate-400 line-through"
                : "bg-slate-100/80 text-slate-700"
            }`}
            title={task.title}
          >
            <span className="truncate">{task.title}</span>
          </div>
        ))}
        {tasks.length > maxTasks && (
          <span className="text-[10px] text-slate-400">+{tasks.length - maxTasks}</span>
        )}
      </div>
    </div>
  );
}

// ─── "view" 模式日期格(完整日曆功能,HTML5 拖放)───
function ViewDateCell({
  day,
  dateStr,
  isCurrentMonth,
  isToday,
  isOtherMonth,
  isSelected,
  isSearchMatch,
  tasks,
  onSelectDate,
  onSelectTask,
  onDrop,
  onDragOver,
  onToggleStatus,
  onDelete: _onDelete,
  currentMonth: _currentMonth,
}: {
  day: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isOtherMonth: boolean;
  isSelected: boolean;
  isSearchMatch: boolean;
  tasks: Task[];
  onSelectDate?: (dateStr: string) => void;
  onSelectTask?: (task: Task) => void;
  onDrop?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onToggleStatus?: (id: string) => void;
  onDelete?: (id: string) => void;
  currentMonth: Date;
}) {
  const pendingTasks = tasks.filter((t) => t.status !== "done");
  const pendingCount = pendingTasks.length;

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="relative flex flex-col transition-colors duration-150 cursor-pointer"
      style={{
        background: isSelected
          ? "var(--brand-tint)"
          : isCurrentMonth
            ? "var(--surface)"
            : "var(--surface-muted)",
        minHeight: 56,
        outline: isSearchMatch ? "2px solid var(--brand)" : undefined,
        outlineOffset: isSearchMatch ? -2 : undefined,
      }}
      onClick={() => onSelectDate?.(dateStr)}
    >
      <div className="flex flex-row items-center justify-between px-1 pt-0.5">
        <span
          className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-medium"
          style={{
            background: isToday ? "var(--brand)" : "transparent",
            color: isToday
              ? "var(--brand-foreground)"
              : isCurrentMonth
                ? "var(--text-primary)"
                : "var(--text-tertiary)",
          }}
        >
          {format(day, "d")}
        </span>
        {pendingCount > 0 && (
          <span
            className="text-[9px] font-medium px-1 rounded-full"
            style={{
              background: "var(--brand-tint)",
              color: "var(--brand)",
            }}
          >
            {pendingCount}
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col gap-0.5 px-1 pb-1 overflow-hidden">
        {tasks.slice(0, 3).map((task) => (
          <button
            key={task.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectTask?.(task);
            }}
            className={`text-[10px] truncate rounded px-1 py-0.5 text-left transition-colors hover:opacity-80 ${
              task.status === "done" ? "line-through opacity-60" : ""
            }`}
            style={{
              background: task.status === "done" ? "transparent" : "var(--brand-tint)",
              color: task.status === "done" ? "var(--text-tertiary)" : "var(--brand)",
            }}
            title={task.title}
          >
            {task.title}
          </button>
        ))}
        {tasks.length > 3 && (
          <span className="text-[9px] text-center" style={{ color: "var(--text-tertiary)" }}>
            +{tasks.length - 3}
          </span>
        )}
      </div>
    </div>
  );
}
