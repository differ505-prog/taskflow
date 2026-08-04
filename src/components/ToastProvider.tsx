"use client";

/**
 * 全域 Toast Provider
 *
 * 位置策略：top-right（線性 / Notion 標準）
 * - 不擋 FAB、不擋任務列表底部
 * - 視線移動距離短（從卡片往右上 ≈ 15° 視角）
 * - offset 64px 避免壓在 header 上
 *
 * 主題：當前僅支援 light theme（dark mode styling 待 §13 評估是否擴大範圍）
 * style 走 CSS variable，跟隨 design token
 */

import { Toaster } from "sonner";
import type { ReactNode } from "react";

const TOAST_ICONS: Record<"success" | "error" | "warning" | "info", ReactNode> = {
  success: (
    <span className="text-emerald-500" aria-hidden="true">
      ✓
    </span>
  ),
  error: (
    <span className="text-red-500" aria-hidden="true">
      ✕
    </span>
  ),
  warning: (
    <span className="text-amber-500" aria-hidden="true">
      ⚠
    </span>
  ),
  info: (
    <span className="text-blue-500" aria-hidden="true">
      ℹ
    </span>
  ),
};

const TOAST_STYLE: React.CSSProperties = {
  background: "var(--surface-elevated)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  boxShadow: "var(--shadow-lg)",
  fontSize: "13.5px",
  padding: "12px 16px",
};

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      offset="64px"
      closeButton={false}
      theme="light"
      toastOptions={{
        style: TOAST_STYLE,
        className: "toast-shadow",
      }}
      icons={TOAST_ICONS}
    />
  );
}
