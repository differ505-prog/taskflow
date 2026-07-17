"use client";

import { useState, useEffect } from "react";
import { Priority } from "@/lib/types";
import { Info } from "lucide-react";
import { EISENHOWER_URGENT_HOURS } from "@/lib/eisenhower";

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
  /** 中文解釋彩蛋（hover (i) tooltip） */
  caption: string;
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
    caption: `重要且緊急,立即處理。${EISENHOWER_URGENT_HOURS}小時內到期的「排程」任務會自動升至此象限。`,
    value: "do-now",
  },
  {
    label: "排程",
    emoji: "🗓️",
    colorVar: "var(--priority-schedule)",
    colorHex: "#F97316",
    qLabel: "Q2",
    subtitle: "計劃做",
    caption: "重要但不緊急,預先安排時間處理,避免升級為 Q1 緊急。",
    value: "schedule",
  },
  {
    label: "轉交",
    emoji: "🤝",
    colorVar: "var(--priority-delegate)",
    colorHex: "#EAB308",
    qLabel: "Q3",
    subtitle: "委派做",
    caption: "緊急但不重要,適合轉交他人。建議在備註標明接手人。",
    value: "delegate",
  },
  {
    label: "暫緩",
    emoji: "💤",
    colorVar: "var(--priority-none)",
    colorHex: "#9CA3AF",
    qLabel: "Q4",
    subtitle: "可忽略",
    caption: "既不緊急也不重要,勇於說不。可考慮封存或刪除。",
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
          className="group relative rounded-xl p-2.5 text-left transition-all duration-150 active:scale-95"
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

          {/* 中文解釋彩蛋：hover (i) tooltip */}
          <span
            role="img"
            aria-label={q.caption}
            className="absolute bottom-1 right-1 inline-flex items-center justify-center w-4 h-4 rounded-full opacity-50 hover:opacity-100 focus-within:opacity-100 transition-opacity"
            tabIndex={0}
          >
            <Info className="w-3 h-3" aria-hidden="true" />
          </span>
          {/* Tooltip 容器 */}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 px-2.5 py-2 rounded-lg text-[10.5px] leading-relaxed w-48 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 text-center"
            style={{
              background: "var(--surface-elevated)",
              color: "var(--text-secondary)",
              boxShadow: "var(--shadow-md)",
              border: "1px solid var(--border)",
            }}
            role="tooltip"
          >
            {q.caption}
          </span>
        </button>
      ))}
    </div>
  );
}