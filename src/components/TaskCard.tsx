"use client";

import { useState, useCallback } from "react";
import { Task, SubTask } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";
import TaskCommentsInline from "./TaskCommentsInline";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { haptic } from "@/lib/haptics";
import { getFileIcon, formatFileSize } from "@/lib/storageUpload";
import {
  CheckCircle2, Circle, ChevronDown, Clock, Tag as TagIcon,
  Trash2, Edit3, Archive, Repeat, Plus, Trash,
  AlertCircle, Timer, ChevronRight, ListChecks, Paperclip,
} from "lucide-react";

interface TaskCardProps {
  task: Task;
  onToggleStatus: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onToggleSubTask?: (taskId: string, subId: string) => void;
  onAddSubTask?: (taskId: string) => void;
  onDeleteSubTask?: (taskId: string, subId: string) => void;
  onCompleteRecurring?: (taskId: string) => void;
  draggable?: boolean;
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

function SubTaskItem({
  sub,
  onToggle,
  onDelete,
}: {
  sub: SubTask;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isDone = sub.status === "done";
  return (
    <div
      className="flex items-center gap-2.5 py-1.5 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onToggle}
        className="flex-shrink-0 transition-transform hover:scale-110"
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
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50"
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
  onCompleteRecurring,
}: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSubTaskInput, setShowSubTaskInput] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState("");

  const dueInfo = getDueDateInfo(task.dueDate);
  const isDone = task.status === "done";
  const hasMeta = dueInfo || task.tags.length > 0 || task.subTasks?.length || task.recurrence;
  const hasDescription = Boolean(task.description);
  const subTasks = task.subTasks || [];
  const completedSubTasks = subTasks.filter((s) => s.status === "done").length;
  const subTaskProgress = subTasks.length > 0 ? completedSubTasks / subTasks.length : 0;
  const attachmentCount = task.attachments?.length || 0;

  const handleToggleStatus = useCallback(() => {
    haptic("success");
    onToggleStatus(task.id);
  }, [onToggleStatus, task.id]);

  const handleDelete = useCallback(() => {
    haptic("warning");
    setIsDeleting(true);
    setTimeout(() => onDelete(task.id), 200);
  }, [onDelete, task.id]);

  const handleExpand = () => setIsExpanded((p) => !p);

  const handleSubTaskSubmit = () => {
    if (!newSubTaskTitle.trim() || !onAddSubTask) return;
    onAddSubTask(task.id);
    // Note: this component doesn't manage the input state — onAddSubTask gets called with title
    // We store the title in a ref via the form — simpler: call context directly
    setNewSubTaskTitle("");
    setShowSubTaskInput(false);
  };

  return (
    <article
      className={`card relative overflow-hidden transition-all duration-200 ${
        isDone ? "opacity-60" : ""
      } ${isDeleting ? "scale-[0.97] opacity-0" : ""}`}
      style={{ transition: "box-shadow 200ms ease, transform 200ms ease, opacity 200ms ease" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={`任務: ${task.title}`}
    >
      {/* Priority left border accent */}
      {!isDone && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
          style={{
            background:
              task.priority === "high"
                ? "var(--priority-high)"
                : task.priority === "medium"
                ? "var(--priority-medium)"
                : "var(--priority-low)",
          }}
        />
      )}

      <div className="flex items-start gap-3 pl-5 pr-4 py-4">
        {/* Status toggle */}
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
                isDone
                  ? "line-through"
                  : ""
              }`}
              style={isDone ? { color: "var(--text-tertiary)" } : { color: "var(--text-primary)" }}
            >
              {task.title}
            </h3>
            <div className="flex-shrink-0 flex items-center gap-1.5">
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
              <PriorityBadge priority={task.priority} size="sm" />
            </div>
          </div>

          {/* Sub-task progress bar */}
          {subTasks.length > 0 && !isExpanded && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${subTaskProgress * 100}%`,
                    background: subTaskProgress === 1 ? "var(--status-success)" : "var(--brand)",
                  }}
                />
              </div>
              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {completedSubTasks}/{subTasks.length}
              </span>
            </div>
          )}

          {/* Meta row — collapsed */}
          {!isExpanded && hasMeta && (
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
              {task.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="pill-muted text-[11px] py-0.5">{tag}</span>
              ))}
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
              <button
                onClick={handleExpand}
                className="flex items-center gap-0.5 text-[11px] hover:underline transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                aria-label={isExpanded ? "收起詳情" : "展開詳情"}
              >
                {isExpanded ? "收起" : "詳情"}
                <ChevronDown className="w-3 h-3 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }} />
              </button>
            </div>
          )}

          {/* Expanded content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-3">
                  {/* Description */}
                  {task.description && (
                    <div>
                      <p
                        className={`text-[13px] leading-relaxed ${
                          isDone ? "line-through opacity-50" : ""
                        }`}
                        style={{ color: isDone ? "var(--text-tertiary)" : "var(--text-secondary)" }}
                      >
                        {task.description}
                      </p>
                    </div>
                  )}

                  {/* Due date */}
                  {dueInfo && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
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
                            <AlertCircle className="w-3 h-3" /> 已逾期 ·
                          </span>
                        )}
                        截止 {dueInfo.text}
                        {dueInfo.isToday && "（今天）"}
                        {dueInfo.isTomorrow && "（明天）"}
                        {task.dueTime && ` · ${task.dueTime}`}
                      </span>
                    </div>
                  )}

                  {/* Recurrence info */}
                  {task.recurrence && (
                    <div className="flex items-center gap-2">
                      <Repeat className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--brand)" }} />
                      <span className="text-[12px]" style={{ color: "var(--brand)" }}>
                        {task.recurrence.pattern === "daily" && "每天"}
                        {task.recurrence.pattern === "weekly" && "每週"}
                        {task.recurrence.pattern === "monthly" && "每月"}
                        {task.recurrence.pattern === "yearly" && "每年"}
                        {task.recurrence.pattern === "custom" && `每隔 ${task.recurrence.interval} 天`}
                        {task.recurrence.completedCount > 0 && ` · 已完成 ${task.recurrence.completedCount} 次`}
                      </span>
                    </div>
                  )}

                  {/* Tags */}
                  {task.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <TagIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
                      <div className="flex flex-wrap gap-1.5">
                        {task.tags.map((tag) => (
                          <span key={tag} className="pill-muted">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {task.attachments && task.attachments.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                          附件 ({task.attachments.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {task.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative aspect-square rounded-xl overflow-hidden border transition-all hover:border-brand"
                            style={{ borderColor: "var(--border)" }}
                            title={attachment.name}
                          >
                            {attachment.type === "image" ? (
                              <img
                                src={attachment.url}
                                alt={attachment.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-2"
                                style={{ background: "var(--surface-muted)" }}>
                                <span className="text-3xl mb-1">{getFileIcon(attachment.mimeType)}</span>
                                <span className="text-[10px] text-center truncate w-full" style={{ color: "var(--text-tertiary)" }}>
                                  {attachment.name}
                                </span>
                              </div>
                            )}
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-[11px] font-medium">預覽</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sub-tasks */}
                  {subTasks.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                          子任務 ({completedSubTasks}/{subTasks.length})
                        </span>
                        {subTaskProgress === 1 && isDone && (
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
                    </div>
                  )}

                  {/* Add sub-task */}
                  {showSubTaskInput ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleSubTaskSubmit(); }}
                      className="flex items-center gap-2"
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
                        onClick={() => { setShowSubTaskInput(false); setNewSubTaskTitle(""); }}
                        className="btn-ghost py-1.5 px-3 text-[12px]"
                      >
                        取消
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowSubTaskInput(true)}
                      className="flex items-center gap-1.5 text-[12px] hover:underline transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增子任務
                    </button>
                  )}

                  {/* Collapse button */}
                  <button
                    onClick={handleExpand}
                    className="flex items-center gap-0.5 text-[11px] hover:underline transition-colors pt-1"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    收起
                    <ChevronDown className="w-3 h-3 transition-transform duration-200" style={{ transform: "rotate(180deg)" }} />
                  </button>

                  {/* Comments inline */}
                  <TaskCommentsInline taskId={task.id} />

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hover actions */}
        <div
          className="flex-shrink-0 flex items-center gap-0.5 transition-all duration-200"
          style={{
            opacity: isHovered && !isDone ? 1 : 0,
            transform: isHovered && !isDone ? "translateX(0)" : "translateX(-4px)",
          }}
        >
          <button
            onClick={() => onEdit(task)}
            className="p-2 rounded-lg hover:bg-black/5 transition-all duration-150 active:scale-90"
            style={{ color: "var(--text-tertiary)" }}
            aria-label="編輯任務"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          {onArchive && (
            <button
              onClick={() => onArchive(task.id)}
              className="p-2 rounded-lg hover:bg-black/5 transition-all duration-150 active:scale-90"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="封存任務"
              title="封存"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg hover:bg-red-50 transition-all duration-150 active:scale-90"
            style={{ color: "var(--text-tertiary)" }}
            aria-label="刪除任務"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

    </article>
  );
}
