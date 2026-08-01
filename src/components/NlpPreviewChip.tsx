"use client";

import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface ParsedPreview {
  /** 解析出的日期 (YYYY-MM-DD) */
  dueDate?: string;
  /** 解析出的時間 (HH:mm) */
  dueTime?: string;
  /** 解析出的優先級 */
  priority?: "do-now" | "schedule" | "delegate" | "none";
  /** 解析出的標籤 */
  tags?: string[];
}

interface NlpPreviewChipProps {
  /** 解析結果（每次 title 變動時外部 debounce 跑 NLP 傳入） */
  parsed: ParsedPreview | null;
  /** 每個解析欄位是否已被使用者手動關閉 */
  dismissed: {
    dueDate: boolean;
    dueTime: boolean;
    priority: boolean;
    tags: boolean;
  };
  /** 關閉單一 chip 的 callback（外部維護 dismissed state） */
  onDismiss: (key: "dueDate" | "dueTime" | "priority" | "tags") => void;
  /** 顯示星期幾的小工具（"週三"） */
  formatRelativeDate: (iso: string) => string;
}

const PRIORITY_LABEL: Record<NonNullable<ParsedPreview["priority"]>, string> = {
  "do-now": "⚡ 速辦",
  "schedule": "📋 排程",
  "delegate": "🤝 委派",
  "none": "🌿 暫緩",
};

export function NlpPreviewChip({ parsed, dismissed, onDismiss, formatRelativeDate }: NlpPreviewChipProps) {
  if (!parsed) return null;
  const hasAny =
    (parsed.dueDate && !dismissed.dueDate) ||
    (parsed.dueTime && !dismissed.dueTime) ||
    (parsed.priority && !dismissed.priority) ||
    (parsed.tags && parsed.tags.length > 0 && !dismissed.tags);
  if (!hasAny) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="mt-2 flex flex-wrap gap-1.5"
      >
        {parsed.dueDate && !dismissed.dueDate && (
          <PreviewPill
            icon="📅"
            text={formatRelativeDate(parsed.dueDate)}
            onDismiss={() => onDismiss("dueDate")}
          />
        )}
        {parsed.dueTime && !dismissed.dueTime && (
          <PreviewPill
            icon="🕐"
            text={parsed.dueTime}
            onDismiss={() => onDismiss("dueTime")}
          />
        )}
        {parsed.priority && !dismissed.priority && (
          <PreviewPill
            icon="🎯"
            text={PRIORITY_LABEL[parsed.priority]}
            onDismiss={() => onDismiss("priority")}
          />
        )}
        {parsed.tags && parsed.tags.length > 0 && !dismissed.tags && (
          <PreviewPill
            icon="🏷️"
            text={parsed.tags.map((t) => `#${t}`).join(" ")}
            onDismiss={() => onDismiss("tags")}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function PreviewPill({ icon, text, onDismiss }: { icon: string; text: string; onDismiss: () => void }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium"
      style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
    >
      <span aria-hidden>{icon}</span>
      <span>{text}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 transition-colors"
        aria-label="關閉自動辨識"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </motion.span>
  );
}
