"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Task, Priority, TaskStatus, Recurrence, Attachment } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/types";
import { useApp } from "@/lib/AppContext";
import { getTagColors, getOrphanTags } from "@/lib/storage";
import { AnimatePresence, motion } from "framer-motion";
import { X, Plus, Repeat, Calendar, Mic, MicOff, Hash, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { ProtectedUploadButton } from "./ProtectedUploadButton";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { Button } from "@/components/ui/Button";
import { useAIShredder } from "@/hooks/useAIShredder";
import { useGhostButton } from "@/hooks/useGhostButton";
import { GhostButton } from "./GhostButton";
import { ProWaitlistModal } from "./ProWaitlistModal";
import { deleteFile } from "@/lib/storageUpload";
import { logger } from "@/lib/logger";
import { EisenhowerQuadrantGrid } from "./EisenhowerQuadrantGrid";
import { getEisenhowerVisual } from "@/lib/eisenhower";
import { isComposingKey, isComposingSubmit } from "@/utils/imeGuard";
import { logEvent } from "@/lib/eventLog";
import { toast } from "sonner";
import { parseNaturalLanguage } from "@/lib/nlp";
import { NlpPreviewChip, ParsedPreview } from "./NlpPreviewChip";

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Task, "id" | "createdAt" | "updatedAt" | "focusMinutes" | "isArchived" | "order">) => void;
  initialData?: Task | null;
  currentListId?: string;
  /** 當前視圖：新增任務時預設日期的參考 */
  currentView?: string;
  onDeleteAttachment?: (attachment: Attachment) => void;
  /** 新增任務時的預設狀態（編輯模式忽略） */
  initialStatus?: TaskStatus;
  /** 新增任務時的預設優先度（編輯模式忽略）— 用於象限視圖快速新增:從象限點 + → priority 直接對應該象限 */
  initialPriority?: Priority;
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

/**
 * 同 describeRecurrence 於 TaskDetailPanel — 讓使用者選完 recurrence 後即時預覽人話
 */
function describeRecurrence(
  type: string,
  interval: number,
  daysOfWeek: number[],
  dayOfMonth: number | undefined
): string {
  if (type === "none") return "";
  if (type === "daily") return interval === 1 ? "每天" : `每 ${interval} 天`;
  if (type === "weekly") {
    const intervalText = interval === 1 ? "每週" : `每 ${interval} 週`;
    if (daysOfWeek.length === 0) return intervalText;
    const days = daysOfWeek.slice().sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join("、");
    return `${intervalText}(${days})`;
  }
  if (type === "monthly") return dayOfMonth ? `每月 ${dayOfMonth} 號` : interval === 1 ? "每月" : `每 ${interval} 個月`;
  if (type === "yearly") return interval === 1 ? "每年" : `每 ${interval} 年`;
  if (type === "custom") return `每 ${interval} 天`;
  return "";
}

const SELECT_ARROW = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23999' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E";

export function TaskForm({ isOpen, onClose, onSubmit, initialData, currentListId, currentView, onDeleteAttachment, initialStatus, initialPriority }: TaskFormProps) {
  const { lists, tasks, getTagCounts } = useApp();
  const keyboard = useKeyboardOffset();
  const aiShredder = useAIShredder();
  // §假門測試 B:無限次 AI 粉碎 — 額度用完時切換為幽靈按鈕
  const unlimitedShredGhost = useGhostButton({ buttonId: "unlimited_shred" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // 預設「暫緩」＝第 4 象限（艾森豪矩陣：避免決策疲勞，新任務預設最低優先）
  const [priority, setPriority] = useState<Priority>("none");
  const [status, setStatus] = useState<TaskStatus>(initialStatus ?? "todo");
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
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number | undefined>(undefined);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [subTaskInputs, setSubTaskInputs] = useState<string[]>([]);

  // ─── A1 NLP 即時預覽 ───────────────────────────────
  // 標題打字時 debounce 200ms 跑 parseNaturalLanguage,把解析結果
  // 顯示為 preview chip,使用者可單獨關閉任一欄位。**只預覽不覆寫**
  // (Q1 選擇):使用者手動改欄位時,preview 會自動對齊新值,但不會
  // 反過來覆蓋使用者已調整的 state。
  const [parsedPreview, setParsedPreview] = useState<ParsedPreview | null>(null);
  const [previewDismissed, setPreviewDismissed] = useState({
    dueDate: false,
    dueTime: false,
    priority: false,
    tags: false,
  });
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // ── Smart Tag Autocomplete ──────────────────────────────
  // 核心：debounce 避免高頻過濾 + orphan tags（未附於任務的標籤）
  const updateTagSuggestions = useCallback((input: string) => {
    const trimmed = input.trim();
    // 查詢正規化：去掉 # 前綴後比對
    const query = trimmed.startsWith("#") ? trimmed.slice(1).toLowerCase() : trimmed.toLowerCase();

    // 取得所有候選標籤（含 orphan tags）
    const counts = getTagCounts();
    const orphanTags = (typeof window !== "undefined") ? getOrphanTags() : [];
    const allCandidates: { tag: string; count: number }[] = [
      // 任務中的標籤（以 count 降冪）
      ...Object.entries(counts)
        .filter(([tag]) => !tags.includes(tag))
        .map(([tag, count]) => ({ tag, count })),
      // Orphan tags（從未附於任務，以字母排序，避免排太前面）
      ...orphanTags
        .filter((t) => !tags.includes(t))
        .map((t) => ({ tag: t, count: 0 })),
    ];

    // 過濾匹配
    const filtered = query
      ? allCandidates.filter(({ tag }) => {
          const normalized = tag.startsWith("#") ? tag.slice(1) : tag;
          return normalized.toLowerCase().includes(query);
        })
      : allCandidates;

    // 排序：頻率高 > 頻率低；orphan tags (count=0) 排在後面
    filtered.sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });

    setSuggestions(filtered.map((f) => f.tag).slice(0, 6));
    // 空白時也顯示（最近使用的標籤建議）
    setShowSuggestions(filtered.length > 0);
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
      setRecurrenceDayOfMonth(initialData.recurrence?.dayOfMonth);
      setRecurrenceEndDate(initialData.recurrence?.endDate || "");
    } else {
      setTitle(""); setDescription(""); setPriority(initialPriority ?? "none"); setStatus(initialStatus ?? "todo");
      setDueDate(currentView === "today" ? new Date().toISOString().split("T")[0] : ""); setStartDate(""); setDueTime(""); setListId(currentListId); setTags([]);
      setSubTaskInputs([]);
      setRecurrenceType("none"); setRecurrenceInterval(1);
      setRecurrenceDaysOfWeek([]); setRecurrenceDayOfMonth(undefined); setRecurrenceEndDate("");
      setAttachments([]);
      setTagColors(getTagColors());
      setTagInput(""); setSuggestions([]); setShowSuggestions(false);
    }
    setErrors({});
    const t = setTimeout(() => titleRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isOpen, initialData, currentView, currentListId, initialStatus, initialPriority]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // ── NLP 即時預覽 debounce ──────────────────────────────────
  // 編輯模式不跑 NLP (使用者已輸入完整標題,不需要自動覆寫提示)
  useEffect(() => {
    if (initialData) {
      setParsedPreview(null);
      return;
    }
    if (!title.trim()) {
      setParsedPreview(null);
      return;
    }
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      const p = parseNaturalLanguage(title);
      // 只在解析出實際欄位時設定,空解析不顯示 chip
      if (p.dueDate || p.dueTime || (p.priority && p.priority !== "delegate") || p.tags.length > 0) {
        setParsedPreview({
          dueDate: p.dueDate,
          dueTime: p.dueTime,
          priority: p.priority && p.priority !== "delegate" ? p.priority : undefined,
          tags: p.tags.length > 0 ? p.tags : undefined,
        });
        // 重置 dismissed (新解析結果出來,使用者重新選擇)
        setPreviewDismissed({ dueDate: false, dueTime: false, priority: false, tags: false });
      } else {
        setParsedPreview(null);
      }
    }, 200);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [title, initialData]);

  // 把「今天/明天/後天」等相對日期轉成人話
  const formatRelativeDate = (iso: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(iso + "T00:00:00");
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) return "今天";
    if (diffDays === 1) return "明天";
    if (diffDays === 2) return "後天";
    if (diffDays === 3) return "大後天";
    if (diffDays > 0 && diffDays <= 7) {
      const weekdays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
      return weekdays[target.getDay()];
    }
    const [y, m, d] = iso.split("-").map(Number);
    return `${m}/${d}`;
  };

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
    // 擋 IME composition 期間的 Enter：keyDown 攔不住，因為有些瀏覽器在 form submit 才 fire
    if (isComposingSubmit(e)) return;
    e.preventDefault();
    if (!title.trim()) { setErrors({ title: "必填" }); titleRef.current?.focus(); return; }
    let recurrence: Recurrence | undefined;
    if (recurrenceType !== "none") {
      recurrence = {
        pattern: recurrenceType as Recurrence["pattern"],
        interval: recurrenceInterval,
        completedCount: initialData?.recurrence?.completedCount || 0,
        daysOfWeek: recurrenceType === "weekly" ? recurrenceDaysOfWeek : undefined,
        dayOfMonth: recurrenceType === "monthly" ? recurrenceDayOfMonth : undefined,
        endDate: recurrenceEndDate || undefined,
      };
    }
    const subTasks = subTaskInputs.map((title, i) => ({
      id: initialData?.subTasks?.[i]?.id || `${Date.now()}-sub-${i}`,
      title,
      status: initialData?.subTasks?.[i]?.status || "todo" as const,
      createdAt: initialData?.subTasks?.[i]?.createdAt || new Date().toISOString(),
      // O-008:若 initialData 有 order 保留,新子任務用 i 作 order
      order: initialData?.subTasks?.[i]?.order ?? i,
    }));
    // 區間：未填截止日但有起始日 → 自動把截止日 = 起始日（單日任務）
    // Today 視圖新建時：未填截止日 → 預設為今天（符合 Smart Defaults 原則）
    // A1: NLP 預覽 — 使用者尚未手動設定欄位時,套用 NLP 解析結果
    // (Q1「只預覽不覆寫」意涵:使用者手動改的不覆蓋,空欄位才套用)
    const finalDueDate =
      dueDate ||
      (parsedPreview?.dueDate && !previewDismissed.dueDate ? parsedPreview.dueDate : "") ||
      startDate ||
      (currentView === "today" ? new Date().toISOString().split("T")[0] : undefined);
    const finalDueTime = dueTime || (parsedPreview?.dueTime && !previewDismissed.dueTime ? parsedPreview.dueTime : undefined);
    // priority 預設值是 "none",若使用者沒從 EisenhowerQuadrantGrid 改過,就套用 NLP 結果
    const finalPriority = parsedPreview?.priority && !previewDismissed.priority && priority === "none"
      ? parsedPreview.priority
      : priority;
    const finalTags = tags.length > 0
      ? tags
      : parsedPreview?.tags && !previewDismissed.tags ? parsedPreview.tags : tags;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority: finalPriority, status,
      startDate: startDate || undefined,
      dueDate: finalDueDate,
      dueTime: finalDueTime,
      listId,
      tags: finalTags,
      subTasks,
      recurrence,
      attachments,
    });
    toast.success("任務已建立", { duration: 2000 });
    setTimeout(() => onClose(), 400);
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
            className="w-full max-w-lg overflow-y-auto rounded-2xl"
            style={{
              background: "var(--surface)",
              boxShadow: "var(--shadow-lg)",
              maxHeight: `calc(100dvh - ${keyboard}px - 32px)`,
            }}
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
                    onKeyDown={(e) => {
                      if (isComposingKey(e)) return;
                      // Enter → 觸發主表單 submit（編輯/新建模式一致：title 是 single-line input,Enter 直覺就是送出)
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).form?.requestSubmit();
                      }
                    }}
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
                {/* A1: NLP 即時預覽 chip — 標題打字時自動解析日期/時間/優先級/標籤 */}
                {!initialData && (
                  <NlpPreviewChip
                    parsed={parsedPreview}
                    dismissed={previewDismissed}
                    onDismiss={(key) => setPreviewDismissed((prev) => ({ ...prev, [key]: true }))}
                    formatRelativeDate={formatRelativeDate}
                  />
                )}
                {errors.title && <p className="mt-1.5 text-[12px] px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "var(--status-danger)" }}>{errors.title}</p>}
              </div>

              {/* AI 自動任務拆解 (AI Task Shredder)
                  - 與上方 input 分區:用 mt-1 (對齊 input error message 間距) + 視覺換色 (中性灰藍) 與 mic 紫色拉開
                  - 額度未用完: 顯示正常按鈕
                  - 額度用完: 切換為假門測試 B 幽靈按鈕 (金色微光 + Lock icon)
                  - 嚴禁拖曳:生成的子步驟是單向線性,不用 dnd-kit */}
              <div className="mt-3">
                {aiShredder.isLimitReached ? (
                  // §假門測試 B:無限次 AI 粉碎 — 點擊 → ProWaitlistModal
                  <GhostButton
                    onClick={unlimitedShredGhost.handleClick}
                    variant="glowing"
                    icon={Sparkles}
                    featureId="infinite_ai"
                    dismissed={unlimitedShredGhost.dismissed}
                  >
                    解鎖無限次粉碎
                  </GhostButton>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!title.trim()) {
                        titleRef.current?.focus();
                        return;
                      }
                      // § Wizard of Oz MVP:攔截點擊 → 顯示提示 toast → 後台偷偷記錄意願
                      logEvent("clicked_ai_smash", { buttonId: "task_form_ai_shred", metadata: { taskTitle: title.slice(0, 100) } });
                      toast("🚀 任務粉碎機正在充能中！\n\n這個強大的 AI 魔法將在下一波更新解鎖。\n\n(我們已經記錄下你的渴望了 😉)", {
                        duration: 4000,
                        id: "ai-smash-ghost",
                      });
                    }}
                    disabled={!title.trim() || aiShredder.loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      background: "var(--surface-hover)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-hover)",
                    }}
                    aria-label="用 AI 拆解任務"
                    title="把任務拆解成 3-5 個微小步驟,打破啟動癱瘓"
                  >
                    {aiShredder.loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                        <span>AI 拆解中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" aria-hidden />
                        <span>AI 拆解 ({aiShredder.remainingCount}/{aiShredder.dailyLimit})</span>
                      </>
                    )}
                  </button>
                )}
                {aiShredder.error && !aiShredder.isLimitReached && (
                  <p className="mt-1.5 text-[11px] px-2.5 py-1 rounded-lg" style={{ background: "rgba(239, 68, 68, 0.08)", color: "var(--status-danger)" }}>
                    {aiShredder.error}
                  </p>
                )}
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
                        logger.ns("TaskForm").warn("Failed to delete attachment from storage", { error: err });
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

                  {/* Q1 自動偵測提示：當 dueDate 在 24h 內且 priority 為 schedule 時，建議升級為 do-now */}
                  {(() => {
                    if (!dueDate || priority === "do-now") return null;
                    const eisen = getEisenhowerVisual({ priority, dueDate });
                    if (!eisen.isUrgent) return null;
                    return (
                      <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: `${eisen.color}12`, color: eisen.color, border: `1px solid ${eisen.color}30` }}>
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        <span>截止在 24 小時內，建議改為「速辦」</span>
                        <button
                          type="button"
                          onClick={() => setPriority("do-now")}
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
                {recurrenceType === "monthly" && (
                  <div className="mt-3">
                    <label className="block mb-1.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>每月幾號</label>
                    <select
                      value={recurrenceDayOfMonth ?? ""}
                      onChange={(e) => setRecurrenceDayOfMonth(e.target.value ? Math.max(1, Math.min(31, parseInt(e.target.value))) : undefined)}
                      className="input cursor-pointer"
                    >
                      <option value="">沿用截止日</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d} 號</option>
                      ))}
                    </select>
                  </div>
                )}
                {recurrenceType !== "none" && (
                  <div className="mt-3">
                    <label className="block mb-1.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>結束日期（選填）</label>
                    <input type="date" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} className="input" />
                  </div>
                )}
                {recurrenceType !== "none" && (
                  <p className="mt-2 text-[12px] px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}>
                    <Repeat className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--brand)" }} />
                    <span>
                      {describeRecurrence(recurrenceType, recurrenceInterval, recurrenceDaysOfWeek, recurrenceDayOfMonth)}
                      {dueDate && recurrenceType !== "none" && (
                        <span style={{ color: "var(--text-tertiary)" }}> · 下次 {(() => {
                          const d = new Date(dueDate + "T00:00:00");
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        })()}</span>
                      )}
                    </span>
                  </p>
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
                          if (isComposingKey(e)) return;
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
                    <Button type="button" variant="ghost" size="icon-sm" onClick={addTag} aria-label="新增標籤" className="flex-shrink-0"><Plus className="w-4 h-4" /></Button>
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
                    <button type="button" onClick={() => setSubTaskInputs(subTaskInputs.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-[var(--hover-bg)]" style={{ color: "var(--text-tertiary)" }} aria-label="刪除此子任務">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input ref={subtaskInputRef} type="text"
                    value={subtaskInputValue}
                    onChange={(e) => setSubtaskInputValue(e.target.value)}
                    onKeyDown={(e) => { if (!isComposingKey(e) && e.key === "Enter") { e.preventDefault(); addSubTask(); } }}
                    placeholder="新增子任務..." className="input flex-1" style={{ fontSize: 16, padding: "8px 12px" }} />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={addSubTask} aria-label="新增子任務"><Plus className="w-4 h-4" /></Button>
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
                <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
                <Button type="submit">{initialData ? "儲存變更" : "建立任務"}</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* §假門測試 B:無限次 AI 粉碎 Modal (幽靈按鈕點擊後彈出) */}
      <ProWaitlistModal
        open={unlimitedShredGhost.open}
        onClose={unlimitedShredGhost.handleDismiss}
        onJoin={unlimitedShredGhost.handleJoin}
        featureId="infinite_ai"
      />
    </AnimatePresence>
  );
}
