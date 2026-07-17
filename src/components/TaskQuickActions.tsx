"use client";

import { useEffect, useState } from "react";
import { Task, Priority } from "@/lib/types";
import { getEisenhowerVisual } from "@/lib/eisenhower";
import { IconPopover } from "./IconPopover";
import { getTagColors } from "@/lib/storage";
import {
  Flag, Tag as TagIcon, Paperclip, ListChecks, Plus, X,
  AlertCircle, Image as ImageIcon, FileText, Pin,
} from "lucide-react";

interface TaskQuickActionsProps {
  task: Task;
  onUpdatePriority: (p: Priority) => void;
  onUpdateTags: (tags: string[]) => void;
  /** 釘選/取消釘選 */
  onTogglePin?: () => void;
  /** 標籤的候選名單（已存在任務的全集） */
  allTags?: string[];
  compact?: boolean;
  /** 唯讀模式（共享任務等不能編輯的情境，旗子/標籤不可點擊） */
  readOnly?: boolean;
}

export function TaskQuickActions({
  task,
  onUpdatePriority,
  onUpdateTags,
  onTogglePin,
  allTags = [],
  compact = false,
  readOnly = false,
}: TaskQuickActionsProps) {
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    setTagColors(getTagColors());
  }, []);

  // 每分鐘重算一次 Q1 狀態，讓「24h 內」的條件即時生效
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const eisen = getEisenhowerVisual(task, now);
  const priorityColor = eisen.color;

  const handleRemoveTag = (t: string) => {
    onUpdateTags(task.tags.filter((x) => x !== t));
  };
  const handleAddTag = (t: string) => {
    if (!t || task.tags.includes(t)) return;
    onUpdateTags([...task.tags, t]);
  };

  // 子任務進度
  const subTasks = task.subTasks || [];
  const completedSub = subTasks.filter((s) => s.status === "done").length;
  const subRatio = subTasks.length > 0 ? completedSub / subTasks.length : 0;

  // 附件
  const attachments = task.attachments || [];
  const attachmentCount = attachments.length;
  const hasImage = attachments.some((a) => a.type?.startsWith("image/"));

  const iconBtnBase = `inline-flex items-center justify-center rounded-lg transition-all duration-150 active:scale-90 hover:bg-black/5`;
  const iconBtnSize = compact ? "w-7 h-7" : "w-8 h-8";

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* 旗子：四象限視覺（Q1=深紅+驚嘆號、Q2=紅、Q3=黃、Q4=綠） */}
      {readOnly ? (
        <div
          className={`${iconBtnBase} ${iconBtnSize} relative cursor-default`}
          style={{ color: priorityColor }}
          title={`優先級：${eisen.label}`}
          aria-label={`優先級 ${eisen.label}${eisen.isUrgent ? "（緊急）" : ""}`}
        >
          <Flag
            className={compact ? "w-3.5 h-3.5" : "w-4 h-4"}
            fill={task.priority !== "low" || eisen.isUrgent ? "currentColor" : "none"}
          />
          {eisen.isUrgent && (
            <AlertCircle
              className="absolute -top-1 -right-1 drop-shadow-sm"
              style={{
                width: compact ? 10 : 12,
                height: compact ? 10 : 12,
                color: "#fff",
                background: priorityColor,
                borderRadius: "50%",
                padding: 1,
              }}
              fill={priorityColor}
              strokeWidth={2.5}
            />
          )}
        </div>
      ) : (
        <IconPopover
          align="end"
          side="bottom"
          trigger={
            <button
              onClick={() => {}} // IconPopover wrapper 處理開合，不 stopPropagation
              className={`${iconBtnBase} ${iconBtnSize} relative`}
              style={{ color: priorityColor }}
              title={`優先級：${eisen.label}（點擊選擇）`}
              aria-label={`優先級 ${eisen.label}${eisen.isUrgent ? "（緊急）" : ""}`}
              aria-haspopup="menu"
            >
              <Flag
                className={compact ? "w-3.5 h-3.5" : "w-4 h-4"}
                fill={task.priority !== "low" || eisen.isUrgent ? "currentColor" : "none"}
              />
              {eisen.isUrgent && (
                <AlertCircle
                  className="absolute -top-1 -right-1 drop-shadow-sm"
                  style={{
                    width: compact ? 10 : 12,
                    height: compact ? 10 : 12,
                    color: "#fff",
                    background: priorityColor,
                    borderRadius: "50%",
                    padding: 1,
                  }}
                  fill={priorityColor}
                  strokeWidth={2.5}
                />
              )}
            </button>
          }
        >
          <PriorityPopoverContent
            current={task.priority}
            isUrgent={eisen.isUrgent}
            compact={compact}
            onSelect={(p) => onUpdatePriority(p)}
          />
        </IconPopover>
      )}

      {/* 圖釘：置頂（旗子之後、標籤之前） */}
      {onTogglePin && !readOnly && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={`${iconBtnBase} ${iconBtnSize} relative`}
          style={{ color: task.isPinned ? "var(--brand)" : "var(--text-tertiary)" }}
          title={task.isPinned ? "取消置頂" : "置頂此任務"}
          aria-label={task.isPinned ? "取消置頂" : "置頂"}
          aria-pressed={task.isPinned}
        >
          <Pin
            className={compact ? "w-3.5 h-3.5" : "w-4 h-4"}
            fill={task.isPinned ? "currentColor" : "none"}
          />
        </button>
      )}

      {/* 標籤 popover（唯讀時也顯示，但不可編輯） */}
      <IconPopover
        align="end"
        side="bottom"
        trigger={
          readOnly ? (
            <div
              className={`${iconBtnBase} ${iconBtnSize} relative cursor-default`}
              style={{
                color: task.tags.length > 0 ? "var(--brand)" : "var(--text-tertiary)",
              }}
              title="標籤"
              aria-label={`標籤 ${task.tags.length} 個`}
            >
              <TagIcon className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
              {task.tags.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 flex items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    background: "var(--brand)",
                    color: "var(--brand-foreground)",
                  }}
                >
                  {task.tags.length}
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={() => {}} // IconPopover wrapper 會處理開合，這裡不做事也不 stopPropagation，否則 wrapper 收不到 click
              className={`${iconBtnBase} ${iconBtnSize} relative`}
              style={{
                color: task.tags.length > 0 ? "var(--brand)" : "var(--text-tertiary)",
              }}
              title="標籤"
              aria-label={`標籤 ${task.tags.length} 個`}
            >
              <TagIcon className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
              {task.tags.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 flex items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    background: "var(--brand)",
                    color: "var(--brand-foreground)",
                  }}
                >
                  {task.tags.length}
                </span>
              )}
            </button>
          )
        }
      >
        <TagPopoverContent
          tags={task.tags}
          tagColors={tagColors}
          allTags={allTags}
          onAdd={handleAddTag}
          onRemove={readOnly ? () => {} : handleRemoveTag}
          readOnly={readOnly}
        />
      </IconPopover>

      {/* 附件 popover */}
      {attachmentCount > 0 && (
        <IconPopover
          align="end"
          side="bottom"
          trigger={
            <button
              onClick={() => {}} // IconPopover wrapper 會處理開合，這裡不做事也不 stopPropagation
              className={`${iconBtnBase} ${iconBtnSize} relative`}
              style={{
                color: hasImage ? "var(--brand)" : "var(--text-tertiary)",
              }}
              title="附件"
              aria-label={`附件 ${attachmentCount} 個`}
            >
              <Paperclip className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
              <span
                className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 flex items-center justify-center rounded-full text-[9px] font-bold"
                style={{
                  background: "var(--surface-muted)",
                  color: "var(--text-secondary)",
                }}
              >
                {attachmentCount}
              </span>
            </button>
          }
        >
          <AttachmentPopoverContent attachments={attachments} />
        </IconPopover>
      )}

      {/* 子任務進度（唯讀） */}
      {subTasks.length > 0 && (
        <div
          className={`${iconBtnBase} ${iconBtnSize} relative cursor-default`}
          style={{ color: subRatio === 1 ? "var(--status-success)" : "var(--text-tertiary)" }}
          title={`子任務 ${completedSub}/${subTasks.length}`}
          aria-label={`子任務 ${completedSub} 個完成，共 ${subTasks.length} 個`}
        >
          <ListChecks className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          <span
            className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full overflow-hidden"
            style={{ background: "var(--border)" }}
          >
            <span
              className="h-full"
              style={{
                width: `${subRatio * 100}%`,
                background: "var(--status-success)",
                transition: "width 200ms ease",
              }}
            />
          </span>
        </div>
      )}
    </div>
  );
}

function TagPopoverContent({
  tags,
  tagColors,
  allTags,
  onAdd,
  onRemove,
  readOnly = false,
}: {
  tags: string[];
  tagColors: Record<string, string>;
  allTags: string[];
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
  readOnly?: boolean;
}) {
  const [input, setInput] = useState("");
  const suggestions = input.trim()
    ? allTags.filter(
        (t) =>
          !tags.includes(t) &&
          t.toLowerCase().includes(input.trim().toLowerCase()),
      ).slice(0, 5)
    : [];

  return (
    <div className="p-3 space-y-2 w-[220px]">
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
        標籤
      </div>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const color = tagColors[tag] || "#3B82F6";
            return (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[11px] py-0.5 pl-2 pr-1 rounded-md"
                style={{
                  background: `${color}15`,
                  color: color,
                  border: `1px solid ${color}25`,
                }}
              >
                {tag}
                {!readOnly && (
                  <button
                    onClick={() => onRemove(tag)}
                    className="p-0.5 rounded hover:bg-black/10 transition-colors"
                    aria-label={`移除 ${tag}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          尚未新增標籤
        </div>
      )}

      {!readOnly && (
        <>
          <div className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAdd(input.trim());
                  setInput("");
                }
              }}
              placeholder="新增標籤..."
              className="input flex-1 text-[12px]"
              style={{ padding: "6px 8px" }}
              maxLength={30}
            />
            <button
              onClick={() => {
                onAdd(input.trim());
                setInput("");
              }}
              disabled={!input.trim()}
              className="btn-primary px-2 disabled:opacity-40"
              aria-label="新增"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-0.5 pt-1">
              <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                已存在的標籤：
              </div>
              {suggestions.map((tag) => {
                const color = tagColors[tag] || "#3B82F6";
                return (
                  <button
                    key={tag}
                    onClick={() => onAdd(tag)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-black/5"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: color }}
                    />
                    <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                      {tag}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AttachmentPopoverContent({
  attachments,
}: {
  attachments: { id: string; name: string; url: string; type?: string }[];
}) {
  return (
    <div className="p-3 space-y-2 w-[240px] max-h-[280px] overflow-y-auto">
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
        附件 ({attachments.length})
      </div>
      <div className="space-y-1">
        {attachments.map((a) => {
          const isImage = a.type?.startsWith("image/");
          return (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 p-1.5 rounded-lg transition-colors hover:bg-black/5"
            >
              {isImage ? (
                <ImageIcon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--brand)" }} />
              ) : (
                <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
              )}
              <span className="flex-1 text-[12px] truncate" style={{ color: "var(--text-primary)" }}>
                {a.name}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ─── 優先級選單內容（艾森豪四象限視覺）─────────────────────
function PriorityPopoverContent({
  current,
  isUrgent,
  compact,
  onSelect,
}: {
  current: Priority;
  isUrgent: boolean;
  compact: boolean;
  onSelect: (p: Priority) => void;
}) {
  const options: Array<{ value: Priority; label: string; color: string; urgent?: boolean }> = [
    { value: "urgent", label: "緊急", color: "#D70015", urgent: true },
    { value: "high", label: "高", color: "var(--priority-high)" },
    { value: "medium", label: "中", color: "var(--priority-medium)" },
    { value: "low", label: "低", color: "var(--priority-low)" },
  ];

  return (
    <div className="p-1.5 w-[220px]">
      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
        優先級
      </div>
      <div className="grid grid-cols-4 gap-1 mt-0.5">
        {options.map((opt) => {
          const isActive = current === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className="flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-150 hover:bg-black/5 active:scale-95"
              style={isActive ? { background: `${opt.color}15`, border: `1.5px solid ${opt.color}` } : { border: "1.5px solid transparent" }}
              aria-pressed={isActive}
              aria-label={`設定優先級為 ${opt.label}`}
            >
              {opt.urgent ? (
                <Flag
                  className={compact ? "w-4 h-4" : "w-5 h-5"}
                  style={{ color: opt.color }}
                  fill="currentColor"
                />
              ) : (
                <Flag
                  className={compact ? "w-4 h-4" : "w-5 h-5"}
                  style={{ color: opt.color }}
                  fill={isActive ? "currentColor" : (opt.value === "low" ? "none" : "currentColor")}
                />
              )}
              <span className="text-[11px] font-medium" style={{ color: isActive ? opt.color : "var(--text-secondary)" }}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
      {isUrgent && current !== "urgent" && (
        <div className="mt-1.5 px-2 py-1.5 text-[11px] flex items-center gap-1.5 rounded-lg" style={{ background: "rgba(215,0,21,0.08)", color: "#D70015" }}>
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>24h 內到期，建議標為緊急</span>
        </div>
      )}
      {current === "urgent" && (
        <div className="mt-1.5 px-2 py-1.5 text-[11px] flex items-center gap-1.5 rounded-lg" style={{ background: "rgba(215,0,21,0.08)", color: "#D70015" }}>
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>已標為緊急（艾森豪 Q1）</span>
        </div>
      )}
    </div>
  );
}
