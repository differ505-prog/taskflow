"use client";

import { useState, useEffect } from "react";
import { Priority, PRIORITY_CONFIG } from "@/lib/types";
import { Flag } from "lucide-react";

interface EisenhowerQuadrantGridProps {
  priority: Priority;
  onChange: (p: Priority) => void;
}

interface CellVisual {
  label: string;
  textColor: string;
  qLabel: string;
  subtitle: string;
  visualKey: string;
}

const QUADRANTS: CellVisual[] = [
  {
    label: PRIORITY_CONFIG.high.label,
    textColor: "var(--priority-high)",
    qLabel: "Q1/Q2",
    subtitle: "重要",
    visualKey: "high",
  },
  {
    label: "中",
    textColor: "var(--priority-medium)",
    qLabel: "Q3",
    subtitle: "次要",
    visualKey: "medium",
  },
  {
    label: PRIORITY_CONFIG.low.label,
    textColor: "var(--priority-low)",
    qLabel: "Q4",
    subtitle: "可忽略",
    visualKey: "low",
  },
  {
    label: "不重要",
    textColor: "var(--text-tertiary)",
    qLabel: "Q4",
    subtitle: "不緊急",
    visualKey: "low-soft",
  },
];

/**
 * 艾森豪 4 象限旗子切換器（圖譜式 UI）
 *
 * 佈局：4 列橫排，節省垂直空間
 *   ┌────┬────┬────┬────┐
 *   │ 高 │ 中 │ 低 │ 不重要 │
 *   │Q1/Q2│ Q3 │ Q4 │ 不緊急 │
 *   └────┴────┴────┴────┘
 *
 * - Q1/Q2 → high
 * - Q3 → medium
 * - Q4 → low
 * - Q4「不重要不緊急」→ low（視覺區分，邏輯同 low）
 *
 * 點擊任意格 → 切換 priority
 */
export function EisenhowerQuadrantGrid({ priority, onChange }: EisenhowerQuadrantGridProps) {
  // visualState 追蹤目前 UI 亮哪格，與 priority 邏輯狀態分開
  const [visualState, setVisualState] = useState<string>(priority);

  const isActive = (visualKey: string) => visualState === visualKey;

  // 當 priority 從外部被更新時（如另一處修改了任務優先級），同步 visualState
  useEffect(() => { setVisualState(priority); }, [priority]);

  const handleClick = (visualKey: string) => {
    setVisualState(visualKey);
    onChange(visualKey === "low-soft" ? "low" : (visualKey as Priority));
  };

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {QUADRANTS.map((q, i) => (
        <button
          key={i}
          type="button"
          onClick={() => handleClick(q.visualKey)}
          className="rounded-xl p-2.5 text-left transition-all duration-150 active:scale-95"
          style={
            isActive(q.visualKey)
              ? {
                  background: q.textColor,
                  color: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  border: "1px solid transparent",
                }
              : {
                  background: "var(--surface)",
                  color: q.textColor,
                  border: "1px solid var(--border)",
                }
          }
          aria-label={`${q.label}優先（${q.qLabel}）`}
          aria-pressed={isActive(q.visualKey)}
        >
          <div className="flex items-center justify-between mb-0.5">
            <Flag
              className="w-3.5 h-3.5"
              fill={isActive(q.visualKey) ? "currentColor" : q.visualKey === "low-soft" ? "none" : "currentColor"}
            />
            <span className="text-[9px] font-bold opacity-70">{q.qLabel}</span>
          </div>
          <div className="text-[11px] font-semibold leading-tight">
            {q.label}優先
          </div>
          <div
            className="text-[9px]"
            style={{ opacity: isActive(q.visualKey) ? 0.85 : 0.7 }}
          >
            {q.subtitle}
          </div>
        </button>
      ))}
    </div>
  );
}
