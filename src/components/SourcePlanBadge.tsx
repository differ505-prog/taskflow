"use client";

import { Layers } from "lucide-react";
import type { SourcePlan } from "@/lib/types";
import { getSourcePlanDisplayName } from "@/lib/sourcePlan";

/**
 * SourcePlanBadge — 任務歸屬模板的純識別徽章
 *
 * 效能防線：純展示元件，**嚴禁**在這裡讀取節奏設定 hook 或任何 context
 * （列表 N 筆任務會觸發 N 次雲端請求）。
 * 休眠狀態由呼叫端（唯一開啟的 TaskDetailPanel / RhythmSection）判定後以 props 傳入。
 *
 * §5a 流程鎖定：徽章本身不觸發任何路由跳轉，只做識別；
 * 直達管理動線由 TaskDetailPanel 的「歸屬模板」資訊卡提供。
 */

export interface SourcePlanBadgeProps {
  sourcePlan?: SourcePlan;
  /** 該模板是否目前休眠中（可選，預設 false） */
  isPaused?: boolean;
  /** 緊湊樣式（供列表列 / 日曆 / 節奏槽使用，預設 false） */
  compact?: boolean;
  className?: string;
}

export function SourcePlanBadge({
  sourcePlan,
  isPaused = false,
  compact = false,
  className = "",
}: SourcePlanBadgeProps) {
  const displayName = getSourcePlanDisplayName(sourcePlan);
  if (!displayName) return null;

  const label = isPaused ? `${displayName} · 休眠中` : displayName;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium min-w-0 ${
        compact
          ? "text-[10px] px-1.5 py-0.5 max-w-[140px]"
          : "text-[11px] px-2 py-0.5 max-w-[168px]"
      } ${className}`}
      style={
        isPaused
          ? {
              background: "var(--surface-muted)",
              color: "var(--text-tertiary)",
              border: "1px solid var(--border)",
            }
          : {
              background: "var(--brand-tint)",
              color: "var(--brand)",
              border: "1px solid color-mix(in srgb, var(--brand) 22%, transparent)",
            }
      }
      title={`歸屬模板：${displayName} · 點進任務詳情可管理或退場`}
      aria-label={isPaused ? `歸屬模板 ${displayName}，休眠中` : `歸屬模板 ${displayName}`}
    >
      <Layers
        className={compact ? "w-2.5 h-2.5 flex-shrink-0" : "w-3 h-3 flex-shrink-0"}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

export default SourcePlanBadge;
