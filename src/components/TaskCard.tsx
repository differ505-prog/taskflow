"use client";

import { useState, useCallback, useEffect } from "react";
import { Task, SubTask, Priority } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";
import { TaskQuickActions } from "./TaskQuickActions";
import TaskCommentsInline from "./TaskCommentsInline";
import { getEisenhowerVisual } from "@/lib/eisenhower";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { haptic } from "@/lib/haptics";
import { getFileIcon } from "@/lib/storageUpload";
import { getTagColors } from "@/lib/storage";
import {
  CheckCircle2, Circle, Clock, Tag as TagIcon,
  Trash2, Edit3, Archive, Repeat, Plus, Trash,
  AlertCircle, Timer, ListChecks, Paperclip,
} from "lucide-react";

interface TaskCardProps {
  task: Task;
  onToggleStatus: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onToggleSubTask?: (taskId: string, subId: string) => void;
  onAddSubTask?: (taskId: string, title: string) => void;
  onDeleteSubTask?: (taskId: string, subId: string) => void;
  onCompleteRecurring?: (taskId: string) => void;
  onUpdatePriority?: (id: string, p: Priority) => void;
  onUpdateTags?: (id: string, tags: string[]) => void;
  allTags?: string[];
  draggable?: boolean;
}

interface DueDateInfo {
  text: string;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
}

function getDueDateInfo(
  dateStr: string | undefined,
  startDateStr?: string
): DueDateInfo | null {
  if (!dateStr) return null;
  try {
    const date = parseISO(dateStr);
    const overdue = !isToday(date) && isPast(date);

    if (startDateStr && startDateStr !== dateStr) {
      const start = parseISO(startDateStr);
      const startLabel = isToday(start) ? "今天" : format(start, "M/d", { locale: zhTW });
      const endLabel = isToday(date) ? "今天" : isTomorrow(date) ? "明天" : format(date, "M/d", { locale: zhTW });
      return {
        text: `${startLabel}～${endLabel}`,
        isOverdue: overdue,
        isToday: isToday(date) || isToday(start),
        isTomorrow: isTomorrow(date) || isTomorrow(start),
      };
    }

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

function SubTaskItem({
  sub,
  onToggle,
  onDelete,
}: {
  sub: SubTask;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isDone = sub.status === "done";
  return (
    <div className="flex items-center gap-2.5 py-1.5 group/SubTask">
      <button
        onClick={onToggle}
        className="flex-shrink-0 transition-transform hover:scale-110 active:scale-90"
        aria-label={isDone ? "標記未完成" : "標記完成"}
      >
        {isDone ? (
          <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
        ) : (
          <Circle className="w-4 h-4 text-[var(--text-tertiary)]" />
        )}
      </button>
      <span
        className={`flex-1 text-[13px] leading-snug ${isDone ? "line-through opacity-50" : ""}`}
        style={{ color: isDone ? "var(--text-tertiary)" : "var(--text-secondary)" }}
      >
        {sub.title}
      </span>
      <button
        onClick={onDelete}
        className="flex-shrink-0 opacity-0 group-hover/SubTask:opacity-100 transition-opacity p-1 rounded hover:bg-red-50"
        style={{ color: "var(--text-tertiary)" }}
        aria-label="刪除子任務"
      >
        <Trash className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function TaskCard({
  task,
  onToggleStatus,
  onEdit,
  onDelete,
  onArchive,
  onToggleSubTask,
  onAddSubTask,
  onDeleteSubTask,
  onUpdatePriority,
  onUpdateTags,
  allTags = [],
}: TaskCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSubTaskInput, setShowSubTaskInput] = useState(false);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});

  useEffect(() => {
    setTagColors(getTagColors());
  }, []);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState("");

  const dueInfo = getDueDateInfo(task.dueDate, task.startDate);
  const isDone = task.status === "done";
  const subTasks = task.subTasks || [];
  const completedSubTasks = subTasks.filter((s) => s.status === "done").length;
  const attachmentCount = task.attachments?.length || 0;

  const handleToggleStatus = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    haptic("success");
    onToggleStatus(task.id);
  }, [onToggleStatus, task.id]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(task);
  }, [onEdit, task]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    haptic("warning");
    setIsDeleting(true);
    setTimeout(() => onDelete(task.id), 200);
  }, [onDelete, task.id]);

  const handleArchive = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onArchive) onArchive(task.id);
  }, [onArchive, task.id]);

  const handleCardClick = useCallback(() => {
    onEdit(task);
  }, [onEdit, task]);

  const handleSubTaskSubmit = () => {
    const title = newSubTaskTitle.trim();
    if (!title || !onAddSubTask) return;
    onAddSubTask(task.id, title);
    setNewSubTaskTitle("");
    setShowSubTaskInput(false);
  };

  return (
    <article
      className={`card relative overflow-hidden transition-all duration-200 ${
        isDone ? "opacity-60" : ""
      } ${isDeleting ? "scale-[0.97] opacity-0" : ""}`}
      style={{ transition: "box-shadow 200ms ease, transform 200ms ease, opacity 200ms ease" }}
      onClick={handleCardClick}
      role="button"
      aria-label={`任務: ${task.title}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(task);
        }
      }}
    >
      {/* Priority left border accent — 艾森豪四象限視覺 */}
      {!isDone && (() => {
        const eisen = getEisenhowerVisual(task);
        return (
          <div
            className="absolute left-0 top-0 bottom-0 rounded-l-xl"
            style={{
              width: eisen.isUrgent ? 3 : 1,
              background: eisen.color,
              boxShadow: eisen.isUrgent ? `0 0 8px ${eisen.color}66` : undefined,
            }}
          />
        );
      })()}

      <div className="flex items-start gap-3 pl-5 pr-4 py-4">
        {/* Status toggle — always visible, tap to complete */}
        <button
          onClick={handleToggleStatus}
          className="flex-shrink-0 mt-0.5 transition-transform duration-200 hover:scale-110 active:scale-90"
          aria-label={isDone ? "標記為未完成" : "標記為已完成"}
        >
          {isDone ? (
            <CheckCircle2 className="w-[18px] h-[18px] text-[var(--status-success)]" />
          ) : (
            <Circle className="w-[18px] h-[18px] text-[var(--text-tertiary)]" />
          )}
        </button>

        {/* Task body */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`text-[15px] font-medium leading-snug min-w-0 flex-1 ${
                isDone ? "line-through" : ""
              }`}
              style={isDone ? { color: "var(--text-tertiary)" } : { color: "var(--text-primary)" }}
            >
              {task.title}
            </h3>

            {/* 右上角：旗子 / 標籤 / 附件 / 子任務 icon 三件套（quick actions） */}
            <div
              className="flex-shrink-0 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {task.recurrence && (
                <span className="p-1 rounded-lg" style={{ color: "var(--brand)" }} title="重複任務">
                  <Repeat className="w-3.5 h-3.5" />
                </span>
              )}
              {task.focusMinutes > 0 && (
                <span className="flex items-center gap-0.5 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  <Timer className="w-3 h-3" />
                  {task.focusMinutes}m
                </span>
              )}
              {(onUpdatePriority || onUpdateTags) && (
                <TaskQuickActions
                  task={task}
                  onUpdatePriority={(p) => onUpdatePriority?.(task.id, p)}
                  onUpdateTags={(tags) => onUpdateTags?.(task.id, tags)}
                  allTags={allTags}
                />
              )}
            </div>
          </div>

          {/* Meta row — always visible */}
          {(dueInfo || task.tags.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {dueInfo && (
                <span
                  className="pill-muted text-[11px] py-0.5"
                  style={
                    dueInfo.isOverdue && !isDone
                      ? { background: "rgba(255,59,48,0.08)", color: "var(--status-danger)" }
                      : dueInfo.isToday
                      ? { background: "var(--brand-tint)", color: "var(--brand)" }
                      : {}
                  }
                >
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {dueInfo.isOverdue && !isDone && "逾期 "}{dueInfo.text}
                </span>
              )}
              {task.tags.slice(0, 2).map((tag) => {
                const color = tagColors[tag] || "#3B82F6";
                return (
                  <span
                    key={tag}
                    className="text-[11px] py-0.5"
                    style={{
                      background: `${color}15`,
                      color: color,
                      border: `1px solid ${color}25`,
                      borderRadius: "6px",
                      padding: "2px 6px",
                    }}
                  >{tag}</span>
                );
              })}
              {task.tags.length > 2 && (
                <span className="pill-muted text-[11px] py-0.5">+{task.tags.length - 2}</span>
              )}
              {subTasks.length > 0 && (
                <span className="pill-muted text-[11px] py-0.5">
                  <ListChecks className="w-3 h-3" />
                  {completedSubTasks}/{subTasks.length}
                </span>
              )}
              {attachmentCount > 0 && (
                <span className="pill-muted text-[11px] py-0.5">
                  <Paperclip className="w-3 h-3" />
                  {attachmentCount}
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {task.description && (
            <p
              className={`text-[13px] leading-relaxed mt-2 ${
                isDone ? "line-through opacity-50" : ""
              }`}
              style={{ color: isDone ? "var(--text-tertiary)" : "var(--text-secondary)" }}
            >
              {task.description}
            </p>
          )}

          {/* Sub-tasks — always expanded */}
          {subTasks.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  子任務 ({completedSubTasks}/{subTasks.length})
                </span>
                {completedSubTasks === subTasks.length && isDone && (
                  <span className="text-[11px] font-medium" style={{ color: "var(--status-success)" }}>
                    ✓ 全部完成
                  </span>
                )}
              </div>
              <div className="pl-1 space-y-0.5">
                {subTasks.map((sub) => (
                  <SubTaskItem
                    key={sub.id}
                    sub={sub}
                    onToggle={() => onToggleSubTask?.(task.id, sub.id)}
                    onDelete={() => onDeleteSubTask?.(task.id, sub.id)}
                  />
                ))}
              </div>

              {/* Add sub-task */}
              {showSubTaskInput ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSubTaskSubmit(); }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 mt-2"
                >
                  <input
                    type="text"
                    value={newSubTaskTitle}
                    onChange={(e) => setNewSubTaskTitle(e.target.value)}
                    placeholder="輸入子任務..."
                    className="input flex-1"
                    style={{ fontSize: 13, padding: "6px 10px" }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setShowSubTaskInput(false); setNewSubTaskTitle(""); }
                    }}
                  />
                  <button type="submit" className="btn-primary py-1.5 px-3 text-[12px]">新增</button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowSubTaskInput(false); setNewSubTaskTitle(""); }}
                    className="btn-ghost py-1.5 px-3 text-[12px]"
                  >
                    取消
                  </button>
                </form>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSubTaskInput(true); }}
                  className="flex items-center gap-1.5 text-[12px] hover:underline transition-colors mt-2"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  新增子任務
                </button>
              )}
            </div>
          )}

          {/* Comments */}
          <TaskCommentsInline taskId={task.id} />

          {/* Bottom action bar: edit/delete/archive */}
          <div
            className="flex items-center gap-1 mt-3 pt-3 border-t"
            style={{ borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleEdit}
              className="p-1.5 rounded-lg hover:bg-black/5 transition-all duration-150 active:scale-90"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="編輯任務"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            {onArchive && (
              <button
                onClick={handleArchive}
                className="p-1.5 rounded-lg hover:bg-black/5 transition-all duration-150 active:scale-90"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="封存任務"
                title="封存"
              >
                <Archive className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 transition-all duration-150 active:scale-90"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="刪除任務"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
