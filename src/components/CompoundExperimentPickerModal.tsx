"use client";

import { useEffect } from "react";
import { Clock, Compass, Lock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Habit } from "@/lib/types";
import {
  COMPOUND_HABIT_TEMPLATES,
  canActivateCompoundExperiment,
  type CompoundHabitTemplate,
} from "@/lib/compoundHabitPlan";

interface CompoundExperimentPickerModalProps {
  /** 是否開啟 */
  open: boolean;
  /** 現有習慣（用於 1-Slot 閥門判斷） */
  habits: Habit[];
  /** 選擇一個實驗開始 */
  onStart: (template: CompoundHabitTemplate) => void;
  onClose: () => void;
}

const FREQUENCY_LABEL: Record<CompoundHabitTemplate["frequency"], string> = {
  daily: "每日",
  weekly: "每週",
  custom: "自訂",
};

export function CompoundExperimentPickerModal({
  open,
  habits,
  onStart,
  onClose,
}: CompoundExperimentPickerModalProps) {
  const { allowed, activeHabit } = canActivateCompoundExperiment(habits);

  // ESC 關閉 + 鎖定背景捲動
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0, 0, 0, 0.35)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="複利實驗挑選器"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-xl sm:rounded-xl p-5 space-y-4"
            style={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
              paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Compass className="w-5 h-5 flex-shrink-0" style={{ color: "var(--brand)" }} aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    複利實驗
                  </h2>
                  <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    一次只專注一個，選了就安心做下去
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── 1-Slot 鎖定橫幅（溫柔措辭，不責備）────────────── */}
            {!allowed && activeHabit && (
              <div
                className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px]"
                style={{
                  background: "var(--surface-hover)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
                <span className="leading-relaxed">
                  目前正在進行「{activeHabit.title}」— 一次只專注一個最有效，想切換可先封存目前實驗
                </span>
              </div>
            )}

            {/* ── 範本卡片列表 ────────────────────────────────────── */}
            <ul className="space-y-2.5">
              {COMPOUND_HABIT_TEMPLATES.map((tpl) => (
                <li
                  key={tpl.id}
                  className="rounded-xl p-3.5 space-y-2"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: tpl.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                        {tpl.title}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                        >
                          {FREQUENCY_LABEL[tpl.frequency]}
                        </span>
                        {tpl.dailyTargetMinutes > 0 && (
                          <span
                            className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ background: "var(--surface-hover)", color: "var(--text-tertiary)" }}
                          >
                            每日 {tpl.dailyTargetMinutes} 分
                          </span>
                        )}
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: "var(--surface-hover)", color: "var(--text-tertiary)" }}
                        >
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {tpl.pomodoroMinutes} 分
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {tpl.description}
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                    {tpl.discomfortHint}
                  </p>

                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => onStart(tpl)}
                      disabled={!allowed}
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-lg text-[13px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
                      aria-label={`開始實驗：${tpl.title}`}
                    >
                      開始實驗
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
