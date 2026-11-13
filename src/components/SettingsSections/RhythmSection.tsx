"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useRhythmSettings } from "@/hooks/useRhythmSettings";
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
  const {
    settings,
    setAnchorTime,
    toggleAnchor,
    toggleMvd,
    addThemeDay,
    removeThemeDay,
  } = useRhythmSettings();

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
      </div>
    </section>
  );
}
