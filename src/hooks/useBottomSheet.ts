"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useBottomSheet — 統一管理底部彈出 sheet 的展開狀態、拖曳手勢、鍵盤行為。
 *
 * Levels:
 *  - "closed": 不顯示 sheet
 *  - "default": 預設高度(70vh)
 *  - "expanded": 全螢幕(95vh)
 *
 * 拖曳行為(handle 上滑 → 下一級;下滑 → 上一級;下滑到頂 → 關閉)。
 * 設計為架構無關的 hook,不綁定 React state shape,讓 sheet 元件自行渲染對應高度。
 */
export type SheetLevel = "closed" | "default" | "expanded";

interface UseBottomSheetOptions {
  /** 預設高度佔視窗比例(0~1),預設 0.7 */
  defaultRatio?: number;
  /** 展開時高度佔視窗比例(0~1),預設 0.95 */
  expandedRatio?: number;
  /** Esc 鍵是否關閉 sheet,預設 true */
  closeOnEsc?: boolean;
  /** 拖曳 handle 引用 */
  handleRef: React.RefObject<HTMLElement | null>;
  /** sheet 容器引用(用於滑入動畫 transform origin) */
  sheetRef: React.RefObject<HTMLElement | null>;
  /** 外部控制的 level(若有) */
  level?: SheetLevel;
  /** level 變更時通知 */
  onLevelChange?: (level: SheetLevel) => void;
}

const SHEET_HEIGHT_PX_BREAKPOINT = 50; // 超過此值才算「明顯下滑可關閉」
const DRAG_THRESHOLD_RATIO = 0.25; // 拖過視窗 25% 高度 → 切下一級

export function useBottomSheet({
  defaultRatio = 0.7,
  expandedRatio = 0.95,
  closeOnEsc = true,
  handleRef,
  sheetRef,
  level: controlledLevel,
  onLevelChange,
}: UseBottomSheetOptions) {
  const [internalLevel, setInternalLevel] = useState<SheetLevel>("default");
  const isControlled = controlledLevel !== undefined;
  const level: SheetLevel = isControlled ? controlledLevel : internalLevel;

  const setLevel = useCallback(
    (next: SheetLevel) => {
      if (!isControlled) setInternalLevel(next);
      onLevelChange?.(next);
    },
    [isControlled, onLevelChange]
  );

  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Esc 鍵關閉
  useEffect(() => {
    if (level === "closed" || !closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLevel("closed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [level, closeOnEsc, setLevel]);

  // 拖曳手勢
  useEffect(() => {
    const handleEl = handleRef.current;
    if (!handleEl || level === "closed") return;

    const onTouchStart = (e: TouchEvent) => {
      dragStartY.current = e.touches[0].clientY;
      dragCurrentY.current = e.touches[0].clientY;
      setIsDragging(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (dragStartY.current === null) return;
      const delta = e.touches[0].clientY - dragStartY.current;
      dragCurrentY.current = e.touches[0].clientY;
      setDragOffset(delta);
    };

    const onTouchEnd = () => {
      const start = dragStartY.current;
      dragStartY.current = null;
      setIsDragging(false);
      if (start === null) {
        setDragOffset(0);
        return;
      }

      const delta = dragCurrentY.current - start;
      const threshold = window.innerHeight * DRAG_THRESHOLD_RATIO;

      if (delta > threshold && level === "default") {
        // 下滑超過閾值 → 關閉
        setLevel("closed");
      } else if (delta > threshold && level === "expanded") {
        // 從全螢幕下滑 → 退回 default
        setLevel("default");
      } else if (delta < -threshold && level === "default") {
        // 從 default 上滑 → 展開
        setLevel("expanded");
      }
      setDragOffset(0);
    };

    handleEl.addEventListener("touchstart", onTouchStart, { passive: true });
    handleEl.addEventListener("touchmove", onTouchMove, { passive: true });
    handleEl.addEventListener("touchend", onTouchEnd);

    return () => {
      handleEl.removeEventListener("touchstart", onTouchStart);
      handleEl.removeEventListener("touchmove", onTouchMove);
      handleEl.removeEventListener("touchend", onTouchEnd);
    };
  }, [level, handleRef, setLevel]);

  const open = useCallback(() => setLevel("default"), [setLevel]);
  const close = useCallback(() => setLevel("closed"), [setLevel]);
  const toggleExpand = useCallback(
    () => setLevel(level === "expanded" ? "default" : "expanded"),
    [level, setLevel]
  );

  const heightRatio =
    level === "expanded" ? expandedRatio : level === "default" ? defaultRatio : 0;

  return {
    level,
    open,
    close,
    toggleExpand,
    setLevel,
    heightRatio,
    dragOffset,
    isDragging,
  };
}
