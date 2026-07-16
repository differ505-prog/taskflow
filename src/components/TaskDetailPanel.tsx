"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Task, Priority, TaskStatus, Recurrence, SubTask, Attachment } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/types";
import { useApp } from "@/lib/AppContext";
import { getTagColors } from "@/lib/storage";
import { getEisenhowerVisual } from "@/lib/eisenhower";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Plus, Repeat, Calendar, Mic, MicOff, Hash,
  Trash2, CheckCircle2, Circle, Tag as TagIcon,
  AlignLeft, Clock, Timer, ListChecks, Paperclip,
  AlertCircle, Flag, ChevronDown,
} from "lucide-react";
import { ProtectedUploadButton } from "./ProtectedUploadButton";
import { EisenhowerQuadrantGrid } from "./EisenhowerQuadrantGrid";
import { SwipeableSubTask } from "./SwipeableSubTask";
import TaskCommentsInline from "./TaskCommentsInline";
import { TextWithLinks } from "./TextWithLinks";

const RECURRENCE_OPTIONS = [
  { label: "不重複", value: "none" },
  { label: "每天", value: "daily" },
  { label: "每週", value: "weekly" },
  { label: "每月", value: "monthly" },
  { label: "每年", value: "yearly" },
  { label: "自訂間隔", value: "custom" },
];

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

interface TaskDetailPanelProps {
  task: Task;
  onClose?: () => void;
}

const SELECT_ARROW = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23999' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E";

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const { updateTask, deleteTask, lists, getTagCounts } = useApp();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [startDate, setStartDate] = useState(task.startDate || "");
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [dueTime, setDueTime] = useState(task.dueTime || "");
  const [listId, setListId] = useState<string | undefined>(task.listId);
  const [tags, setTags] = useState<string[]>(task.tags);
  const [tagInput, setTagInput] = useState("");
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recurrenceType, setRecurrenceType] = useState(task.recurrence?.pattern || "none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(task.recurrence?.interval || 1);
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>(task.recurrence?.daysOfWeek || []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(task.recurrence?.endDate || "");
  const [subTasks, setSubTasks] = useState<SubTask[]>(task.subTasks || []);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const [subtaskInputValue, setSubtaskInputValue] = useState("");
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(task.attachments || []);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showTagPanel, setShowTagPanel] = useState(false);

  useEffect(() => {
    setTagColors(getTagColors());
  }, []);

  // Sync local state when switching tasks
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    setPriority(task.priority);
    setStatus(task.status);
    setStartDate(task.startDate || "");
    setDueDate(task.dueDate || "");
    setDueTime(task.dueTime || "");
    setListId(task.listId);
    setTags(task.tags);
    setRecurrenceType(task.recurrence?.pattern || "none");
    setRecurrenceInterval(task.recurrence?.interval || 1);
    setRecurrenceDaysOfWeek(task.recurrence?.daysOfWeek || []);
    setRecurrenceEndDate(task.recurrence?.endDate || "");
    setSubTasks(task.subTasks || []);
    setEditingSubId(null);
    setAttachments(task.attachments || []);
    setHasChanges(false);
  }, [task.id]);

  // Track changes
  useEffect(() => {
    const changed =
      title !== task.title ||
      description !== (task.description || "") ||
      priority !== task.priority ||
      status !== task.status ||
      startDate !== (task.startDate || "") ||
      dueDate !== (task.dueDate || "") ||
      dueTime !== (task.dueTime || "") ||
      listId !== task.listId ||
      JSON.stringify(tags) !== JSON.stringify(task.tags) ||
      recurrenceType !== (task.recurrence?.pattern || "none") ||
      recurrenceInterval !== (task.recurrence?.interval || 1) ||
      JSON.stringify(recurrenceDaysOfWeek) !== JSON.stringify(task.recurrence?.daysOfWeek || []) ||
      recurrenceEndDate !== (task.recurrence?.endDate || "") ||
      JSON.stringify(subTasks) !== JSON.stringify(task.subTasks || []) ||
      JSON.stringify(attachments) !== JSON.stringify(task.attachments || []);
    setHasChanges(changed);
  }, [title, description, priority, status, startDate, dueDate, dueTime, listId, tags, recurrenceType, recurrenceInterval, recurrenceDaysOfWeek, recurrenceEndDate, subTasks, attachments, task]);

  const counts: Record<string, number> = getTagCounts();

  const updateTagSuggestions = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) { setSuggestions([]); setShowSuggestions(false); return; }
    const query = trimmed.startsWith("#") ? trimmed.slice(1).toLowerCase() : trimmed.toLowerCase();
    const allTags = Object.keys(counts).filter((tag) => {
      if (tags.includes(tag)) return false;
      const normalized = tag.startsWith("#") ? tag.slice(1) : tag;
      return normalized.toLowerCase().includes(query);
    }).sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
    setSuggestions(allTags.slice(0, 5));
    setShowSuggestions(allTags.length > 0 || query.length > 0);
  }, [tags, counts]);

  const selectSuggestion = useCallback((tag: string) => {
    if (!tags.includes(tag)) { setTags([...tags, tag]); }
    setTagInput(""); setSuggestions([]); setShowSuggestions(false);
  }, [tags]);

  const handleVoiceInput = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-TW";
    recognition.continuous = false;
    recognition.interimResults = false;
    if (isRecording) { recognition.stop(); setIsRecording(false); return; }
    setIsRecording(true);
    recognition.start();
    recognition.onresult = (event: any) => {
      setTitle((prev) => prev + event.results[0][0].transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
  }, [isRecording]);

  const handleSave = () => {
    let recurrence: Recurrence | undefined;
    if (recurrenceType !== "none") {
      recurrence = {
        pattern: recurrenceType as Recurrence["pattern"],
        interval: recurrenceInterval,
        completedCount: task.recurrence?.completedCount || 0,
        daysOfWeek: recurrenceType === "weekly" ? recurrenceDaysOfWeek : undefined,
        endDate: recurrenceEndDate || undefined,
      };
    }
    const finalDueDate = dueDate || startDate || undefined;
    updateTask(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      startDate: startDate || undefined,
      dueDate: finalDueDate,
      dueTime: dueTime || undefined,
      listId,
      tags,
      subTasks,
      recurrence,
      attachments,
    });
    setHasChanges(false);
  };

  const handleDelete = () => {
    if (confirm(`刪除任務「${task.title}」？`)) {
      deleteTask(task.id);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(""); }
  };

  const addSubTask = () => {
    const t = subtaskInputValue.trim();
    if (!t) return;
    const newSub: SubTask = {
      id: `${Date.now()}-sub`,
      title: t,
      status: "todo" as const,
      createdAt: new Date().toISOString(),
    };
    const updated: SubTask[] = [...subTasks, newSub];
    setSubTasks(updated);
    updateTask(task.id, { subTasks: updated });
    setSubtaskInputValue("");
    subtaskInputRef.current?.focus();
  };

  const toggleSubTask = (subId: string) => {
    const updated: SubTask[] = subTasks.map((s) =>
      s.id === subId ? { ...s, status: s.status === "done" ? "todo" : "done" } : s
    );
    setSubTasks(updated);
    // 自動儲存勾選狀態變更
    updateTask(task.id, { subTasks: updated });
  };

  const deleteSubTask = (subId: string) => {
    const updated: SubTask[] = subTasks.filter((s) => s.id !== subId);
    setSubTasks(updated);
    // 自動儲存刪除變更
    updateTask(task.id, { subTasks: updated });
  };

  const commitEditSubTask = (subId: string, rawTitle: string) => {
    const title = rawTitle.trim();
    if (!title) {
      // 空字串視為刪除
      deleteSubTask(subId);
      setEditingSubId(null);
      return;
    }
    const updated: SubTask[] = subTasks.map((s) => (s.id === subId ? { ...s, title } : s));
    setSubTasks(updated);
    updateTask(task.id, { subTasks: updated });
    setEditingSubId(null);
  };

  const selectStyle = {
    appearance: "none" as const,
    backgroundImage: `url("${SELECT_ARROW}")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    backgroundSize: "16px",
    paddingRight: "36px",
  };

  const formatDateLabel = (iso: string): string => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return `${m}/${d}`;
  };

  // Native swipe to close functionality
  const panelRef = useRef<HTMLDivElement>(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    // Only allow left swipe (negative diff)
    if (diff < 0) {
      setSwipeX(diff);
    }
  };

  const handleTouchEnd = () => {
    const diff = touchCurrentX.current - touchStartX.current;
    // Swipe left more than 80px to close
    if (diff < -80) {
      onClose?.();
    }
    setSwipeX(0);
  };

  const panelStyle = onClose ? {
    transform: `translateX(${swipeX}px)`,
    transition: swipeX === 0 ? 'transform 0.25s ease-out' : 'none',
  } : {};

  return (
    <div
      ref={panelRef}
      className="flex flex-col h-full overflow-hidden"
      onTouchStart={onClose ? handleTouchStart : undefined}
      onTouchMove={onClose ? handleTouchMove : undefined}
      onTouchEnd={onClose ? handleTouchEnd : undefined}
      style={panelStyle}
    >
      {/* Swipe indicator */}
      {onClose && swipeX < 0 && (
        <div className="absolute top-1/2 left-3 -translate-y-1/2 z-10 pointer-events-none" style={{ opacity: Math.min(1, Math.abs(swipeX) / 100) }}>
          <svg className="w-4 h-7" viewBox="0 0 16 28" fill="none">
            <path d="M10 6L4 14L10 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)' }}/>
          </svg>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 touch-none" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-black/5 transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="返回"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              任務詳情
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 rounded-xl hover:bg-red-50 transition-colors"
              style={{ color: "var(--status-danger)" }}
              aria-label="刪除任務"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || !title.trim()}
              className="btn-primary text-[13px] py-2 px-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              儲存
            </button>
          </div>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 pb-24">

        {/* Title */}
        <div>
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="任務標題"
              className="w-full text-[16px] font-medium bg-transparent border-none outline-none placeholder:text-[var(--text-tertiary)]"
              style={{ color: "var(--text-primary)" }}
              maxLength={200}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${isRecording ? "recording" : ""}`}
              style={{ color: isRecording ? "var(--status-danger)" : "var(--text-tertiary)" }}
              aria-label={isRecording ? "停止錄音" : "語音輸入"}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          {!title.trim() && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--status-danger)" }}>標題必填</p>
          )}
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlignLeft className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
            <label className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>描述</label>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="任務描述（支援 Markdown）"
            rows={3}
            className="input resize-none"
            style={{ minHeight: 80 }}
            maxLength={1000}
          />
        </div>

        {/* Sub-tasks */}
        <div className="rounded-2xl p-4" style={{ background: "var(--surface-muted)" }}>
          <div className="flex items-center gap-1.5 mb-3">
            <ListChecks className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
            <label className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
              子任務 ({subTasks.filter((s) => s.status === "done").length}/{subTasks.length})
            </label>
            <span className="ml-auto text-[11px]" style={{ color: "var(--text-tertiary)" }}>自動儲存</span>
          </div>
          {subTasks.map((sub) => (
            <SwipeableSubTask
              key={sub.id}
              sub={sub}
              isEditing={editingSubId === sub.id}
              onToggle={() => toggleSubTask(sub.id)}
              onEdit={() => setEditingSubId(sub.id)}
              onEditCommit={(title) => commitEditSubTask(sub.id, title)}
              onDelete={() => deleteSubTask(sub.id)}
            />
          ))}
          <div className="flex gap-2 mt-3">
            <input
              ref={subtaskInputRef}
              type="text"
              value={subtaskInputValue}
              onChange={(e) => setSubtaskInputValue(e.target.value)}
              onKeyUp={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubTask(); } }}
              placeholder="新增子任務..." className="input flex-1" style={{ fontSize: 13, padding: "8px 12px" }} />
            <button type="button" onClick={addSubTask} className="btn-ghost px-3" aria-label="新增子任務">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List + Priority + Attachments + Tags — 圖示化高頻區 */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-muted)" }}>
          {/* 清單：緊湊下拉 */}
          <div>
            <label className="block mb-2 text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>清單</label>
            <select value={listId || ""} onChange={(e) => setListId(e.target.value || undefined)} className="input cursor-pointer text-[13px]" style={selectStyle}>
              <option value="">📋 無清單</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
            </select>
          </div>

          {/* 高頻操作列：優先級 + 標籤 + 附件 */}
          <div className="flex items-start gap-2 relative" style={{ zIndex: 30 }}>
            {/* 優先級：艾森豪四象限 */}
            <div>
              <label className="block mb-2 text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>優先級</label>
              <EisenhowerQuadrantGrid priority={priority} onChange={setPriority} />

              {/* Q1 緊急提示：priority=high 且 dueDate 在 24h 內時顯示 */}
              {(() => {
                const eisen = getEisenhowerVisual({ priority, dueDate });
                if (!eisen.isUrgent) return null;
                return (
                  <div
                    className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px]"
                    style={{
                      background: `${eisen.color}12`,
                      color: eisen.color,
                      border: `1px solid ${eisen.color}30`,
                    }}
                  >
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-medium">24 小時內緊急</span>
                  </div>
                );
              })()}
            </div>

            {/* 標籤：圖示按鈕 + 計數 */}
            <div className="flex-1 relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowTagPanel(false); }}>
              <label className="block mb-1.5 text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>標籤</label>
              <button
                type="button"
                onClick={() => setShowTagPanel(!showTagPanel)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-colors w-full"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: tags.length > 0 ? "var(--brand)" : "var(--text-tertiary)" }}
                aria-label="管理標籤"
                aria-expanded={showTagPanel}
              >
                <TagIcon className="w-4 h-4" />
                <span className="text-[13px] flex-1 text-left">
                  {tags.length > 0 ? `${tags.length} 個標籤` : "新增標籤"}
                </span>
              </button>
              {/* 標籤輸入面板 */}
              {showTagPanel && (
                <div className="absolute left-0 top-full mt-1 z-20 rounded-xl p-3 min-w-[260px]" style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)" }}>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => { setTagInput(e.target.value); updateTagSuggestions(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addTag(); }
                      if (e.key === "Escape") { setShowSuggestions(false); }
                    }}
                    onFocus={() => { if (tagInput.trim()) updateTagSuggestions(tagInput); }}
                    placeholder="新增標籤..." className="input w-full text-[13px] mb-2" maxLength={50} />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {suggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => selectSuggestion(tag)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
                        >
                          <div className="w-2 h-2 rounded-full" style={{ background: tagColors[tag] || "#3B82F6" }} />
                          <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>{tag}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
                          style={{ background: `${tagColors[tag] || "#3B82F6"}20`, color: tagColors[tag] || "#3B82F6" }}
                        >
                          {tag}
                          <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-red-500" aria-label={`移除標籤 ${tag}`}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 附件：僅圖示 */}
            <div>
              <label className="block mb-1.5 text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>附件</label>
              <div className="flex items-center gap-2">
                {attachments.length > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
                    {attachments.length}
                  </span>
                )}
                <ProtectedUploadButton
                  existingAttachments={attachments}
                  onRemoveAttachment={(attachment) => setAttachments((prev) => prev.filter((a) => a.id !== attachment.id))}
                  onFilesUploaded={(newAttachments) => setAttachments((prev) => [...prev, ...newAttachments])}
                  buttonIcon={<Paperclip className="w-4 h-4" />}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>狀態</label>
          <div className="flex gap-2">
            {(["todo", "in-progress", "done"] as TaskStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className="flex-1 py-2 px-3 rounded-xl text-[13px] font-medium transition-all duration-150 border"
                style={
                  status === s
                    ? { background: "var(--text-primary)", color: "var(--surface)", borderColor: "var(--text-primary)" }
                    : { background: "var(--surface-elevated)", color: "var(--text-secondary)", borderColor: "var(--border)" }
                }
              >
                {s === "todo" ? "待辦" : s === "in-progress" ? "進行中" : "已完成"}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
                <label className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>開始日期</label>
              </div>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input cursor-pointer" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
                <label className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>截止日期</label>
              </div>
              <input type="date" value={dueDate} min={startDate || undefined} onChange={(e) => setDueDate(e.target.value)} className="input cursor-pointer" />
            </div>
          </div>
          {(startDate || dueDate) && (
            <div className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--text-tertiary)" }}>
              <Calendar className="w-3 h-3" />
              {startDate && dueDate && startDate !== dueDate
                ? `${formatDateLabel(startDate)} ~ ${formatDateLabel(dueDate)}`
                : formatDateLabel(startDate || dueDate)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Timer className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
              <label className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>具體時間</label>
            </div>
            <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="input cursor-pointer" />
          </div>
        </div>

        {/* Recurrence */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Repeat className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
            <label className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>重複</label>
          </div>
          <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)} className="input cursor-pointer" style={selectStyle}>
            {RECURRENCE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          {recurrenceType === "weekly" && (
            <div className="flex gap-2 mt-3">
              {WEEKDAY_LABELS.map((label, i) => {
                const active = recurrenceDaysOfWeek.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (active) setRecurrenceDaysOfWeek(recurrenceDaysOfWeek.filter((d) => d !== i));
                      else setRecurrenceDaysOfWeek([...recurrenceDaysOfWeek, i]);
                    }}
                    className="w-9 h-9 rounded-xl text-[13px] font-medium transition-all"
                    style={active ? { background: "var(--brand)", color: "var(--brand-foreground)" } : { background: "var(--surface-hover)", color: "var(--text-secondary)" }}
                  >{label}</button>
                );
              })}
            </div>
          )}
          {recurrenceType === "custom" && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>每隔</span>
              <input type="number" min={1} max={365} value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className="input w-20 text-center" style={{ padding: "8px 4px" }} />
              <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>天</span>
            </div>
          )}
          {recurrenceType !== "none" && (
            <div className="mt-3">
              <label className="block mb-1.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>結束日期（選填）</label>
              <input type="date" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} className="input" />
            </div>
          )}
        </div>

        {/* Comments */}
        <TaskCommentsInline taskId={task.id} />
      </div>
    </div>
  );
}
