"use client";

import { motion } from "framer-motion";
import { ClipboardList, Inbox, Plus, Sparkles, Calendar, Layers, BarChart3, Tag, Flame } from "lucide-react";

/**
 * EmptyState — 視圖情境化空狀態
 *
 * 對齊 VOICE_AND_TONE.md §2 「空狀態」：
 * - 視圖定位 + 動作動詞
 * - 每個視圖有專屬語態（inbox 收、today 專注、zen 安靜、habits 起步、tag 整理）
 * - 不使用「無資料」「尚未建立」這種工程腔
 */

export type EmptyStateVariant =
  | "general"
  | "inbox"
  | "today"
  | "zen"
  | "all"
  | "habits"
  | "tags"
  | "stats";

interface EmptyStateProps {
  onAddTask?: () => void;
  onAddHabit?: () => void;
  onCreateTag?: () => void;
  /** 視圖類型：決定語態與 CTA 文案 */
  variant?: EmptyStateVariant;
}

const COPY: Record<
  EmptyStateVariant,
  { title: string; body: string; cta: string | null; hint?: string; icon: typeof Inbox }
> = {
  general: {
    title: "建立第一個任務",
    body: "把腦中浮現的事寫下來,從一個開始。",
    cta: "建立一個任務",
    icon: ClipboardList,
  },
  inbox: {
    title: "腦中先倒乾淨",
    body: "把現在想到的所有事快速記下來,之後再統一分類、安排優先順序。",
    cta: "倒一筆進來",
    hint: "支援自然語言：「明天下午3點 #工作 p1」",
    icon: Inbox,
  },
  today: {
    title: "今天還沒有任務",
    body: "從收集箱挑一個過來,或是心血來潮寫一個。",
    cta: "挑一個過來",
    icon: Calendar,
  },
  zen: {
    title: "戰場很安靜",
    body: "慢呼吸一下,沒有任務在催你。",
    cta: null,
    icon: Sparkles,
  },
  all: {
    title: "你的任務從這裡開始",
    body: "建立一個任務,或先打開收集箱接住腦中浮現的念頭。",
    cta: "建立一個任務",
    icon: Layers,
  },
  habits: {
    title: "從一個小習慣開始",
    body: "暖身區的「喝一口水」就是從這裡建的 — 最短的開始,最長的堅持。",
    cta: "建立第一個習慣",
    icon: Flame,
  },
  tags: {
    title: "整理一下任務的方式",
    body: "為相似的任務分類,之後查詢更快。",
    cta: "建立第一個標籤",
    icon: Tag,
  },
  stats: {
    title: "等你完成一些任務",
    body: "完成第一個任務後,這裡會幫你記錄節奏與軌跡。",
    cta: null,
    icon: BarChart3,
  },
};

export function EmptyState({
  onAddTask,
  onAddHabit,
  onCreateTag,
  variant = "general",
}: EmptyStateProps) {
  const copy = COPY[variant];
  const Icon = copy.icon;

  const handleClick = () => {
    if (variant === "habits") onAddHabit?.();
    else if (variant === "tags") onCreateTag?.();
    else onAddTask?.();
  };

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      {/* 裝飾性圖示 */}
      <motion.div
        className="relative mb-8"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <div
          className="absolute inset-0 rounded-full blur-3xl scale-125"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)" }}
          aria-hidden="true"
        />
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: "var(--surface)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Icon className="w-7 h-7" style={{ color: "var(--brand)", opacity: 0.7 }} aria-hidden="true" />
        </div>
      </motion.div>

      {/* 文案區 */}
      <motion.div
        className="space-y-2 max-w-xs"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
      >
        <h3 className="text-[17px] font-semibold text-[var(--text-primary)] text-balance">
          {copy.title}
        </h3>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed text-pretty">
          {copy.body}
        </p>
      </motion.div>

      {/* CTA 按鈕 */}
      {copy.cta && (
        <motion.div
          className="mt-8 flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <button onClick={handleClick} className="btn-primary">
            <Plus className="w-4 h-4" aria-hidden="true" />
            {copy.cta}
          </button>
          {copy.hint && (
            <span
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              {copy.hint}
            </span>
          )}
        </motion.div>
      )}
    </div>
  );
}
