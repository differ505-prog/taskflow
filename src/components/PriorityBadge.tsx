"use client";

import { Priority, PRIORITY_CONFIG } from "@/lib/types";

interface PriorityBadgeProps {
  priority: Priority;
  size?: "sm" | "md";
}

export function PriorityBadge({ priority, size = "md" }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  const sizeClasses = size === "sm"
    ? "px-2 py-0.5 text-[11px]"
    : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`pill ${sizeClasses}`}
      style={
        priority === "high"
          ? { background: "rgba(255, 59, 48, 0.08)", color: "var(--priority-high)" }
          : priority === "medium"
          ? { background: "rgba(255, 149, 0, 0.08)", color: "var(--priority-medium)" }
          : { background: "rgba(52, 199, 89, 0.08)", color: "var(--priority-low)" }
      }
      aria-label={`優先級: ${config.label}`}
    >
      <span
        className="rounded-full flex-shrink-0"
        style={
          priority === "high"
            ? { width: 5, height: 5, background: "var(--priority-high)" }
            : priority === "medium"
            ? { width: 5, height: 5, background: "var(--priority-medium)" }
            : { width: 5, height: 5, background: "var(--priority-low)" }
        }
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}
