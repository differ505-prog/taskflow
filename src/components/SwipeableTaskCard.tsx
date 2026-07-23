"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, CheckCircle2 } from "lucide-react";
import { haptic } from "@/lib/haptics";

const ACTION_WIDTH = 80; // px, width of the revealed action strip

interface SwipeableTaskCardProps {
  children: React.ReactNode;
  /** Task id forwarded to onDelete (required so the parent can identify which task to remove). */
  taskId: string;
  onDelete: (id: string) => void;
  onComplete?: () => void;
  /** Pass true to hide the complete swipe (e.g. when task is already done) */
  hideComplete?: boolean;
}

export function SwipeableTaskCard({
  taskId,
  children,
  onDelete,
  onComplete,
  hideComplete = false,
}: SwipeableTaskCardProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Track offset: negative = card shifted left, reveals right-side actions
  const [offset, setOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentOffsetRef = useRef(0);
  // 方向鎖定：null=未定,true=水平意圖,false=垂直意圖（鎖定後不再更新）
  // 前 12px 移動內決定意圖,避免「上下滑偏一點」被當左滑
  const directionLockedRef = useRef<boolean | null>(null);
  const isProcessingRef = useRef(false); // 防止重複點擊

  const close = useCallback(() => {
    setOffset(0);
    currentOffsetRef.current = 0;
    setIsOpen(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    directionLockedRef.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - startXRef.current;
    const dy = touch.clientY - startYRef.current;
    const max = hideComplete ? ACTION_WIDTH : ACTION_WIDTH * 2;

    // 方向鎖定：前 12px 內決定意圖（§E2：修「上下滑偏一下就觸發左滑」）
    if (directionLockedRef.current === null) {
      const totalMoved = Math.abs(dx) + Math.abs(dy);
      if (totalMoved > 12) {
        // |dy| > |dx| * 1.5 = 明確垂直意圖（容忍垂直滾動）,不允許 swipe
        directionLockedRef.current = Math.abs(dy) > Math.abs(dx) * 1.5 ? false : true;
      } else {
        return; // 未達決定門檻,先不動
      }
    }
    if (directionLockedRef.current === false) return; // 已鎖為垂直,不累積 offset

    // Swipe left (dx < 0) reveals actions; swipe right closes
    const next = Math.min(0, Math.max(-max, currentOffsetRef.current + dx));
    setOffset(next);
  }, [hideComplete]);

  const handleTouchEnd = useCallback(() => {
    if (isProcessingRef.current) return; // 防止重複處理
    isProcessingRef.current = true;
    setTimeout(() => { isProcessingRef.current = false; }, 300);

    // 方向未定（使用者只上下滑未達 12px）→ 視為關閉
    if (directionLockedRef.current !== true) { close(); return; }

    const max = hideComplete ? ACTION_WIDTH : ACTION_WIDTH * 2;

    if (offset < -max / 2) {
      // Snap fully open
      setOffset(-max);
      currentOffsetRef.current = -max;
      setIsOpen(true);
    } else if (offset < -30) {
      // Partial open — snap to max (門檻從 10px → 30px,避免 dy 干擾下誤觸)
      setOffset(-max);
      currentOffsetRef.current = -max;
      setIsOpen(true);
    } else {
      // Snap closed
      close();
    }
  }, [offset, hideComplete, close]);

  // Tap scrim / outside closes the strip
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 防止冒泡
    close();
  }, [close]);

  return (
    <div className="relative overflow-hidden rounded-2xl min-h-[60px]" ref={trackRef}>
      {/* Action strip behind the card */}
      <div
        className="absolute inset-y-0 right-0 z-10 flex items-stretch"
        style={{ width: hideComplete ? ACTION_WIDTH : ACTION_WIDTH * 2 }}
      >
        {/* Complete button (rightmost, revealed first on left-swipe) */}
        {!hideComplete && onComplete && (
          <button
            className="relative z-40 flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold"
            style={{ width: ACTION_WIDTH, background: "var(--status-success)" }}
            onClick={() => {
              haptic("light");
              onComplete();
              close();
            }}
            aria-label="完成任務"
          >
            <CheckCircle2 className="w-5 h-5" />
            完成
          </button>
        )}
        {/* Delete button (always present, rightmost) */}
        <button
          className="relative z-40 flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold"
          style={{ width: ACTION_WIDTH, background: "var(--status-danger)" }}
          onClick={() => {
            haptic("medium");
            onDelete(taskId);
            close();
          }}
          aria-label="刪除任務"
        >
          <Trash2 className="w-5 h-5" />
          刪除
        </button>
      </div>

      {/* Scrim: tap anywhere outside buttons to close — pointer-events-none lets clicks pass through */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute inset-0 z-30 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleOverlayClick}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Swipeable card — captures clicks to close when scrim is open */}
      <motion.div
        className="relative z-20 bg-[var(--surface)] h-full min-h-[60px]"
        animate={{ x: offset }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (isOpen) {
            e.stopPropagation(); // 防止冒泡到卡片点击
            close();
          }
        }}
        style={{ width: "100%", touchAction: "pan-y" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// Convenience wrapper for task lists
interface TaskSwipeWrapperProps {
  taskId: string;
  isDone: boolean;
  onComplete: () => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  children: React.ReactNode;
}

export function TaskSwipeWrapper({
  taskId,
  isDone,
  onComplete,
  onDelete,
  onArchive: _onArchive,
  children,
}: TaskSwipeWrapperProps) {
  return (
    <SwipeableTaskCard
      taskId={taskId}
      onDelete={onDelete}
      onComplete={isDone ? undefined : onComplete}
      hideComplete={isDone}
    >
      {children}
    </SwipeableTaskCard>
  );
}
