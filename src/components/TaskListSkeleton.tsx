"use client";

/**
 * 任務列表骨架屏
 * 首次載入時顯示 placeholder，提升感知效能
 */
export function TaskListSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 w-32 rounded-lg bg-slate-200 animate-pulse" />
        <div className="h-8 w-8 rounded-xl bg-slate-200 animate-pulse" />
      </div>

      {/* List item skeletons */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: "var(--surface-muted, #f8f9fa)" }}
        >
          {/* Checkbox */}
          <div className="w-5 h-5 rounded-full bg-slate-200 animate-pulse flex-shrink-0" />

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div
              className="h-4 rounded-md bg-slate-200 animate-pulse"
              style={{
                width: `${70 + (i * 7) % 25}%`,
              }}
            />
            <div className="flex gap-2">
              <div className="h-3 w-12 rounded-full bg-slate-200 animate-pulse" />
              <div className="h-3 w-16 rounded-full bg-slate-200 animate-pulse" />
            </div>
          </div>

          {/* Date */}
          <div className="h-3 w-12 rounded bg-slate-200 animate-pulse flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
