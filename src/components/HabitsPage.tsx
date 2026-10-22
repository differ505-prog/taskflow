"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
  Pause,
  Play,
} from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { getLocalToday, toLocalDateString } from "@/lib/dateUtils";
import { useFlowTimerContext } from "@/lib/ZenFlowContext";

const HABIT_COLORS = [
  "#4F6AF5",
  "#4F6AF5",
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
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

function HabitCalendar({ habits, activeHabits, checkinHabit, uncheckHabit, selectedDate, onSelectDate }: HabitCalendarProps) {
  const today = getLocalToday();
  const now = new Date();
  
  // 嘗試將 viewYear / viewMonth 初始化為 selectedDate 所在的年月
  const selectedDateObj = new Date(selectedDate);
  const [viewYear, setViewYear] = useState(selectedDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDateObj.getMonth());

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
              onClick={() => {
                if (!isFuture) onSelectDate(dateStr);
              }}
              className="relative flex flex-col items-center py-1.5 rounded-lg transition-colors select-none"
              style={{
                background: dateStr === selectedDate ? "var(--brand-tint)" : isToday ? "var(--surface-hover)" : "transparent",
                cursor: isFuture ? "default" : "pointer",
                border: dateStr === selectedDate ? "1px solid var(--brand)" : "1px solid transparent",
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
                    <div
                      key={habit.id}
                      className="w-2 h-2 rounded-full"
                      style={{ background: habit.color }}
                      title={`${habit.title} ${dateStr} ✓`}
                      aria-label={`${habit.title} ${dateStr} 已打卡`}
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
                  className="absolute inset-0 rounded-lg opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"
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
      </div>
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

function HabitRow({
  habit,
  date,
  onCheckin,
  onDelete,
  onUpdate,
  onRestore,
  onEdit,
  activePomodoro,
  onStartPomodoro,
  onPausePomodoro,
  onStopPomodoro,
  onIncrementPomodoro,
  onDecrementPomodoro,
  onLogTime,
}: {
  habit: Habit;
  date: string;
  onCheckin: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Habit>) => void;
  onRestore?: () => void;
  onEdit: () => void;
  /** 若此 habit 正有計時器在跑，傳入 { secondsLeft, totalSeconds }；否則 null */
  activePomodoro?: { secondsLeft: number; totalSeconds: number } | null;
  onStartPomodoro: (minutes: number) => void;
  onPausePomodoro: () => void;
  onStopPomodoro: () => void;
  onIncrementPomodoro: () => void;
  onDecrementPomodoro: () => void;
  onLogTime?: (minutes: number) => void;
}) {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showTimeLogger, setShowTimeLogger] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState("");
  const isArchived = !!habit.archivedAt;
  const currentCheckin = habit.checkins.find((c) => c.date === date);
  const isChecked = !!currentCheckin?.completed;
  const last30Days = getLast30Days();
  const completedDays = new Set(habit.checkins.filter((c) => c.completed).map((c) => c.date));
  const [desc, setDesc] = useState(habit.description || "");

  // 計算本日番茄數
  const todayPoms = habit.checkins.find((c) => c.date === date)?.pomodoros ?? 0;

  // 番茄單位時長：手動「+」每按一顆代表的分鐘數
  // = 該習慣「上次使用」的時長（pomodoroMinutes），未設定時預設 25（標準番茄）
  const unitMinutes = habit.pomodoroMinutes ?? 25;

  // ── 雙維度時長：今日專注 + 歷史累計 ──────────────────────────────
  // 今日專注分鐘：優先使用真實 minutes，若無則依番茄數乘算
  const todayMinutes = currentCheckin?.minutes ?? (todayPoms * unitMinutes);
  // 歷史累計總時長：各日真實 minutes 加總（無 minutes 則以番茄數推算）
  const totalHistoryMinutes = useMemo(() => {
    return habit.checkins.reduce(
      (sum, c) => sum + (c.minutes ?? ((c.pomodoros ?? 0) * (habit.pomodoroMinutes ?? 25))),
      0,
    );
  }, [habit.checkins, habit.pomodoroMinutes]);

  // < 60 分 → "X 分"；≥ 60 分 → "Y.Y 小時"
  const formatDuration = (minutes: number) =>
    minutes < 60 ? `${minutes} 分` : `${(minutes / 60).toFixed(1)} 小時`;

  // 選取的不是今天時，用日期前綴避免誤導
  const isToday = date === getLocalToday();
  const durationLabel = isToday ? "今日" : `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

  // 計時器格式化
  const formatSeconds = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  useEffect(() => {
    setDesc(habit.description || "");
  }, [habit.description]);

  const heatmapColors = (date: string) => {
    if (!completedDays.has(date)) return "var(--surface-hover)";
    const checkin = habit.checkins.find((c) => c.date === date);
    const poms = checkin?.pomodoros ?? 0;
    if (poms >= 3) return habit.color;
    if (poms === 2) return habit.color + "CC";
    if (poms === 1) return habit.color + "88";
    // 已打卡但無番茄：最淡
    return habit.color + "55";
  };

  return (
    <div className="card px-5 py-4" style={isArchived ? { opacity: 0.65 } : undefined}>
      <div className="flex items-start gap-4">
        {/* Check button */}
        <button
          onClick={onCheckin}
          disabled={isArchived}
          className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110 disabled:hover:scale-100 disabled:cursor-not-allowed"
          aria-label={isArchived ? "已封存" : isChecked ? "取消打卡" : "打卡"}
        >
          {isChecked ? (
            <CheckCircle2 className="w-6 h-6" style={{ color: habit.color }} />
          ) : (
            <Circle className="w-6 h-6" style={{ color: "var(--text-tertiary)" }} />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>{habit.title}</h3>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onBlur={() => {
                  if (desc.trim() !== (habit.description || "")) {
                    onUpdate({ description: desc.trim() });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.currentTarget.blur();
                  }
                }}
                placeholder="新增符合的行為 (例如: 慢跑、重訓...)"
                className="w-full bg-transparent outline-none text-[12px] mt-0.5 placeholder:opacity-50 transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                disabled={isArchived}
              />
            </div>
            <div className="flex gap-1">
              {isArchived && onRestore ? (
                <button
                  onClick={onRestore}
                  className="px-2 py-1 rounded-lg text-[12px] font-medium hover:bg-blue-50 transition-colors"
                  style={{ color: "var(--brand)" }}
                  aria-label="還原習慣"
                >
                  還原
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label="顯示熱力圖"
                  >
                    <TrendingUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onEdit}
                    className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label="編輯習慣"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onDelete}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label="封存習慣"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 🍅 Pomodoro chip 排 */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* 時長按鈕群組 */}
            <div className="flex items-center gap-1" role="group" aria-label="選擇專注時長">
              {([5, 10, 25] as const).map((mins) => (
                <button
                  key={mins}
                  type="button"
                  disabled={!!activePomodoro && activePomodoro.secondsLeft > 0}
                  onClick={() => onStartPomodoro(mins)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 disabled:cursor-not-allowed"
                  style={{
                    background: activePomodoro && activePomodoro.secondsLeft > 0 ? "var(--surface-hover)" : "var(--brand-tint)",
                    color: activePomodoro && activePomodoro.secondsLeft > 0 ? "var(--text-quaternary)" : "var(--brand)",
                    opacity: activePomodoro && activePomodoro.secondsLeft > 0 ? 0.5 : 1,
                    // 當前番茄單位長度（手動「+」每顆代表的分鐘數）用內圈標示，
                    // 讓用戶看得出「按這個 🍅 就會改掉手動登錄的單位時長」
                    boxShadow: unitMinutes === mins ? "inset 0 0 0 1.5px var(--brand)" : undefined,
                  }}
                  title={
                    unitMinutes === mins
                      ? `目前每顆番茄 = ${mins} 分（點此改單位）`
                      : `開始 ${mins} 分鐘專注（會把手動登錄單位改為 ${mins} 分）`
                  }
                  aria-label={
                    unitMinutes === mins
                      ? `開始 ${mins} 分鐘專注（目前番茄單位）`
                      : `開始 ${mins} 分鐘專注`
                  }
                >
                  🍅 {mins}
                </button>
              ))}
            </div>

            {/* 就地倒數顯示（僅運行中該列顯示） */}
            {activePomodoro && activePomodoro.secondsLeft > 0 && (
              <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1 duration-200">
                <span
                  className="font-mono text-[13px] tabular-nums font-medium"
                  style={{ color: "var(--text-primary)" }}
                  aria-live="polite"
                >
                  {formatSeconds(activePomodoro.secondsLeft)}
                </span>
                <button
                  type="button"
                  onClick={onPausePomodoro}
                  className="p-1 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  aria-label="暫停"
                >
                  <Pause className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={onStopPomodoro}
                  className="px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors hover:bg-[var(--hover-bg)]"
                  style={{ color: "var(--text-tertiary)" }}
                  aria-label="收工（結束本次專注）"
                >
                  收工
                </button>
              </div>
            )}

            {/* ── 手動登錄計數器 ──────────────────────────── */}
            <div
              className="flex items-center gap-1 ml-auto"
              role="group"
              aria-label="手動調整番茄計數"
            >
              {/* 減一按鈕：≥1 時才顯示 */}
              {todayPoms > 0 && (
                <button
                  type="button"
                  onClick={onDecrementPomodoro}
                  disabled={!!activePomodoro && activePomodoro.secondsLeft > 0}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-[13px] font-medium transition-all duration-150 disabled:cursor-not-allowed hover:bg-[var(--hover-bg)]"
                  style={{
                    color: "var(--text-tertiary)",
                    opacity: activePomodoro && activePomodoro.secondsLeft > 0 ? 0.4 : 1,
                  }}
                  aria-label={`移除 1 個番茄（目前 ${todayPoms} 個，每顆 ${unitMinutes} 分）`}
                  title={`移除 1 個番茄（−${unitMinutes} 分）`}
                >
                  −
                </button>
              )}

              {/* 本日番茄計數（置於 − / + 之間，湊成 [−] [×N] [+] 三件式）*/}
              {todayPoms > 0 && (
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full tabular-nums"
                  style={{ background: habit.color + "22", color: habit.color }}
                  aria-label={`本日 ${todayPoms} 個番茄`}
                >
                  ×{todayPoms}
                </span>
              )}

              {/* 加一按鈕 */}
              <button
                type="button"
                onClick={onIncrementPomodoro}
                disabled={!!activePomodoro && activePomodoro.secondsLeft > 0}
                className="w-6 h-6 flex items-center justify-center rounded-md text-[14px] font-medium transition-all duration-150 disabled:cursor-not-allowed"
                style={{
                  color: "var(--brand)",
                  background: "var(--brand-tint)",
                  opacity: activePomodoro && activePomodoro.secondsLeft > 0 ? 0.4 : 1,
                }}
                aria-label={`記錄 1 個番茄（目前 ${todayPoms} 個，每顆 ${unitMinutes} 分）`}
                title={`手動記錄 1 個番茄（+${unitMinutes} 分）`}
              >
                +
              </button>

              {/* 番茄單位時長 — 讓「+ 會加多少分鐘」隨時可見、可預期 */}
              <span
                className="ml-0.5 text-[10px] tabular-nums whitespace-nowrap"
                style={{ color: "var(--text-tertiary)", opacity: 0.6 }}
                title={`每顆番茄代表 ${unitMinutes} 分鐘（點上方 🍅 晶片可調整單位）`}
              >
                每顆 {unitMinutes} 分
              </span>
            </div>
          </div>

          {/* ── 雙維度時長徽章：今日專注 · 歷史累計 · 補登入口 ─────────────── */}
          <div
            className="flex items-center gap-2 mt-1.5 text-[10px] tabular-nums whitespace-nowrap flex-wrap"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span
              style={{ opacity: todayMinutes > 0 ? 0.9 : 0.55 }}
              title={`${durationLabel}專注時長（本日投入 ${todayMinutes} 分鐘）`}
            >
              {durationLabel} {formatDuration(todayMinutes)}
            </span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span
              style={{ opacity: totalHistoryMinutes > 0 ? 0.9 : 0.55 }}
              title={`歷史累計專注時長（${totalHistoryMinutes} 分鐘）`}
            >
              歷史累計 {formatDuration(totalHistoryMinutes)}
            </span>

            {/* 補登入口按鈕 */}
            {!isArchived && onLogTime && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <button
                  type="button"
                  onClick={() => setShowTimeLogger((v) => !v)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium transition-all hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]"
                  style={{
                    color: showTimeLogger ? "var(--brand)" : "var(--text-tertiary)",
                    background: showTimeLogger ? "var(--brand-tint)" : "transparent",
                  }}
                  aria-label="補登專注時長"
                  title="手動記錄剛剛執行了多少時間"
                >
                  ⏱️ 補登時長
                </button>
              </>
            )}
          </div>

          {/* ── 補登時長面板（快捷膠囊 + 自訂輸入）──────────────── */}
          <AnimatePresence>
            {showTimeLogger && !isArchived && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden mt-2 p-2.5 rounded-xl border"
                style={{
                  background: "var(--surface-hover)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    ⏱️ 補登執行時間（直接累加至今日）
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTimeLogger(false)}
                    className="text-[11px] hover:opacity-100 opacity-60 transition-opacity"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    關閉
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {([15, 25, 30, 45, 60] as const).map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        onLogTime?.(mins);
                        setShowTimeLogger(false);
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium transition-transform hover:scale-105 active:scale-95"
                      style={{
                        background: "var(--brand-tint)",
                        color: "var(--brand)",
                      }}
                    >
                      +{mins}分
                    </button>
                  ))}

                  {/* 自訂數字輸入 */}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={customMinutesInput}
                      onChange={(e) => setCustomMinutesInput(e.target.value)}
                      placeholder="自訂"
                      className="w-14 px-2 py-1 rounded-lg text-[11px] border bg-[var(--surface)] text-center outline-none focus:border-[var(--brand)] font-mono"
                      style={{
                        color: "var(--text-primary)",
                        borderColor: "var(--border)",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customMinutesInput) {
                          const n = parseInt(customMinutesInput, 10);
                          if (n > 0) {
                            onLogTime?.(n);
                            setCustomMinutesInput("");
                            setShowTimeLogger(false);
                          }
                        }
                      }}
                    />
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>分</span>
                    <button
                      type="button"
                      disabled={!customMinutesInput || parseInt(customMinutesInput, 10) <= 0}
                      onClick={() => {
                        const n = parseInt(customMinutesInput, 10);
                        if (n > 0) {
                          onLogTime?.(n);
                          setCustomMinutesInput("");
                          setShowTimeLogger(false);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium disabled:opacity-40 transition-colors"
                      style={{
                        background: "var(--brand)",
                        color: "#fff",
                      }}
                    >
                      登錄
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                    <div className="w-3 h-3 rounded-sm" style={{ background: habit.color }} />
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>已達成</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ background: habit.color + "88" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>🍅 ×1</span>
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
  const { habits, addHabit, updateHabit, checkinHabit, uncheckHabit, archiveHabit, unarchiveHabit, incrementHabitPomodoro, decrementHabitPomodoro, logHabitTime } = useApp();
  const confirm = useConfirm();
  const [today, setToday] = useState<string>(getLocalToday);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalToday);

  // ── 跨日自動換日監聽（分頁醒來、定時檢查、窗口焦點）──────────────
  useEffect(() => {
    const checkDateRollover = () => {
      const nowToday = getLocalToday();
      setToday((prevToday) => {
        if (nowToday !== prevToday) {
          // 若原本選取的是舊的「今天」，自動換日推進到新的「今天」
          setSelectedDate((prevSelected) =>
            prevSelected === prevToday ? nowToday : prevSelected
          );
          return nowToday;
        }
        return prevToday;
      });
    };

    // 每 30 秒定期檢查、視窗 focus 時檢查、分頁 visibilitychange 時檢查
    const timer = setInterval(checkDateRollover, 30_000);
    window.addEventListener("focus", checkDateRollover);
    document.addEventListener("visibilitychange", checkDateRollover);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", checkDateRollover);
      document.removeEventListener("visibilitychange", checkDateRollover);
    };
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [activeHabitTimer, setActiveHabitTimer] = useState<{
    habitId: string;
    secondsLeft: number;
    totalSeconds: number;
  } | null>(null);
  const [form, setForm] = useState<HabitFormData>({
    title: "",
    frequency: "daily",
    color: HABIT_COLORS[0],
    daysOfWeek: [],
    targetCount: 1,
    description: "",
  });

  // ── Pomodoro ↔ Habit 同步 ────────────────────────────────────
  const flowTimer = useFlowTimerContext();

  useEffect(() => {
    const { boundHabitId, phase, totalMs } = flowTimer.snapshot;
    const { secondsLeft } = flowTimer;
    if (phase === "running" && boundHabitId) {
      setActiveHabitTimer({
        habitId: boundHabitId,
        secondsLeft,
        totalSeconds: Math.floor(totalMs / 1000),
      });
    } else if (phase !== "running") {
      setActiveHabitTimer(null);
    }
  }, [flowTimer, flowTimer.snapshot, flowTimer.secondsLeft]);

  const handleStartPomodoro = useCallback(
    (habitId: string, minutes: number) => {
      flowTimer.start({ type: "focus", habitId, customMinutes: minutes });
      // 更新習慣記住的時長
      updateHabit(habitId, { pomodoroMinutes: minutes });
    },
    [flowTimer, updateHabit]
  );

  const handlePausePomodoro = useCallback(() => {
    flowTimer.pause();
  }, [flowTimer]);

  const handleStopPomodoro = useCallback(() => {
    flowTimer.reset({ type: "focus" });
    setActiveHabitTimer(null);
  }, [flowTimer]);

  const handleIncrementPomodoro = useCallback(
    (habitId: string) => {
      incrementHabitPomodoro(habitId, selectedDate);
    },
    [incrementHabitPomodoro, selectedDate]
  );

  const handleDecrementPomodoro = useCallback(
    (habitId: string) => {
      decrementHabitPomodoro(habitId, selectedDate);
    },
    [decrementHabitPomodoro, selectedDate]
  );

  const handleLogTime = useCallback(
    (habitId: string, minutes: number) => {
      logHabitTime(habitId, selectedDate, minutes);
    },
    [logHabitTime, selectedDate]
  );

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    if (editingHabitId) {
      updateHabit(editingHabitId, {
        title: form.title.trim(),
        description: form.description || undefined,
        frequency: form.frequency,
        color: form.color,
        daysOfWeek: form.frequency === "weekly" ? form.daysOfWeek : undefined,
        targetCount: form.targetCount,
      });
      setEditingHabitId(null);
    } else {
      addHabit({
        title: form.title.trim(),
        description: form.description || undefined,
        frequency: form.frequency,
        color: form.color,
        daysOfWeek: form.frequency === "weekly" ? form.daysOfWeek : undefined,
        targetCount: form.targetCount,
      });
    }
    setForm({ title: "", frequency: "daily", color: HABIT_COLORS[0], daysOfWeek: [], targetCount: 1, description: "" });
    setShowForm(false);
  };

  const openEditForm = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setForm({
      title: habit.title,
      frequency: habit.frequency,
      color: habit.color,
      daysOfWeek: habit.daysOfWeek || [],
      targetCount: habit.targetCount,
      description: habit.description || "",
    });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingHabitId(null);
    setForm({ title: "", frequency: "daily", color: HABIT_COLORS[0], daysOfWeek: [], targetCount: 1, description: "" });
    setShowForm(false);
  };

  const activeHabits = habits.filter((h) => !h.archivedAt);
  const archivedHabits = habits.filter((h) => !!h.archivedAt);
  const selectedDateDone = activeHabits.filter((h) => h.checkins.some((c) => c.date === selectedDate && c.completed)).length;
  const displayHabits = showArchived ? archivedHabits : activeHabits;

  // ── 投資量格式化 ────────────────────────────────────────
  /**
   * 把分鐘數轉換成「X 小時 Y 分鐘」或「Y 分鐘」
   * 目標：視覺重量鎖定在 2 個 token 以內
   */
  const formatMinutes = (mins: number): { primary: string; secondary: string } => {
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return {
        primary: `${h} 小時${m > 0 ? ` ${m} 分鐘` : ""}`,
        secondary: `${mins} 分鐘`,
      };
    }
    return { primary: `${mins} 分鐘`, secondary: `${mins} 分鐘` };
  };

  // 計算「今日總番茄時長（分鐘）」= 優先使用實際登記的 minutes，無則退回 pomodoros × pomodoroMinutes
  const totalTodayMinutes = useMemo(() => {
    return activeHabits.reduce((sum, h) => {
      const entry = h.checkins.find((c) => c.date === selectedDate);
      return sum + (entry?.minutes ?? ((entry?.pomodoros ?? 0) * (h.pomodoroMinutes ?? 25)));
    }, 0);
  }, [activeHabits, selectedDate]);

  const totalTodayPomodoros = useMemo(() => {
    return activeHabits.reduce((sum, h) => {
      const entry = h.checkins.find((c) => c.date === selectedDate);
      return sum + (entry?.pomodoros ?? 0);
    }, 0);
  }, [activeHabits, selectedDate]);

  // 格式化結果
  const timeDisplay = formatMinutes(totalTodayMinutes);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5 overflow-y-auto overscroll-contain pb-[calc(60px+env(safe-area-inset-bottom,0px)+12px)]"
      style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>習慣打卡</h1>
          {/* ── 投資量宣告 ─────────────────────────────────────── */}
          {totalTodayMinutes > 0 ? (
            /* 有投資時：大字說時間，次要行說番茄 + 完成數（完成數不因有投資而消失）*/
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="text-[20px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                  {timeDisplay.primary}
                </p>
                {selectedDate !== today && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(today)}
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors hover:opacity-80"
                    style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                    title="切換回今日"
                  >
                    回到今天 →
                  </button>
                )}
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>
                🍅 {totalTodayPomodoros} 個番茄 · {selectedDate === today ? "今日已推進" : `${selectedDate.replace(/^\d{4}-/, "").replace("-", "/")} 紀錄`} · 完成 {selectedDateDone}/{activeHabits.length} 個習慣
              </p>
            </div>
          ) : (
            /* 無投資時：柔性備忘，不說 0 */
            <div className="space-y-0.5 mt-1">
              <div className="flex items-center gap-2">
                <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  {selectedDate === today ? "今日" : selectedDate.replace(/^\d{4}-/, "").replace("-", "/")} 完成 {selectedDateDone}/{activeHabits.length} 個習慣
                </p>
                {selectedDate !== today && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(today)}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors hover:opacity-80"
                    style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                    title="切換回今日"
                  >
                    回到今天 →
                  </button>
                )}
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
                隨時可以按 🍅 5 分鐘起步
              </p>
            </div>
          )}
          {archivedHabits.length > 0 && !showArchived && (
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
              已封存 {archivedHabits.length} 個
            </p>
          )}
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

            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="符合行為，例如：慢跑、游泳、健身（選填）"
              rows={2}
              className="input resize-none text-[13px]"
            />

            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={cancelEdit}>取消</Button>
              <Button type="button" onClick={handleSubmit} disabled={!form.title.trim()}>
                {editingHabitId ? "儲存變更" : "建立習慣"}
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
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
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
                  date={selectedDate}
                  onCheckin={() => {
                    const isDone = habit.checkins.some((c) => c.date === selectedDate && c.completed);
                    if (isDone) uncheckHabit(habit.id, selectedDate);
                    else checkinHabit(habit.id, selectedDate);
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
                  onUpdate={(updates) => updateHabit(habit.id, updates)}
                  onRestore={showArchived ? () => unarchiveHabit(habit.id) : undefined}
                  onEdit={() => openEditForm(habit)}
                  activePomodoro={
                    activeHabitTimer?.habitId === habit.id
                      ? { secondsLeft: activeHabitTimer.secondsLeft, totalSeconds: activeHabitTimer.totalSeconds }
                      : null
                  }
                  onStartPomodoro={(mins) => handleStartPomodoro(habit.id, mins)}
                  onPausePomodoro={handlePausePomodoro}
                  onStopPomodoro={handleStopPomodoro}
                  onIncrementPomodoro={() => handleIncrementPomodoro(habit.id)}
                  onDecrementPomodoro={() => handleDecrementPomodoro(habit.id)}
                  onLogTime={(mins) => handleLogTime(habit.id, mins)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
