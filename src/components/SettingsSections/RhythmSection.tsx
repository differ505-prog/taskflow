"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/AppContext";
import { useConfirm } from "@/hooks/useConfirm";
import { useRhythmSettings } from "@/hooks/useRhythmSettings";
import { toLocalDateString } from "@/lib/dateUtils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  archivePlanTasks,
  collectInstalledPlans,
  isPlanPaused,
  removePlanThemeDays,
  type PlanSummary,
} from "@/lib/sourcePlan";
import type { RhythmAnchorId } from "@/lib/types";
import { INSTALLED_PLANS_ANCHOR_ID } from "@/lib/sourcePlan";

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
    toggleSlotGrid,
    setThemeDays,
    addThemeDay,
    removeThemeDay,
    setCustomAnchor,
    pausePlan,
    resumePlan,
  } = useRhythmSettings();

  const installedPlans = useMemo(
    () => collectInstalledPlans(tasks, habits, settings.themeDays),
    [tasks, habits, settings.themeDays]
  );

  // ── ?plan= 直達高亮（Next.js 靜態建置防線）────────────────────
  // 嚴禁使用 Next.js 的 URL query hook：會導致 /settings 靜態預渲染失敗。
  // 只在 client 端 useEffect 內讀取 window.location.search。
  const [highlightedPlanId, setHighlightedPlanId] = useState<string | null>(null);
  useEffect(() => {
    const planParam = new URLSearchParams(window.location.search).get("plan");
    if (!planParam) return;
    if (!installedPlans.some((p) => p.id === planParam)) return;

    setHighlightedPlanId(planParam);
    const timer = window.setTimeout(() => {
      document
        .getElementById(`installed-plan-${planParam}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    const clearTimer = window.setTimeout(() => setHighlightedPlanId(null), 4000);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearTimer);
    };
  }, [installedPlans]);

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

  // 第 4 顆自訂紅線（本地草稿 + blur 時提交）
  const [customLabel, setCustomLabel] = useState(settings.customAnchor?.label ?? "");
  const [customTime, setCustomTime] = useState(settings.customAnchor?.time ?? "20:00");

  // 外部（雲端同步 / 其他分頁）變更時同步回草稿
  useEffect(() => {
    setCustomLabel(settings.customAnchor?.label ?? "");
    setCustomTime(settings.customAnchor?.time ?? "20:00");
  }, [settings.customAnchor?.label, settings.customAnchor?.time]);

  const handleCommitCustomAnchor = () => {
    const label = customLabel.trim();
    if (!label) return;
    setCustomAnchor({
      label,
      time: customTime,
      enabled: customAnchorEnabled,
    });
  };

  // 自訂紅線的啟用狀態：以 customAnchor.enabled 為單一事實來源，
  // 舊資料只有 enabled.custom 時才退回讀 enabled.custom
  const customAnchorEnabled =
    settings.customAnchor?.enabled ?? settings.enabled.custom ?? false;

  // ── 方案休眠／恢復 ──────────────────────────────────────────
  const [pauseResumeTarget, setPauseResumeTarget] = useState<string | null>(null);
  const [resumeDateInput, setResumeDateInput] = useState("");

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }, []);

  /** 明天（喚醒日最小值：選今天等同沒休眠，屬無效日期） */
  const tomorrowStr = useMemo(() => {
    const d = new Date(`${todayStr}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return toLocalDateString(d);
  }, [todayStr]);

  const handlePausePlan = (planId: string) => {
    // 喚醒日必須晚於今天：選今天等同沒休眠
    if (resumeDateInput && resumeDateInput < tomorrowStr) return;
    pausePlan(planId, resumeDateInput || undefined);
    setPauseResumeTarget(null);
    setResumeDateInput("");
    toast.success("方案已休眠，會安靜地等你回來");
  };

  const handleResumePlan = (planId: string, planName: string) => {
    resumePlan(planId);
    setPauseResumeTarget(null);
    setResumeDateInput("");
    toast.success(`「${planName}」已回來了`);
  };

  // Esc 關閉展開中的休眠日期列（鍵盤無障礙）
  useEffect(() => {
    if (!pauseResumeTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPauseResumeTarget(null);
        setResumeDateInput("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pauseResumeTarget]);

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
                    className="input w-auto min-h-[44px] cursor-pointer"
                    aria-label={`${row.label}時間`}
                  />
                  <ThemeToggle
                    checked={settings.enabled[row.id]}
                    onChange={() => toggleAnchor(row.id)}
                    ariaLabel={`啟用${row.label}提醒`}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* 第 4 顆：自訂紅線 */}
          <div className="h-px" style={{ background: "var(--border)" }} />
          {/* 手機版（375px）改單欄堆疊，避免名稱輸入與時間輸入橫向溢出 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="min-w-0 sm:flex-1">
              <span className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                自訂紅線
              </span>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                屬於你自己的第四顆節奏錨點
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                maxLength={20}
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                onBlur={handleCommitCustomAnchor}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCommitCustomAnchor();
                }}
                placeholder="名稱（如 停杯紅線）"
                className="input w-full sm:w-40 min-h-[44px]"
                aria-label="自訂紅線名稱"
              />
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                onBlur={handleCommitCustomAnchor}
                className="input w-auto min-h-[44px] cursor-pointer"
                aria-label="自訂紅線時間"
              />
              {/* 深色模式可見的 toggle：軌道底色改用 var(--surface-hover) / var(--brand) */}
              <ThemeToggle
                checked={customAnchorEnabled}
                onChange={() => toggleAnchor("custom")}
                ariaLabel="啟用自訂紅線提醒"
              />
            </div>
          </div>
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
            <ThemeToggle
              checked={settings.mvdEnabled}
              onChange={toggleMvd}
              ariaLabel="啟用低耗能模式"
            />
          </div>
        </div>

        {/* 4. 一天的節奏槽網格 */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                一天的節奏
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                用一天的節奏槽看今天要做什麼
              </p>
            </div>
            <ThemeToggle
              checked={settings.slotGridEnabled}
              onChange={toggleSlotGrid}
              ariaLabel="啟用一天的節奏槽網格"
            />
          </div>
        </div>

        {/* 5. 已套用方案安全退場 */}
        {installedPlans.length > 0 && (
          <div id={INSTALLED_PLANS_ANCHOR_ID} className="card p-4 space-y-3">
            <div>
              <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                已套用方案
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                換新計畫時可整套封存退場，保留歷史紀錄與統計，不誤刪手動建立的項目
              </p>
            </div>
            <div className="space-y-2">
              {installedPlans.map((plan) => {
                const pauseEntry = settings.pausedPlans?.[plan.id];
                const isPaused = isPlanPaused(plan.id, settings.pausedPlans, todayStr);
                const autoResumed =
                  !!pauseEntry?.resumeDate && pauseEntry.resumeDate <= todayStr;
                return (
                  <div
                    key={plan.id}
                    id={`installed-plan-${plan.id}`}
                    className="rounded-xl px-3 py-2.5"
                    style={{
                      background: "var(--surface-hover)",
                      boxShadow:
                        highlightedPlanId === plan.id
                          ? "0 0 0 2px var(--brand)"
                          : undefined,
                      transition: "box-shadow 300ms ease",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {plan.name}
                        </p>
                        <p className="text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                          {plan.activeTasksCount} 任務 · {plan.activeHabitsCount} 習慣 · {plan.themeDaysCount} 主題日
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isPaused ? (
                          <>
                            <span
                              className="rounded-full px-2.5 py-1 text-[11px]"
                              style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                            >
                              {pauseEntry?.resumeDate
                                ? `休眠中 · ${pauseEntry.resumeDate} 恢復`
                                : "休眠中"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleResumePlan(plan.id, plan.name)}
                              className="min-h-[44px] rounded-xl px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                              style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                            >
                              立即恢復
                            </button>
                          </>
                        ) : (
                          <>
                            {autoResumed && (
                              <span
                                className="rounded-full px-2.5 py-1 text-[11px]"
                                style={{ background: "var(--surface-muted)", color: "var(--text-tertiary)" }}
                              >
                                已於 {pauseEntry?.resumeDate} 回來
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setPauseResumeTarget(
                                  pauseResumeTarget === plan.id ? null : plan.id
                                );
                                setResumeDateInput("");
                              }}
                              className="min-h-[44px] rounded-xl px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                              style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
                            >
                              休眠
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleUninstallPlan(plan)}
                              className="min-h-[44px] shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                              style={{
                                background: "var(--brand-tint)",
                                color: "var(--brand)",
                              }}
                            >
                              整套退場
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {pauseResumeTarget === plan.id && !isPaused && (
                      <div
                        className="mt-2.5 flex flex-wrap items-center gap-2 pt-2.5"
                        style={{ borderTop: "1px solid var(--border)" }}
                      >
                        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                          選擇喚醒日（可留空＝手動恢復）
                        </span>
                        <input
                          type="date"
                          value={resumeDateInput}
                          min={tomorrowStr}
                          onChange={(e) => setResumeDateInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.stopPropagation();
                              setPauseResumeTarget(null);
                              setResumeDateInput("");
                            }
                          }}
                          className="input w-auto min-h-[44px] cursor-pointer"
                          aria-label={`${plan.name} 喚醒日`}
                        />
                        <button
                          type="button"
                          onClick={() => handlePausePlan(plan.id)}
                          className="min-h-[44px] rounded-xl px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                          style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                        >
                          確認休眠
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
