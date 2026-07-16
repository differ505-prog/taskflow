"use client";

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
}

const CELL_VISUALS: Record<Priority, CellVisual> = {
  high: {
    label: PRIORITY_CONFIG.high.label,
    textColor: "var(--priority-high)",
    qLabel: "Q1/Q2",
    subtitle: "重要",
  },
  medium: {
    label: PRIORITY_CONFIG.medium.label,
    textColor: "var(--priority-medium)",
    qLabel: "Q3",
    subtitle: "次要",
  },
  low: {
    label: PRIORITY_CONFIG.low.label,
    textColor: "var(--priority-low)",
    qLabel: "Q4",
    subtitle: "可忽略",
  },
};

/**
 * 艾森豪 4 象限旗子切換器（圖譜式 UI）
 *
 * 佈局：4 列橫排，節省垂直空間
 *   ┌────┬────┬────┬────┐
 *   │ 高 │ 中 │ 低 │ 不重要 │
 *   │Q1/Q2│ Q3 │ Q4 │ 不緊急 │
 *   └────┴────┴────┴────┘
 *
 * - 高 ＝ Q1 / Q2（依 dueDate 自動判定是否緊急）
 * - 中 ＝ Q3
 * - 低 ＝ Q4（預設）
 *
 * 點擊任意格 → 切換 priority
 */
export function EisenhowerQuadrantGrid({ priority, onChange }: EisenhowerQuadrantGridProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <EisenhowerCell
        p="high"
        visual={CELL_VISUALS.high}
        active={priority === "high"}
        onClick={() => onChange("high")}
      />
      <EisenhowerCell
        p="medium"
        visual={CELL_VISUALS.medium}
        active={priority === "medium"}
        onClick={() => onChange("medium")}
      />
      <EisenhowerCell
        p="low"
        visual={CELL_VISUALS.low}
        active={priority === "low"}
        onClick={() => onChange("low")}
      />
      {/* 第 4 象限：重要 + 不緊急 → 仍是 low priority */}
      <button
        type="button"
        onClick={() => onChange("low")}
        className="rounded-xl p-2.5 text-left transition-all duration-150 active:scale-95"
        style={{
          background: priority === "low"
            ? "var(--text-tertiary)"
            : "var(--surface)",
          border: priority === "low" ? "1px solid transparent" : "1px solid var(--border)",
          color: priority === "low" ? "#fff" : "var(--text-tertiary)",
        }}
        aria-label="不重要不緊急"
        aria-pressed={priority === "low"}
      >
        <div className="flex items-center justify-between mb-0.5">
          <Flag className="w-3.5 h-3.5" fill="none" />
          <span className="text-[9px] font-bold opacity-70">Q4</span>
        </div>
        <div className="text-[11px] font-semibold leading-tight">
          不重要
        </div>
        <div className="text-[9px] opacity-70">
          不緊急
        </div>
      </button>
    </div>
  );
}

function EisenhowerCell({
  p,
  visual,
  active,
  onClick,
}: {
  p: Priority;
  visual: CellVisual;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl p-2.5 text-left transition-all duration-150 active:scale-95"
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
              border: "1px solid var(--border)",
            }
      }
      aria-label={`${visual.label}優先（${visual.qLabel}）`}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between mb-0.5">
        <Flag className="w-3.5 h-3.5" fill={active ? "currentColor" : p === "low" ? "none" : "currentColor"} />
        <span className="text-[9px] font-bold opacity-70">{visual.qLabel}</span>
      </div>
      <div className="text-[11px] font-semibold leading-tight">
        {visual.label}優先
      </div>
      <div
        className="text-[9px]"
        style={{ opacity: active ? 0.85 : 0.7 }}
      >
        {visual.subtitle}
      </div>
    </button>
  );
}
