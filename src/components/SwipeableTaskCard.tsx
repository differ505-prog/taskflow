"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { CheckCircle2, Trash2, Archive } from "lucide-react";
import { haptic } from "@/lib/haptics";

const SWIPE_THRESHOLD = 72;
const ACTION_WIDTH = 72;

interface SwipeAction {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}

interface SwipeableTaskCardProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function SwipeableTaskCard({
  children,
  leftActions = [],
  rightActions = [],
  onSwipeLeft,
  onSwipeRight,
}: SwipeableTaskCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const clickBlockedRef = useRef(false);

  // leftActions revealed when user swipes LEFT (card moves right → reveals left side)
  // rightActions revealed when user swipes RIGHT (card moves left → reveals right side)
  const leftReveal = useTransform(x, [0, ACTION_WIDTH], [0, ACTION_WIDTH]);
  const rightReveal = useTransform(x, [0, -ACTION_WIDTH], [0, -ACTION_WIDTH]);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    const offset = info.offset.x;

    if (offset > SWIPE_THRESHOLD && onSwipeRight) {
      haptic("success");
      onSwipeRight();
    } else if (offset < -SWIPE_THRESHOLD && onSwipeLeft) {
      haptic("medium");
      onSwipeLeft();
    }

    // Block child's onClick for ~200ms after drag ends
    clickBlockedRef.current = true;
    setTimeout(() => { clickBlockedRef.current = false; }, 200);
  }, [onSwipeLeft, onSwipeRight]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    clickBlockedRef.current = true;
  }, []);

  // Block child's onClick when it bubbles up after a swipe
  const handleMotionClick = useCallback((e: React.MouseEvent) => {
    if (clickBlockedRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  return (
    <div className="relative overflow-hidden" ref={containerRef} style={{ touchAction: "pan-y" }}>
      {/* Left action strip (revealed when swiping LEFT, i.e. card moves right) */}
      {leftActions.length > 0 && (
        <motion.div
          className="absolute inset-y-0 left-0 flex items-stretch"
          style={{ width: leftActions.length * ACTION_WIDTH, x: leftReveal, zIndex: 0 }}
        >
          {leftActions.map((action, i) => (
            <button
              key={i}
              className="flex-1 flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold"
              style={{ background: action.color }}
              onClick={() => { haptic("light"); action.onClick(); }}
              aria-label={action.label}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* Right action strip (revealed when swiping RIGHT, i.e. card moves left) */}
      {rightActions.length > 0 && (
        <motion.div
          className="absolute inset-y-0 right-0 flex items-stretch"
          style={{ width: rightActions.length * ACTION_WIDTH, x: rightReveal, zIndex: 0 }}
        >
          {rightActions.map((action, i) => (
            <button
              key={i}
              className="flex-1 flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold"
              style={{ background: action.color }}
              onClick={() => { haptic("light"); action.onClick(); }}
              aria-label={action.label}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* Main card */}
      <motion.div
        className="relative z-10 bg-[var(--surface)]"
        drag="x"
        dragDirectionLock
        dragConstraints={{
          // Card can only move within the space needed to reveal action strips
          left: -(rightActions.length * ACTION_WIDTH),
          right: leftActions.length * ACTION_WIDTH,
        }}
        dragElastic={0.05}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleMotionClick}
        style={{ x, touchAction: "none" }}
        whileTap={{ cursor: "grabbing" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// Convenience wrapper — swipe LEFT = delete, swipe RIGHT = complete
interface TaskSwipeWrapperProps {
  taskId: string;
  isDone: boolean;
  onComplete: () => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  children: React.ReactNode;
}

export function TaskSwipeWrapper({ taskId, isDone, onComplete, onDelete, onArchive, children }: TaskSwipeWrapperProps) {
  // LEFT side = DELETE (red)
  const leftActions: SwipeAction[] = [
    { icon: <Trash2 className="w-5 h-5" />, label: "刪除", color: "var(--status-danger)", onClick: () => onDelete(taskId) },
  ];

  // RIGHT side = COMPLETE (green), no archive strip
  const rightActions: SwipeAction[] = isDone ? [] : [
    { icon: <CheckCircle2 className="w-5 h-5" />, label: "完成", color: "var(--status-success)", onClick: onComplete },
  ];

  return (
    <SwipeableTaskCard
      leftActions={leftActions}
      rightActions={rightActions}
      onSwipeLeft={() => onDelete(taskId)}
      onSwipeRight={isDone ? undefined : onComplete}
    >
      {children}
    </SwipeableTaskCard>
  );
}
