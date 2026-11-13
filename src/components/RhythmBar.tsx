"use client";

import { useEffect, useRef, useState } from "react";
import { useRhythmSettings } from "@/hooks/useRhythmSettings";
import { useStatusWindow } from "@/hooks/useStatusWindow";
import { computeMvdProgress } from "@/lib/mvd";
import { anchorCopy, getActiveAnchor, getTodayTheme, themeCopy } from "@/lib/rhythm";
import type { Task } from "@/lib/types";

const WEEKDAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"] as const;

interface RhythmBarProps {
  visibleTasks: Task[];
}

export function RhythmBar({ visibleTasks }: RhythmBarProps) {
  const { settings, isHydrated, toggleMvd } = useRhythmSettings();
  const showWindow = useStatusWindow();
  const [now, setNow] = useState<Date>(() => new Date());
  const shownReachedRef = useRef(false);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const doneCount = visibleTasks.filter((t) => t.status === "done").length;
  const mvd = computeMvdProgress(visibleTasks.length, doneCount);
  const activeAnchor = isHydrated ? getActiveAnchor(now, settings) : null;
  const todayTheme = isHydrated ? getTodayTheme(settings, now) : null;

  useEffect(() => {
    if (!settings.mvdEnabled || !mvd.reached) return;
    if (shownReachedRef.current) return;
    shownReachedRef.current = true;
    showWindow({
      title: "低耗能達標",
      message: "今天的份完成了，剩下的都在這裡",
    });
  }, [settings.mvdEnabled, mvd.reached, showWindow]);

  const barWidthPct = Math.min(100, mvd.pct);

  return (
    <div
      className="mx-auto max-w-2xl px-1 flex flex-col gap-1.5"
      style={{ color: "var(--text-tertiary)" }}
    >
      <div className="flex min-h-[24px] flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span>{isHydrated ? WEEKDAY_NAMES[now.getDay()] : ""}</span>

          {todayTheme && (
            <span className="inline-flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
              <span>{themeCopy(todayTheme).title}</span>
            </span>
          )}

          {activeAnchor && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-1 h-1 rounded-full shrink-0"
                style={{ backgroundColor: "var(--brand)" }}
                aria-hidden
              />
              <span>{anchorCopy(activeAnchor).title}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={toggleMvd}
          aria-pressed={settings.mvdEnabled}
          className="rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
          style={
            settings.mvdEnabled
              ? { backgroundColor: "var(--brand-tint)", color: "var(--brand)" }
              : { color: "var(--text-tertiary)" }
          }
        >
          {settings.mvdEnabled ? "低耗能" : "正常"}
        </button>
      </div>

      {settings.mvdEnabled && (
        <div
          className="h-1 w-full rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--surface-hover)" }}
          role="progressbar"
          aria-label="低耗能進度"
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${barWidthPct}%`,
              backgroundColor: "var(--brand)",
            }}
          />
        </div>
      )}
    </div>
  );
}
