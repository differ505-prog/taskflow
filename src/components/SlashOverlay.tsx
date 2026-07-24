"use client";

import { motion } from "framer-motion";

/**
 * 卡片斬擊特效
 *
 * 規格:0.0s 觸發、0.3s 結束
 * 設計:雙斜線 X 型斬擊 + 中心柔光
 * 風格:亮藍/紫發光 drop-shadow,俐落不浮誇
 */
export function SlashOverlay({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.08 }}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-3xl"
    >
      <svg
        viewBox="0 0 200 200"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          {/* 斬擊漸層 — 亮藍紫發光 */}
          <linearGradient id="slashGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0" />
            <stop offset="40%" stopColor="#818cf8" stopOpacity="1" />
            <stop offset="60%" stopColor="#c4b5fd" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* 中心柔光 */}
          <radialGradient id="slashGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </radialGradient>

          {/* 發光 filter */}
          <filter id="slashGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 中心柔光 — 200ms 內爆發並淡出 */}
        <motion.circle
          cx="100"
          cy="100"
          r="60"
          fill="url(#slashGlow)"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.8, 0], scale: [0.4, 1.1, 1.3] }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        />

        {/* 第一斜斬 — 左上到右下 */}
        <motion.path
          d="M 30 30 L 170 170"
          stroke="url(#slashGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          filter="url(#slashGlowFilter)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
          transition={{
            pathLength: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
            opacity: { duration: 0.3, times: [0, 0.1, 0.7, 1] },
          }}
        />

        {/* 第二斜斬 — 右上到左下(交叉,強化「劍意」) */}
        <motion.path
          d="M 170 30 L 30 170"
          stroke="url(#slashGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          filter="url(#slashGlowFilter)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
          transition={{
            pathLength: { duration: 0.18, delay: 0.08, ease: [0.4, 0, 0.2, 1] },
            opacity: { duration: 0.3, delay: 0.08, times: [0, 0.1, 0.7, 1] },
          }}
        />

        {/* 劍氣尾痕 — 細線垂直斬(三刀流的俐落感) */}
        <motion.path
          d="M 100 20 L 100 180"
          stroke="url(#slashGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          filter="url(#slashGlowFilter)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.7, 0] }}
          transition={{
            pathLength: { duration: 0.22, delay: 0.04, ease: "easeOut" },
            opacity: { duration: 0.28, delay: 0.04, times: [0, 0.3, 1] },
          }}
        />
      </svg>
    </motion.div>
  );
}
