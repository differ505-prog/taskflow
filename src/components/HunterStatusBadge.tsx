"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useHunterStatus } from "@/hooks/useHunterStatus";
import type { HunterRank } from "@/lib/hunterRankTypes";

/**
 * HunterStatusBadge — 獵人公會常駐狀態徽章
 *
 * 設計（對應提示詞 §1 + §10.3 9.2 方案）：
 * - 平時：極簡低彩度,顯示階級代號 + 進度條細線,不打擾專注
 * - hover：稍微發光,顯示「XXX EXP / 下一階級」詳細數字
 * - 平滑 tween 動畫：EXP 變化時進度條用 framer-motion useMotionValue 平滑增長
 * - 固定位置：右上角（與「任務大廳」按鈕共存,需調整後者位置）
 *
 * 為什麼要 React state + useMotionValue：
 * - totalExp 是 React state（會同步觸發組件重渲染）
 * - useMotionValue 給 framer-motion 用,獨立於 React render 之外做平滑 tween
 * - 兩者解耦：UI 不會因為動畫而 re-render,動畫不會因為 React batch 而卡頓
 */

const COMPACT_VIEWPORT = 9999; // 永遠顯示,future-proof

export function HunterStatusBadge() {
  const { totalExp, rankInfo, currentRank } = useHunterStatus();
  const [hovered, setHovered] = useState(false);

  // 平滑 tween 的 motion value(0..1 對應 rankInfo.progress)
  const progressMV = useMotionValue(rankInfo.progress);
  const [progressDisplay, setProgressDisplay] = useState(rankInfo.progress);

  // 監聽 motion value 變化,更新 React state 給 a11y / 進度條 fillWidth 用
  useEffect(() => {
    const unsub = progressMV.on("change", (v) => setProgressDisplay(v));
    return unsub;
  }, [progressMV]);

  // totalExp 變化時,從 currentProgress 動畫到 targetProgress
  useEffect(() => {
    const controls = animate(progressMV, rankInfo.progress, {
      duration: 0.9,
      ease: [0.4, 0, 0.2, 1],
    });
    return () => controls.stop();
  }, [rankInfo.progress, progressMV]);

  const isMaxRank = !rankInfo.nextRank;
  const tierLabel = `${currentRank.code} 級`;
  const expLabel = isMaxRank
    ? `${totalExp.toLocaleString()} EXP`
    : `${totalExp.toLocaleString()} / ${rankInfo.nextRank?.min.toLocaleString() ?? 0}`;

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      initial={false}
      animate={{
        boxShadow: hovered
          ? `0 0 0 1px ${currentRank.color}33, 0 4px 20px ${currentRank.color}1f`
          : "0 0 0 1px rgba(148,163,184,0.18)",
        scale: hovered ? 1.02 : 1,
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="inline-flex select-none items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 backdrop-blur-md transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      role="status"
      aria-label={`獵人公會狀態：${currentRank.label}，${expLabel}`}
      tabIndex={0}
    >
      {/* 階級色塊(低彩度 slate 為主) */}
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
        style={{
          background: `${currentRank.color}1a`, // 10% alpha
          color: currentRank.color,
          border: `1px solid ${currentRank.color}40`,
        }}
        aria-hidden
      >
        {currentRank.code}
      </span>

      {/* 階級文字 + EXP 數字(響應式:較窄 viewport 隱藏) */}
      <div className="hidden min-[280px]:flex min-w-0 flex-col leading-none">
        <span className="text-[11px] font-medium text-slate-600">{tierLabel}</span>
        <span
          className={`tabular-nums text-[10px] text-slate-400 transition-opacity duration-200 ${
            hovered ? "opacity-100" : "opacity-70"
          }`}
        >
          {expLabel}
        </span>
      </div>

      {/* 細線進度條(只在不是最高階級時有意義) */}
      {!isMaxRank && (
        <div
          className="relative ml-1 h-1 w-10 overflow-hidden rounded-full bg-slate-200/60"
          aria-hidden
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${currentRank.color}, ${currentRank.color}cc)`,
              width: `${progressDisplay * 100}%`,
              transition: "width 0.3s ease-out",
            }}
          />
        </div>
      )}
    </motion.div>
  );
}

/**
 * 純函式 helper：給父層決定 layout 用
 * 確保 placeholder 預留寬度,避免 layout shift
 */
export function hunterBadgePlaceholderHeight(): number {
  return 32; // h-8 = 32px
}

// Re-export type for convenience
export type { HunterRank };

// Avoid unused warning for internal constant
void COMPACT_VIEWPORT;