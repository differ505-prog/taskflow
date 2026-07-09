"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, CheckCircle2 } from "lucide-react";
import { haptic } from "@/lib/haptics";

const ACTION_WIDTH = 80; // px, width of the revealed action strip

interface SwipeableTaskCardProps {
  children: React.ReactNode;
  onDelete: () => void;
  onComplete?: () => void;
  /** Pass true to hide the complete swipe (e.g. when task is already done) */
  hideComplete?: boolean;
}

export function SwipeableTaskCard({
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
  const currentOffsetRef = useRef(0);

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
  const handleOverlayClick = useCallback(() => {
    close();
  }, [close]);

  return (
    <div className="relative overflow-hidden rounded-2xl" ref={trackRef}>
      {/* Action strip behind the card */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: hideComplete ? ACTION_WIDTH : ACTION_WIDTH * 2 }}
      >
        {/* Complete button (rightmost, revealed first on left-swipe) */}
        {!hideComplete && onComplete && (
          <button
            className="flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold"
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
          className="flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold"
          style={{ width: ACTION_WIDTH, background: "var(--status-danger)" }}
          onClick={() => {
            haptic("medium");
            onDelete();
            close();
          }}
          aria-label="刪除任務"
        >
          <Trash2 className="w-5 h-5" />
          刪除
        </button>
      </div>

      {/* Scrim: tap anywhere outside buttons to close */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleOverlayClick}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Swipeable card */}
      <motion.div
        className="relative z-10 bg-[var(--surface)]"
        animate={{ x: offset }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
  onArchive,
  children,
}: TaskSwipeWrapperProps) {
  return (
    <SwipeableTaskCard
      onDelete={() => onDelete(taskId)}
      onComplete={isDone ? undefined : onComplete}
      hideComplete={isDone}
    >
      {children}
    </SwipeableTaskCard>
  );
}
