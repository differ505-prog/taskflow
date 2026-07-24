"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { HunterRank } from "@/lib/hunterRankTypes";

/**
 * RankUpNotification — 全螢幕「階級晉升」慶祝動畫
 *
 * 設計（對應提示詞 §3,符合「多巴胺核心」）：
 * - 畫面稍微變暗(70% alpha 黑色遮罩 + backdrop-blur,非完全阻斷)
 * - 中央巨大徽章 + 階級名稱,帶發光特效(blur + 動態 scale)
 * - 文案:「階級晉升！你已成為 D 級獵人！」
 * - 自動 3 秒後淡出,**不需要用戶手動點擊**(絕對 ADHD 地雷)
 * - 用 portal 掛到 body,避免 z-index 衝突
 * - 使用 zustand 風格的單一 payload store,避免 prop drilling
 *
 * 序列化播放機制（與 StatusWindow 配合）：
 * - useRankUpStore 暴露 show(rank)
 * - 任何 hook 可呼叫,確保與 StatusWindow 的 2.5s 不重疊
 *   (Caller 應在 StatusWindow dismiss 後才呼叫 show())
 *
 * 音效：本機不預設播放,避免意外聲音嚇到用戶
 *   (未來可加 Web Audio API 短莊嚴 chord,需用戶互動後才能播放,屬 P2)
 */

const VISIBLE_DURATION_MS = 3000; // 3 秒後自動淡出

type RankUpState = {
  rank: HunterRank | null;
  show: (rank: HunterRank) => void;
  dismiss: () => void;
};

// 用 React context 簡單實作（不引 zustand,因為這是純 UI 一次性事件）
// 任何元件 import useRankUpNotification() 即可呼叫
const listeners = new Set<(rank: HunterRank | null) => void>();
let currentRank: HunterRank | null = null;

function setRank(rank: HunterRank | null) {
  currentRank = rank;
  listeners.forEach((fn) => fn(rank));
}

export function useRankUpNotification() {
  return {
    show: (rank: HunterRank) => setRank(rank),
    dismiss: () => setRank(null),
  };
}

export function RankUpNotification() {
  const [rank, setLocalRank] = useState<HunterRank | null>(currentRank);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fn = (r: HunterRank | null) => setLocalRank(r);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  // 自動 3 秒淡出
  useEffect(() => {
    if (!rank) return;
    const timer = window.setTimeout(() => setRank(null), VISIBLE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [rank]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {rank && (
        <motion.div
          key={`rankup-${rank.tier}-${rank.code}`}
          role="status"
          aria-live="assertive"
          aria-label={`階級晉升！你已成為 ${rank.label}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center"
          style={{
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          {/* 巨型徽章 + 發光 */}
          <motion.div
            initial={{ scale: 0.3, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.2, opacity: 0, y: -20 }}
            transition={{
              type: "spring",
              stiffness: 220,
              damping: 18,
              mass: 0.8,
            }}
            className="relative flex flex-col items-center gap-6 px-8 py-10"
          >
            {/* 發光暈(多重 blur 堆疊) */}
            <motion.div
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${rank.color}80 0%, transparent 70%)`,
                filter: "blur(40px)",
              }}
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.6, 1, 0.8],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* 徽章圓盤 */}
            <motion.div
              className="relative flex h-32 w-32 items-center justify-center rounded-full text-5xl font-black tabular-nums"
              style={{
                background: `linear-gradient(135deg, ${rank.color}, ${rank.color}cc)`,
                color: "white",
                boxShadow: `0 0 60px ${rank.color}80, 0 0 120px ${rank.color}40, inset 0 0 0 4px rgba(255,255,255,0.3)`,
              }}
              animate={{
                rotate: [0, -5, 5, 0],
              }}
              transition={{
                duration: 0.6,
                ease: "easeOut",
              }}
            >
              {rank.code}
            </motion.div>

            {/* 標題 */}
            <div className="flex flex-col items-center gap-2">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-balance text-xs font-semibold uppercase tracking-[0.4em]"
                style={{ color: rank.color }}
              >
                Rank Up
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl"
              >
                階級晉升！
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="text-balance text-lg font-medium text-slate-200"
              >
                你已成為 <span style={{ color: rank.color }}>{rank.label}</span>
              </motion.p>
            </div>

            {/* 裝飾刻線 */}
            <motion.div
              aria-hidden
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.7, duration: 0.5, ease: "easeOut" }}
              className="h-px w-48"
              style={{
                background: `linear-gradient(90deg, transparent, ${rank.color}, transparent)`,
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}