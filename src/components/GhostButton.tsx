"use client";

import { Lock, type LucideIcon } from "lucide-react";

/**
 * GhostButton — 幽靈按鈕共用視覺元件
 *
 * 用途:
 *   假門測試 (Fake Door Test) 用,點擊後觸發 ProWaitlistModal
 *
 * 4 個 featureId(對應教練任務 §假門測試 spec):
 *   - `time_bar`     : 時間感知魔法(禪模式焦點卡片)
 *   - `infinite_ai`  : 無限粉碎魔法(任務表單 AI 拆解旁)
 *   - `pro_themes`   : S 級獵人特權(設定頁外觀區)
 *   - `body_doubling`: 無聲討伐營地(Zen toolbar 右上)
 *
 * 兩種變體:
 *   - `muted`: 灰色低調,帶 Pro 鎖頭
 *   - `glowing`: 金/紫微光,搶眼,引導渴望
 *
 * 不耦合 useGhostButton hook:
 *   此元件純視覺,點擊行為由 onClick 傳入,允許在不同場景重用
 */

export type GhostButtonVariant = "muted" | "glowing";

export type GhostFeatureId =
  | "time_bar"
  | "infinite_ai"
  | "pro_themes"
  | "body_doubling";

export interface GhostButtonProps {
  /** 點擊事件(由父層傳入,通常接 useGhostButton.handleClick) */
  onClick: () => void;
  /** 變體樣式 */
  variant: GhostButtonVariant;
  /** 主圖示 (Lucide icon) */
  icon: LucideIcon;
  /** 按鈕文字 */
  children: React.ReactNode;
  /** 功能 ID(用於追蹤 + Modal 文案來源) */
  featureId?: GhostFeatureId;
  /** 是否為「已被拒絕過」的靜默狀態(只追蹤不開 modal) */
  dismissed?: boolean;
  /** 額外 className */
  className?: string;
  /** 額外 style */
  style?: React.CSSProperties;
}

export function GhostButton({
  onClick,
  variant,
  icon: Icon,
  children,
  featureId,
  dismissed = false,
  className,
  style,
}: GhostButtonProps) {
  const baseStyle: React.CSSProperties =
    variant === "glowing"
      ? {
          // 金/紫微光 — 對齊 Modal 同色系,讓用戶想起「這是 Pro」
          background:
            "linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(139, 92, 246, 0.18))",
          color: "#fbbf24",
          border: "1px solid rgba(251, 191, 36, 0.35)",
          boxShadow:
            "0 0 16px -2px rgba(139, 92, 246, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
        }
      : {
          // 灰色低調 — 像 Pro 鎖住的舊版功能
          background: "rgba(148, 163, 184, 0.08)",
          color: "#94a3b8",
          border: "1px solid rgba(148, 163, 184, 0.2)",
        };

  return (
    <button
      type="button"
      onClick={onClick}
      data-feature-id={featureId}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] ${className ?? ""}`}
      style={{ ...baseStyle, ...style }}
      aria-label={dismissed ? `${typeof children === "string" ? children : ""} (已記錄,但不重複彈窗)` : undefined}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{children}</span>
      {/* 鎖頭 — 始終可見,符合「這是 Pro 功能」的誠實標示 */}
      <Lock className="h-3 w-3 opacity-70" aria-hidden />
    </button>
  );
}
