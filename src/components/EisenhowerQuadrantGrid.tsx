"use client";

import { Priority, PRIORITY_CONFIG } from "@/lib/types";
import { Flag } from "lucide-react";

interface EisenhowerQuadrantGridProps {
  priority: Priority;
  onChange: (p: Priority) => void;
}

interface CellVisual {
  label: string;
  bg: string;
  textColor: string;
  dotColor: string;
  qLabel: string; // Q1-Q4
}

const CELL_VISUALS: Record<Priority, CellVisual> = {
  high: {
    label: PRIORITY_CONFIG.high.label,
    bg: "#FF3B3012",
    textColor: "var(--priority-high)",
    dotColor: "var(--priority-high)",
    qLabel: "Q1/Q2",
  },
  medium: {
    label: PRIORITY_CONFIG.medium.label,
    bg: "#FF950012",
    textColor: "var(--priority-medium)",
    dotColor: "var(--priority-medium)",
    qLabel: "Q3",
  },
  low: {
    label: PRIORITY_CONFIG.low.label,
    bg: "#34C75912",
    textColor: "var(--priority-low)",
    dotColor: "var(--priority-low)",
    qLabel: "Q4",
  },
};

/**
 * 艾森豪 4 象限旗子切換器（圖譜式 UI）
 *
 * 佈局：
 *   ┌──────┬──────┐
 *   │  高  │  中  │
 *   │ Q1/Q2│  Q3  │
 *   ├──────┼──────┤
 *   │  -  │  低  │
 *   │      │  Q4  │
 *   └──────┴──────┘
 *
 * - 高 ＝ Q1 / Q2（依 dueDate 自動判定是否緊急）
 * - 中 ＝ Q3
 * - 低 ＝ Q4（預設）
 *
 * 點擊任意格 → 切換 priority
 */
export function EisenhowerQuadrantGrid({ priority, onChange }: EisenhowerQuadrantGridProps) {
  const isActive = (p: Priority) => priority === p;

  return (
    <div className="grid grid-cols-2 gap-2">
      <EisenhowerCell
        p="high"
        visual={CELL_VISUALS.high}
        active={isActive("high")}
        subtitle="重要"
        onClick={() => onChange("high")}
      />
      <EisenhowerCell
        p="medium"
        visual={CELL_VISUALS.medium}
        active={isActive("medium")}
        subtitle="次要"
        onClick={() => onChange("medium")}
      />
      <EisenhowerCell
        p="low"
        visual={CELL_VISUALS.low}
        active={isActive("low")}
        subtitle="可忽略"
        onClick={() => onChange("low")}
      />
      <button
        type="button"
        onClick={() => onChange("low")}
        className="rounded-xl p-3 text-left transition-all duration-150 active:scale-95"
        style={{
          background: priority === "low"
            ? "var(--text-tertiary)"
            : "var(--surface)",
          border: priority === "low" ? "1px solid transparent" : "1px solid var(--border)",
          color: priority === "low" ? "#fff" : "var(--text-tertiary)",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <Flag className="w-4 h-4" fill="none" />
          <span className="text-[10px] font-bold opacity-70">預設</span>
        </div>
        <div className="text-[13px] font-semibold leading-tight">
          第 4 象限
        </div>
        <div className="text-[10px] mt-0.5 opacity-70">
          不重要不緊急
        </div>
      </button>
    </div>
  );
}

function EisenhowerCell({
  p,
  visual,
  active,
  subtitle,
  onClick,
}: {
  p: Priority;
  visual: CellVisual;
  active: boolean;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl p-3 text-left transition-all duration-150 active:scale-95"
      style={
        active
          ? {
              background: visual.textColor,
              color: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              border: "1px solid transparent",
            }
          : {
              background: "var(--surface)",
              color: visual.textColor,
              border: `1px solid var(--border)`,
            }
      }
      aria-label={`${visual.label}優先（${visual.qLabel}）`}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between mb-1">
        <Flag className="w-4 h-4" fill={active ? "currentColor" : p === "low" ? "none" : "currentColor"} />
        <span className="text-[10px] font-bold opacity-70">{visual.qLabel}</span>
      </div>
      <div className="text-[13px] font-semibold leading-tight">
        {visual.label}優先
      </div>
      <div
        className="text-[10px] mt-0.5"
        style={{ opacity: active ? 0.85 : 0.7 }}
      >
        {subtitle}
      </div>
    </button>
  );
}
