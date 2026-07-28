"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { ProgressLevel } from "@/lib/progressRankTypes";

/**
 * LevelUpNotification — 全螢幕「等級晉升」慶祝動畫
 * - 自動 3 秒後淡出
 * - 用 portal 掛到 body
 */

const VISIBLE_DURATION_MS = 3000;

type LevelUpState = {
  level: ProgressLevel | null;
  show: (level: ProgressLevel) => void;
  dismiss: () => void;
};

const listeners = new Set<(level: ProgressLevel | null) => void>();
let currentLevel: ProgressLevel | null = null;

function setLevel(level: ProgressLevel | null) {
  currentLevel = level;
  listeners.forEach((fn) => fn(level));
}

export function useLevelUpNotification() {
  return {
    show: (level: ProgressLevel) => setLevel(level),
    dismiss: () => setLevel(null),
  };
}

export function LevelUpNotification() {
  const [level, setLocalLevel] = useState<ProgressLevel | null>(currentLevel);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fn = (l: ProgressLevel | null) => setLocalLevel(l);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  useEffect(() => {
    if (!level) return;
    const timer = window.setTimeout(() => setLevel(null), VISIBLE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [level]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {level && (
        <motion.div
          key={`levelup-${level.tier}-${level.code}`}
          role="status"
          aria-live="assertive"
          aria-label={`等級晉升！你已晉升至 ${level.label}`}
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
          <motion.div
            initial={{ scale: 0.3, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.2, opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 220, damping: 18, mass: 0.8 }}
            className="relative flex flex-col items-center gap-6 px-8 py-10"
          >
            {/* 發光暈 */}
            <motion.div
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${level.color}80 0%, transparent 70%)`,
                filter: "blur(40px)",
              }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* 等級徽章圓盤 */}
            <motion.div
              className="relative flex h-32 w-32 items-center justify-center rounded-full text-5xl font-black tabular-nums"
              style={{
                background: `linear-gradient(135deg, ${level.color}, ${level.color}cc)`,
                color: "white",
                boxShadow: `0 0 60px ${level.color}80, 0 0 120px ${level.color}40, inset 0 0 0 4px rgba(255,255,255,0.3)`,
              }}
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              {level.code}
            </motion.div>

            {/* 標題 */}
            <div className="flex flex-col items-center gap-2">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-xs font-semibold uppercase tracking-[0.4em]"
                style={{ color: level.color }}
              >
                Level Up
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
              >
                等級晉升！
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="text-lg font-medium text-slate-200"
              >
                你已晉升至 <span style={{ color: level.color }}>{level.label}</span>
              </motion.p>
            </div>

            {/* 裝飾刻線 */}
            <motion.div
              aria-hidden
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.7, duration: 0.5, ease: "easeOut" }}
              className="h-px w-48"
              style={{ background: `linear-gradient(90deg, transparent, ${level.color}, transparent)` }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
