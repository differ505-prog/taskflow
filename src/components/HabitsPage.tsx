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
  Play,
  Clock,
  NotebookPen,
  Compass,
  Moon,
} from "lucide-react";
import { PomodoroSplitPill } from "./PomodoroSplitPill";
import { useConfirm } from "@/hooks/useConfirm";
import { useRhythmSettings } from "@/hooks/useRhythmSettings";
import { getLocalToday, toLocalDateString } from "@/lib/dateUtils";
import {
  buildEarlyResumePeriods,
  computeHabitBalance,
  formatBalanceChip,
  getActivePauseUntil,
  getCheckinMinutes,
  getHeatmapFill,
  getLastRecordedInfo,
} from "@/lib/habitBalance";
import { isItemPausedByPlan } from "@/lib/sourcePlan";
import { useFlowTimerContext } from "@/lib/ZenFlowContext";
import { playTaskDoneSound } from "@/lib/confetti";
import { toast } from "sonner";
import { CompoundExperimentPickerModal } from "@/components/CompoundExperimentPickerModal";
import {
  COMPOUND_PLAN,
  type CompoundHabitTemplate,
} from "@/lib/compoundHabitPlan";

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
  /** 每日投入目標（分鐘），0 = 不啟用累積目標池 */
  dailyTargetMinutes: number;
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
  today,
  onCheckin,
  onDelete,
  onUpdate,
  onRestore,
  onEdit,
  pomodoroState,
  pomodoroSecondsLeft,
  onStartPomodoro,
  onSelectPomodoroDuration,
  onPausePomodoro,
  onResumePomodoro,
  onStopPomodoro,
  onIncrementPomodoro,
  onDecrementPomodoro,
  onLogTime,
  onSaveNote,
  onPause,
  pauseMenuOpen,
}: {
  habit: Habit;
  date: string;
  /** 真實今天（用於累積目標池結餘計算，跨日時會更新） */
  today: string;
  onCheckin: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Habit>) => void;
  onRestore?: () => void;
  onEdit: () => void;
  /** 番茄膠囊狀態：idle | running | paused | busy-other */
  pomodoroState?: "idle" | "running" | "paused" | "busy-other";
  /** 番茄倒數剩餘秒數 */
  pomodoroSecondsLeft?: number;
  onStartPomodoro: (minutes: number) => void;
  /** 僅調整記憶時長（不立即開跑） */
  onSelectPomodoroDuration?: (minutes: number) => void;
  onPausePomodoro: () => void;
  onResumePomodoro: () => void;
  onStopPomodoro: () => void;
  onIncrementPomodoro: () => void;
  onDecrementPomodoro: () => void;
  onLogTime?: (minutes: number) => void;
  /** 儲存當日復盤筆記（所有習慣可用） */
  onSaveNote?: (note: string) => void;
  /** 開啟「休眠至…」選單 */
  onPause?: () => void;
  /** 休眠選單是否展開 */
  pauseMenuOpen?: boolean;
}) {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showTimeLogger, setShowTimeLogger] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState("");
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const isArchived = !!habit.archivedAt;
  const currentCheckin = habit.checkins.find((c) => c.date === date);
  const isChecked = !!currentCheckin?.completed;
  const savedNote = currentCheckin?.note?.trim() ?? "";
  const last30Days = getLast30Days();
  const completedDays = new Set(habit.checkins.filter((c) => c.completed).map((c) => c.date));
  const [desc, setDesc] = useState(habit.description || "");

  // 計算本日番茄數
  const todayPoms = habit.checkins.find((c) => c.date === date)?.pomodoros ?? 0;

  // 番茄單位時長：手動「+」每按一顆代表的分鐘數
  // = 該習慣「上次使用」的時長（pomodoroMinutes），未設定時預設 25（標準番茄）
  const unitMinutes = habit.pomodoroMinutes ?? 25;

  // 番茄進行中（含暫停）時鎖定手動增減，避免計時與手動記錄互相覆寫
  const isPomodoroBusy = pomodoroState === "running" || pomodoroState === "paused";
  const isManualCounterLocked = isPomodoroBusy || isArchived;

  // ── 雙維度時長：今日專注 + 歷史累計 ──────────────────────────────
  // 今日專注分鐘：優先使用真實 minutes，若無則依番茄數乘算
  const todayMinutes = currentCheckin ? getCheckinMinutes(currentCheckin, unitMinutes) : 0;
  // 歷史累計總時長：各日真實 minutes 加總（無 minutes 則以番茄數推算）
  const totalHistoryMinutes = useMemo(() => {
    return habit.checkins.reduce(
      (sum, c) => sum + getCheckinMinutes(c, habit.pomodoroMinutes ?? 25),
      0,
    );
  }, [habit.checkins, habit.pomodoroMinutes]);

  // ── 累積目標池：結餘 = 累計投入 − 累計目標 ────────────────────────
  // 恆以「今天」為終點（切換日曆日期不會讓結餘亂跳；跨日自動重算）
  const balanceInfo = useMemo(
    () => computeHabitBalance(habit, today),
    [habit, today]
  );
  const balance = balanceInfo?.balance ?? 0;

  // ── 上次記錄時間資訊 ──────────────────────────────────────────────
  const lastRecordedInfo = useMemo(
    () => getLastRecordedInfo(habit, date),
    [habit, date]
  );

  // 雙維度時長格式化：< 60 分顯示「X 分」；≥ 60 分顯示「H 小時 M 分 (共 X 分)」，避免小數點小時的心算負擔
  const formatDuration = (minutes: number) => {
    if (minutes <= 0) return "0 分";
    if (minutes < 60) return `${minutes} 分`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} 小時${m > 0 ? ` ${m} 分` : ""} (共 ${minutes} 分)`;
  };

  // 選取的不是今天時，用日期前綴避免誤導
  const isToday = date === getLocalToday();
  const durationLabel = isToday ? "今日" : `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

  useEffect(() => {
    setDesc(habit.description || "");
  }, [habit.description]);

  // 復盤筆記草稿：外部資料變動時（例如換日、切換習慣）同步回來
  useEffect(() => {
    setNoteDraft(savedNote);
  }, [savedNote]);

  const heatmapColors = (date: string) => {
    // 有每日目標 → 用「當日投入 ÷ 目標」比例色階（能看出哪些天靠後面的天補回來）
    const fill = getHeatmapFill(habit, date);
    if (fill !== null) return fill;
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
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator?.vibrate) {
              try { navigator.vibrate(15); } catch {}
            }
            onCheckin();
          }}
          disabled={isArchived}
          className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110 active:scale-90 disabled:hover:scale-100 disabled:cursor-not-allowed group"
          aria-label={
            isArchived
              ? "已封存"
              : isChecked
              ? `取消打卡（${todayMinutes > 0 ? `本日投入 ${todayMinutes} 分鐘` : "已完成"}）`
              : `完成打卡（${todayMinutes > 0 ? `已投入 ${todayMinutes} 分鐘` : "點擊完成"}）`
          }
          title={
            isChecked
              ? `已完成打卡${todayMinutes > 0 ? ` · 本日已投入 ${todayMinutes} 分鐘` : ""} · 點擊取消`
              : `點擊打卡${todayMinutes > 0 ? `（目前已累積 ${todayMinutes} 分鐘）` : ""}`
          }
        >
          {isChecked ? (
            <motion.div
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 600, damping: 25 }}
            >
              <CheckCircle2 className="w-6 h-6" style={{ color: habit.color }} />
            </motion.div>
          ) : (
            <Circle className="w-6 h-6 group-hover:opacity-80 transition-opacity" style={{ color: "var(--text-tertiary)" }} />
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
                  {onPause && (
                    <button
                      onClick={onPause}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors"
                      style={
                        pauseMenuOpen
                          ? { background: "var(--brand-tint)", color: "var(--brand)" }
                          : { color: "var(--text-tertiary)" }
                      }
                      onMouseEnter={(e) => {
                        if (!pauseMenuOpen) {
                          e.currentTarget.style.background = "var(--surface-hover)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!pauseMenuOpen) {
                          e.currentTarget.style.background = "";
                        }
                      }}
                      aria-label="休眠至…"
                      title="休眠至…"
                      aria-expanded={!!pauseMenuOpen}
                      aria-haspopup="dialog"
                    >
                      <Moon className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={onDelete}
                    className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
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
            {/* 分裂式番茄膠囊：左半部開始、右半部選時長（統一與任務列表共用元件） */}
            <PomodoroSplitPill
              minutes={unitMinutes}
              state={pomodoroState ?? "idle"}
              secondsLeft={pomodoroSecondsLeft}
              revealOnGroupHover={false}
              disabled={isArchived}
              onStart={(mins) => onStartPomodoro(mins)}
              onSelectDuration={(mins) => onSelectPomodoroDuration?.(mins)}
              onPause={onPausePomodoro}
              onResume={onResumePomodoro}
              onStop={onStopPomodoro}
              itemLabel={habit.title}
            />

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
                  disabled={isManualCounterLocked}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-[13px] font-medium transition-all duration-150 disabled:cursor-not-allowed hover:bg-[var(--hover-bg)]"
                  style={{
                    color: "var(--text-tertiary)",
                    opacity: isManualCounterLocked ? 0.4 : 1,
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
                disabled={isManualCounterLocked}
                className="w-6 h-6 flex items-center justify-center rounded-md text-[14px] font-medium transition-all duration-150 disabled:cursor-not-allowed"
                style={{
                  color: "var(--brand)",
                  background: "var(--brand-tint)",
                  opacity: isManualCounterLocked ? 0.4 : 1,
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

            {/* ── 上次記錄時間膠囊 ───────────────────────────────────── */}
            {lastRecordedInfo && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <span
                  className="inline-flex items-center gap-1 font-medium transition-colors"
                  style={{
                    color: lastRecordedInfo.isTargetDate ? "var(--brand)" : "var(--text-tertiary)",
                    opacity: lastRecordedInfo.isTargetDate ? 0.9 : 0.7,
                  }}
                  title={lastRecordedInfo.tooltip}
                >
                  <Clock className="w-2.5 h-2.5 opacity-70" />
                  上次 {lastRecordedInfo.badgeText}
                </span>
              </>
            )}

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

            {/* ── 復盤筆記入口（所有習慣可用）────────────────── */}
            {!isArchived && onSaveNote && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <button
                  type="button"
                  onClick={() => setShowNoteEditor((v) => !v)}
                  className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[32px] px-1.5 py-0.5 rounded text-[10px] font-medium transition-all hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]"
                  style={{
                    color: showNoteEditor || savedNote ? "var(--brand)" : "var(--text-tertiary)",
                    background: showNoteEditor ? "var(--brand-tint)" : "transparent",
                  }}
                  aria-label={savedNote ? "查看復盤筆記" : "寫下復盤筆記"}
                  title="今天做了什麼決定 → 結果 → 下次怎麼改"
                >
                  <NotebookPen className="w-3 h-3" aria-hidden="true" />
                  復盤筆記
                  {savedNote && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--brand)" }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </>
            )}

            {/* ── 累積目標池結餘膠囊 ─────────────────────────────────── */}
            {balanceInfo && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                {balance >= 0 ? (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums whitespace-nowrap"
                    style={{
                      color: habit.color,
                      background: "var(--brand-tint)",
                    }}
                    aria-label={`累積目標結餘 ${balance} 分鐘`}
                    title={`累計投入 ${balanceInfo.invested} 分 − 目標 ${balanceInfo.target} 分（起算 ${balanceInfo.days} 天）`}
                  >
                    {formatBalanceChip(balance)}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTimeLogger(true)}
                    disabled={isArchived}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums whitespace-nowrap transition-all hover:bg-[var(--brand-tint)] hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    style={{
                      color: "var(--text-tertiary)",
                      background: "transparent",
                      border: "1px dashed var(--border)",
                    }}
                    aria-label={`還差 ${Math.abs(balance)} 分鐘達標，點擊補登時長`}
                    title={`累計投入 ${balanceInfo.invested} 分 − 目標 ${balanceInfo.target} 分（起算 ${balanceInfo.days} 天）· 點擊補登`}
                  >
                    {formatBalanceChip(balance)}
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── 已存復盤筆記單行預覽（面板收合時）────────────── */}
          {savedNote && !showNoteEditor && (
            <p
              className="mt-1.5 flex items-center gap-1 text-[11px] min-w-0"
              style={{ color: "var(--text-tertiary)" }}
            >
              <NotebookPen className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              <span className="truncate" title={savedNote}>
                {savedNote}
              </span>
            </p>
          )}

          {/* ── 復盤筆記編輯面板 ─────────────────────────────── */}
          <AnimatePresence>
            {showNoteEditor && !isArchived && onSaveNote && (
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
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    <NotebookPen className="w-3.5 h-3.5" style={{ color: "var(--brand)" }} aria-hidden="true" />
                    復盤筆記
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNoteEditor(false)}
                    className="inline-flex items-center justify-center min-h-[44px] sm:min-h-[32px] px-2 text-[11px] opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    關閉
                  </button>
                </div>

                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="今天做了什麼決定 → 結果 → 下次怎麼改"
                  rows={3}
                  className="w-full resize-none rounded-lg border bg-[var(--surface)] px-2.5 py-2 text-[12px] outline-none focus:border-[var(--brand)]"
                  style={{
                    color: "var(--text-primary)",
                    borderColor: "var(--border)",
                  }}
                  aria-label="復盤筆記內容"
                />

                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNoteDraft(savedNote);
                      setShowNoteEditor(false);
                    }}
                    className="inline-flex items-center justify-center min-h-[44px] sm:min-h-[32px] px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-[var(--hover-bg)]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    收合
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSaveNote(noteDraft.trim());
                      setShowNoteEditor(false);
                    }}
                    disabled={!noteDraft.trim()}
                    className="inline-flex items-center justify-center min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-40"
                    style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
                  >
                    存下復盤
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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

                {/* ── 上次記錄對照條（防止忘記記錄導致累計失準） ── */}
                <div
                  className="flex items-center justify-between px-2.5 py-1.5 mb-2.5 rounded-lg text-[11px] border flex-wrap gap-1.5"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Clock className="w-3.5 h-3.5" style={{ color: "var(--brand)" }} />
                    <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
                      上次記錄：
                    </span>
                    {lastRecordedInfo ? (
                      <>
                        <span className="font-mono tabular-nums font-semibold" style={{ color: "var(--brand)" }}>
                          {lastRecordedInfo.dateAndTimeString}
                        </span>
                        {lastRecordedInfo.minutesLogged && lastRecordedInfo.minutesLogged > 0 ? (
                          <span
                            className="px-1.5 py-0.2 rounded text-[10px] font-medium"
                            style={{
                              background: "var(--brand-tint)",
                              color: "var(--brand)",
                            }}
                          >
                            +{lastRecordedInfo.minutesLogged}分
                          </span>
                        ) : null}
                        <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                          ({lastRecordedInfo.relativeText})
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                        今日尚未有記錄
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] ml-auto">
                    <span style={{ color: "var(--text-tertiary)" }}>
                      今日累計: <strong className="font-semibold" style={{ color: "var(--text-primary)" }}>{todayMinutes}分</strong>
                    </span>
                    {/* ⚡ 智慧填入間隔：若距上次記錄在 5~360 分鐘內，提供一鍵填入 */}
                    {lastRecordedInfo &&
                      lastRecordedInfo.isTargetDate &&
                      lastRecordedInfo.elapsedMinutes >= 5 &&
                      lastRecordedInfo.elapsedMinutes <= 360 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomMinutesInput(String(lastRecordedInfo.elapsedMinutes));
                          }}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer"
                          style={{
                            background: "var(--brand-tint)",
                            color: "var(--brand)",
                            border: "1px dashed var(--brand)",
                          }}
                          title={`點擊自動將自訂欄填入 ${lastRecordedInfo.elapsedMinutes} 分鐘（距上次記錄時間）`}
                        >
                          ⚡ 填入距上次 {lastRecordedInfo.elapsedMinutes} 分
                        </button>
                      )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {([10, 15, 25, 30, 45, 60] as const).map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        onLogTime?.(mins);
                        setShowTimeLogger(false);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      style={{
                        background: "var(--brand-tint)",
                        color: "var(--brand)",
                      }}
                      title={`補登 ${mins} 分鐘`}
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
                      className="inline-flex items-center justify-center min-h-[44px] sm:min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-medium disabled:opacity-40 transition-colors"
                      style={{
                        background: "var(--brand)",
                        color: "var(--brand-foreground)",
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
                        title={
                          balanceInfo
                            ? `${date} · 投入 ${getCheckinMinutes(habit.checkins.find((c) => c.date === date), habit.pomodoroMinutes ?? 25)} 分 / 目標 ${balanceInfo.minutes} 分`
                            : `${date}${completedDays.has(date) ? " ✓" : ""}`
                        }
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
  const { settings: rhythmSettings } = useRhythmSettings();
  const [today, setToday] = useState<string>(getLocalToday);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalToday);

  // ── 單一習慣預約休眠 ────────────────────────────────────────
  const [pauseMenuHabitId, setPauseMenuHabitId] = useState<string | null>(null);
  const [customResumeDate, setCustomResumeDate] = useState("");
  const [showPausedSection, setShowPausedSection] = useState(false);

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
  const [showCompoundPicker, setShowCompoundPicker] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [form, setForm] = useState<HabitFormData>({
    title: "",
    frequency: "daily",
    color: HABIT_COLORS[0],
    daysOfWeek: [],
    targetCount: 1,
    description: "",
    dailyTargetMinutes: 0,
  });

  // ── Pomodoro ↔ Habit 同步 ────────────────────────────────────
  const flowTimer = useFlowTimerContext();

  /**
   * 番茄膠囊狀態映射
   * - running：本習慣正在計時
   * - paused：本習慣被暫停（可續跑）
   * - busy-other：其他項目正在計時（本列不可開跑）
   */
  const getHabitPomodoroState = useCallback(
    (habitId: string): "idle" | "running" | "paused" | "busy-other" => {
      const { phase, boundHabitId, pausedTarget } = flowTimer.snapshot;
      if (phase === "running" && boundHabitId === habitId) return "running";
      if (
        phase === "paused" &&
        pausedTarget?.kind === "habit" &&
        pausedTarget.id === habitId
      ) {
        return "paused";
      }
      if (phase === "running" || phase === "paused") return "busy-other";
      return "idle";
    },
    [flowTimer.snapshot]
  );

  const handleStartPomodoro = useCallback(
    (habitId: string, minutes: number) => {
      flowTimer.start({ type: "focus", habitId, customMinutes: minutes });
      // 更新習慣記住的時長
      updateHabit(habitId, { pomodoroMinutes: minutes });
    },
    [flowTimer, updateHabit]
  );

  /** 僅調整習慣記憶的番茄單位（不立即開跑） */
  const handleSelectPomodoroDuration = useCallback(
    (habitId: string, minutes: number) => updateHabit(habitId, { pomodoroMinutes: minutes }),
    [updateHabit]
  );

  const handlePausePomodoro = useCallback(() => {
    flowTimer.pause();
  }, [flowTimer]);

  const handleResumePomodoro = useCallback(() => {
    flowTimer.resume();
  }, [flowTimer]);

  const handleStopPomodoro = useCallback(() => {
    flowTimer.reset({ type: "focus" });
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

  /**
   * 儲存當日復盤筆記
   * - 若當天已打卡 → count = 0（只補 note，不重複加次數，也不觸發 uncheck）
   * - 若當天未打卡 → count = 1（順手完成打卡）
   */
  const handleSaveNote = useCallback(
    (habitId: string, note: string) => {
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      const isDone = habit.checkins.some(
        (c) => c.date === selectedDate && c.completed
      );
      checkinHabit(habitId, selectedDate, isDone ? 0 : 1, note.trim());
      toast.success("復盤筆記已存下 ✓");
    },
    [habits, checkinHabit, selectedDate]
  );

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    // 編輯時保留原本的累計起算日（否則每次改目標都會把已累積的缺額抹掉）
    const oldHabit = editingHabitId ? habits.find((h) => h.id === editingHabitId) : undefined;
    const dailyTarget =
      form.dailyTargetMinutes > 0
        ? {
            minutes: form.dailyTargetMinutes,
            minutesSetAt: oldHabit?.dailyTarget?.minutesSetAt ?? getLocalToday(),
          }
        : undefined;
    if (editingHabitId) {
      updateHabit(editingHabitId, {
        title: form.title.trim(),
        description: form.description || undefined,
        frequency: form.frequency,
        color: form.color,
        daysOfWeek: form.frequency === "weekly" ? form.daysOfWeek : undefined,
        targetCount: form.targetCount,
        dailyTarget,
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
        dailyTarget,
      });
    }
    setForm({ title: "", frequency: "daily", color: HABIT_COLORS[0], daysOfWeek: [], targetCount: 1, description: "", dailyTargetMinutes: 0 });
    setShowForm(false);
  };

  /**
   * 開啟一個複利實驗
   * - 掛上 sourcePlan → 可於「設定 → 日常節奏」整套退場
   * - dailyTarget 以「本地今天」為累計起算日
   */
  const handleStartCompoundExperiment = useCallback(
    (template: CompoundHabitTemplate) => {
      addHabit({
        title: template.title,
        description: template.description,
        frequency: template.frequency,
        color: template.color,
        targetCount: 1,
        pomodoroMinutes: template.pomodoroMinutes,
        dailyTarget:
          template.dailyTargetMinutes > 0
            ? { minutes: template.dailyTargetMinutes, minutesSetAt: getLocalToday() }
            : undefined,
        sourcePlan: COMPOUND_PLAN,
      });
      setShowCompoundPicker(false);
      toast.success("已開啟單一實驗 ✓");
    },
    [addHabit]
  );

  const openEditForm = (habit: Habit) => {    setEditingHabitId(habit.id);
    setForm({
      title: habit.title,
      frequency: habit.frequency,
      color: habit.color,
      daysOfWeek: habit.daysOfWeek || [],
      targetCount: habit.targetCount,
      description: habit.description || "",
      dailyTargetMinutes: habit.dailyTarget?.minutes ?? 0,
    });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingHabitId(null);
    setForm({ title: "", frequency: "daily", color: HABIT_COLORS[0], daysOfWeek: [], targetCount: 1, description: "", dailyTargetMinutes: 0 });
    setShowForm(false);
  };

  // ── 習慣分組：活躍 / 休眠中 / 已封存 ─────────────────────────
  // 休眠中 = 未封存 且（所屬方案休眠中 或 單一習慣預約休眠中）
  const notArchivedHabits = habits.filter((h) => !h.archivedAt);
  const archivedHabits = habits.filter((h) => !!h.archivedAt);

  const { activeHabits, pausedHabits } = useMemo(() => {
    const active: Habit[] = [];
    const paused: Habit[] = [];
    for (const h of notArchivedHabits) {
      const planPaused = isItemPausedByPlan(h, rhythmSettings.pausedPlans, today);
      const habitPaused = !!getActivePauseUntil(h, today);
      if (planPaused || habitPaused) paused.push(h);
      else active.push(h);
    }
    return { activeHabits: active, pausedHabits: paused };
  }, [notArchivedHabits, rhythmSettings.pausedPlans, today]);

  const selectedDateDone = activeHabits.filter((h) => h.checkins.some((c) => c.date === selectedDate && c.completed)).length;
  const displayHabits = showArchived ? archivedHabits : activeHabits;

  // ── 預約休眠：快捷日期 ──────────────────────────────────────
  /** 明天（喚醒日最小值：選今天等同沒休眠，屬無效日期） */
  const tomorrowStr = useMemo(() => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return toLocalDateString(d);
  }, [today]);

  /** 取得「n 週後」的日期字串（半開區間：from=today, to=目標日，目標日自動醒來） */
  const getWeeksLater = (weeks: number): string => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + weeks * 7);
    return toLocalDateString(d);
  };

  /** 取得「月底」的日期字串（下個月最後一天後一天＝下月 1 號自動醒來） */
  const getMonthEnd = (): string => {
    const d = new Date(`${today}T00:00:00`);
    d.setMonth(d.getMonth() + 1, 1);
    return toLocalDateString(d);
  };

  const handlePauseHabit = (habit: Habit, resumeDate: string) => {
    // 喚醒日必須晚於今天：選今天等同沒休眠（半開區間 [today, today) 為空）
    if (!resumeDate || resumeDate < tomorrowStr) return;
    const nextPeriods = [
      ...(habit.pausedPeriods ?? []),
      { from: today, to: resumeDate },
    ];
    updateHabit(habit.id, { pausedPeriods: nextPeriods });
    setPauseMenuHabitId(null);
    setCustomResumeDate("");
    toast.success(`「${habit.title}」會安靜地休息到 ${resumeDate}，那天自動醒來`);
  };

  const handleEarlyResume = (habit: Habit) => {
    const nextPeriods = buildEarlyResumePeriods(habit.pausedPeriods, today);
    updateHabit(habit.id, { pausedPeriods: nextPeriods });
    toast.success(`「${habit.title}」回來了`);
  };

  // Esc 關閉展開中的休眠選單（鍵盤無障礙）
  useEffect(() => {
    if (!pauseMenuHabitId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPauseMenuHabitId(null);
        setCustomResumeDate("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pauseMenuHabitId]);

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
      return sum + getCheckinMinutes(entry, h.pomodoroMinutes ?? 25);
    }, 0);
  }, [activeHabits, selectedDate]);

  const totalTodayPomodoros = useMemo(() => {
    return activeHabits.reduce((sum, h) => {
      const entry = h.checkins.find((c) => c.date === selectedDate);
      return sum + (entry?.pomodoros ?? 0);
    }, 0);
  }, [activeHabits, selectedDate]);

  // 全體習慣在選取日期的最近一次記錄
  const latestTodayRecord = useMemo(() => {
    let latestIso: string | null = null;
    for (const h of activeHabits) {
      const info = getLastRecordedInfo(h, selectedDate);
      if (info && info.isTargetDate && info.isoString) {
        if (!latestIso || info.isoString > latestIso) {
          latestIso = info.isoString;
        }
      }
    }
    if (!latestIso) return null;
    const d = new Date(latestIso);
    if (isNaN(d.getTime())) return null;
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const diffMs = Math.max(0, Date.now() - d.getTime());
    const diffMins = Math.floor(diffMs / 60000);
    const rel = diffMins < 1 ? "剛剛" : diffMins < 60 ? `${diffMins} 分鐘前` : `${Math.floor(diffMins / 60)} 小時前`;
    return { timeStr: `${hh}:${mm}`, rel };
  }, [activeHabits, selectedDate]);

  // 格式化結果
  const timeDisplay = formatMinutes(totalTodayMinutes);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5 overflow-y-auto overscroll-contain pb-[calc(60px+env(safe-area-inset-bottom,0px)+12px)]"
      style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>習慣打卡</h1>
          {/* ── 投資量宣告 ─────────────────────────────────────── */}
          {totalTodayMinutes > 0 ? (
            /* 有投資時：大字說時間，清晰標記總分鐘數（無須心算），次要行說番茄 + 完成數 */
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="text-[20px] font-semibold leading-tight tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {timeDisplay.primary}
                </p>
                {totalTodayMinutes >= 60 && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums"
                    style={{
                      background: "var(--brand-tint)",
                      color: "var(--brand)",
                      border: "1px solid color-mix(in srgb, var(--brand) 20%, transparent)",
                    }}
                    title={`今日累計投入 ${totalTodayMinutes} 分鐘`}
                  >
                    共 {totalTodayMinutes} 分鐘
                  </span>
                )}
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
              <p className="text-[12px] flex items-center gap-1.5 flex-wrap" style={{ color: "var(--text-tertiary)", opacity: 0.7 }}>
                <span>🍅 {totalTodayPomodoros} 個番茄 · 共 {totalTodayMinutes} 分鐘</span>
                {latestTodayRecord && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Clock className="w-3 h-3 opacity-70" />
                      上次記錄 {latestTodayRecord.timeStr} ({latestTodayRecord.rel})
                    </span>
                  </>
                )}
                <span>·</span>
                <span>{selectedDate === today ? "今日已推進" : `${selectedDate.replace(/^\d{4}-/, "").replace("-", "/")} 紀錄`}</span>
                <span>·</span>
                <span>完成 {selectedDateDone}/{activeHabits.length} 個習慣</span>
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
        {/* 工具列：手機 375px 以 flex-wrap 換行 + 圖示化標籤避免橫向溢位 */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {archivedHabits.length > 0 && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-[var(--hover-bg)] whitespace-nowrap"
              style={{ color: "var(--text-secondary)" }}
            >
              {showArchived ? "← 返回" : `查看封存 (${archivedHabits.length})`}
            </button>
          )}
          <Button
            onClick={() => setShowCalendar((v) => !v)}
            aria-label="月曆視圖"
            className="flex items-center gap-1.5 whitespace-nowrap"
            icon={<CalendarDays className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">{showCalendar ? "列表" : "月曆"}</span>
          </Button>
          <Button
            onClick={() => setShowCompoundPicker(true)}
            aria-label="挑選複利實驗"
            className="flex items-center gap-1.5 whitespace-nowrap"
            variant="ghost"
            icon={<Compass className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">複利實驗</span>
          </Button>
          <Button onClick={() => setShowForm(true)} aria-label="新增習慣" className="flex items-center gap-1.5 whitespace-nowrap" icon={<Plus className="w-4 h-4" />}>新增習慣</Button>
        </div>
      </div>

      {/* 複利實驗挑選器 */}
      <CompoundExperimentPickerModal
        open={showCompoundPicker}
        habits={habits}
        onStart={handleStartCompoundExperiment}
        onClose={() => setShowCompoundPicker(false)}
      />

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

            {/* ── 每日目標投入（累積目標池）────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  每日目標投入
                </span>
                {form.dailyTargetMinutes >= 60 && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
                    ⚡ {Math.floor(form.dailyTargetMinutes / 60)} 小時{form.dailyTargetMinutes % 60 > 0 ? ` ${form.dailyTargetMinutes % 60} 分鐘` : ""} / 天
                  </span>
                )}
              </div>

              {/* 快速晶片：涵蓋深層專注時數（含 150 分鐘一鍵選取） */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, dailyTargetMinutes: 0 })}
                  className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all"
                  style={
                    form.dailyTargetMinutes === 0
                      ? { background: "var(--brand-tint)", color: "var(--brand)" }
                      : { background: "var(--surface-hover)", color: "var(--text-secondary)" }
                  }
                >
                  不設定
                </button>
                {([30, 60, 90, 120, 150] as const).map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setForm({ ...form, dailyTargetMinutes: mins })}
                    className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all"
                    style={
                      form.dailyTargetMinutes === mins
                        ? { background: "var(--brand-tint)", color: "var(--brand)" }
                        : { background: "var(--surface-hover)", color: "var(--text-secondary)" }
                    }
                  >
                    {mins >= 60 ? `${mins / 60}h (${mins}分)` : `${mins} 分`}
                  </button>
                ))}
              </div>

              {/* 自訂數字輸入 + 微調步進器 */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, dailyTargetMinutes: Math.max(0, form.dailyTargetMinutes - 15) })}
                  className="px-2 py-1 rounded-lg text-[11px] border bg-[var(--surface-hover)] hover:bg-[var(--hover-bg)]"
                  style={{ color: "var(--text-secondary)", borderColor: "var(--border)" }}
                  title="減少 15 分鐘"
                >
                  -15分
                </button>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={form.dailyTargetMinutes > 0 ? form.dailyTargetMinutes : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setForm({ ...form, dailyTargetMinutes: 0 });
                        return;
                      }
                      const n = parseInt(val, 10);
                      if (Number.isFinite(n)) {
                        setForm({ ...form, dailyTargetMinutes: Math.min(720, Math.max(0, n)) });
                      }
                    }}
                    placeholder="自訂"
                    className="w-24 px-2 py-1 pr-6 rounded-lg text-[12px] border bg-[var(--surface)] text-center outline-none focus:border-[var(--brand)] font-mono"
                    style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                  />
                  <span className="absolute right-2 text-[10px]" style={{ color: "var(--text-tertiary)" }}>分</span>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, dailyTargetMinutes: Math.min(720, (form.dailyTargetMinutes || 0) + 15) })}
                  className="px-2 py-1 rounded-lg text-[11px] border bg-[var(--surface-hover)] hover:bg-[var(--hover-bg)]"
                  style={{ color: "var(--text-secondary)", borderColor: "var(--border)" }}
                  title="增加 15 分鐘"
                >
                  +15分
                </button>
                <span className="text-[10px] ml-1" style={{ color: "var(--text-tertiary)" }}>
                  上限 720 分 (12h)
                </span>
              </div>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                設定後，未補滿的天數可由之後多投入的分鐘數補回
              </p>
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
                  today={today}
                  onCheckin={() => {
                    const isDone = habit.checkins.some((c) => c.date === selectedDate && c.completed);
                    if (isDone) {
                      uncheckHabit(habit.id, selectedDate);
                    } else {
                      try {
                        playTaskDoneSound();
                      } catch {}
                      checkinHabit(habit.id, selectedDate);
                    }
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
                  pomodoroState={getHabitPomodoroState(habit.id)}
                  pomodoroSecondsLeft={flowTimer.secondsLeft}
                  onStartPomodoro={(mins) => handleStartPomodoro(habit.id, mins)}
                  onSelectPomodoroDuration={(mins) => handleSelectPomodoroDuration(habit.id, mins)}
                  onPausePomodoro={handlePausePomodoro}
                  onResumePomodoro={handleResumePomodoro}
                  onStopPomodoro={handleStopPomodoro}
                  onIncrementPomodoro={() => handleIncrementPomodoro(habit.id)}
                  onDecrementPomodoro={() => handleDecrementPomodoro(habit.id)}
                  onLogTime={(mins) => handleLogTime(habit.id, mins)}
                  onSaveNote={(note) => handleSaveNote(habit.id, note)}
                  onPause={() => {
                    setPauseMenuHabitId((prev) => (prev === habit.id ? null : habit.id));
                    setCustomResumeDate("");
                  }}
                  pauseMenuOpen={pauseMenuHabitId === habit.id}
                />
                {pauseMenuHabitId === habit.id && (
                  <div
                    className="mt-2 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5"
                    style={{ background: "var(--surface-muted)" }}
                  >
                    <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      休眠至
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePauseHabit(habit, getWeeksLater(1))}
                      className="min-h-[44px] rounded-xl px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                      style={{ background: "var(--surface-hover)", color: "var(--text-primary)" }}
                    >
                      1 週後
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePauseHabit(habit, getMonthEnd())}
                      className="min-h-[44px] rounded-xl px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                      style={{ background: "var(--surface-hover)", color: "var(--text-primary)" }}
                    >
                      月底
                    </button>
                    <input
                      type="date"
                      value={customResumeDate}
                      min={tomorrowStr}
                      onChange={(e) => setCustomResumeDate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setPauseMenuHabitId(null);
                          setCustomResumeDate("");
                        }
                      }}
                      className="input w-auto min-h-[44px] cursor-pointer"
                      aria-label="自訂喚醒日"
                    />
                    <button
                      type="button"
                      onClick={() => handlePauseHabit(habit, customResumeDate)}
                      disabled={!customResumeDate || customResumeDate < tomorrowStr}
                      className="min-h-[44px] rounded-xl px-3 py-1.5 text-[12px] font-medium transition-opacity disabled:opacity-40 hover:opacity-80"
                      style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                    >
                      確認休眠
                    </button>
                    <button
                      type="button"
                      onClick={() => setPauseMenuHabitId(null)}
                      className="min-h-[44px] rounded-xl px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      取消
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 休眠中（溫柔折疊區） */}
      {pausedHabits.length > 0 && !showArchived && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowPausedSection((v) => !v)}
            className="min-h-[44px] w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-opacity hover:opacity-80"
            style={{ background: "var(--surface-muted)" }}
            aria-expanded={showPausedSection}
          >
            <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
              休眠中（{pausedHabits.length}）
            </span>
            <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {showPausedSection ? "收起" : "展開"}
            </span>
          </button>

          {showPausedSection && (
            <div className="mt-2 space-y-2">
              {pausedHabits.map((habit) => {
                const pauseUntil = getActivePauseUntil(habit, today);
                const planPaused = isItemPausedByPlan(
                  habit,
                  rhythmSettings.pausedPlans,
                  today
                );
                return (
                  <div
                    key={habit.id}
                    className="rounded-xl px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
                    style={{ background: "var(--surface-muted)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {habit.title}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        {planPaused
                          ? "所屬方案休眠中"
                          : pauseUntil
                          ? `休眠至 ${pauseUntil} · 自動喚醒`
                          : "休眠中"}
                      </p>
                    </div>
                    {!planPaused && (
                      <button
                        type="button"
                        onClick={() => handleEarlyResume(habit)}
                        className="min-h-[44px] rounded-xl px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                        style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                      >
                        提前喚醒
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
