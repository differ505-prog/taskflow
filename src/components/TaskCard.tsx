"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Task, SubTask, Priority } from "@/lib/types";
import TaskCommentsInline from "./TaskCommentsInline";
import TaskCommentsDrawer from "./TaskCommentsDrawer";
import { getEisenhowerVisual } from "@/lib/eisenhower";
import { getTagColors } from "@/lib/storage";
import { haptic } from "@/lib/haptics";
import { fireTaskDoneConfetti, playTaskDoneSound } from "@/lib/confetti";
import { useSubTaskCollapse } from "@/utils/useSubTaskCollapse";
import { SubTaskItem } from "./SubTaskItem";
import { DueDateChip } from "./DueDateChip";
import { TaskCardToolbar } from "./TaskCardToolbar";
import {
  CheckCircle2, Circle, Plus, ListChecks, Paperclip, ExternalLink,
  ChevronDown, ChevronRight,
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
  onFocusNow?: (taskId: string) => void;
  allTags?: string[];
  onHoverEnter?: (id: string) => void;
  onHoverLeave?: (id: string) => void;
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
  onFocusNow,
  allTags = [],
  onHoverEnter,
  onHoverLeave,
}: TaskCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSubTaskInput, setShowSubTaskInput] = useState(false);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [commentsDrawerOpen, setCommentsDrawerOpen] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState("");

  useEffect(() => {
    setTagColors(getTagColors());
  }, []);

  const isDone = task.status === "done";
  const subTasks = task.subTasks || [];
  const completedSubTasks = subTasks.filter((s) => s.status === "done").length;
  const todoSubTasks = subTasks.filter((s) => s.status !== "done");
  const doneSubTasks = subTasks.filter((s) => s.status === "done");
  const attachmentCount = task.attachments?.length || 0;
  const { isCollapsed: isDoneCollapsed, toggle: toggleDoneCollapse } = useSubTaskCollapse(task.id, subTasks);

  // ── Handlers ────────────────────────────────────────────────

  const handleToggleStatus = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    haptic("success");
    const wasNotDone = !isDone;
    onToggleStatus(task.id);
    if (wasNotDone) {
      fireTaskDoneConfetti(e.currentTarget);
      playTaskDoneSound();
    }
  }, [onToggleStatus, task.id, isDone]);

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
    subtaskInputRef.current?.focus();
  };

  const handleSubTaskToggle = (subId: string) => {
    onToggleSubTask?.(task.id, subId);
  };

  const handleSubTaskDelete = (subId: string) => {
    onDeleteSubTask?.(task.id, subId);
  };

  // ── Render ───────────────────────────────────────────────────

  return (
    <article
      className={`card relative overflow-hidden transition-all duration-200 ${
        isDone ? "opacity-60" : ""
      } ${isDeleting ? "scale-[0.97] opacity-0" : ""}`}
      onClick={handleCardClick}
      role="button"
      aria-label={`任務: ${task.title}`}
      tabIndex={0}
      onMouseEnter={onHoverEnter ? () => onHoverEnter(task.id) : undefined}
      onMouseLeave={onHoverLeave ? () => onHoverLeave(task.id) : undefined}
      onFocus={onHoverEnter ? () => onHoverEnter(task.id) : undefined}
      onBlur={onHoverLeave ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) onHoverLeave(task.id); } : undefined}
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
                isDone ? "line-through" : ""
              }`}
              style={isDone ? { color: "var(--text-tertiary)" } : { color: "var(--text-primary)" }}
            >
              {task.title}
            </h3>

            {/* 右上角工具列 */}
            <div
              className="flex-shrink-0 flex items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <TaskCardToolbar
                task={task}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onArchive={onArchive ? handleArchive : undefined}
                onUpdatePriority={onUpdatePriority ? (p) => onUpdatePriority(task.id, p) : undefined}
                onUpdateTags={onUpdateTags ? (tags) => onUpdateTags(task.id, tags) : undefined}
                onFocusNow={onFocusNow}
                allTags={allTags}
              />
            </div>
          </div>

          {/* Meta row */}
          {(task.dueDate || task.tags.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <DueDateChip
                dueDate={task.dueDate}
                startDate={task.startDate}
                dueTime={task.dueTime}
                isDone={isDone}
              />
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

          {/* Sub-tasks */}
          {subTasks.length > 0 && (
            <SubTasksSection
              todoSubTasks={todoSubTasks}
              doneSubTasks={doneSubTasks}
              completedSubTasks={completedSubTasks}
              totalSubTasks={subTasks.length}
              isDoneCollapsed={isDoneCollapsed}
              toggleDoneCollapse={toggleDoneCollapse}
              showSubTaskInput={showSubTaskInput}
              setShowSubTaskInput={setShowSubTaskInput}
              newSubTaskTitle={newSubTaskTitle}
              setNewSubTaskTitle={setNewSubTaskTitle}
              subtaskInputRef={subtaskInputRef}
              handleSubTaskSubmit={handleSubTaskSubmit}
              onAddSubTask={!!onAddSubTask}
              onSubTaskToggle={handleSubTaskToggle}
              onSubTaskDelete={handleSubTaskDelete}
            />
          )}

          {/* Comments */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCommentsDrawerOpen(true); }}
              className="absolute right-0 top-0 z-10 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-all duration-200 hover:bg-[var(--hover-bg)] active:scale-95"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="開啟留言面板"
              title="於留言面板開啟"
            >
              <ExternalLink className="w-3 h-3" />
              面板
            </button>
            <TaskCommentsInline taskId={task.id} />
          </div>
          <TaskCommentsDrawer
            taskId={task.id}
            taskTitle={task.title}
            open={commentsDrawerOpen}
            onClose={() => setCommentsDrawerOpen(false)}
          />

          {/* Bottom action bar */}
          <div
            className="flex items-center gap-1 mt-3 pt-3 border-t"
            style={{ borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleEdit}
              className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-all duration-150 active:scale-90"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="編輯任務"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            {onArchive && (
              <button
                onClick={handleArchive}
                className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-all duration-150 active:scale-90"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="封存任務"
                title="封存"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Sub-components ──────────────────────────────────────────────

interface SubTasksSectionProps {
  todoSubTasks: SubTask[];
  doneSubTasks: SubTask[];
  completedSubTasks: number;
  totalSubTasks: number;
  isDoneCollapsed: boolean;
  toggleDoneCollapse: () => void;
  showSubTaskInput: boolean;
  setShowSubTaskInput: (v: boolean) => void;
  newSubTaskTitle: string;
  setNewSubTaskTitle: (v: string) => void;
  subtaskInputRef: React.RefObject<HTMLInputElement | null>;
  handleSubTaskSubmit: () => void;
  onAddSubTask: boolean;
  onSubTaskToggle: (subId: string) => void;
  onSubTaskDelete: (subId: string) => void;
}

function SubTasksSection({
  todoSubTasks,
  doneSubTasks,
  completedSubTasks,
  totalSubTasks,
  isDoneCollapsed,
  toggleDoneCollapse,
  showSubTaskInput,
  setShowSubTaskInput,
  newSubTaskTitle,
  setNewSubTaskTitle,
  subtaskInputRef,
  handleSubTaskSubmit,
  onAddSubTask,
  onSubTaskToggle,
  onSubTaskDelete,
}: SubTasksSectionProps) {
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
      {/* 未完成群組（永遠展開） */}
      {todoSubTasks.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ListChecks className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
            <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
              子任務 ({completedSubTasks}/{totalSubTasks})
            </span>
          </div>
          <div className="pl-1 space-y-0.5">
            {todoSubTasks.map((sub) => (
              <SubTaskItem
                key={sub.id}
                sub={sub}
                onToggle={() => onSubTaskToggle(sub.id)}
                onDelete={() => onSubTaskDelete(sub.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 已完成群組（獨立可折疊） */}
      {doneSubTasks.length > 0 && (
        <div className={todoSubTasks.length > 0 ? "mt-2 pt-2 border-t border-dashed" : ""} style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleDoneCollapse(); }}
            className="flex items-center gap-1.5 w-full text-left"
            aria-expanded={!isDoneCollapsed}
            aria-label={isDoneCollapsed ? `展開 ${doneSubTasks.length} 項已完成子任務` : `摺疊 ${doneSubTasks.length} 項已完成子任務`}
          >
            {isDoneCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
            )}
            <span className="text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>
              已完成 ({doneSubTasks.length})
            </span>
            {todoSubTasks.length === 0 && (
              <span className="text-[11px] font-medium ml-1" style={{ color: "var(--status-success)" }}>
                ✓ 全部完成
              </span>
            )}
          </button>

          {!isDoneCollapsed && (
            <div className="pl-1 space-y-0.5 mt-1.5">
              {doneSubTasks.map((sub) => (
                <SubTaskItem
                  key={sub.id}
                  sub={sub}
                  onToggle={() => onSubTaskToggle(sub.id)}
                  onDelete={() => onSubTaskDelete(sub.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 新增子任務 */}
      {onAddSubTask && (
        <div className="mt-2">
          {showSubTaskInput ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleSubTaskSubmit(); }}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                ref={subtaskInputRef}
                value={newSubTaskTitle}
                onChange={(e) => setNewSubTaskTitle(e.target.value)}
                placeholder="輸入子任務..."
                className="input flex-1"
                style={{ fontSize: 16, padding: "6px 10px" }}
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
              onClick={(e) => { e.stopPropagation(); setShowSubTaskInput(true); subtaskInputRef.current?.focus(); }}
              className="flex items-center gap-1.5 text-[12px] hover:underline transition-colors"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              新增子任務
            </button>
          )}
        </div>
      )}
    </div>
  );
}
