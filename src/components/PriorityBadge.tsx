"use client";

import { Priority, PRIORITY_CONFIG } from "@/lib/types";

interface PriorityBadgeProps {
  priority: Priority;
  size?: "sm" | "md";
}

export function PriorityBadge({ priority, size = "md" }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  const sizeClasses = size === "sm"
    ? "px-1.5 py-0.5 text-[11px] gap-1"
    : "px-2 py-1 text-xs gap-1.5";

  // 速辦（Q1）使用更深色票，呼應 24h 緊急
  const isUrgent = priority === "do-now";

  return (
    <span
      className={`pill inline-flex items-center ${sizeClasses}`}
      style={
        isUrgent
          ? { background: `${config.colorHex}1A`, color: config.colorHex }
          : priority === "schedule"
          ? { background: `${config.colorHex}14`, color: config.colorHex }
          : priority === "delegate"
          ? { background: `${config.colorHex}14`, color: config.colorHex }
          : { background: "rgba(0,0,0,0.04)", color: "var(--text-secondary)" }
      }
      aria-label={`優先級: ${config.label}`}
    >
      <span aria-hidden="true" style={{ fontSize: size === "sm" ? "11px" : "12px" }}>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}