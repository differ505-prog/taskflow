"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, X, RefreshCw, Plus, Star } from "lucide-react";

/**
 * AIShredPreviewSheet — AI 任務拆解 預覽 Sheet
 *
 * UX 哲學 (§1 / §4 對齊):
 * - 拆解 ≠ 結果,是「討論的開始」(ADHD 友善)。使用者必須能在接受前微調。
 * - 首條聚焦:AI 設計第一步是「物理上最簡單的動作」,UI 要視覺強化
 *   (粗體 + Star icon + 強調色),呼應 ADHD 啟動癱瘓。
 * - 重新生成扣額度(共用 3 次/日),鼓勵接受合理結果而非浪費 API。
 *
 * 互動:
 * - ✏️ 單條編輯
 * - 🗑️ 單條刪除
 * - ➕ 新增一條
 * - 🔄 重新生成(扣 1 次)
 * - 全部接受 → 寫入子任務清單
 * - 取消 → 不寫入
 *
 * 注意:
 * - 不耦合 useAIShredder hook:此元件純展示/互動,shred/regenerate 由父層傳入。
 * - 「未輸入標題」會擋 API 呼叫,UI 顯示提示但不鎖按鈕(讓空狀態看起來像「尚未拆解」)。
 */
export interface AIShredPreviewSheetProps {
  /** 是否顯示 */
  open: boolean;
  /** 關閉 sheet (不清除步驟由父層決定) */
  onClose: () => void;
  /** 拆解後步驟(由父層 useAIShredder.steps 提供) */
  steps: string[] | null;
  /** 正在呼叫 AI */
  loading: boolean;
  /** 是否能重新生成(額度未用完) */
  canRegenerate: boolean;
  /** 額度提示文字 e.g. "剩餘 2 次" */
  remainingHint?: string;
  /** 重新生成:觸發一次新的 AI 拆解(扣額度) */
  onRegenerate: () => void;
  /** 全部接受:把這些步驟寫入子任務清單 */
  onAccept: (steps: string[]) => void;
}

export function AIShredPreviewSheet({
  open,
  onClose,
  steps,
  loading,
  canRegenerate,
  remainingHint,
  onRegenerate,
  onAccept,
}: AIShredPreviewSheetProps) {
  // 本地編輯副本 — 不直接 mutate props.steps,只有按「全部接受」才 commit
  const [edited, setEdited] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // 當 props.steps 變動 → 重置 edited 副本
  useEffect(() => {
    if (steps) setEdited([...steps]);
  }, [steps]);

  // 編輯模式 focus
  useEffect(() => {
    if (editingIndex !== null) {
      // setTimeout 確保 ref 已掛載
      setTimeout(() => editInputRef.current?.focus(), 0);
    }
  }, [editingIndex]);

  // Esc 關閉 sheet
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // 若正在編輯某條,先取消編輯
        if (editingIndex !== null) {
          setEditingIndex(null);
          setDraftValue("");
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, editingIndex]);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setDraftValue(edited[index] ?? "");
  };

  const commitEdit = () => {
    if (editingIndex === null) return;
    const v = draftValue.trim();
    if (v) {
      const next = [...edited];
      next[editingIndex] = v;
      setEdited(next);
    }
    setEditingIndex(null);
    setDraftValue("");
  };

  const handleDelete = (index: number) => {
    setEdited(edited.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    setEdited([...edited, ""]);
    const newIndex = edited.length;
    setEditingIndex(newIndex);
    setDraftValue("");
  };

  const handleAccept = () => {
    const filtered = edited.map((s) => s.trim()).filter((s) => s.length > 0);
    if (filtered.length === 0) {
      onClose();
      return;
    }
    onAccept(filtered);
  };

  const handleRegenerateClick = () => {
    if (!canRegenerate || loading) return;
    onRegenerate();
  };

  // 阻止背景 scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ai-shred-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-shred-title"
        >
          <motion.div
            key="ai-shred-sheet"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
            style={{
              background: "var(--surface)",
              borderTop: "1px solid var(--border)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: "var(--accent-primary, #8b5cf6)" }} aria-hidden />
                <h2 id="ai-shred-title" className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  AI 拆解建議
                </h2>
                {remainingHint && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(139, 92, 246, 0.08)",
                      color: "var(--accent-primary, #8b5cf6)",
                    }}
                  >
                    {remainingHint}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 max-h-[55vh] overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--accent-primary, #8b5cf6)" }} />
                  <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    AI 正在把任務拆成「無腦第一步」…
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    這通常需要 2-4 秒
                  </p>
                </div>
              ) : edited.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                    沒有可接受的步驟。
                    <br />
                    試試「換一組建議」或新增一條。
                  </p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {edited.map((step, i) => {
                    const isFirst = i === 0;
                    const isEditing = editingIndex === i;
                    return (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors"
                        style={{
                          background: isFirst ? "rgba(139, 92, 246, 0.06)" : "var(--surface-hover, rgba(0,0,0,0.02))",
                          border: isFirst
                            ? "1px solid rgba(139, 92, 246, 0.18)"
                            : "1px solid transparent",
                        }}
                      >
                        {/* 編號 / 首條星號 */}
                        <div
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold"
                          style={{
                            background: isFirst ? "var(--accent-primary, #8b5cf6)" : "var(--surface-hover, rgba(0,0,0,0.04))",
                            color: isFirst ? "white" : "var(--text-tertiary)",
                          }}
                        >
                          {isFirst ? <Star className="w-3 h-3" aria-hidden /> : i + 1}
                        </div>

                        {/* 標題 / 編輯輸入 */}
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input
                              ref={editInputRef}
                              type="text"
                              value={draftValue}
                              onChange={(e) => setDraftValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commitEdit();
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  setEditingIndex(null);
                                  setDraftValue("");
                                }
                              }}
                              onBlur={commitEdit}
                              className="w-full bg-transparent outline-none text-[13px] leading-snug border-b pb-0.5"
                              style={{
                                color: "var(--text-primary)",
                                borderColor: "var(--accent-primary, #8b5cf6)",
                              }}
                            />
                          ) : (
                            <p
                              className={`text-[13px] leading-snug ${isFirst ? "font-semibold" : ""}`}
                              style={{ color: "var(--text-primary)" }}
                            >
                              {step}
                              {isFirst && (
                                <span
                                  className="ml-1.5 text-[10px] uppercase tracking-wide font-medium"
                                  style={{ color: "var(--accent-primary, #8b5cf6)" }}
                                >
                                  第一步
                                </span>
                              )}
                            </p>
                          )}
                        </div>

                        {/* 操作 */}
                        {!isEditing && (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEdit(i)}
                              className="p-1 rounded hover:bg-black/5 transition-colors"
                              style={{ color: "var(--text-tertiary)" }}
                              aria-label={`編輯步驟 ${i + 1}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(i)}
                              className="p-1 rounded hover:bg-red-50 transition-colors"
                              style={{ color: "var(--text-tertiary)" }}
                              aria-label={`刪除步驟 ${i + 1}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Actions */}
            {!loading && (
              <div
                className="px-5 py-3 flex items-center justify-between gap-2"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] hover:bg-black/5 transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                    aria-label="新增一條步驟"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新增</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerateClick}
                    disabled={!canRegenerate || loading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] hover:bg-black/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: "var(--text-secondary)" }}
                    aria-label="換一組建議(扣除 1 次額度)"
                    title={canRegenerate ? "換一組建議(扣除 1 次額度)" : "今日額度已用完"}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>換一組</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-[13px] font-medium hover:bg-black/5 transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={edited.length === 0}
                    className="px-4 py-2 rounded-xl text-[13px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      background: "var(--accent-primary, #8b5cf6)",
                      color: "white",
                    }}
                  >
                    全部接受 →
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}