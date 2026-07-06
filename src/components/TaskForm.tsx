"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus } from "lucide-react";
import { Task, Priority, TaskStatus } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Task, "id" | "createdAt" | "updatedAt">) => void;
  initialData?: Task | null;
}

export function TaskForm({ isOpen, onClose, onSubmit, initialData }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ title?: string }>({});
  const titleRef = useRef<HTMLInputElement>(null);

  const isEditing = !!initialData;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setDescription(initialData.description || "");
        setPriority(initialData.priority);
        setStatus(initialData.status);
        setDueDate(initialData.dueDate || "");
        setTags(initialData.tags);
      } else {
        setTitle("");
        setDescription("");
        setPriority("medium");
        setStatus("todo");
        setDueDate("");
        setTags([]);
      }
      setErrors({});
      const timer = setTimeout(() => titleRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrors({ title: "必填" });
      titleRef.current?.focus();
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      dueDate: dueDate || undefined,
      tags,
    });
    onClose();
  };

  const priorityOptions: Priority[] = ["high", "medium", "low"];
  const statusOptions: { value: TaskStatus; label: string }[] = [
    { value: "todo", label: "待辦" },
    { value: "in-progress", label: "進行中" },
    { value: "done", label: "已完成" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.25)", backdropFilter: "blur(4px)" }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-title"
        >
          <motion.div
            className="w-full max-w-md"
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-lg)",
            }}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 pt-6 pb-5"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h2
                id="form-title"
                className="text-[17px] font-semibold text-[var(--text-primary)]"
              >
                {isEditing ? "編輯任務" : "新增任務"}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-all duration-150 active:scale-90"
                aria-label="關閉表單"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* 任務標題 */}
              <div>
                <label htmlFor="task-title" className="block mb-2 text-[13px] font-medium text-[var(--text-secondary)]">
                  任務標題 <span className="text-[var(--status-danger)]" aria-label="必填">*</span>
                </label>
                <input
                  ref={titleRef}
                  id="task-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="輸入任務名稱"
                  className={`input ${errors.title ? "input-error" : ""}`}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? "title-error" : undefined}
                  maxLength={200}
                />
                {errors.title && (
                  <p id="title-error" className="mt-1.5 text-[12px] text-[var(--status-danger)]" role="alert">
                    {errors.title}
                  </p>
                )}
              </div>

              {/* 任務描述 */}
              <div>
                <label htmlFor="task-description" className="block mb-2 text-[13px] font-medium text-[var(--text-secondary)]">
                  任務描述
                </label>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="任務描述（選填）"
                  rows={3}
                  className="input resize-none"
                  maxLength={1000}
                  style={{ minHeight: 80 }}
                />
              </div>

              {/* 優先級 + 狀態 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="task-priority" className="block mb-2 text-[13px] font-medium text-[var(--text-secondary)]">
                    優先級
                  </label>
                  <select
                    id="task-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="input cursor-pointer"
                    style={{ appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23999' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "16px", paddingRight: "36px" }}
                  >
                    {priorityOptions.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_CONFIG[p].label}優先
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="task-status" className="block mb-2 text-[13px] font-medium text-[var(--text-secondary)]">
                    狀態
                  </label>
                  <select
                    id="task-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="input cursor-pointer"
                    style={{ appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23999' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "16px", paddingRight: "36px" }}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 截止日期 */}
              <div>
                <label htmlFor="task-due-date" className="block mb-2 text-[13px] font-medium text-[var(--text-secondary)]">
                  截止日期
                </label>
                <input
                  id="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input cursor-pointer"
                />
              </div>

              {/* 標籤 */}
              <div>
                <label htmlFor="task-tags" className="block mb-2 text-[13px] font-medium text-[var(--text-secondary)]">
                  標籤
                </label>
                <div className="flex gap-2">
                  <input
                    id="task-tags"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="輸入標籤後按 Enter"
                    className="input flex-1"
                    maxLength={50}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="btn-ghost flex-shrink-0 px-3"
                    aria-label="新增標籤"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="tag-chip"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="p-0.5 rounded-full hover:text-[var(--status-danger)] transition-colors duration-150"
                          aria-label={`移除標籤 ${tag}`}
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 操作按鈕 */}
              <div
                className="flex justify-end gap-3 pt-4"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <button type="button" onClick={onClose} className="btn-ghost">
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  {isEditing ? "儲存變更" : "建立任務"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
