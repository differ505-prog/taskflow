"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NotebookPen, X } from "lucide-react";
import type { ReflectionFields } from "@/lib/compoundHabitPlan";

interface WrapUpReflectionSheetProps {
  /** 是否開啟 */
  open: boolean;
  /** 目標習慣標題（用於文案） */
  habitTitle: string;
  /** 關閉（不儲存） */
  onDismiss: () => void;
  /** 送出復盤欄位內容 */
  onSubmit: (fields: ReflectionFields) => void;
}

const EMPTY_FIELDS: ReflectionFields = {
  decision: "",
  outcome: "",
  nextStep: "",
  hardTruth: "",
};

/**
 * 下班閥門接棒 — 30 秒睡前復盤
 *
 * 設計意圖（ADHD 友善）：
 *   - 可選、可一鍵關閉，永遠不打斷休息
 *   - 拆成 4 個小欄位，降低「空白頁」壓力
 *   - 不出現「跳過可惜」等責備語氣
 */
export function WrapUpReflectionSheet({
  open,
  habitTitle,
  onDismiss,
  onSubmit,
}: WrapUpReflectionSheetProps) {
  const [fields, setFields] = useState<ReflectionFields>(EMPTY_FIELDS);

  // 每次開啟都清空草稿（避免上一輪內容殘留）
  useEffect(() => {
    if (open) setFields(EMPTY_FIELDS);
  }, [open]);

  // ESC 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  const hasContent = Object.values(fields).some((v) => v.trim());

  const handleSubmit = () => {
    onSubmit(fields);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-end justify-center p-0"
          style={{ background: "rgba(0, 0, 0, 0.35)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onDismiss();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="睡前復盤"
        >
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full sm:max-w-md rounded-t-xl p-5 space-y-4 max-h-[88vh] overflow-y-auto"
            style={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              borderBottom: "none",
              boxShadow: "var(--shadow-lg)",
              paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <NotebookPen className="w-5 h-5 flex-shrink-0" style={{ color: "var(--brand)" }} aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    睡前 30 秒復盤
                  </h2>
                  <p className="text-[12px] truncate" style={{ color: "var(--text-tertiary)" }}>
                    {habitTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="flex-shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              今天想收個尾的話，寫一點就好。不想寫也沒關係 — 先休息。
            </p>

            {/* ── 4 個微型欄位 ─────────────────────────────────────── */}
            <div className="space-y-2.5">
              <Field
                label="決定"
                placeholder="今天做了什麼決定？"
                value={fields.decision}
                onChange={(v) => setFields((f) => ({ ...f, decision: v }))}
              />
              <Field
                label="結果"
                placeholder="發生了什麼？"
                value={fields.outcome}
                onChange={(v) => setFields((f) => ({ ...f, outcome: v }))}
              />
              <Field
                label="下次"
                placeholder="下次怎麼改？"
                value={fields.nextStep}
                onChange={(v) => setFields((f) => ({ ...f, nextStep: v }))}
              />
              <Field
                label="真話"
                placeholder="一句對自己誠實的話（可留空）"
                value={fields.hardTruth ?? ""}
                onChange={(v) => setFields((f) => ({ ...f, hardTruth: v }))}
                optional
              />
            </div>

            {/* ── 動作 ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg text-[13px] font-medium transition-colors hover:bg-[var(--hover-bg)]"
                style={{ color: "var(--text-tertiary)" }}
              >
                先休息
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!hasContent}
                className="inline-flex flex-1 items-center justify-center min-h-[44px] px-4 rounded-lg text-[13px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
              >
                存進今日復盤
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  optional,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[11px] font-medium mb-1" style={{ color: "var(--text-tertiary)" }}>
        {label}
        {optional && <span style={{ opacity: 0.7 }}>· 選填</span>}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none rounded-lg border bg-[var(--surface)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--brand)] transition-colors"
        style={{
          color: "var(--text-primary)",
          borderColor: "var(--border)",
        }}
        aria-label={label}
      />
    </label>
  );
}
