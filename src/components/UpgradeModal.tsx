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
  "advanced-tags": {
    title: "進階標籤管理後台",
    description: "解鎖「標籤管理模組」。全域重新命名、自訂 HEX 顏色、查看任務計數統計與合併標籤。讓整理強迫症患者心甘情願買單。",
  },
  "stats-dashboard": {
    title: "統計儀表板",
    description: "深度洞察你的任務完成率、優先級分布與工作節奏。",
  },
  "cloud-attachments": {
    title: "雲端檔案與富文本評論",
    description: "S3 / Supabase Storage 拖曳上傳附件，搭配富文本編輯器撰寫任務備註與協作留言。",
  },
  "storage-cleaner": {
    title: "空間清理器",
    description: "列出大檔案供一鍵刪除，釋放儲存空間。",
  },
  "zip-backup": {
    title: "ZIP 輕量備份",
    description: "打包舊專案為 ZIP 下載回本機，隨時隨地掌握你的資料主權。",
  },
  "storage-expansion": {
    title: "加大儲存空間",
    description: "+10GB 額外空間，告別滿載焦慮，讓你盡情保存所有重要檔案。",
  },
  "karma-mode": {
    title: "心靈還債引擎 · Karma Mode",
    description: "結合記帳概念，設定虧損與渴望獎勵，靠打勾好習慣填平赤字。信用血條會因拖延而扣血，完成任務累積 Karma。",
  },
  "domino-tasks": {
    title: "漸進式專案解鎖模組 · Task Dependency",
    description: "前置任務打勾，後置任務動態解鎖彈出。蔡加尼克效應驅動你完成每一個環節。",
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