"use client";

import { BellRing, Lock, type LucideIcon } from "lucide-react";

/**
 * GhostButton — 幽靈按鈕共用視覺元件
 *
 * 用途:
 *   假門測試 (Fake Door Test) 用,點擊後觸發 ProWaitlistModal
 *
 * 4 個 featureId(對應教練任務 §假門測試 spec):
 *   - `time_bar`     : 時間感知魔法(禪模式焦點卡片)
 *   - `infinite_ai`  : 無限粉碎魔法(任務表單 AI 拆解旁)
 *   - `pro_themes`   : Pro 版專屬功能(設定頁外觀區)
 *   - `body_doubling`: 無聲專注室(Zen toolbar 右上)
 *
 * 兩種變體:
 *   - `muted`: 灰色低調,帶 Pro 鎖頭
 *   - `glowing`: 金/紫微光,搶眼,引導渴望
 *
 * 兩種狀態:
 *   - 未訂閱:dismissed = false → 點擊開 modal(預期行為)
 *   - 已訂閱:dismissed = true → 點擊只彈 toast,徽章「已記錄」永遠 visible
 *     (避免「按鍵故障」誤判,符合 §7 防禦性 UI)
 *
 * 不耦合 useGhostButton hook:
 *   此元件純視覺,點擊行為由 onClick 傳入,允許在不同場景重用
 */

export type GhostButtonVariant = "muted" | "glowing";

export type GhostFeatureId =
  | "time_bar"
  | "infinite_ai"
  | "pro_themes"
  | "body_doubling"
  | "infinite_focus";

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
          background: dismissed
            ? // 已訂閱:降透明度,但保留「這個按鈕與眾不同」的訊號(不要灰掉到看不出是 Pro)
              "linear-gradient(135deg, rgba(251, 191, 36, 0.06), rgba(139, 92, 246, 0.10))"
            : "linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(139, 92, 246, 0.18))",
          color: dismissed ? "rgba(251, 191, 36, 0.65)" : "#fbbf24",
          border: dismissed
            ? "1px dashed rgba(251, 191, 36, 0.4)"
            : "1px solid rgba(251, 191, 36, 0.35)",
          boxShadow: dismissed
            ? "none"
            : "0 0 16px -2px rgba(139, 92, 246, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
        }
      : {
          // 灰色低調 — 像 Pro 鎖住的舊版功能，極度淡化避免干擾
          background: dismissed
            ? "transparent"
            : "rgba(148, 163, 184, 0.04)",
          color: dismissed ? "rgba(148, 163, 184, 0.5)" : "rgba(148, 163, 184, 0.8)", // slate-400 with opacity
          border: dismissed
            ? "1px dashed rgba(148, 163, 184, 0.2)"
            : "1px solid rgba(148, 163, 184, 0.15)",
        };

  return (
    <button
      type="button"
      onClick={onClick}
      data-feature-id={featureId}
      data-dismissed={dismissed ? "true" : "false"}
      title={dismissed ? "已加入提醒 — 1 週內不再彈窗(此為尚未推出的 Pro 功能)" : undefined}
      className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] ${className ?? ""}`}
      style={{ ...baseStyle, ...style }}
      aria-label={
        dismissed
          ? `${typeof children === "string" ? children : ""} (已加入提醒,此為尚未推出的 Pro 功能)`
          : undefined
      }
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{children}</span>
      {/* 已訂閱狀態 → 顯示「已記錄」徽章(取代鎖頭);保留 Pro 暗示 */}
      {dismissed ? (
        <BellRing
          className="h-3 w-3 opacity-80"
          aria-hidden
          data-testid="ghost-button-subscribed-badge"
        />
      ) : (
        <Lock className="h-3 w-3 opacity-70" aria-hidden />
      )}
    </button>
  );
}
