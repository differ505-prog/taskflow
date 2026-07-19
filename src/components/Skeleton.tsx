"use client";

import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  /** 預設 "skeleton"(淺色);深色背景下用 "skeleton-dark" */
  variant?: "default" | "dark";
  /** 是否加上輕微呼吸動畫(預設關閉,符合 §4 不超過 300ms 原則) */
  pulse?: boolean;
}

/**
 * 通用骨架屏基礎元件
 *
 * 設計原則（§L0）：
 * - 不發明新 keyframes,沿用 globals.css 既有 .skeleton / .skeleton-dark + skeleton-shimmer 動畫
 * - className 自由組合尺寸,符合 §13 最小變更
 * - pulse 為選填,預設關閉避免與既有 §4 微互動 200ms 規範衝突
 */
export function Skeleton({ className = "", variant = "default", pulse = false }: SkeletonProps) {
  const base = variant === "dark" ? "skeleton-dark" : "skeleton";
  if (pulse) {
    return (
      <motion.div
        animate={{ opacity: [1, 0.6, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className={`${base} ${className}`}
        aria-hidden="true"
      />
    );
  }
  return <div className={`${base} ${className}`} aria-hidden="true" />;
}

/**
 * AppShell 主框架骨架(左側 sidebar + 主列表 + 右側詳情面板)
 * 取代原本 AppContext 在 isLoaded 之前的 return null,避免整頁空白
 */
export function AppShellSkeleton() {
  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--background)" }}
      role="status"
      aria-label="載入中"
    >
      {/* Sidebar */}
      <aside className="w-[260px] border-r flex-shrink-0 p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
        <Skeleton className="h-8 w-3/4" />
        <div className="pt-2 space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="pt-4 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-7 w-5/6" />
          ))}
        </div>
      </aside>

      {/* Main list */}
      <main className="flex-1 min-w-0 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2 pt-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3">
              <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Detail panel placeholder */}
      <aside className="w-[360px] border-l flex-shrink-0 p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="pt-4 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

/**
 * 標籤頁骨架(取代 tags/page.tsx 與 TagsPage.tsx 的 spinner)
 */
export function TagsPageSkeleton() {
  return (
    <div className="min-h-screen p-5 space-y-4" role="status" aria-label="載入中">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-4 space-y-2 rounded-xl" style={{ background: "var(--surface-muted)" }}>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
