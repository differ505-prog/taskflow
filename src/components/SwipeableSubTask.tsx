"use client";

import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Trash2, CheckCircle2, Circle } from "lucide-react";
import { SubTask } from "@/lib/types";
import { TextWithLinks } from "./TextWithLinks";

const ACTION_WIDTH = 72; // px per action

interface SwipeableSubTaskProps {
  sub: SubTask;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onEditCommit: (title: string) => void;
  onDelete: () => void;
}

export function SwipeableSubTask({
  sub,
  isEditing,
  onToggle,
  onEdit,
  onEditCommit,
  onDelete,
}: SwipeableSubTaskProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
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
    const max = ACTION_WIDTH;
    const next = Math.min(0, Math.max(-max, currentOffsetRef.current + delta));
    setOffset(next);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setTimeout(() => { isProcessingRef.current = false; }, 300);

    if (offset < -ACTION_WIDTH / 2) {
      setOffset(-ACTION_WIDTH);
      currentOffsetRef.current = -ACTION_WIDTH;
      setIsOpen(true);
    } else {
      close();
    }
  }, [offset, close]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    close();
  }, [close]);

  return (
    <div className="relative overflow-hidden rounded-xl" ref={trackRef}>
      {/* Delete strip behind */}
      <div
        className="absolute inset-y-0 right-0 z-10 flex items-center justify-end"
        style={{ width: ACTION_WIDTH }}
      >
        <button
          className="relative z-40 flex flex-col items-center justify-center gap-0.5 text-white text-[10px] font-semibold h-full w-full"
          style={{ background: "var(--status-danger)" }}
          onClick={() => {
            onDelete();
            close();
          }}
          aria-label="刪除子任務"
        >
          <Trash2 className="w-4 h-4" />
          刪除
        </button>
      </div>

      {/* Scrim */}
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Swipeable row */}
      <motion.div
        className="relative z-20 flex items-center gap-2 py-1.5 px-1"
        animate={{ x: offset }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (isOpen) {
            e.stopPropagation();
            close();
          }
        }}
        style={{ width: "100%", touchAction: "pan-y", background: "transparent", pointerEvents: isOpen ? "auto" : "none" }}
      >
        {/* Checkbox */}
        <label className="flex-shrink-0 w-7 h-7 -m-1 flex items-center justify-center rounded-full cursor-pointer transition-transform [@media(hover:hover)]:hover:scale-110">
          <input
            type="checkbox"
            checked={sub.status === "done"}
            onChange={onToggle}
            className="sr-only"
            aria-label={sub.status === "done" ? "標記未完成" : "標記完成"}
          />
          {sub.status === "done" ? (
            <CheckCircle2 className="w-[18px] h-[18px] text-[var(--status-success)]" />
          ) : (
            <Circle className="w-[18px] h-[18px] text-[var(--text-tertiary)]" />
          )}
        </label>

        {/* Title */}
        {isEditing ? (
          <input
            autoFocus
            type="text"
            defaultValue={sub.title}
            onBlur={(e) => onEditCommit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
              if (e.key === "Escape") { onEditCommit(sub.title); }
            }}
            className="flex-1 text-[13px] bg-white/60 rounded px-1.5 py-0.5 outline-none border border-[var(--brand)]/40 focus:border-[var(--brand)]"
            style={{ color: "var(--text-primary)" }}
            aria-label="編輯子任務"
          />
        ) : (
          <span
            onClick={onEdit}
            className={`flex-1 min-w-0 text-[13px] cursor-text rounded px-1 -mx-1 break-words ${sub.status === "done" ? "line-through opacity-50" : ""}`}
            style={{ color: sub.status === "done" ? "var(--text-tertiary)" : "var(--text-primary)", wordBreak: "break-word", overflowWrap: "anywhere" }}
            title="點擊編輯"
          >
            <TextWithLinks
              text={sub.title}
              linkStyle={{
                color: "var(--brand)",
                textDecoration: "underline",
                pointerEvents: "auto",
              }}
            />
          </span>
        )}
      </motion.div>
    </div>
  );
}
