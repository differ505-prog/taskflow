"use client";

import { useRef, useState, useCallback, useEffect } from "react";
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
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  // Block child onClick fires after a drag ends (prevents tap-while-dragging bug)
  const clickBlockedRef = useRef(false);

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

    // Block any child onClick that fires within ~200ms of drag-end
    clickBlockedRef.current = true;
    setTimeout(() => { clickBlockedRef.current = false; }, 200);
  }, [onSwipeLeft, onSwipeRight]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    clickBlockedRef.current = true;
  }, []);

  // Intercept child's onClick to prevent it from firing when user was swiping
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (clickBlockedRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* Left action strip */}
      {leftActions.length > 0 && (
        <motion.div
          className="absolute inset-y-0 left-0 flex items-stretch"
          style={{ width: ACTION_WIDTH, x: leftReveal, zIndex: 0 }}
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

      {/* Right action strip */}
      {rightActions.length > 0 && (
        <motion.div
          className="absolute inset-y-0 right-0 flex items-stretch"
          style={{ width: ACTION_WIDTH, x: rightReveal, zIndex: 0 }}
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

      {/* Main card — click-block overlay prevents child's onClick after swipe */}
      <div ref={cardRef} onClick={handleCardClick}>
        <motion.div
          className="relative z-10 bg-[var(--surface)]"
          drag={isDragging ? "x" : false}
          dragDirectionLock
          dragConstraints={{ left: -(rightActions.length * ACTION_WIDTH), right: leftActions.length * ACTION_WIDTH }}
          dragElastic={0.1}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          style={{ x }}
          whileTap={{ cursor: "grabbing" }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

// Convenience wrapper with typical task actions pre-wired
interface TaskSwipeWrapperProps {
  taskId: string;
  isDone: boolean;
  onComplete: () => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  children: React.ReactNode;
}

export function TaskSwipeWrapper({ taskId, isDone, onComplete, onDelete, onArchive, children }: TaskSwipeWrapperProps) {
  const leftActions: SwipeAction[] = isDone ? [] : [
    {
      icon: <CheckCircle2 className="w-5 h-5" />,
      label: "完成",
      color: "var(--status-success)",
      onClick: onComplete,
    },
  ];

  const rightActions: SwipeAction[] = onArchive
    ? [
        { icon: <Archive className="w-5 h-5" />, label: "封存", color: "var(--text-tertiary)", onClick: () => onArchive(taskId) },
        { icon: <Trash2 className="w-5 h-5" />, label: "刪除", color: "var(--status-danger)", onClick: () => onDelete(taskId) },
      ]
    : [
        { icon: <Trash2 className="w-5 h-5" />, label: "刪除", color: "var(--status-danger)", onClick: () => onDelete(taskId) },
      ];

  return (
    <SwipeableTaskCard
      leftActions={leftActions}
      rightActions={rightActions}
      onSwipeRight={isDone ? undefined : onComplete}
      onSwipeLeft={() => onDelete(taskId)}
    >
      {children}
    </SwipeableTaskCard>
  );
}
