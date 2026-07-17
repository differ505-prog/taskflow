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

  // 緊急：用更深的色票區分（艾森豪 Q1）
  const isUrgent = priority === "urgent";

  return (
    <span
      className={`pill ${sizeClasses}`}
      style={
        isUrgent
          ? { background: "rgba(215, 0, 21, 0.10)", color: "#D70015" }
          : priority === "high"
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
          isUrgent
            ? { width: 6, height: 6, background: "#D70015" }
            : priority === "high"
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
