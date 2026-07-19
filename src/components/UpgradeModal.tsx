"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Lock, ArrowRight } from "lucide-react";
import type { ProFeature } from "@/lib/useFeatureGate";
import { track } from "@/lib/analytics";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 觸發這個 modal 的功能（決定說明文案） */
  feature?: ProFeature;
}

const FEATURE_COPY: Record<ProFeature, { title: string; description: string }> = {
  "custom-tag-colors": {
    title: "自訂標籤顏色",
    description: "為每個標籤挑選專屬顏色,讓任務清單一眼可辨。",
  },
  "stats-dashboard": {
    title: "統計儀表板",
    description: "深度洞察你的任務完成率、優先級分布與工作節奏。",
  },
  "tag-rename": {
    title: "關聯式標籤更新",
    description: "一鍵批次更新所有關聯任務的標籤,歷史任務與未來任務同步生效。",
  },
  "batch-operations": {
    title: "批次操作",
    description: "選取多個任務一次完成搬移、標記、刪除等操作。",
  },
  "cloud-attachments": {
    title: "雲端檔案與富文本評論",
    description: "S3 拖曳上傳附件,搭配富文本格式撰寫任務註解與協作留言。",
  },
  "ai-task-decompose": {
    title: "AI 自動任務拆解",
    description: "輸入大專案,AI 自動切分為具體可執行的子任務與時間估算。",
  },
  "karma-mode": {
    title: "Karma Mode · 心靈還債引擎",
    description: "信用血條會因拖延而扣血;完成任務累積 Karma,維持你的信用節奏。",
  },
  "domino-tasks": {
    title: "Domino Tasks · 漸進式專案解鎖",
    description: "未完成的子任務保持毛玻璃模糊,完成前置任務後自動解鎖後續步驟。",
  },
  "storage-overflow": {
    title: "加大儲存空間",
    description: "提供 ZIP 備份、大檔清理與加購空間,告別滿載焦慮。",
  },
};

/**
 * Upgrade CTA Modal
 *
 * 當 free 用戶點擊 PRO 專屬功能時彈出。
 * 設計原則（§1 Stripe 骨架）：
 * - 留白充足、單一聚焦 CTA
 * - 無實體邊框,陰影柔和
 * - 標題/內文 size 對比清晰
 * - 顏色遵循品牌色 tokens（PRO 用 #F59E0B）
 *
 * @example
 *   const gate = useFeatureGate("tag-rename");
 *   <UpgradeModal isOpen={gate.upgradeModalOpen} onClose={gate.closeUpgradeModal} feature="tag-rename" />
 */
export function UpgradeModal({ isOpen, onClose, feature }: UpgradeModalProps) {
  const copy = feature ? FEATURE_COPY[feature] : null;

  // Painted Door 埋點：modal 打開時記錄一次
  useEffect(() => {
    if (isOpen && feature) {
      track("painted_door_clicked", { feature, timestamp: Date.now() });
    }
  }, [isOpen, feature]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="upgrade-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.45)", backdropFilter: "blur(6px)" }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-modal-title"
        >
          <motion.div
            key="upgrade-modal-card"
            className="w-full max-w-sm rounded-3xl p-8 text-center"
            style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-xl)" }}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-lg hover:bg-black/5 transition-colors"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="關閉"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon */}
            <div
              className="w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(245, 158, 11, 0.12)" }}
            >
              <Lock className="w-6 h-6" style={{ color: "#F59E0B" }} aria-hidden="true" />
            </div>

            {/* PRO badge */}
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide mb-3"
              style={{ background: "rgba(245, 158, 11, 0.12)", color: "#F59E0B" }}
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              PRO 專屬
            </span>

            {/* Title */}
            <h2 id="upgrade-modal-title" className="text-[19px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              {copy?.title ?? "升級 PRO"}
            </h2>

            {/* Description */}
            <p className="text-[13.5px] leading-relaxed mb-7" style={{ color: "var(--text-secondary)" }}>
              {copy?.description ?? "解鎖所有進階功能,提升你的工作效率。"}
            </p>

            {/* Single CTA（disabled，避免虛假承諾） */}
            <button
              type="button"
              disabled
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[14px] font-medium opacity-60 cursor-not-allowed"
              style={{ background: "rgba(245, 158, 11, 0.12)", color: "#F59E0B" }}
              aria-label="升級 PRO（敬請期待）"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              升級 PRO
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <p className="mt-4 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              敬請期待 · 目前免費體驗所有現有功能
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}