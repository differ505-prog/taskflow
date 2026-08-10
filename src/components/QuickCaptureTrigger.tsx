"use client";

import { Plus } from "lucide-react";

interface QuickCaptureTriggerProps {
  variant: "desktop" | "mobile";
  onClick: () => void;
}

/**
 * QuickCaptureTrigger — 雙平台共用 CTA（§5 DRY + §2 可發現性）
 *
 * 桌機 (md 以上)：品牌色 CTA，⌘K 提示預設隱藏、hover/focus 才揭示
 * 手機 (md 以下)：深色 FAB，固定底部 + iOS safe area
 *
 * 視覺對齊（§1-§4）：
 * - 桌機:bg-brand / text-white / shadow-md / hover -translate-y-0.5
 * - 過渡:transition-all duration-200 ease-out
 * - 統一 active scale-[0.98] + focus-visible:ring
 */
export function QuickCaptureTrigger({ variant, onClick }: QuickCaptureTriggerProps) {
  if (variant === "desktop") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="新增任務至收件箱"
        className="hidden items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium text-white shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:inline-flex"
        style={{
          background: "var(--brand)",
          boxShadow: "0 4px 12px -2px color-mix(in srgb, var(--brand) 25%, transparent)",
        }}
      >
        <Plus className="h-4 w-4" aria-hidden />
        <span>新增</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="捕捉靈感到收件箱"
      className="fixed left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-warm-end)] md:hidden"
      style={{
        bottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
        backgroundImage: "linear-gradient(135deg, var(--accent-warm-start), var(--accent-warm-end))",
      }}
    >
      <Plus className="h-4 w-4" aria-hidden />
      <span>捕捉靈感</span>
    </button>
  );
}