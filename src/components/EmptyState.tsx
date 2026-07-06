"use client";

import { motion } from "framer-motion";
import { ClipboardList, Plus } from "lucide-react";

interface EmptyStateProps {
  onAddTask: () => void;
}

export function EmptyState({ onAddTask }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      {/* 裝飾性圖示 */}
      <motion.div
        className="relative mb-8"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {/* 光暈背景 */}
        <div
          className="absolute inset-0 rounded-full blur-3xl scale-125"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)" }}
          aria-hidden="true"
        />
        {/* 圖示容器 */}
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: "var(--surface)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <ClipboardList
            className="w-7 h-7"
            style={{ color: "var(--brand)", opacity: 0.7 }}
            aria-hidden="true"
          />
        </div>
      </motion.div>

      {/* 文案區 */}
      <motion.div
        className="space-y-2 max-w-xs"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
      >
        <h3
          className="text-[17px] font-semibold text-[var(--text-primary)] text-balance"
        >
          尚無任務
        </h3>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          開始建立你的第一個任務
        </p>
      </motion.div>

      {/* CTA 按鈕 */}
      <motion.div
        className="mt-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <button
          onClick={onAddTask}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          新增任務
        </button>
      </motion.div>
    </div>
  );
}
