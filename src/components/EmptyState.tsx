"use client";

import { motion } from "framer-motion";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  InboxIllustration,
  TodayIllustration,
  AllIllustration,
  HabitsIllustration,
  TagsIllustration,
  StatsIllustration,
  GeneralIllustration,
  ZenIllustration,
} from "@/illustrations/EmptyStateIllustrations";

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
  { title: string; body: string; cta: string | null; hint?: string; Illustration: React.ComponentType<{ className?: string }> }
> = {
  general: {
    title: "建立第一個任務",
    body: "把腦中浮現的事寫下來,從一個開始。",
    cta: "建立一個任務",
    Illustration: GeneralIllustration,
  },
  inbox: {
    title: "腦中先倒乾淨",
    body: "把現在想到的所有事快速記下來,之後再統一分類、安排優先順序。",
    cta: "倒一筆進來",
    hint: "支援自然語言：「明天下午3點 #工作 p1」",
    Illustration: InboxIllustration,
  },
  today: {
    title: "今天還沒有任務",
    body: "從收集箱挑一個過來,或是心血來潮寫一個。",
    cta: "挑一個過來",
    Illustration: TodayIllustration,
  },
  zen: {
    title: "戰場很安靜",
    body: "慢呼吸一下,沒有任務在催你。",
    cta: null,
    Illustration: ZenIllustration,
  },
  all: {
    title: "你的任務從這裡開始",
    body: "建立一個任務,或先打開收集箱接住腦中浮現的念頭。",
    cta: "建立一個任務",
    Illustration: AllIllustration,
  },
  habits: {
    title: "從一個小習慣開始",
    body: "暖身區的「喝一口水」就是從這裡建的 — 最短的開始,最長的堅持。",
    cta: "建立第一個習慣",
    Illustration: HabitsIllustration,
  },
  tags: {
    title: "整理一下任務的方式",
    body: "為相似的任務分類,之後查詢更快。",
    cta: "建立第一個標籤",
    Illustration: TagsIllustration,
  },
  stats: {
    title: "等你完成一些任務",
    body: "完成第一個任務後,這裡會幫你記錄節奏與軌跡。",
    cta: null,
    Illustration: StatsIllustration,
  },
};

export function EmptyState({
  onAddTask,
  onAddHabit,
  onCreateTag,
  variant = "general",
}: EmptyStateProps) {
  const copy = COPY[variant];
  const Illustration = copy.Illustration;

  const handleClick = () => {
    if (variant === "habits") onAddHabit?.();
    else if (variant === "tags") onCreateTag?.();
    else onAddTask?.();
  };

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      {/* 插圖區 */}
      <motion.div
        className="relative mb-8"
        initial={{ opacity: 0, scale: 0.85, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {/* 外圈光暈 */}
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            background: "radial-gradient(circle, rgba(var(--brand-rgb, 79 106 245), 0.10) 0%, transparent 70%)",
            transform: "scale(1.8)",
            filter: "blur(14px)",
          }}
          aria-hidden="true"
        />
        {/* 插圖本體 */}
        <div className="relative w-28 h-28">
          <Illustration className="w-full h-full" />
        </div>
      </motion.div>

      {/* 文案區 */}
      <motion.div
        className="space-y-2 max-w-xs"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <Button
            onClick={handleClick}
            aria-label={copy.cta}
            className="group"
            icon={<Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" aria-hidden="true" />}
          >
            {copy.cta}
          </Button>
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
