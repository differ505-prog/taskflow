"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/lib/AppContext";
import { Habit } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  X,
  CheckCircle2,
  Circle,
  Trash2,
  Edit3,
  TrendingUp,
  Heart,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { getLocalToday, toLocalDateString } from "@/lib/dateUtils";

const HABIT_COLORS = [
  "#4F6AF5",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#636366",
];

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_NAMES = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

/** 取得某年月的日曆格（包含上月底空白 + 當月所有日） */
function getMonthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(toLocalDateString(new Date(year, month, d)));
  }
  return grid;
}

interface HabitCalendarProps {
  habits: Habit[];
  activeHabits: Habit[];
  checkinHabit: (id: string, date: string) => void;
  uncheckHabit: (id: string, date: string) => void;
}

function DayDetailPopover({ dateStr, allHabits, checkedIds, checkinHabit, uncheckHabit, top, left, onClose }: {
  dateStr: string;
  allHabits: Habit[];
  checkedIds: Set<string>;
  checkinHabit: (id: string, date: string) => void;
  uncheckHabit: (id: string, date: string) => void;
  top: number;
  left: number;
  onClose: () => void;
}) {
  const checkedCount = checkedIds.size;
  const totalCount = allHabits.length;
  const displayDate = dateStr.replace(/^\d{4}-/, "").replace("-", "/");

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      {/* Popover */}
      <div
        className="fixed z-50 w-64 rounded-2xl shadow-lg border overflow-hidden"
        style={{
          top: Math.min(top + 4, window.innerHeight - 320),
          left: Math.max(8, Math.min(left - 32, window.innerWidth - 280)),
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
        role="dialog"
        aria-label={`${dateStr} 打卡狀態`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{displayDate}</div>
            <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              {checkedCount}/{totalCount} 已打卡
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--hover-bg)]" aria-label="關閉">
            <X className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>
        {/* Habit list */}
        <div className="max-h-60 overflow-y-auto divide-y" style={{ borderColor: "var(--border)" }}>
          {allHabits.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              這天沒有進行的習慣
            </div>
          ) : (
            allHabits.map((habit) => {
              const isChecked = checkedIds.has(habit.id);
              return (
                <button
                  key={habit.id}
                  onClick={() => {
                    if (isChecked) uncheckHabit(habit.id, dateStr);
                    else checkinHabit(habit.id, dateStr);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--hover-bg)] transition-colors text-left"
                >
                  {isChecked ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: habit.color }} />
                  ) : (
                    <Circle className="w-5 h-5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
                  )}
                  <span className="text-[13px] flex-1 truncate" style={{ color: isChecked ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    {habit.title}
                  </span>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isChecked ? habit.color : "var(--text-quaternary)" }} />
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function HabitCalendar({ habits, activeHabits, checkinHabit, uncheckHabit }: HabitCalendarProps) {
  const today = getLocalToday();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = `${viewYear}年 ${MONTH_NAMES[viewMonth]}`;
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const selectedDateData = useMemo(() => {
    if (!selectedDate) return null;
    const checked = habits.filter((h) => !h.archivedAt && h.checkins.some((c) => c.date === selectedDate && c.completed));
    const all = activeHabits.filter((h) => !h.archivedAt);
    return {
      dayAllHabits: all,
      dayCheckedIds: new Set(checked.map((d) => d.id)),
    };
  }, [selectedDate, habits, activeHabits]);

  return (
    <div className="card px-5 py-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors" aria-label="上個月">
          <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>{monthLabel}</span>
          {!isCurrentMonth && (
            <button
              onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); }}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors"
              style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
              aria-label="回到今天"
            >
              今天
            </button>
          )}
        </div>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors" aria-label="下個月">
          <ChevronRight className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-medium py-1"
            style={{ color: i === 0 || i === 6 ? "var(--text-quaternary)" : "var(--text-tertiary)" }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((dateStr, idx) => {
          if (!dateStr) return <div key={`empty-${idx}`} />;
          const dayNum = parseInt(dateStr.split("-")[2], 10);
          const isToday = dateStr === today;
          const isFuture = dateStr > today;
          const isPast = dateStr < today;
          const dayCheckins = habits
            .filter((h) => !h.archivedAt && h.checkins.some((c) => c.date === dateStr && c.completed))
            .map((h) => ({ habit: h, checkin: h.checkins.find((c) => c.date === dateStr)! }));
          const dayAllHabits = activeHabits.filter((h) => !h.archivedAt);
          const dayCheckedIds = new Set(dayCheckins.map((d) => d.habit.id));

          return (
            <div
              key={dateStr}
              className="relative flex flex-col items-center py-1.5 rounded-lg transition-colors select-none"
              style={{
                background: isToday ? "var(--brand-tint)" : "transparent",
                cursor: isFuture ? "default" : "pointer",
              }}
            >
              <span
                className="text-[12px] font-medium"
                style={{
                  color: isToday
                    ? "var(--brand)"
                    : isFuture
                    ? "var(--text-quaternary)"
                    : isPast
                    ? "var(--text-secondary)"
                    : "var(--text-tertiary)",
                }}
              >
                {dayNum}
              </span>
              {/* Habit dots */}
              {!isFuture && dayCheckins.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-0.5 max-w-[36px]">
                  {dayCheckins.slice(0, 3).map(({ habit, checkin }) => (
                    <button
                      key={habit.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        uncheckHabit(habit.id, dateStr);
                      }}
                      className="w-2 h-2 rounded-full transition-transform hover:scale-125"
                      style={{ background: habit.color }}
                      title={`${habit.title} ${dateStr} ✓`}
                      aria-label={`取消 ${habit.title} ${dateStr} 打卡`}
                    />
                  ))}
                  {dayCheckins.length > 3 && (
                    <span className="text-[8px]" style={{ color: "var(--text-tertiary)" }}>+{dayCheckins.length - 3}</span>
                  )}
                </div>
              )}
              {/* Unchecked habits → tap to view day summary */}
              {!isFuture && (
                <div
                  className="absolute inset-0 rounded-lg opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setSelectedDate(dateStr);
                    setPopoverPos({ top: rect.bottom, left: rect.left });
                  }}
                  title="查看打卡狀態"
                >
                  {dayCheckins.length === 0 && (
                    <div
                      className="w-4 h-4 rounded-full border border-dashed"
                      style={{ borderColor: "var(--text-quaternary)" }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: "var(--text-quaternary)" }} />
          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>未打卡</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: "var(--brand)" }} />
          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>已打卡</span>
        </div>
        <span className="text-[10px]" style={{ color: "var(--text-quaternary)" }}>點格查打卡</span>
      </div>

      {/* Day detail popover */}
      {selectedDate && popoverPos && selectedDateData && (
        <DayDetailPopover
          dateStr={selectedDate}
          allHabits={selectedDateData.dayAllHabits}
          checkedIds={selectedDateData.dayCheckedIds}
          checkinHabit={checkinHabit}
          uncheckHabit={uncheckHabit}
          top={popoverPos.top}
          left={popoverPos.left}
          onClose={() => { setSelectedDate(null); setPopoverPos(null); }}
        />
      )}
    </div>
  );
}

interface HabitFormData {
  title: string;
  frequency: Habit["frequency"];
  color: string;
  daysOfWeek: number[];
  targetCount: number;
  description: string;
}

function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(toLocalDateString(d));
  }
  return days;
}

function HabitRow({ habit, onCheckin, onDelete, onUpdate, onRestore }: {
  habit: Habit;
  onCheckin: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Habit>) => void;
  onRestore?: () => void;
}) {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const today = getLocalToday();
  const isArchived = !!habit.archivedAt;
  const todayCheckin = habit.checkins.find((c) => c.date === today);
  const isCheckedToday = !!todayCheckin?.completed;
  const last30Days = getLast30Days();
  const completedDays = new Set(habit.checkins.filter((c) => c.completed).map((c) => c.date));

  const heatmapColors = (date: string) => {
    if (!completedDays.has(date)) return "var(--surface-hover)";
    const checkin = habit.checkins.find((c) => c.date === date);
    const count = checkin?.count || 1;
    if (count >= 3) return habit.color;
    if (count === 2) return habit.color + "CC";
    return habit.color + "88";
  };

  return (
    <div className="card px-5 py-4" style={isArchived ? { opacity: 0.65 } : undefined}>
      <div className="flex items-start gap-4">
        {/* Check button */}
        <button
          onClick={onCheckin}
          disabled={isArchived}
          className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110 disabled:hover:scale-100 disabled:cursor-not-allowed"
          aria-label={isArchived ? "已封存" : isCheckedToday ? "取消打卡" : "打卡"}
        >
          {isCheckedToday ? (
            <CheckCircle2 className="w-6 h-6" style={{ color: habit.color }} />
          ) : (
            <Circle className="w-6 h-6" style={{ color: "var(--text-tertiary)" }} />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>{habit.title}</h3>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="顯示熱力圖"
              >
                <TrendingUp className="w-4 h-4" />
              </button>
              {onRestore ? (
                <button
                  onClick={onRestore}
                  className="px-2 py-1 rounded-lg text-[12px] font-medium hover:bg-blue-50 transition-colors"
                  style={{ color: "var(--brand)" }}
                  aria-label="還原習慣"
                >
                  還原
                </button>
              ) : (
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  aria-label="封存習慣"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Heatmap */}
          <AnimatePresence>
            {showHeatmap && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-10 gap-1 mt-3">
                  {last30Days.map((date, i) => {
                    const d = new Date(date);
                    const dayOfWeek = d.getDay();
                    return (
                      <div
                        key={date}
                        className="aspect-square rounded-sm transition-colors"
                        style={{
                          background: heatmapColors(date),
                          opacity: dayOfWeek === 0 || dayOfWeek === 6 ? 0.5 : 1,
                        }}
                        title={`${date}${completedDays.has(date) ? " ✓" : ""}`}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>30天</span>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ background: "var(--surface-hover)" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>未達成</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ opacity: 0.5, background: habit.color }} />
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>已達成</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function HabitsPage() {
  const { habits, addHabit, checkinHabit, uncheckHabit, archiveHabit, unarchiveHabit } = useApp();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [form, setForm] = useState<HabitFormData>({
    title: "",
    frequency: "daily",
    color: HABIT_COLORS[0],
    daysOfWeek: [],
    targetCount: 1,
    description: "",
  });

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    addHabit({
      title: form.title.trim(),
      description: form.description || undefined,
      frequency: form.frequency,
      color: form.color,
      daysOfWeek: form.frequency === "weekly" ? form.daysOfWeek : undefined,
      targetCount: form.targetCount,
    });
    setForm({ title: "", frequency: "daily", color: HABIT_COLORS[0], daysOfWeek: [], targetCount: 1, description: "" });
    setShowForm(false);
  };

  const today = getLocalToday();
  const activeHabits = habits.filter((h) => !h.archivedAt);
  const archivedHabits = habits.filter((h) => !!h.archivedAt);
  const todayDone = activeHabits.filter((h) => h.checkins.some((c) => c.date === today && c.completed)).length;
  const displayHabits = showArchived ? archivedHabits : activeHabits;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5 overflow-y-auto overscroll-contain pb-[calc(60px+env(safe-area-inset-bottom,0px)+12px)]"
      style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>習慣打卡</h1>
          <p className="text-[12px] mt-1.5" style={{ color: "var(--text-tertiary)" }}>
            今日完成 {todayDone}/{activeHabits.length} 個習慣
            {archivedHabits.length > 0 && !showArchived && (
              <span className="ml-2">
                · 已封存 {archivedHabits.length} 個
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {archivedHabits.length > 0 && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-[var(--hover-bg)]"
              style={{ color: "var(--text-secondary)" }}
            >
              {showArchived ? "← 返回" : `查看封存 (${archivedHabits.length})`}
            </button>
          )}
          <Button
            onClick={() => setShowCalendar((v) => !v)}
            aria-label="月曆視圖"
            className="flex items-center gap-1.5"
            icon={<CalendarDays className="w-4 h-4" />}
          >
            {showCalendar ? "列表" : "月曆"}
          </Button>
          <Button onClick={() => setShowForm(true)} aria-label="新增習慣" className="flex items-center gap-1.5" icon={<Plus className="w-4 h-4" />}>新增習慣</Button>
        </div>
      </div>

      {/* Habit form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="card p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>新增習慣</h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)]" style={{ color: "var(--text-tertiary)" }} aria-label="關閉">
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="習慣名稱，例如：每天運動 30 分鐘"
              className="input"
              autoFocus
            />

            {/* Frequency */}
            <div className="flex gap-2">
              {(["daily", "weekly"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setForm({ ...form, frequency: f })}
                  className="flex-1 py-2 rounded-xl text-[13px] font-medium transition-all"
                  style={
                    form.frequency === f
                      ? { background: "var(--brand-tint)", color: "var(--brand)" }
                      : { background: "var(--surface-hover)", color: "var(--text-secondary)" }
                  }
                >
                  {f === "daily" ? "每日" : "每週"}
                </button>
              ))}
            </div>

            {/* Weekly day picker */}
            {form.frequency === "weekly" && (
              <div className="flex gap-2">
                {WEEKDAY_LABELS.map((label, i) => {
                  const active = form.daysOfWeek.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (active) {
                          setForm({ ...form, daysOfWeek: form.daysOfWeek.filter((d) => d !== i) });
                        } else {
                          setForm({ ...form, daysOfWeek: [...form.daysOfWeek, i] });
                        }
                      }}
                      className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all"
                      style={
                        active
                          ? { background: form.color, color: "white" }
                          : { background: "var(--surface-hover)", color: "var(--text-secondary)" }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Color */}
            <div className="flex gap-2 flex-wrap justify-center">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c,
                    transform: form.color === c ? "scale(1.15)" : "scale(1)",
                    boxShadow: form.color === c ? `0 0 0 3px var(--surface), 0 0 0 5px ${c}` : "none",
                  }}
                  aria-label={`選擇顏色 ${c}`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>取消</Button>
              <Button type="button" onClick={handleSubmit} disabled={!form.title.trim()}>
                建立習慣
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar view */}
      {showCalendar && !showArchived && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
          <HabitCalendar
            habits={habits}
            activeHabits={activeHabits}
            checkinHabit={checkinHabit}
            uncheckHabit={uncheckHabit}
          />
        </motion.div>
      )}

      {/* Habits list */}
      {displayHabits.length === 0 && !showForm ? (
        <div className="card px-6 py-16 text-center">
          <Heart className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "var(--text-tertiary)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>
            {showArchived ? "沒有封存的習慣" : "還沒有習慣"}
          </p>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>
            {showArchived ? "封存的習慣會保留所有打卡紀錄" : "點擊上方「新增習慣」開始追蹤你的第一個習慣"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {displayHabits.map((habit) => (
              <motion.div
                key={habit.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
              >
                <HabitRow
                  habit={habit}
                  onCheckin={() => {
                    const isDone = habit.checkins.some((c) => c.date === today && c.completed);
                    if (isDone) uncheckHabit(habit.id, today);
                    else checkinHabit(habit.id, today);
                  }}
                  onDelete={async () => {
                  const ok = await confirm({
                    intent: "defer",
                    title: `封存習慣「${habit.title}」`,
                    message: "此習慣將從主列表移除,但 streak、checkins 紀錄仍會保留,可在「查看封存」中還原。",
                    impactDetail: `${habit.checkins.filter((c) => c.completed).length} 次打卡紀錄將保留`,
                    tone: "warning",
                  });
                  if (ok) archiveHabit(habit.id);
                }}
                  onUpdate={() => {}}
                  onRestore={showArchived ? () => unarchiveHabit(habit.id) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
