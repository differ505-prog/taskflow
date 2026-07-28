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
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200"
        style={{
          background: `${level.color}15`,
          color: level.color,
          border: `1px solid ${level.color}30`,
        }}
        aria-label={`Pro 等級狀態：${level.label}，${expLabel}`}
      >
        {/* 等級符號 */}
        <span className="font-mono font-bold">{level.code}</span>
        {/* 小箭頭 — 暗示可開啟 popover,跟「I」垂直置中 */}
        <svg
          aria-hidden
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="-ml-0.5 opacity-60"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Tooltip / Popover — §26 微遊戲化:3 行層次拉開視覺權重,加極簡進度條 */}
      {showTooltip && (
        <div
          className="absolute top-full right-0 mt-1.5 z-50 w-[180px] rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 text-center shadow-sm backdrop-blur"
          role="tooltip"
        >
          {/* 第 1 行:等級名稱 (低權重,標籤感) */}
          <p className="text-[11px] font-medium text-slate-500">{level.label}</p>

          {/* 第 2 行:當前 PP — 視覺焦點,font-semibold 略大 */}
          <p className="mt-1 font-mono text-[15px] font-semibold leading-tight text-slate-800">
            {displayPp.toLocaleString()} <span className="text-[12px] font-medium text-slate-500">PP</span>
          </p>

          {/* 第 3 行:升級目標 (輔助說明,最弱權重) */}
          {nextLevel && (
            <>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {nextLevel.min.toLocaleString()} PP → {nextLevel.label}
              </p>

              {/* 極簡進度條 */}
              <div
                className="mx-auto mt-1.5 h-1 w-[140px] overflow-hidden rounded-full bg-slate-100"
                aria-hidden
              >
                <div
                  className="block h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(2, Math.round(progress * 100))}%`,
                    background: "color-mix(in srgb, " + level.color + " 70%, transparent)",
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
