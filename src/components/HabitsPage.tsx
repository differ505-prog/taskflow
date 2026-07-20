"use client";

import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { Habit } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X, CheckCircle2, Circle, Trash2, Edit3, Flame, Target, TrendingUp } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";

const HABIT_COLORS = ["#4F6AF5", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6", "#06B6D4", "#636366"];

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

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
    days.push(d.toISOString().split("T")[0]);
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
  const today = new Date().toISOString().split("T")[0];
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
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--status-danger)" }}>
                  <Flame className="w-3.5 h-3.5" />
                  {habit.streak} 天
                </span>
                <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  <Target className="w-3.5 h-3.5" />
                  最佳 {habit.longestStreak} 天
                </span>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
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
  const { habits, addHabit, checkinHabit, archiveHabit, unarchiveHabit } = useApp();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
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

  const today = new Date().toISOString().split("T")[0];
  const activeHabits = habits.filter((h) => !h.archivedAt);
  const archivedHabits = habits.filter((h) => !!h.archivedAt);
  const todayDone = activeHabits.filter((h) => h.checkins.some((c) => c.date === today && c.completed)).length;
  const displayHabits = showArchived ? archivedHabits : activeHabits;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>習慣打卡</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
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
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              style={{ color: "var(--text-secondary)" }}
            >
              {showArchived ? "← 返回" : `查看封存 (${archivedHabits.length})`}
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            新增習慣
          </button>
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
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: "var(--text-tertiary)" }}>
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
            <div className="flex gap-2 flex-wrap">
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
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1">取消</button>
              <button onClick={handleSubmit} className="btn-primary flex-1" disabled={!form.title.trim()}>
                建立習慣
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Habits list */}
      {displayHabits.length === 0 && !showForm ? (
        <div className="card py-16 text-center">
          <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>
            {showArchived ? "沒有封存的習慣" : "還沒有習慣，點擊上方新增開始追蹤"}
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
                  onCheckin={() => checkinHabit(habit.id, today)}
                  onDelete={async () => {
                  const ok = await confirm({
                    title: `封存習慣「${habit.title}」`,
                    message: "此習慣將從主列表移除,但 streak、checkins 紀錄仍會保留,可在「查看封存」中還原。",
                    impactDetail: `${habit.checkins.filter((c) => c.completed).length} 次打卡紀錄將保留`,
                    confirmText: "封存",
                    cancelText: "取消",
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
