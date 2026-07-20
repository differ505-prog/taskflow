"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Info } from "lucide-react";

export type ConfirmTone = "danger" | "warning" | "info";

export interface ConfirmOptions {
  title: string;
  message: string;
  impactDetail?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
}

interface ConfirmDialogProps extends ConfirmOptions {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  impactDetail,
  confirmText = "確認",
  cancelText = "取消",
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  // 開啟時：capture active element、focus confirm 按鈕、鎖滾動、ESC 監聽
  useEffect(() => {
    if (!isOpen) return;

    previousActiveRef.current = document.activeElement as HTMLElement | null;

    requestAnimationFrame(() => {
      confirmBtnRef.current?.focus();
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveRef.current?.focus?.();
    };
  }, [isOpen, onCancel]);

  const toneMeta: Record<ConfirmTone, { icon: typeof AlertTriangle; ring: string; bg: string; text: string; btn: string }> = {
    danger: {
      icon: AlertTriangle,
      ring: "var(--status-danger)",
      bg: "bg-red-50 dark:bg-red-500/10",
      text: "text-red-600 dark:text-red-400",
      btn: "bg-[var(--status-danger)] hover:opacity-90 text-white",
    },
    warning: {
      icon: AlertTriangle,
      ring: "var(--status-warning)",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-400",
      btn: "bg-[var(--status-warning)] hover:opacity-90 text-white",
    },
    info: {
      icon: Info,
      ring: "var(--brand)",
      bg: "bg-blue-50 dark:bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-400",
      btn: "bg-[var(--brand)] hover:opacity-90 text-white",
    },
  };
  const meta = toneMeta[tone];
  const Icon = meta.icon;

  const titleId = "confirm-dialog-title";
  const descId = "confirm-dialog-desc";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCancel();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-start gap-3 p-5 pb-3">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${meta.bg}`}
              >
                <Icon className={`w-5 h-5 ${meta.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id={titleId}
                  className="text-[15px] font-semibold leading-snug"
                  style={{ color: "var(--text-primary)" }}
                >
                  {title}
                </h2>
                <p
                  id={descId}
                  className="mt-1.5 text-[13px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {message}
                </p>
                {impactDetail && (
                  <div
                    className="mt-3 px-3 py-2 rounded-lg text-[12px] font-medium"
                    style={{
                      background: "var(--surface-muted)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {impactDetail}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                style={{ color: "var(--text-secondary)" }}
              >
                {cancelText}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${meta.btn} focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none`}
                style={
                  {
                    "--tw-ring-color": meta.ring,
                  } as React.CSSProperties
                }
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}