"use client";

/**
 * FeedbackButton + FeedbackModal — 封測/公測反饋浮動入口(使用者面向)
 *
 * 設計動機(§B 評分 9.2):
 *   - 右下角永遠浮動「📣」按鈕,BetaTester / Pro / Admin 看到
 *   - 點擊 → Modal 自動預填 metadata(§3 feedbackContext)
 *   - 使用者可選打字 1 句話,送出即同步至 Supabase + Discord 開發者通知
 *
 * 注意(§A 修正):
 *   - 「📋 複製 + AI 整理」**不是**使用者功能,是開發者後台(/admin/feedback)的功能
 *   - 因此本檔**只提供送出**,不提供複製按鈕
 *
 * 對齊既有 pattern(§25):
 *   - Modal 對齊 ConfirmDialog 的 AnimatePresence + focus trap + ESC 監聽
 *   - 變數對齊 useAuth().isBeta / isPro / isAdmin
 *   - 送出對齊 useDiscordNotifier 的 keepalive: true 風格
 *
 * 反覆根因預防(§26):
 *   - §M Provider 旁路:本元件在 AppProviders 內 mount,所有 routes 都看得到
 *   - §O' 雙 hook 死鎖:open state 單一(useState),不混用 hook 內部狀態
 *   - §4 高級微互動:200ms transition,hover scale,active scale 0.98
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, X, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import {
  collectContext,
  installFeedbackInterceptors,
  type FeedbackContextPayload,
} from "@/lib/feedbackContext";

const Z_INDEX = 200; // 對齊 ConfirmDialog

export function FeedbackButton({ isZenMode = false }: { isZenMode?: boolean }) {
  const { isAdmin, isPro, isBeta, user } = useAuth();
  // 權限 gate:只有 beta / pro / admin 看得到(免費使用者看不到反饋按鈕)
  const canShow = isAdmin || isPro || isBeta;
  const [open, setOpen] = useState(false);

  // 安裝 interceptor:module-level 旗自動守護只安裝一次
  useEffect(() => {
    installFeedbackInterceptors();
  }, []);

  if (!canShow) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="送出反饋"
        title="📣 任何想法 / bug / 優化建議都歡迎"
        className={`fixed bottom-4 right-4 z-[150] flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-200 ease-out hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${isZenMode ? "opacity-50 hover:opacity-100" : ""}`}
        style={{
          background: "var(--brand)",
          color: "var(--brand-foreground, white)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        }}
      >
        <MessageSquare className="w-5 h-5" aria-hidden="true" />
      </button>
      <FeedbackModal
        open={open}
        onClose={() => setOpen(false)}
        userEmail={user?.email ?? null}
        userRole={isAdmin ? "admin" : isPro ? "pro" : isBeta ? "beta" : "free"}
      />
    </>
  );
}

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  userEmail: string | null;
  userRole: string;
}

function FeedbackModal({ open, onClose, userEmail, userRole }: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [context, setContext] = useState<FeedbackContextPayload | null>(null);
  const [sending, setSending] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  // 開啟時:collect context + focus textarea + 鎖滾動 + ESC 監聽
  useEffect(() => {
    if (!open) return;

    previousActiveRef.current = document.activeElement as HTMLElement | null;
    setContext(collectContext());

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveRef.current?.focus?.();
    };
  }, [open, onClose]);

  // 關閉時重置(下次再開乾淨)
  useEffect(() => {
    if (!open) {
      setMessage("");
      setSending(false);
    }
  }, [open]);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          userEmail,
          userRole,
          context,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "送出失敗");
      }
      toast.success("已收到,謝謝你的反饋 ✨");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "送出失敗,請稍後再試");
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="min-w-0">
                <h2
                  id="feedback-modal-title"
                  className="text-[15px] font-semibold leading-snug truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  📣 任何想法 / bug / 優化建議
                </h2>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  系統已自動附上當下狀態,只需(可選)打 1 句話
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉"
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:bg-black/5 active:scale-95"
              >
                <X className="w-4 h-4" style={{ color: "var(--text-secondary)" }} aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 自動 metadata 預覽 */}
              <div
                className="rounded-xl p-3 text-[11px] font-mono leading-relaxed"
                style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                    自動 metadata
                  </span>
                  <span className="text-[10px] opacity-60">
                    {context?.collectedAt?.slice(11, 19) ?? ""}
                  </span>
                </div>
                <div>📍 {context?.route || "—"}</div>
                <div>👤 {userEmail ?? "訪客"} ({userRole})</div>
                <div>📱 {context?.viewport || "—"} · {context?.online ? "online" : "offline"}</div>
                <div>
                  ⚠️ console errors: {context?.recentConsoleErrors ?? 0} · warns: {context?.recentConsoleWarnings ?? 0}
                </div>
                {context?.lastActions && context.lastActions.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t" style={{ borderColor: "var(--border)" }}>
                    最後動作:
                    {context.lastActions.slice(-3).map((a, i) => (
                      <div key={i} className="truncate">
                        · {a.type}: {a.target}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 訊息輸入 */}
              <div>
                <label
                  htmlFor="feedback-message"
                  className="block text-[12px] font-medium mb-1.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  補充說明(可選)
                </label>
                <textarea
                  id="feedback-message"
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="例:點了 X 按鈕沒反應 / 希望可以加 Y 功能 / 某個畫面卡卡的…"
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] leading-relaxed resize-none focus-visible:ring-2 focus-visible:outline-none transition-colors"
                  style={{
                    background: "var(--surface-muted)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                  maxLength={2000}
                />
                <div className="text-[10px] mt-1 text-right" style={{ color: "var(--text-secondary)" }}>
                  {message.length} / 2000
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-5 py-3 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="px-4 py-2 rounded-lg text-[12.5px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                style={{ color: "var(--text-secondary)" }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                style={{
                  background: "var(--brand)",
                  color: "var(--brand-foreground, white)",
                }}
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                {sending ? "送出中…" : "送出"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
