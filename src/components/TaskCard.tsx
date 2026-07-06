"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, Clock, Tag, Trash2, Edit3, AlertCircle } from "lucide-react";
import { Task } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";

interface TaskCardProps {
  task: Task;
  onToggleStatus: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

interface DueDateInfo {
  text: string;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
}

function getDueDateInfo(dateStr: string | undefined): DueDateInfo | null {
  if (!dateStr) return null;
  try {
    const date = parseISO(dateStr);
    const overdue = !isToday(date) && isPast(date);
    return {
      text: isToday(date) ? "今天" : isTomorrow(date) ? "明天" : format(date, "M/d", { locale: zhTW }),
      isOverdue: overdue,
      isToday: isToday(date),
      isTomorrow: isTomorrow(date),
    };
  } catch {
    return null;
  }
}

export function TaskCard({ task, onToggleStatus, onEdit, onDelete }: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const dueInfo = getDueDateInfo(task.dueDate);
  const isDone = task.status === "done";
  const hasMeta = dueInfo || task.tags.length > 0;
  const hasDescription = Boolean(task.description);

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => onDelete(task.id), 200);
  };

  const handleExpand = () => {
    if (hasDescription || hasMeta) {
      setIsExpanded((prev) => !prev);
    }
  };

  return (
    <article
      className={`card relative overflow-hidden transition-all duration-240 ${
        isDone ? "opacity-50" : ""
      } ${isDeleting ? "scale-[0.97] opacity-0" : ""}`}
      style={{ transition: "box-shadow 240ms ease, transform 240ms ease, opacity 200ms ease" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={`任務: ${task.title}`}
    >
      {/* 主內容行 */}
      <div className="flex items-start gap-3 px-5 py-4">

        {/* 狀態切換按鈕 */}
        <button
          onClick={() => onToggleStatus(task.id)}
          className="flex-shrink-0 mt-0.5 transition-transform duration-200 hover:scale-115 active:scale-90"
          aria-label={isDone ? "標記為未完成" : "標記為已完成"}
          aria-pressed={isDone}
        >
          {isDone ? (
            <CheckCircle2 className="w-[18px] h-[18px] text-[var(--status-success)]" aria-hidden="true" />
          ) : (
            <Circle className="w-[18px] h-[18px] text-[var(--text-tertiary)] transition-colors duration-200 group-hover:text-[var(--brand)]" aria-hidden="true" />
          )}
        </button>

        {/* 任務主體 */}
        <div className="flex-1 min-w-0">
          {/* 標題列 */}
          <div className="flex items-center justify-between gap-2">
            <h3
              className={`text-[15px] font-medium leading-snug min-w-0 ${
                isDone
                  ? "line-through text-[var(--text-tertiary)]"
                  : "text-[var(--text-primary)]"
              }`}
              style={{ wordBreak: "break-word" }}
            >
              <span className={isDone ? "" : "text-pretty"}>
                {task.title}
              </span>
            </h3>
            <div className="flex-shrink-0 flex items-center gap-2">
              <PriorityBadge priority={task.priority} size="sm" />
            </div>
          </div>

          {/* Meta 行 — 僅在非展開時顯示關鍵資訊 */}
          {!isExpanded && hasMeta && (
            <div className="flex flex-wrap items-center gap-2 mt-2 overflow-hidden">
              {/* 截止日期 */}
              {dueInfo && (
                <span
                  className="pill-muted"
                  style={
                    dueInfo.isOverdue && !isDone
                      ? { background: "rgba(255, 59, 48, 0.08)", color: "var(--status-danger)" }
                      : dueInfo.isToday
                      ? { background: "rgba(59, 130, 246, 0.08)", color: "var(--brand)" }
                      : {}
                  }
                >
                  <Clock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                  {dueInfo.isOverdue && !isDone && "逾期 "}{dueInfo.text}
                </span>
              )}

              {/* 標籤 (首批2個) */}
              {task.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="pill-muted">
                  {tag}
                </span>
              ))}
              {task.tags.length > 2 && (
                <span className="pill-muted">+{task.tags.length - 2}</span>
              )}

              {/* 展開提示 — 如果有隱藏資訊 */}
              {hasDescription && (
                <button
                  onClick={handleExpand}
                  className="flex items-center gap-0.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors duration-150 cursor-pointer"
                  aria-expanded={isExpanded}
                  aria-label="展開任務詳情"
                >
                  詳情
                  <ChevronDown
                    className="w-3 h-3 transition-transform duration-200"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>
          )}

          {/* 展開內容區 — Progressive Disclosure */}
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: isExpanded ? "500px" : "0",
              opacity: isExpanded ? 1 : 0,
            }}
          >
            <div className="pt-3 space-y-2">
              {/* 完整描述 */}
              {task.description && (
                <p
                  className={`text-[13px] leading-relaxed ${
                    isDone ? "line-through text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"
                  }`}
                >
                  {task.description}
                </p>
              )}

              {/* 截止日期 (詳細) */}
              {dueInfo && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[var(--text-tertiary)] flex-shrink-0" aria-hidden="true" />
                  <span
                    className="text-[12px]"
                    style={
                      dueInfo.isOverdue && !isDone
                        ? { color: "var(--status-danger)", fontWeight: 500 }
                        : { color: "var(--text-secondary)" }
                    }
                  >
                    {dueInfo.isOverdue && !isDone && (
                      <span className="inline-flex items-center gap-1 mr-1">
                        <AlertCircle className="w-3 h-3" aria-hidden="true" />
                        已逾期 ·
                      </span>
                    )}
                    截止 {dueInfo.text}
                    {dueInfo.isToday && "（今天）"}
                    {dueInfo.isTomorrow && "（明天）"}
                  </span>
                </div>
              )}

              {/* 所有標籤 */}
              {task.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-[var(--text-tertiary)] flex-shrink-0" aria-hidden="true" />
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map((tag) => (
                      <span key={tag} className="pill-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 收起按鈕 */}
              {(hasDescription || task.tags.length > 0) && (
                <button
                  onClick={handleExpand}
                  className="flex items-center gap-0.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors duration-150 pt-1"
                  aria-expanded={isExpanded}
                  aria-label="收起任務詳情"
                >
                  收起
                  <ChevronDown
                    className="w-3 h-3 transition-transform duration-200"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 動作按鈕列 — Hover Reveal */}
        <div
          className="flex-shrink-0 flex items-center gap-0.5 transition-all duration-200"
          style={{
            opacity: isHovered && !isDone ? 1 : 0,
            transform: isHovered && !isDone ? "translateX(0)" : "translateX(-4px)",
          }}
        >
          <button
            onClick={() => onEdit(task)}
            className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--brand)] hover:bg-[var(--brand-tint)] transition-all duration-200 active:scale-90"
            aria-label="編輯任務"
          >
            <Edit3 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--status-danger)] hover:bg-red-50 transition-all duration-200 active:scale-90"
            aria-label="刪除任務"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
