"use client";

import { useCallback, useRef, useState } from "react";

const PULL_THRESHOLD = 72; // px

interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
}

/**
 * Pull-to-Refresh 元件（僅行動版 touch 觸發）
 * 桌面用戶：此功能無效，依賴瀏覽器重新整理
 */
export function PullToRefresh({ onRefresh, children, className = "" }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      touchStartY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      // Only preventDefault once past threshold — allows native scroll below threshold
      if (delta > PULL_THRESHOLD) {
        (e as unknown as { nativeEvent: TouchEvent }).nativeEvent.preventDefault?.();
      }
      setPullDistance(Math.min(delta, PULL_THRESHOLD * 1.5));
    }
  }, [pulling]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    touchStartY.current = null;
    setPulling(false);

    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pulling, pullDistance, onRefresh]);

  const indicatorHeight = refreshing ? PULL_THRESHOLD : pullDistance;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col min-h-0 overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "pan-down", userSelect: "none" }}
    >
      {/* Pull indicator */}
      <div
        style={{
          height: indicatorHeight,
          overflow: "hidden",
          transition: refreshing ? "none" : "height 0.2s ease-out",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {pulling || refreshing ? (
          <div className="flex flex-col items-center gap-1">
            <svg
              className={`w-5 h-5 animate-spin ${refreshing ? "opacity-100" : "opacity-60"}`}
              viewBox="0 0 24 24"
              fill="none"
              style={{ color: "var(--brand, #3B82F6)", transform: pullDistance > 0 && !refreshing ? `rotate(${Math.min(180, (pullDistance / PULL_THRESHOLD) * 180)}deg)` : undefined }}
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {!refreshing && (
              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {pullDistance >= PULL_THRESHOLD ? "放開以重新整理" : "下拉重新整理"}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div style={{ transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined, transition: refreshing ? "none" : "transform 0.2s ease-out" }}>
        {children}
      </div>
    </div>
  );
}
