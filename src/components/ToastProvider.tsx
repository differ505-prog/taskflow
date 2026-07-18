"use client";

/**
 * 全域 Toast Provider
 *
 * 使用 Sonner 提供一致的通知體驗。
 * 自動匯入 Toaster 元件，放在 AppLayout 根層級。
 */
import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-center"
      closeButton={false}
      toastOptions={{
        style: {
          background: "var(--surface-elevated)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "var(--shadow-lg)",
          fontSize: "13.5px",
          padding: "12px 16px",
        },
        className: "toast-shadow",
      }}
      icons={{
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
      }}
    />
  );
}
