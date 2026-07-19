"use client";

/**
 * ProGhostButton — 幽靈按鈕共用元件
 *
 * 用途：在 UI 表面放置「看得到但不能直接用」的 Pro 功能按鈕，
 * 免費用戶點擊 → 跳出 UpgradeModal + 自動觸發 painted_door_clicked 事件。
 *
 * 設計原則（§5 DRY + §25 對齊）：
 * - 統一封裝 useFeatureGate + 點擊追蹤
 * - 6 個 Pro 功能呼叫端只需傳 feature + children，不用各自寫 modal state
 * - 視覺採用 Lock 圖示 + subtle gradient（不搶眼，符合 §3 色彩紀律）
 *
 * @example
 *   <ProGhostButton feature="cloud-attachments" variant="icon" label="附件" />
 *   <ProGhostButton feature="ai-task-decompose" variant="cta">
 *     ✨ AI 拆解
 *   </ProGhostButton>
 */

import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useFeatureGate } from "@/lib/useFeatureGate";
import { UpgradeModal } from "@/components/UpgradeModal";

type ProGhostVariant = "icon" | "cta" | "inline" | "card";

interface ProGhostButtonProps {
  feature: Parameters<typeof useFeatureGate>[0];
  /** 按鈕內容（icon variant 不需填，自動用 Lock） */
  children?: ReactNode;
  variant?: ProGhostVariant;
  /** icon variant 的 aria-label */
  label?: string;
  /** 額外 className */
  className?: string;
  /** 額外 tooltip（會覆蓋預設的 PRO 專屬描述） */
  title?: string;
  /** 按鈕 disabled（不只是 free 鎖定，業務上也許要 disable） */
  disabled?: boolean;
}

const variantStyles: Record<ProGhostVariant, string> = {
  icon:
    "p-2 rounded-xl transition-all duration-150 disabled:opacity-40 enabled:hover:bg-black/5",
  cta:
    "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]",
  inline:
    "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium transition-colors",
  card:
    "card px-4 py-3 flex items-center gap-3 cursor-pointer transition-all duration-200 hover:scale-[1.01]",
};

const variantColors: Record<ProGhostVariant, React.CSSProperties> = {
  icon: { color: "var(--text-tertiary)" },
  cta: { background: "var(--surface-muted)", color: "var(--text-secondary)" },
  inline: { background: "var(--surface-muted)", color: "var(--text-secondary)" },
  card: {},
};

export function ProGhostButton({
  feature,
  children,
  variant = "icon",
  label,
  className = "",
  title,
  disabled,
}: ProGhostButtonProps) {
  const gate = useFeatureGate(feature);
  const isLocked = gate.locked || disabled;

  const handleClick = () => {
    gate.requestUnlock();
  };

  const tooltipText =
    title ?? (isLocked ? `${feature} · PRO 專屬` : feature);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLocked}
        title={tooltipText}
        aria-label={label ?? tooltipText}
        className={`${variantStyles[variant]} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        style={variantColors[variant]}
      >
        {variant === "icon" ? (
          <Lock className="w-4 h-4" aria-hidden="true" />
        ) : (
          <>
            <Lock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            {children}
          </>
        )}
      </button>
      <UpgradeModal
        isOpen={gate.upgradeModalOpen}
        onClose={gate.closeUpgradeModal}
        feature={feature}
      />
    </>
  );
}
