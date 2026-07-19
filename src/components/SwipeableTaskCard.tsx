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
  const [offset, setOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  // 按鈕反饋動畫：觸發短暫脈衝（模擬 iOS 無 vibrate 時的震動感）
  const [pulseKey, setPulseKey] = useState(0);
  const startXRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const isProcessingRef = useRef(false);

  const close = useCallback(() => {
    setOffset(0);
    currentOffsetRef.current = 0;
    setIsOpen(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startXRef.current;
    const max = hideComplete ? ACTION_WIDTH : ACTION_WIDTH * 2;

    // Swipe left (delta < 0) reveals actions; swipe right closes
    const next = Math.min(0, Math.max(-max, currentOffsetRef.current + delta));
    setOffset(next);
  }, [hideComplete]);

  const handleTouchEnd = useCallback(() => {
    if (isProcessingRef.current) return; // 防止重複處理
    isProcessingRef.current = true;
    setTimeout(() => { isProcessingRef.current = false; }, 300);

    const max = hideComplete ? ACTION_WIDTH : ACTION_WIDTH * 2;

    if (offset < -max / 2) {
      // Snap fully open
      setOffset(-max);
      currentOffsetRef.current = -max;
      setIsOpen(true);
    } else if (offset < -10) {
      // Partial open — snap to max
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
    <div className="relative overflow-hidden rounded-2xl" ref={trackRef}>
      {/* Action strip behind the card */}
      <div
        className="absolute inset-y-0 right-0 z-10 flex items-stretch"
        style={{ width: hideComplete ? ACTION_WIDTH : ACTION_WIDTH * 2 }}
      >
        {/* Complete button (rightmost, revealed first on left-swipe) */}
        {!hideComplete && onComplete && (
          <motion.button
            key={`complete-${pulseKey}`}
            className="relative z-40 flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold"
            style={{ width: ACTION_WIDTH, background: "var(--status-success)" }}
            whileTap={{ scale: 0.9 }}
            animate={pulseKey > 0 ? { scale: [1, 1.15, 1] } : { scale: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => {
              e.stopPropagation();
              isProcessingRef.current = true;
              // iOS 無 navigator.vibrate：用脈衝動畫模擬震動回饋
              setPulseKey((k) => k + 1);
              haptic("light");
              // 延遲 close 等 spring 動畫完成，避免按鈕被滑動中卡片遮住
              setTimeout(() => {
                onComplete();
                close();
                setTimeout(() => { isProcessingRef.current = false; }, 50);
              }, 200);
            }}
            aria-label="完成任務"
          >
            <CheckCircle2 className="w-5 h-5" />
            完成
          </motion.button>
        )}
        {/* Delete button (always present, rightmost) */}
        <motion.button
          key={`delete-${pulseKey}`}
          className="relative z-40 flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold"
          style={{ width: ACTION_WIDTH, background: "var(--status-danger)" }}
          whileTap={{ scale: 0.9 }}
          animate={pulseKey > 0 ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={(e) => {
            e.stopPropagation();
            isProcessingRef.current = true;
            // iOS 無 navigator.vibrate：用較強脈衝模擬震動回饋
            setPulseKey((k) => k + 1);
            haptic("medium");
            // 卡片閃白反饋（替代震動）
            if (trackRef.current) {
              trackRef.current.animate(
                [
                  { boxShadow: "inset 0 0 0 2px rgba(239, 68, 68, 0.6)" },
                  { boxShadow: "inset 0 0 0 0px rgba(239, 68, 68, 0)" },
                ],
                { duration: 250, easing: "ease-out" }
              );
            }
            // 延遲 close 等 spring 動畫完成，按鈕動畫先完成再收合
            setTimeout(() => {
              onDelete(taskId);
              close();
              setTimeout(() => { isProcessingRef.current = false; }, 50);
            }, 220);
          }}
          aria-label="刪除任務"
        >
          <Trash2 className="w-5 h-5" />
          刪除
        </motion.button>
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
        className="relative z-20 bg-[var(--surface)]"
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
