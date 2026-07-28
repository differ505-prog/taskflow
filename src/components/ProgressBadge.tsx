"use client";

import { useEffect, useRef, useState } from "react";
import { useProgressStatus } from "@/hooks/useProgressStatus";

/**
 * ProgressBadge — Pro 等級常駐狀態徽章
 * 置於 ZenDashboard toolbar 右上
 */
export function ProgressBadge() {
  const { totalPp, levelInfo } = useProgressStatus();
  const [showTooltip, setShowTooltip] = useState(false);
  const [displayPp, setDisplayPp] = useState(0);
  const prevPpRef = useRef(0);

  // 平滑 tween 動畫：PP 變化時用 framer-motion useMotionValue 平滑增長
  useEffect(() => {
    const start = prevPpRef.current;
    const end = totalPp;
    if (start === end) return;
    const duration = 600;
    const startTime = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      setDisplayPp(Math.round(start + (end - start) * t));
      if (t < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        prevPpRef.current = end;
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [totalPp]);

  const { level, progress, nextLevel } = levelInfo;
  const expLabel = nextLevel
    ? `${(nextLevel.min - totalPp).toLocaleString()} PP to next`
    : "Max Level";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200"
        style={{
          background: `${level.color}15`,
          color: level.color,
          border: `1px solid ${level.color}30`,
        }}
        aria-label={`Pro 等級狀態：${level.label}，${expLabel}`}
      >
        {/* 等級符號 */}
        <span className="font-mono font-bold">{level.code}</span>
        {/* 等級名稱（小屏隱藏） */}
        <span className="hidden text-[10px] opacity-80 sm:inline">{level.label}</span>
        {/* 進度指示條 */}
        <span
          className="h-1 w-8 overflow-hidden rounded-full bg-white/20"
          aria-hidden
        >
          <span
            className="block h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.round(progress * 100)}%`, background: level.color }}
          />
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[140px] rounded-xl border border-zinc-200/80 bg-white/95 px-3 py-2 text-center shadow-sm backdrop-blur"
          role="tooltip"
        >
          <p className="text-[11px] font-medium" style={{ color: level.color }}>
            {level.label}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
            {displayPp.toLocaleString()} PP
          </p>
          {nextLevel && (
            <p className="mt-1 text-[10px] text-zinc-400">
              {nextLevel.min.toLocaleString()} PP → {nextLevel.label}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
