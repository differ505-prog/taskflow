"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import { parseNaturalLanguage } from "@/lib/nlp";
import { getLocalToday } from "@/lib/dateUtils";

/**
 * QuickCaptureModal — Spotlight 風格的「發射後不理」大腦傾倒輸入框
 *
 * 設計哲學(對應教練 §10.3 9.5 方案):
 * 1. ADHD 焦點保護:用戶丟進去的靈感**不顯示於當前頁面**(默默進 Inbox)
 * 2. Fire-and-forget:送出瞬間 modal 關閉,絕不開「新增成功」對話框
 * 3. 視覺對齊 Spotlight / Linear command menu:中央偏上浮動 + 毛玻璃暗化背景
 * 4. 開啟動畫:opacity + 輕微 y 軸位移(俐落、不浮誇,符合 §4 微互動 ≤300ms)
 * 5. IME safe:onKeyDown + isComposing 防中文模式雙觸發(§15.4)
 * 6. Esc 關閉 / 點 backdrop 關閉(§18 全域 modal 標準行為)
 * 7. 沿用現有 addTask({ listId: undefined }) = 收件箱路徑,與原 QuickCapture 一致
 * 8. 背景滾動鎖定(modal 開啟期間),避免閃爍
 * 9. 受控設計:`open` + `onOpenChange` 由外部 owner 管理
 *    — ZenDashboard 統一管 Cmd+K 召喚 + mobile FAB 點擊
 *    — 內部不再監聽 Cmd+K(避免重複觸發,符合 §26 reuse)
 *
 * 沿用既有實作:
 * - addTask 介面不變(已支援 status: "todo" + priority: "delegate" + listId: undefined)
 * - 色彩 token:var(--brand-tint) / var(--brand) / var(--status-success)
 */

const FLASH_DURATION_MS = 480;

export interface QuickCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickCaptureModal({ open, onOpenChange }: QuickCaptureModalProps) {
  const { addTask, quickAdd } = useApp();
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const successTimerRef = useRef<number | null>(null);

  // Portal mount(SSR-safe)
  useEffect(() => {
    setMounted(true);
  }, []);

  // §15.4:背景 scroll 鎖定
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = useCallback(() => {
    onOpenChange(false);
    setValue("");
  }, [onOpenChange]);

  // 開啟時自動 focus(spotlight 招牌行為)
  useEffect(() => {
    if (open) {
      // 微延遲等 framer-motion 進場動畫開始
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    // §26 沿用「delegate 最低優先級 + listId: undefined = 收件箱」路徑
    // 確保禪模式的今日清單、Top 3 不會冒出剛捕捉的任務
    addTask({
      title: trimmed,
      status: "todo",
      priority: "delegate",
      listId: undefined, // 收件箱
      tags: [],
    });
    setValue("");
    // 微成功閃光(綠色 ✦,持續 480ms 然後關閉)
    setShowSuccess(true);
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    successTimerRef.current = window.setTimeout(() => {
      setShowSuccess(false);
      close();
    }, FLASH_DURATION_MS);
  }, [value, addTask, close]);

  // Shift+Enter / Cmd+Enter → 加入今日任務
  const handleSubmitToToday = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    // quickAdd 自動解析自然語言日期；若無日期則預設 today
    quickAdd(trimmed, "today");
    setValue("");
    setShowSuccess(true);
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    successTimerRef.current = window.setTimeout(() => {
      setShowSuccess(false);
      close();
    }, FLASH_DURATION_MS);
  }, [value, quickAdd, close]);

  // §15.4 mobile input:Enter on keydown + isComposing 防 IME 雙觸發
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (e.nativeEvent.isComposing) return; // IME 組字中
        e.preventDefault();
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          handleSubmitToToday();
        } else {
          handleSubmit();
        }
      }
    },
    [handleSubmit, handleSubmitToToday],
  );

  // Esc 關閉(只在 modal 開啟時接)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // NLP 即時預覽 — 打字時顯示解析結果（日期晶片 + 優先級）
  const nlpPreview = useMemo(() => {
    if (!value.trim()) return null;
    return parseNaturalLanguage(value);
  }, [value]);

  // 將 YYYY-MM-DD 轉為「今天/明天/週三」等友善格式
  const formatDueDate = (dateStr: string) => {
    const today = getLocalToday();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const t = tomorrow.toISOString().split("T")[0];
    if (dateStr === today) return "今天";
    if (dateStr === t) return "明天";
    const d = new Date(dateStr + "T12:00:00");
    const weekdays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
    return `${d.getMonth() + 1}/${d.getDate()} ${weekdays[d.getDay()]}`;
  };

  const previewDueDate = nlpPreview?.dueDate;
  const previewPriority = nlpPreview?.priority;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="quick-capture-backdrop"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm"
          onClick={close}
        >
          {/* Desktop: 中央浮動 | Mobile: 底部滑出 Bottom Sheet */}
          <motion.div
            key="quick-capture-panel"
            role="dialog"
            aria-modal="true"
            aria-label="快速捕捉任務"
            initial={{ opacity: 0, y: -12, x: "-50%", scale: 0.98 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, y: -8, x: "-50%", scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute left-1/2 top-[18vh] w-[min(640px,calc(100dvw-32px))] hidden sm:block"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Desktop 內容 */}
            <div
              className={`flex items-center gap-3 rounded-2xl bg-white/95 px-5 py-4 shadow-2xl ring-1 backdrop-blur-md transition-all duration-200 ease-out ${
                showSuccess
                  ? "ring-[var(--status-success)]/40"
                  : "ring-slate-200/60 focus-within:ring-slate-400"
              }`}
            >
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg transition-colors duration-200 ease-out"
                aria-hidden
                style={{
                  background: showSuccess ? "var(--status-success)" : "var(--brand-tint)",
                  color: showSuccess ? "white" : "var(--brand)",
                }}
              >
                {showSuccess ? "✓" : "＋"}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="想到什麼？按 Enter 丟進收件箱..."
                aria-label="大腦傾倒輸入框 — Enter 送出到收件箱，Shift+Enter 加入今日任務"
                className="flex-1 min-w-0 bg-transparent text-[16px] sm:text-[17px] placeholder:text-[var(--text-placeholder)] focus:outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              {/* Desktop NLP 預覽晶片 */}
              <AnimatePresence>
                {(previewDueDate || previewPriority) && (
                  <motion.div
                    key="desktop-preview"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-shrink-0 items-center gap-1.5"
                    aria-live="polite"
                    aria-label="NLP 預覽：系統將如此解析"
                  >
                    {previewDueDate && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1" style={{ background: "var(--chip-accent-bg)", color: "var(--chip-accent-text)", boxShadow: "0 0 0 1px var(--chip-accent-ring)" }}>
                        📅 {formatDueDate(previewDueDate)}
                      </span>
                    )}
                    {previewPriority && (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1"
                        style={
                          previewPriority === "do-now"
                            ? { background: "var(--priority-high-bg)", color: "var(--priority-high-text)", boxShadow: "0 0 0 1px var(--priority-high-ring)" }
                            : previewPriority === "schedule"
                            ? { background: "var(--priority-medium-bg)", color: "var(--priority-medium-text)", boxShadow: "0 0 0 1px var(--priority-medium-ring)" }
                            : { background: "var(--surface-muted)", color: "var(--text-tertiary)", boxShadow: "0 0 0 1px var(--border)" }
                        }
                      >
                        {previewPriority === "do-now" ? "🔴 速辦" :
                         previewPriority === "schedule" ? "🟡 排程" : "⬜ 一般"}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Desktop 快捷鍵提示 */}
              {value.trim() && !previewDueDate && (
                <span className="flex-shrink-0 text-[10px] text-slate-400 tabular-nums" aria-hidden>
                  ↵ Enter 收集箱 · ⇧ Enter 今日
                </span>
              )}
              <span
                aria-live="polite"
                aria-atomic="true"
                className={`flex-shrink-0 text-[12px] font-medium transition-opacity duration-200 ease-out ${
                  showSuccess ? "opacity-100" : "opacity-0"
                }`}
                style={{ color: "var(--status-success)" }}
              >
                已投遞
              </span>
              <kbd
                className="hidden items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200/60 sm:inline-flex"
                aria-hidden
              >
                Esc
              </kbd>
            </div>
          </motion.div>

          {/* Mobile: 底部 Bottom Sheet */}
          <motion.div
            key="quick-capture-mobile"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-x-0 bottom-0 z-[81] sm:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 安全區底部留白 */}
            <div
              className={`flex flex-col rounded-t-3xl bg-white/95 px-5 pt-5 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-md transition-all duration-200 ${
                showSuccess ? "ring-1 ring-[var(--status-success)]/40" : "ring-1 ring-slate-200/60"
              }`}
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
            >
              {/* 拖曳指示條 */}
              <div className="mx-auto mb-4 h-1 w-10 flex-shrink-0 rounded-full bg-slate-200" aria-hidden />

              {/* 輸入框 */}
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg transition-colors duration-200 ease-out"
                  aria-hidden
                  style={{
                    background: showSuccess ? "var(--status-success)" : "var(--brand-tint)",
                    color: showSuccess ? "white" : "var(--brand)",
                  }}
                >
                  {showSuccess ? "✓" : "＋"}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="想到什麼？..."
                  aria-label="大腦傾倒輸入框 — 送出到收件箱或今日"
                  className="flex-1 min-w-0 bg-transparent text-[16px] placeholder:text-[var(--text-placeholder)] focus:outline-none"
                style={{ color: "var(--text-primary)" }}
                />
                {/* 成功提示 */}
                <span
                  aria-live="polite"
                  aria-atomic="true"
                  className={`flex-shrink-0 text-[12px] font-medium transition-opacity duration-200 ${
                    showSuccess ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ color: "var(--status-success)" }}
                >
                  已投遞
                </span>
              </div>

              {/* Mobile NLP 預覽晶片 */}
              <AnimatePresence>
                {(previewDueDate || previewPriority) && (
                  <motion.div
                    key="mobile-preview"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mt-2 flex flex-wrap items-center gap-1.5 overflow-hidden"
                    aria-live="polite"
                    aria-label="NLP 預覽：系統將如此解析"
                  >
                    {previewDueDate && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1" style={{ background: "var(--chip-accent-bg)", color: "var(--chip-accent-text)", boxShadow: "0 0 0 1px var(--chip-accent-ring)" }}>
                        📅 {formatDueDate(previewDueDate)}
                      </span>
                    )}
                    {previewPriority && (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1"
                        style={
                          previewPriority === "do-now"
                            ? { background: "var(--priority-high-bg)", color: "var(--priority-high-text)", boxShadow: "0 0 0 1px var(--priority-high-ring)" }
                            : previewPriority === "schedule"
                            ? { background: "var(--priority-medium-bg)", color: "var(--priority-medium-text)", boxShadow: "0 0 0 1px var(--priority-medium-ring)" }
                            : { background: "var(--surface-muted)", color: "var(--text-tertiary)", boxShadow: "0 0 0 1px var(--border)" }
                        }
                      >
                        {previewPriority === "do-now" ? "🔴 速辦" :
                         previewPriority === "schedule" ? "🟡 排程" : "⬜ 一般"}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">預覽</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mobile 雙按鈕區 */}
              <div className="mt-4 flex gap-3">
                {/* 📥 收集箱 */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!value.trim() || showSuccess}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: "var(--surface-muted, #f4f4f5)",
                    color: "var(--text-secondary, #71717a)",
                    border: "1px solid var(--border, #e4e4e7)",
                  }}
                  aria-label="將任務投入收集箱"
                >
                  <span aria-hidden>📥</span>
                  <span>收集箱</span>
                </button>

                {/* 🎯 今日 */}
                <button
                  type="button"
                  onClick={handleSubmitToToday}
                  disabled={!value.trim() || showSuccess}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: "var(--brand, #3b82f6)",
                    color: "var(--brand-foreground, #ffffff)",
                  }}
                  aria-label="將任務加入今日待辦"
                >
                  <span aria-hidden>🎯</span>
                  <span>今日</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}