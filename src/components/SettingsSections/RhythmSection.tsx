"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/AppContext";
import { useConfirm } from "@/hooks/useConfirm";
import { useRhythmSettings } from "@/hooks/useRhythmSettings";
import {
  archivePlanTasks,
  collectInstalledPlans,
  removePlanThemeDays,
  type PlanSummary,
} from "@/lib/sourcePlan";
import type { RhythmAnchorId } from "@/lib/types";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

const ANCHOR_ROWS: Array<{
  id: RhythmAnchorId;
  label: string;
  timeKey: "wakeTime" | "offDutyTime" | "screensOffTime";
}> = [
  { id: "wake", label: "起床開機", timeKey: "wakeTime" },
  { id: "offduty", label: "下班閥門", timeKey: "offDutyTime" },
  { id: "screensoff", label: "熄屏休息", timeKey: "screensOffTime" },
];

export function RhythmSection() {
  const { tasks, habits, saveTasksDirectly, archiveHabitsByPlan } = useApp();
  const confirm = useConfirm();
  const {
    settings,
    setAnchorTime,
    toggleAnchor,
    toggleMvd,
    setThemeDays,
    addThemeDay,
    removeThemeDay,
  } = useRhythmSettings();

  const installedPlans = useMemo(
    () => collectInstalledPlans(tasks, habits, settings.themeDays),
    [tasks, habits, settings.themeDays]
  );

  const handleUninstallPlan = async (plan: PlanSummary) => {
    const ok = await confirm({
      intent: "remove",
      tone: "info",
      title: `整套退場「${plan.name}」`,
      message: "將封存此方案的待處理任務與習慣，並移除對應主題日；已完成紀錄與產出統計會完整保留。",
      impactDetail: `${plan.activeTasksCount} 個任務 · ${plan.activeHabitsCount} 個習慣 · ${plan.themeDaysCount} 個主題日`,
      confirmText: "整套退場",
    });
    if (!ok) return;

    const nowIso = new Date().toISOString();
    const { changedTasks } = archivePlanTasks(tasks, plan.id, nowIso);
    if (changedTasks.length > 0) {
      saveTasksDirectly(changedTasks);
    }
    const archivedHabitsCount = archiveHabitsByPlan(plan.id);
    const nextThemeDays = removePlanThemeDays(settings.themeDays, plan.id);
    if (nextThemeDays.length !== settings.themeDays.length) {
      setThemeDays(nextThemeDays);
    }

    toast.success(
      `「${plan.name}」已退場：封存 ${changedTasks.length} 個任務、${archivedHabitsCount} 個習慣，歷史紀錄已保留`
    );
  };

  const [themeLabel, setThemeLabel] = useState("");
  const [themeEmoji, setThemeEmoji] = useState("");
  const [themeTag, setThemeTag] = useState("");
  const [themeWeekdays, setThemeWeekdays] = useState<number[]>([]);

  const toggleWeekday = (day: number) => {
    setThemeWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleAddThemeDay = () => {
    const label = themeLabel.trim();
    if (!label || themeWeekdays.length === 0) return;
    addThemeDay({
      label,
      emoji: themeEmoji.trim(),
      weekdays: themeWeekdays,
      tag: themeTag.trim() || undefined,
    });
    setThemeLabel("");
    setThemeEmoji("");
    setThemeTag("");
    setThemeWeekdays([]);
  };

  return (
    <section>
      <h3
        className="text-[12px] font-semibold tracking-tight mb-1"
        style={{ color: "var(--text-tertiary)" }}
      >
        日常節奏
      </h3>
      <p className="text-[12px] mb-3" style={{ color: "var(--text-tertiary)" }}>
        提醒一天只出現一次，關掉也沒關係
      </p>

      <div className="space-y-3">
        {/* 1. 作息錨點 */}
        <div className="card p-4 space-y-3">
          <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
            作息錨點
          </p>
          {ANCHOR_ROWS.map((row, idx) => (
            <div key={row.id}>
              {idx > 0 && <div className="h-px mb-3" style={{ background: "var(--border)" }} />}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {row.label}
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={settings[row.timeKey]}
                    onChange={(e) => setAnchorTime(row.id, e.target.value)}
                    className="input w-auto cursor-pointer"
                    aria-label={`${row.label}時間`}
                  />
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.enabled[row.id]}
                      onChange={() => toggleAnchor(row.id)}
                      aria-label={`啟用${row.label}提醒`}
                    />
                    <div className="w-11 h-6 rounded-full peer peer-checked:bg-brand bg-black/10 transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 2. 每日主題日 */}
        <div className="card p-4 space-y-3">
          <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
            每日主題日
          </p>

          {settings.themeDays.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {settings.themeDays.map((td) => {
                const daysText = td.weekdays
                  .map((d) => WEEKDAY_LABELS[d] ?? "")
                  .filter(Boolean)
                  .join("／");
                return (
                  <span
                    key={td.id}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]"
                    style={{
                      background: "var(--surface-hover)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {td.emoji && <span>{td.emoji}</span>}
                    <span className="font-medium">{td.label}</span>
                    <span style={{ color: "var(--text-tertiary)" }}>週{daysText}</span>
                    <button
                      type="button"
                      onClick={() => removeThemeDay(td.id)}
                      className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/5"
                      style={{ color: "var(--text-tertiary)" }}
                      aria-label={`移除主題日 ${td.label}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-[64px_1fr] gap-2">
            <input
              type="text"
              maxLength={4}
              value={themeEmoji}
              onChange={(e) => setThemeEmoji(e.target.value)}
              placeholder="💻"
              className="input text-center"
              aria-label="主題日圖示"
            />
            <input
              type="text"
              maxLength={24}
              value={themeLabel}
              onChange={(e) => setThemeLabel(e.target.value)}
              placeholder="主題名稱（如 Vibe Coding）"
              className="input"
              aria-label="主題日名稱"
            />
          </div>

          <input
            type="text"
            maxLength={24}
            value={themeTag}
            onChange={(e) => setThemeTag(e.target.value)}
            placeholder="關聯任務標籤（選填，用於統計）"
            className="input"
            aria-label="關聯任務標籤"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {WEEKDAY_LABELS.map((label, i) => {
                const active = themeWeekdays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleWeekday(i)}
                    className="w-9 h-9 rounded-xl text-[13px] font-medium transition-all"
                    style={
                      active
                        ? { background: "var(--brand)", color: "var(--brand-foreground)" }
                        : { background: "var(--surface-hover)", color: "var(--text-secondary)" }
                    }
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleAddThemeDay}
              disabled={!themeLabel.trim() || themeWeekdays.length === 0}
              className="px-3.5 py-2 rounded-xl text-[13px] font-medium transition-opacity disabled:opacity-40"
              style={{
                background: "var(--brand-tint)",
                color: "var(--brand)",
              }}
            >
              加入主題日
            </button>
          </div>
        </div>

        {/* 3. 低耗能模式 */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                低耗能模式
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                睡不好時開啟，今天完成兩成就算有份
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.mvdEnabled}
                onChange={toggleMvd}
                aria-label="啟用低耗能模式"
              />
              <div className="w-11 h-6 rounded-full peer peer-checked:bg-brand bg-black/10 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
            </label>
          </div>
        </div>

        {/* 4. 已套用方案安全退場 */}
        {installedPlans.length > 0 && (
          <div className="card p-4 space-y-3">
            <div>
              <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                已套用方案
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                換新計畫時可整套封存退場，保留歷史紀錄與統計，不誤刪手動建立的項目
              </p>
            </div>
            <div className="space-y-2">
              {installedPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: "var(--surface-hover)" }}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {plan.name}
                    </p>
                    <p className="text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                      {plan.activeTasksCount} 任務 · {plan.activeHabitsCount} 習慣 · {plan.themeDaysCount} 主題日
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleUninstallPlan(plan)}
                    className="shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                    style={{
                      background: "var(--brand-tint)",
                      color: "var(--brand)",
                    }}
                  >
                    整套退場
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
