"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Task, Priority, TaskStatus, Recurrence, Attachment } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/types";
import { useApp } from "@/lib/AppContext";
import { getTagColors } from "@/lib/storage";
import { AnimatePresence, motion } from "framer-motion";
import { X, Plus, Repeat, Calendar, Mic, MicOff, Hash, AlertCircle } from "lucide-react";
import { ProtectedUploadButton } from "./ProtectedUploadButton";
import { deleteFile } from "@/lib/storageUpload";
import { EisenhowerQuadrantGrid } from "./EisenhowerQuadrantGrid";
import { getEisenhowerVisual } from "@/lib/eisenhower";

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">) => void;
  initialData?: Task | null;
  currentListId?: string;
  onDeleteAttachment?: (attachment: Attachment) => void;
}

const RECURRENCE_OPTIONS = [
  { label: "不重複", value: "none" },
  { label: "每天", value: "daily" },
  { label: "每週", value: "weekly" },
  { label: "每月", value: "monthly" },
  { label: "每年", value: "yearly" },
  { label: "自訂間隔", value: "custom" },
];

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const SELECT_ARROW = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23999' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E";

export function TaskForm({ isOpen, onClose, onSubmit, initialData, currentListId, onDeleteAttachment }: TaskFormProps) {
  const { lists, tasks, getTagCounts } = useApp();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // 預設「低」＝第 4 象限（艾森豪矩陣：不重要不緊急，避免決策疲勞）
  const [priority, setPriority] = useState<Priority>("low");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [listId, setListId] = useState<string | undefined>(undefined);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [errors, setErrors] = useState<{ title?: string }>({});
  const [recurrenceType, setRecurrenceType] = useState("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [subTaskInputs, setSubTaskInputs] = useState<string[]>([]);

  const formatDateLabel = (iso: string): string => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return `${m}/${d}`;
  };
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const [subtaskInputValue, setSubtaskInputValue] = useState("");

  // ─── Voice Input
  const handleVoiceInput = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-TW";
    recognition.continuous = false;
    recognition.interimResults = false;

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      return;
    }

    setIsRecording(true);
    recognition.start();

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTitle((prev) => prev + transcript);
      setIsRecording(false);
      titleRef.current?.focus();
    };

    recognition.onerror = () => { setIsRecording(false); };
    recognition.onend = () => { setIsRecording(false); };
  }, [isRecording]);

  useEffect(() => {
    return () => { /* cleanup recognition if needed */ };
  }, []);

  // Load tag colors
  useEffect(() => {
    if (typeof window !== "undefined") {
      setTagColors(getTagColors());
    }
  }, []);

  // Tag auto-complete logic
  const updateTagSuggestions = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // 支持 # 前綴或純文字匹配
    const query = trimmed.startsWith("#") ? trimmed.slice(1).toLowerCase() : trimmed.toLowerCase();
    const counts = getTagCounts();
    const allTags = Object.keys(counts).filter((tag) => {
      // 排除已選的標籤
      if (tags.includes(tag)) return false;
      // 匹配：去掉 # 前綴後比對
      const normalized = tag.startsWith("#") ? tag.slice(1) : tag;
      return normalized.toLowerCase().includes(query);
    }).sort((a, b) => (counts[b] || 0) - (counts[a] || 0)); // 按使用頻率排序

    setSuggestions(allTags.slice(0, 5)); // 最多顯示 5 個
    setShowSuggestions(allTags.length > 0 || query.length > 0);
    setHighlightedIndex(-1);
  }, [tags, getTagCounts]);

  const selectSuggestion = useCallback((tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  }, [tags]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || "");
      setPriority(initialData.priority);
      setStatus(initialData.status);
      setDueDate(initialData.dueDate || "");
      setStartDate(initialData.startDate || "");
      setDueTime(initialData.dueTime || "");
      setListId(initialData.listId);
      setTags(initialData.tags);
      setSubTaskInputs(initialData.subTasks?.map((s) => s.title) || []);
      setRecurrenceType(initialData.recurrence?.pattern || "none");
      setRecurrenceInterval(initialData.recurrence?.interval || 1);
      setRecurrenceDaysOfWeek(initialData.recurrence?.daysOfWeek || []);
      setRecurrenceEndDate(initialData.recurrence?.endDate || "");
    } else {
      setTitle(""); setDescription(""); setPriority("low"); setStatus("todo");
      setDueDate(""); setStartDate(""); setDueTime(""); setListId(currentListId); setTags([]);
      setSubTaskInputs([]);
      setRecurrenceType("none"); setRecurrenceInterval(1);
      setRecurrenceDaysOfWeek([]); setRecurrenceEndDate("");
      setAttachments([]);
      setTagColors(getTagColors());
      setTagInput(""); setSuggestions([]); setShowSuggestions(false);
    }
    setErrors({});
    const t = setTimeout(() => titleRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isOpen, initialData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(""); }
  };

  const addSubTask = () => {
    const t = subtaskInputValue.trim();
    if (t) {
      setSubTaskInputs([...subTaskInputs, t]);
      setSubtaskInputValue("");
      subtaskInputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErrors({ title: "必填" }); titleRef.current?.focus(); return; }
    let recurrence: Recurrence | undefined;
    if (recurrenceType !== "none") {
      recurrence = {
        pattern: recurrenceType as Recurrence["pattern"],
        interval: recurrenceInterval,
        completedCount: initialData?.recurrence?.completedCount || 0,
        daysOfWeek: recurrenceType === "weekly" ? recurrenceDaysOfWeek : undefined,
        endDate: recurrenceEndDate || undefined,
      };
    }
    const subTasks = subTaskInputs.map((title, i) => ({
      id: initialData?.subTasks?.[i]?.id || `${Date.now()}-sub-${i}`,
      title,
      status: initialData?.subTasks?.[i]?.status || "todo" as const,
      createdAt: initialData?.subTasks?.[i]?.createdAt || new Date().toISOString(),
    }));
    // 區間：未填截止日但有起始日 → 自動把截止日 = 起始日（單日任務）
    const finalDueDate = dueDate || startDate || undefined;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority, status,
      startDate: startDate || undefined,
      dueDate: finalDueDate,
      dueTime: dueTime || undefined,
      listId,
      tags,
      subTasks,
      recurrence,
      attachments,
    });
    onClose();
  };

  const selectStyle = {
    appearance: "none" as const,
    backgroundImage: `url("${SELECT_ARROW}")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    backgroundSize: "16px",
    paddingRight: "36px",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-title"
        >
          <motion.div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 id="form-title" className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {initialData ? "編輯任務" : "新增任務"}
              </h2>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5" style={{ color: "var(--text-tertiary)" }} aria-label="關閉">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  任務標題 <span style={{ color: "var(--status-danger)" }}>*</span>
                </label>
                <div className="relative">
                  <input
                    ref={titleRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="輸入任務名稱"
                    className={`input pr-12 ${errors.title ? "input-error" : ""}`}
                    aria-invalid={!!errors.title}
                    maxLength={200}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={handleVoiceInput}
                    className={`voice-indicator absolute right-3 ${isRecording ? "recording" : ""}`}
                    style={{ top: "calc(50% - 1px)" }}
                    aria-label={isRecording ? "停止錄音" : "語音輸入"}
                    title={isRecording ? "停止錄音" : "說出任務名稱"}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
                {errors.title && <p className="mt-1.5 text-[12px]" style={{ color: "var(--status-danger)" }}>{errors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>描述</label>
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

              {/* Attachments - Role Protected */}
              <div>
                <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  附件
                </label>
                <ProtectedUploadButton
                  existingAttachments={attachments}
                  onRemoveAttachment={(attachment) => {
                    if (attachment.storagePath) {
                      deleteFile(attachment.storagePath).catch((err) => {
                        console.warn("[TaskForm] Failed to delete attachment from storage:", err);
                      });
                    }
                    setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
                  }}
                  onFilesUploaded={(newAttachments) => {
                    setAttachments((prev) => [...prev, ...newAttachments]);
                  }}
                  buttonText="添加附件"
                />
              </div>

              {/* List + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>清單</label>
                  <select value={listId || ""} onChange={(e) => setListId(e.target.value || undefined)} className="input cursor-pointer" style={selectStyle}>
                    <option value="">無清單</option>
                    {lists.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>優先級</label>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                      style={{ background: "var(--surface-muted)", color: "var(--text-tertiary)" }}
                      title="艾森豪矩陣：區分重要與緊急，減少決策疲勞"
                    >
                      艾森豪
                    </span>
                  </div>
                  <EisenhowerQuadrantGrid priority={priority} onChange={setPriority} />

                  {/* Q1 自動偵測提示：當 dueDate 在 24h 內且 priority 非 high 時，建議升級 */}
                  {(() => {
                    if (!dueDate || priority === "high") return null;
                    const eisen = getEisenhowerVisual({ priority, dueDate });
                    if (!eisen.isUrgent) return null;
                    return (
                      <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: `${eisen.color}12`, color: eisen.color, border: `1px solid ${eisen.color}30` }}>
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        <span>截止在 24 小時內，建議改為「高優先」自動升級 Q1</span>
                        <button
                          type="button"
                          onClick={() => setPriority("high")}
                          className="ml-auto px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors hover:opacity-80"
                          style={{ background: eisen.color, color: "#fff" }}
                        >
                          升級
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 日期區間 + 時間 */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                      <Calendar className="w-3.5 h-3.5 inline mr-1" />開始日期
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                      <Calendar className="w-3.5 h-3.5 inline mr-1" />截止日期
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      min={startDate || undefined}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="input cursor-pointer"
                    />
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
                  <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>具體時間</label>
                  <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="input cursor-pointer" />
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  <Repeat className="w-3.5 h-3.5 inline mr-1" />重複
                </label>
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

              {/* Tags */}
              <div>
                <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>標籤</label>
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
                      <input type="text" value={tagInput} onChange={(e) => { setTagInput(e.target.value); updateTagSuggestions(e.target.value); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                              selectSuggestion(suggestions[highlightedIndex]);
                            } else {
                              addTag();
                            }
                          }
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setHighlightedIndex((i) => Math.min(i + 1, suggestions.length));
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setHighlightedIndex((i) => Math.max(i - 1, -1));
                          }
                          if (e.key === "Escape") { setShowSuggestions(false); }
                        }}
                        onFocus={() => { if (tagInput.trim()) updateTagSuggestions(tagInput); }}
                        placeholder="輸入或選擇標籤" className="input flex-1 pl-9" maxLength={50} />
                    </div>
                    <button type="button" onClick={addTag} className="btn-ghost flex-shrink-0 px-3" aria-label="新增標籤">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Auto-complete dropdown */}
                  <AnimatePresence>
                    {showSuggestions && (
                      <motion.div
                        className="absolute left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden"
                        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)" }}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        {suggestions.length > 0 ? (
                          suggestions.map((tag, i) => {
                            const color = tagColors[tag] || "#3B82F6";
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => selectSuggestion(tag)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
                                style={{
                                  background: highlightedIndex === i ? "var(--surface-hover)" : "transparent",
                                }}
                              >
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                                <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>{tag}</span>
                              </button>
                            );
                          })
                        ) : tagInput.trim() ? (
                          <button
                            type="button"
                            onClick={addTag}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                          >
                            <Plus className="w-4 h-4" style={{ color: "var(--brand)" }} />
                            <span className="text-[13px]" style={{ color: "var(--brand)" }}>建立新標籤「{tagInput.trim()}」</span>
                          </button>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {tags.map((tag) => {
                      const color = tagColors[tag] || "#3B82F6";
                      return (
                        <span
                          key={tag}
                          className="tag-chip"
                          style={{
                            background: `${color}15`,
                            color: color,
                            border: `1px solid ${color}25`,
                          }}
                        >
                          {tag}
                          <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="p-0.5 rounded-full hover:text-red-500" aria-label={`移除標籤 ${tag}`}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sub-tasks */}
              <div>
                <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>子任務</label>
                {subTaskInputs.map((st, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center" style={{ borderColor: "var(--border-hover)" }}>
                      <div className="w-2 h-2 rounded-sm" style={{ background: "var(--text-tertiary)" }} />
                    </div>
                    <span className="flex-1 text-[13px]" style={{ color: "var(--text-primary)" }}>{st}</span>
                    <button type="button" onClick={() => setSubTaskInputs(subTaskInputs.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-black/5" style={{ color: "var(--text-tertiary)" }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input ref={subtaskInputRef} type="text"
                    value={subtaskInputValue}
                    onChange={(e) => setSubtaskInputValue(e.target.value)}
                    onKeyUp={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubTask(); } }}
                    placeholder="新增子任務..." className="input flex-1" style={{ fontSize: 13, padding: "8px 12px" }} />
                  <button type="button" onClick={addSubTask} className="btn-ghost px-3" aria-label="新增子任務">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>狀態</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="input cursor-pointer" style={selectStyle}>
                  <option value="todo">待辦</option>
                  <option value="in-progress">進行中</option>
                  <option value="done">已完成</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 pb-[calc(60px+env(safe-area-inset-bottom,0px)+12px)]" style={{ borderTop: "1px solid var(--border)" }}>
                <button type="button" onClick={onClose} className="btn-ghost">取消</button>
                <button type="submit" className="btn-primary">{initialData ? "儲存變更" : "建立任務"}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
