"use client";

import { useState, useEffect } from "react";
import { Priority } from "@/lib/types";

interface EisenhowerQuadrantGridProps {
  priority: Priority;
  onChange: (p: Priority) => void;
}

interface CellVisual {
  label: string;
  emoji: string;
  colorVar: string;
  colorHex: string;
  qLabel: string;
  subtitle: string;
  value: Priority;
}

const QUADRANTS: CellVisual[] = [
  {
    label: "速辦",
    emoji: "🔥",
    colorVar: "var(--priority-do-now)",
    colorHex: "#D70015",
    qLabel: "Q1",
    subtitle: "立即做",
    value: "do-now",
  },
  {
    label: "排程",
    emoji: "🗓️",
    colorVar: "var(--priority-schedule)",
    colorHex: "#F97316",
    qLabel: "Q2",
    subtitle: "計劃做",
    value: "schedule",
  },
  {
    label: "轉交",
    emoji: "🤝",
    colorVar: "var(--priority-delegate)",
    colorHex: "#EAB308",
    qLabel: "Q3",
    subtitle: "委派做",
    value: "delegate",
  },
  {
    label: "暫緩",
    emoji: "💤",
    colorVar: "var(--priority-none)",
    colorHex: "#9CA3AF",
    qLabel: "Q4",
    subtitle: "可忽略",
    value: "none",
  },
];

/**
 * 艾森豪 4 象限優先級切換器（艾森豪四象限視覺）
 *
 * 佈局：4 格橫排（每格 = emoji + label + Q 標籤 + subtitle）
 *
 * - 點擊任意格 → 切換 priority
 * - schedule 且 dueDate 在 24h 內 → 視覺提升為 Q1（由 TaskForm / TaskDetailPanel 提示升級）
 */
export function EisenhowerQuadrantGrid({ priority, onChange }: EisenhowerQuadrantGridProps) {
  const [visualState, setVisualState] = useState<Priority>(priority);

  const isActive = (v: Priority) => visualState === v;

  useEffect(() => { setVisualState(priority); }, [priority]);

  const handleClick = (v: Priority) => {
    setVisualState(v);
    onChange(v);
  };

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {QUADRANTS.map((q) => (
        <button
          key={q.value}
          type="button"
          onClick={() => handleClick(q.value)}
          className="rounded-xl p-2.5 text-left transition-all duration-150 active:scale-95"
          style={
            isActive(q.value)
              ? {
                  background: q.colorVar,
                  color: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  border: "1px solid transparent",
                }
              : {
                  background: "var(--surface)",
                  color: q.colorVar,
                  border: "1px solid var(--border)",
                }
          }
          aria-label={`${q.label}（${q.qLabel}）`}
          aria-pressed={isActive(q.value)}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-base" aria-hidden="true">{q.emoji}</span>
            <span className="text-[9px] font-bold opacity-70">{q.qLabel}</span>
          </div>
          <div className="text-[11px] font-semibold leading-tight">
            {q.label}
          </div>
          <div
            className="text-[9px]"
            style={{ opacity: isActive(q.value) ? 0.85 : 0.7 }}
          >
            {q.subtitle}
          </div>
        </button>
      ))}
    </div>
  );
}