"use client";

import { useEffect, useState } from "react";
import { Mic, MicOff, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useApp } from "@/lib/AppContext";
import { useVoiceRecognition } from "@/lib/useVoiceRecognition";

/**
 * 快速語音建任務 FAB。
 * - 永遠浮動在右下角(mobile 在 BottomNav 上方,desktop 在內容右下)
 * - 按下 → 彈出底部 mini sheet → 開始錄音
 * - 辨識到最終結果 → 自動 addTask 到收集箱(inbox = 不傳 listId)
 * - 顯示 toast「已加入收集箱」,sheet 自動關閉
 */
export function QuickVoiceFAB() {
  const { addTask } = useApp();
  const [open, setOpen] = useState(false);

  const handleResult = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addTask({
      title: trimmed,
      priority: "none",
      status: "todo",
      tags: [],
    });
    toast.success("已加入收集箱");
    setOpen(false);
  };

  const { isRecording, interimText, voiceError, toggle, reset } = useVoiceRecognition(handleResult);

  // 開 sheet 時若沒在錄音,自動 toggle;若已在錄音(例如從 TaskDetailPanel 切過來),保留狀態
  useEffect(() => {
    if (open && !isRecording && !voiceError) {
      toggle();
    }
    // 關 sheet 時重置錯誤
    if (!open && voiceError) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      {/* FAB button */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-50 rounded-full shadow-lg flex items-center justify-center text-white"
        style={{
          // mobile: BottomNav 上方 16px(60 nav + 16);desktop: 右下 24
          bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
          right: "calc(16px + env(safe-area-inset-right, 0px))",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        aria-label="快速語音建任務"
        title="快速語音建任務"
      >
        {/* desktop: 較大圓鈕;mobile: 仍 56px 但下移避開 BottomNav */}
        <span className="hidden md:flex items-center gap-2 px-5 h-14 rounded-full bg-[var(--brand)] text-white">
          <Mic className="w-5 h-5" />
          <span className="text-sm font-medium">語音建任務</span>
        </span>
        <span className="md:hidden w-14 h-14 rounded-full bg-[var(--brand)] flex items-center justify-center">
          <Mic className="w-6 h-6" />
        </span>
      </motion.button>

      {/* Bottom sheet */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="quick-voice-backdrop"
              className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              key="quick-voice-sheet"
              role="dialog"
              aria-label="快速語音建任務"
              className="fixed left-0 right-0 bottom-0 z-[80] rounded-t-3xl px-5 pt-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))]"
              style={{ background: "var(--surface)" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-4" />

              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  快速語音建任務
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  aria-label="關閉"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[13px] mb-4" style={{ color: "var(--text-tertiary)" }}>
                說出任務,完成後自動加入收集箱
              </p>

              {/* Mic button + interim text */}
              <div className="flex flex-col items-center gap-4 py-4">
                <motion.button
                  type="button"
                  onClick={toggle}
                  className="w-20 h-20 rounded-full flex items-center justify-center relative"
                  style={{
                    backgroundColor: isRecording ? "rgba(239,68,68,0.12)" : "var(--brand)",
                    color: isRecording ? "var(--status-danger)" : "white",
                  }}
                  animate={isRecording ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={isRecording ? { repeat: Infinity, duration: 1.2 } : { duration: 0.2 }}
                  aria-label={isRecording ? "停止錄音" : "開始錄音"}
                >
                  {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                  {isRecording && (
                    <span
                      className="absolute inset-0 rounded-full"
                      style={{
                        border: "2px solid var(--status-danger)",
                        opacity: 0.5,
                      }}
                    >
                      <motion.span
                        className="absolute inset-0 rounded-full"
                        style={{ border: "2px solid var(--status-danger)" }}
                        animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                        transition={{ repeat: Infinity, duration: 1.4, ease: "easeOut" }}
                      />
                    </span>
                  )}
                </motion.button>

                <div className="min-h-[28px] text-center px-4">
                  {isRecording && interimText && (
                    <p className="text-[14px] italic" style={{ color: "var(--text-tertiary)" }}>
                      {interimText}…
                    </p>
                  )}
                  {isRecording && !interimText && (
                    <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>
                      正在聆聽…
                    </p>
                  )}
                  {!isRecording && !voiceError && (
                    <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>
                      點擊麥克風開始
                    </p>
                  )}
                  {voiceError && (
                    <p className="text-[14px]" style={{ color: "var(--status-danger)" }}>
                      {voiceError}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
