"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface IconPopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
  className?: string;
  /** 受控模式：傳入後由外部決定開關狀態（未傳則沿用內部 state，向後相容） */
  open?: boolean;
  /** 開關狀態變更回呼（受控模式下必傳） */
  onOpenChange?: (open: boolean) => void;
  /** 為 true 時點擊 trigger 只阻斷冒泡、不開啟 Popover */
  disabled?: boolean;
}

/**
 * 輕量級 Popover（點擊觸發、自動偵測靠左/靠右對齊避免溢出）
 *
 * 不依賴任何 popover 函式庫，使用 framer-motion + AnimatePresence。
 */
export function IconPopover({
  trigger,
  children,
  align = "end",
  side = "bottom",
  className = "",
  open: controlledOpen,
  onOpenChange,
  disabled = false,
}: IconPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 受控模式：外部傳入 open 時以外部為準；否則用內部 state
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  /** 統一的開關寫入器：受控模式通知外部，未受控模式更新內部 state */
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div ref={wrapperRef} className={`relative inline-flex ${className}`}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setOpen(!open);
        }}
        className="inline-flex"
      >
        {trigger}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: side === "top" ? 4 : -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: side === "top" ? 4 : -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className={`absolute z-30 min-w-[180px] ${
              side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
            } ${
              align === "end" ? "right-0" : "left-0"
            } rounded-2xl overflow-hidden`}
            style={{
              background: "var(--surface-elevated)",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
