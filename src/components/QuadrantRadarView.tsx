"use client";

/**
 * 緩急圖視圖
 *
 * 艾森豪四象限緩急圖,2x2 卡片網格,每象限顯示:
 * - Q 標籤 + emoji + 中文標籤
 * - 中文解釋彩蛋（hover (i) tooltip）
 * - 該象限任務數
 * - 該象限前 5 項任務（點擊打開 detail）
 *
 * 理論基石：艾森豪矩陣 Eisenhower Matrix
 * UI 命名：緩急圖
 *
 * 設計原則（§1 Stripe 骨架）：
 * - 2x2 網格,每象限統一結構
 * - 卡片強烈色彩但低飽和度背景(避免大面積塗抹品牌色 §3 色彩紀律)
 * - 文字對比清晰,符合 Apple 極簡視覺
 */

import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { Task, Priority } from "@/lib/types";
import { getEisenhowerVisual, EISENHOWER_URGENT_HOURS } from "@/lib/eisenhower";
import { Info } from "lucide-react";
import { TextWithLinks } from "./TextWithLinks";
import { CheckCircle2, Circle } from "lucide-react";
import { fireTaskDoneConfetti, playTaskDoneSound } from "@/lib/confetti";

interface QuadrantCardProps {
  quadrant: "do-now" | "schedule" | "delegate" | "none";
  emoji: string;
  label: string;
  caption: string; // 中文解釋彩蛋（hover (i) 顯示）
  colorHex: string;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onToggleStatus: (taskId: string) => void;
}

function QuadrantCard({ quadrant, emoji, label, caption, colorHex, tasks, onTaskClick, onToggleStatus }: QuadrantCardProps) {
  const count = tasks.length;
  // 顯示前 5 項未完成任務
  const visible = tasks.filter((t) => t.status !== "done").slice(0, 5);
  const doneCount = tasks.length - visible.length;

  const handleCheckboxClick = (e: React.MouseEvent, taskId: string, isDone: boolean) => {
    e.stopPropagation();
    const wasNotDone = !isDone;
    onToggleStatus(taskId);
    if (wasNotDone) {
      fireTaskDoneConfetti(e.currentTarget as HTMLElement | null);
      playTaskDoneSound();
    }
  };

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{
        background: "var(--surface-elevated)",
        boxShadow: "var(--shadow-sm)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header：Q標 + emoji + label + (i) tooltip + count */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{
          background: `${colorHex}10`, // 主色 10% 透明（§3 嚴禁大面積塗抹品牌色）
          borderBottom: `2px solid ${colorHex}40`,
        }}
      >
        <span className="text-base" aria-hidden="true">{emoji}</span>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: `${colorHex}25`, color: colorHex }}
        >
          {quadrant === "do-now" ? "Q1"
            : quadrant === "schedule" ? "Q2"
            : quadrant === "delegate" ? "Q3"
            : "Q4"}
        </span>
        <span className="text-[13px] font-semibold flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
          {label}
        </span>
        <span
          className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
          style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
          aria-label={`${count} 項任務`}
        >
          {count}
        </span>

        {/* 中文解釋彩蛋：hover (i) tooltip */}
        <div className="relative group" tabIndex={0} aria-label="理論解釋">
          <Info
            className="w-3.5 h-3.5 transition-colors hover:opacity-100"
            style={{ color: "var(--text-tertiary)" }}
            aria-hidden="true"
          />
          <div
            className="absolute top-full right-0 mt-2 z-50 px-3 py-2 rounded-lg text-[11.5px] leading-relaxed w-56 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150"
            style={{
              background: "var(--surface-elevated)",
              color: "var(--text-secondary)",
              boxShadow: "var(--shadow-md)",
              border: "1px solid var(--border)",
            }}
            role="tooltip"
          >
            {caption}
          </div>
        </div>
      </div>

      {/* 任務列表 */}
      <div className="flex-1 min-h-0 px-3 py-2 overflow-y-auto">
        {visible.length === 0 ? (
          <p
            className="text-[12px] py-3 text-center"
            style={{ color: "var(--text-tertiary)" }}
          >
            {count === 0 ? "此象限空無一物" : `全部 ${count} 項已完成 ✓`}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {visible.map((task) => (
              <li key={task.id}>
                <button
                  onClick={() => onTaskClick(task.id)}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-[12.5px] leading-snug hover:bg-black/5 transition-colors flex items-start gap-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {/* 檢核框 */}
                  <button
                    onClick={(e) => handleCheckboxClick(e, task.id, task.status === "done")}
                    className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110 z-10"
                    aria-label={task.status === "done" ? "標記未完成" : "標記完成"}
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 className="w-[15px] h-[15px] text-[var(--status-success)]" />
                    ) : (
                      <Circle className="w-[15px] h-[15px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" />
                    )}
                  </button>
                  <span
                    className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ background: colorHex }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <TextWithLinks text={task.title} />
                  </span>
                </button>
              </li>
            ))}
            {doneCount > 0 && (
              <li
                className="text-[10.5px] px-2.5 py-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                + {doneCount} 項已完成
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

interface QuadrantRadarViewProps {
  onTaskSelect: (id: string) => void;
}

export function QuadrantRadarView({ onTaskSelect }: QuadrantRadarViewProps) {
  const { tasks, toggleTaskStatus } = useApp();

  // 用 getEisenhowerVisual 取每個任務的即時象限（含 24h 自動提升 schedule → do-now）
  const grouped = useMemo(() => {
    const groups: Record<"do-now" | "schedule" | "delegate" | "none", Task[]> = {
      "do-now": [],
      "schedule": [],
      "delegate": [],
      "none": [],
    };
    for (const t of tasks) {
      if (t.isArchived || t.status === "done") continue;
      const v = getEisenhowerVisual(t);
      groups[v.quadrant].push(t);
    }
    return groups;
  }, [tasks]);

  const totalActive = grouped["do-now"].length + grouped["schedule"].length + grouped["delegate"].length + grouped["none"].length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: "var(--brand-tint)" }}
              aria-hidden="true"
            >
              ◖
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>
                Quadrant Radar
              </h1>
              <p className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                {totalActive} 項進行中 · 艾森豪矩陣
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 2x2 雷達視圖（行動裝置:1欄 / 平板+:2x2） */}
      <main className="flex-1 min-h-0 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 h-full" style={{ gridAutoRows: "minmax(220px, 1fr)" }}>
          {/* Q1: 速辦（左上 · 最關鍵位置） */}
          <QuadrantCard
            quadrant="do-now"
            emoji="🔥"
            label="立即做"
            caption={`重要且緊急：必須立刻處理。按 24 小時內截止的 deadline 引擎規則,排程任務在到期前 ${EISENHOWER_URGENT_HOURS} 小時會自動升級至此象限(艾森豪矩陣 Q1)。`}
            colorHex="#D70015"
            tasks={grouped["do-now"]}
            onTaskClick={onTaskSelect}
            onToggleStatus={toggleTaskStatus}
          />

          {/* Q2: 排程（右上） */}
          <QuadrantCard
            quadrant="schedule"
            emoji="🗓️"
            label="計劃做"
            caption="重要但不緊急：明日復盤與一週規劃的主角。預先安排時間處理,避免任務累積升級為 Q1 緊急(艾森豪矩陣 Q2)。"
            colorHex="#F97316"
            tasks={grouped["schedule"]}
            onTaskClick={onTaskSelect}
            onToggleStatus={toggleTaskStatus}
          />

          {/* Q3: 轉交（左下） */}
          <QuadrantCard
            quadrant="delegate"
            emoji="🤝"
            label="委派做"
            caption="緊急但不重要：適合轉交他人。識別可委派對象,在備註中標明接手人(艾森豪矩陣 Q3)。"
            colorHex="#EAB308"
            tasks={grouped["delegate"]}
            onTaskClick={onTaskSelect}
            onToggleStatus={toggleTaskStatus}
          />

          {/* Q4: 暫緩（右下） */}
          <QuadrantCard
            quadrant="none"
            emoji="💤"
            label="可忽略"
            caption="既不緊急也不重要：勇於說不。可考慮封存或刪除,避免雜訊污染注意力(艾森豪矩陣 Q4)。"
            colorHex="#9CA3AF"
            tasks={grouped["none"]}
            onTaskClick={onTaskSelect}
            onToggleStatus={toggleTaskStatus}
          />
        </div>
      </main>
    </div>
  );
}