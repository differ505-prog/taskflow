"use client";

import { useEffect, useState } from "react";
import { Play, Pause, Square, ChevronDown } from "lucide-react";
import { IconPopover } from "./IconPopover";
import { isComposingKey } from "@/utils/imeGuard";
import {
  MAX_POMODORO_MINUTES,
  MIN_POMODORO_MINUTES,
  POMODORO_PRESETS,
  formatPomodoroClock,
  sanitizePomodoroMinutes,
} from "@/lib/pomodoroHelpers";

/**
 * PomodoroSplitPill — 分裂式番茄膠囊
 *
 * 三種顯示狀態：
 * - idle / busy-other：分裂膠囊 [ ▶ | 25m ▾ ]
 * - running：倒數 + 暫停鈕 + 收工鈕
 * - paused：倒數 + 繼續鈕 + 收工鈕
 *
 * 紅線紀律：
 * - 零紅色系（只使用 DESIGN_SYSTEM CSS Token）
 * - 全部按鈕 e.stopPropagation()，避免誤觸任務詳情面板（§5a 流程鎖定）
 * - 不跳頁、不搶 Zen 焦點、不開全頁 Modal
 * - 中文輸入保護：自訂分鐘 Enter 需通過 isComposingKey
 *
 * §死按鈕防線（Round 1 紅線修正）：
 * - 外層容器 **不可** 使用任何裁切屬性（會裁切 IconPopover 浮層）
 * - 右半部 trigger **不可** 自行 `stopPropagation()`（會吃掉 IconPopover 的 click）
 * - 禁用狀態一律由 `disabled` prop 表達，禁止用「看起來 disabled 但仍可點」的假象
 */

export interface PomodoroSplitPillProps {
  /** 顯示在膠囊上的記憶時長（分鐘），例如 task.pomodoroMinutes ?? 25 */
  minutes: number;
  /** idle=待機 | running=本列計時中 | paused=本列暫停中 | busy-other=其他項目計時中 */
  state: "idle" | "running" | "paused" | "busy-other";
  /** state 為 running / paused 時顯示的剩餘秒數 */
  secondsLeft?: number;
  /** 觸發開始計時（帶入本次分鐘數） */
  onStart: (mins: number) => void;
  /** 僅修改記憶時長（不立即開跑）— 供習慣頁同步手動單位或預先調整 */
  onSelectDuration?: (mins: number) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  /** true 時在桌面 idle 態低調淡出，group-hover / focus-visible 顯現（用於 TaskListItem） */
  revealOnGroupHover?: boolean;
  disabled?: boolean;
  itemLabel?: string;
}

export function PomodoroSplitPill({
  minutes,
  state,
  secondsLeft,
  onStart,
  onSelectDuration,
  onPause,
  onResume,
  onStop,
  revealOnGroupHover = false,
  disabled = false,
  itemLabel,
}: PomodoroSplitPillProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const isBusyOther = state === "busy-other";
  const isDisabled = disabled || isBusyOther;
  const label = itemLabel ? `「${itemLabel}」` : "";

  // 禁用狀態一律自動收合 Popover，避免殘留浮層遮住畫面
  useEffect(() => {
    if (isDisabled) {
      setPopoverOpen(false);
    }
  }, [isDisabled]);

  // ── 自訂分鐘驗證 ────────────────────────────────────────────
  const customMinutes = sanitizePomodoroMinutes(customInput);
  const customValid = customMinutes !== null;

  const closePopover = () => setPopoverOpen(false);

  const handleSelectPreset = (preset: number) => {
    onSelectDuration?.(preset);
    onStart(preset);
    closePopover();
  };

  const handleStartCustom = () => {
    if (!customValid || customMinutes === null) return;
    onSelectDuration?.(customMinutes);
    onStart(customMinutes);
    setCustomInput("");
    closePopover();
  };

  // ── running / paused：倒數狀態 ────────────────────────────────
  if (state === "running" || state === "paused") {
    const isRunning = state === "running";
    const clock = formatPomodoroClock(secondsLeft ?? 0);

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 rounded-full pl-1 pr-1.5 py-0.5 min-h-[36px] sm:min-h-[26px]"
        style={{
          background: isRunning ? "var(--brand-tint)" : "var(--surface-muted)",
          color: isRunning ? "var(--brand)" : "var(--text-secondary)",
          border: isRunning
            ? "1px solid color-mix(in srgb, var(--brand) 22%, transparent)"
            : "1px dashed var(--border-hover)",
        }}
        role="group"
        aria-label={`${label}番茄${isRunning ? "進行中" : "已暫停"}，剩餘 ${clock}`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isRunning) onPause();
            else onResume();
          }}
          aria-label={isRunning ? `暫停${label}番茄` : `繼續${label}番茄`}
          title={isRunning ? "暫停" : "繼續"}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        >
          {isRunning ? (
            <Pause className="w-3 h-3" aria-hidden="true" />
          ) : (
            <Play className="w-3 h-3" aria-hidden="true" />
          )}
        </button>

        <span className="text-[11px] font-medium tabular-nums px-0.5 whitespace-nowrap">
          {clock}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStop();
          }}
          aria-label={`收工${label}番茄`}
          title="收工"
          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        >
          <Square className="w-2.5 h-2.5" aria-hidden="true" />
          收工
        </button>
      </div>
    );
  }

  // ── idle / busy-other：分裂膠囊 ──────────────────────────────
  // 手機端保留 opacity-85（不可完全隱形，否則觸控無入口）；
  // 桌面（sm 以上）才在未 hover 時淡出，focus-within 仍保持顯現。
  const idleOpacity =
    revealOnGroupHover && !popoverOpen
      ? "opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 sm:focus-within:opacity-100"
      : "opacity-100";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center rounded-full border min-h-[36px] sm:min-h-[26px] transition-opacity ${idleOpacity}`}
      style={{
        background: "var(--surface-muted)",
        borderColor: "var(--border)",
        color: "var(--text-secondary)",
      }}
      role="group"
      aria-label={`${label}番茄時長選擇`}
    >
      {/* 左半部：開始 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (isDisabled) return;
          onStart(minutes);
        }}
        disabled={isDisabled}
        aria-label={
          isBusyOther
            ? "已有其他專注進行中"
            : `開始${label}${minutes}分鐘番茄`
        }
        title={isBusyOther ? "已有其他專注進行中" : `開始 ${minutes} 分鐘番茄`}
        className="inline-flex items-center justify-center w-7 h-full rounded-l-full flex-shrink-0 transition-opacity hover:opacity-75 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
      >
        <Play className="w-3 h-3" aria-hidden="true" />
      </button>

      {/* 分隔線 */}
      <span
        className="w-px self-stretch flex-shrink-0"
        style={{ background: "var(--border)" }}
        aria-hidden="true"
      />

      {/* 右半部：時長 popover trigger
          注意：不可在此自行 stopPropagation()，否則 IconPopover 收不到 click（死按鈕）。
          冒泡由外層容器的 onClick 統一阻斷。 */}
      <IconPopover
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        disabled={isDisabled}
        align="end"
        side="bottom"
        className="min-w-0"
        trigger={
          <button
            type="button"
            disabled={isDisabled}
            aria-label={`${label}番茄時長，目前 ${minutes} 分鐘`}
            aria-expanded={popoverOpen}
            title={isBusyOther ? "已有其他專注進行中" : "選擇番茄時長"}
            className="inline-flex items-center gap-0.5 px-1.5 h-full rounded-r-full whitespace-nowrap text-[11px] font-medium tabular-nums transition-opacity hover:opacity-75 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            {minutes}m
            <ChevronDown className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
          </button>
        }
      >
        <div className="w-[216px] p-2.5 space-y-2.5">
          {/* 快捷時長 */}
          <div className="grid grid-cols-4 gap-1">
            {POMODORO_PRESETS.map((preset) => {
              const active = preset === minutes;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPreset(preset);
                  }}
                  aria-pressed={active}
                  title={`${preset} 分鐘`}
                  className={`rounded-lg px-1 py-1.5 text-[12px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                    active ? "ring-1 ring-[var(--brand)]" : ""
                  }`}
                  style={
                    active
                      ? { background: "var(--brand-tint)", color: "var(--brand)" }
                      : { color: "var(--text-secondary)" }
                  }
                >
                  {preset}m
                </button>
              );
            })}
          </div>

          {/* 自訂分鐘 */}
          <div
            className="flex items-center gap-1.5 pt-2.5 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <input
              type="number"
              min={MIN_POMODORO_MINUTES}
              max={MAX_POMODORO_MINUTES}
              inputMode="numeric"
              placeholder="自訂"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (isComposingKey(e)) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleStartCustom();
                }
              }}
              aria-label={`${label}自訂番茄分鐘數`}
              className="flex-1 min-w-0 rounded-lg px-2 py-1 text-[12px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <span className="text-[12px] flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
              分
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleStartCustom();
              }}
              disabled={!customValid}
              title={customValid ? "以此時長開始" : "請輸入 1 到 180 之間的分鐘數"}
              className="rounded-lg px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-opacity disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
            >
              開始
            </button>
          </div>
        </div>
      </IconPopover>
    </div>
  );
}

export default PomodoroSplitPill;
