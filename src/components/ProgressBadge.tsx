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

  // 格式化 PP：>1000 顯示為 K（如 1.5K）
  const formatPp = (pp: number) => {
    if (pp >= 10000) return `${(pp / 1000).toFixed(1)}K`;
    if (pp >= 1000) return `${(pp / 1000).toFixed(1)}K`;
    return pp.toString();
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="inline-flex flex-col items-center gap-0.5 rounded-full px-2.5 pt-1.5 text-[11px] font-medium transition-all duration-200"
        style={{
          background: `${level.color}12`,
          color: level.color,
          border: `1px solid ${level.color}25`,
        }}
        aria-label={`Pro 等級狀態：${level.label}`}
      >
        {/* 等級符號 + PP */}
        <div className="flex items-center gap-1">
          <span className="font-mono text-[13px] font-bold leading-none">{level.code}</span>
          <span className="text-[10px] font-medium leading-none opacity-70">{formatPp(displayPp)}</span>
        </div>
        {/* 微型進度條 — 始終可見 */}
        {nextLevel && (
          <div
            className="h-0.5 w-full overflow-hidden rounded-full"
            style={{ background: `${level.color}20` }}
            aria-hidden
          >
            <div
              className="block h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.max(2, Math.round(progress * 100))}%`,
                background: level.color,
              }}
            />
          </div>
        )}
        {!nextLevel && (
          <div
            className="h-0.5 w-full rounded-full"
            style={{ background: `${level.color}40` }}
            aria-hidden
          />
        )}
      </button>

      {/* Tooltip / Popover — hover/focus 時顯示詳細資訊 */}
      {showTooltip && (
        <div
          className="absolute top-full right-0 mt-1.5 z-50 w-[180px] rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 text-center shadow-sm backdrop-blur"
          role="tooltip"
        >
          {/* 第 1 行:等級名稱 */}
          <p className="text-[11px] font-medium text-slate-500">{level.label}</p>

          {/* 第 2 行:當前 PP */}
          <p className="mt-1 font-mono text-[15px] font-semibold leading-tight text-slate-800">
            {displayPp.toLocaleString()} <span className="text-[12px] font-medium text-slate-500">PP</span>
          </p>

          {/* 第 3 行:升級目標 */}
          {nextLevel && (
            <>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {nextLevel.min.toLocaleString()} PP → {nextLevel.label}
              </p>
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
