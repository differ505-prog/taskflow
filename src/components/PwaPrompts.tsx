"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share, Plus, PartyPopper, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// ─── 共用工具 ────────────────────────────────────────────────────

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}

function isInStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    ("standalone" in window.navigator && (window.navigator as any).standalone === true)
  );
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ─── Milestone Keys ──────────────────────────────────────────────

const AHA_KEY = "taskflow_aha_seen";          // Aha Moment 全域只觸發一次
const INSTALL_MILESTONE_KEY = "taskflow_pwa_install_milestone"; // 安裝提示只觸發一次

// ─── iOS Safari 安裝提示（被動，等事件觸發）────────────────────

const IOS_DISMISS_KEY = "taskflow_ios_install_dismissed";

export function IOSInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOS()) return;
    if (isInStandalone()) return;
    if (localStorage.getItem(IOS_DISMISS_KEY) === "1") return;

    const handler = () => setVisible(true);
    window.addEventListener("taskflow:pwa-install-prompt", handler);
    return () => window.removeEventListener("taskflow:pwa-install-prompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(IOS_DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.18 }}
          className="fixed bottom-20 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-40"
          role="dialog"
          aria-label="加入主畫面引導"
        >
          <div className="card p-4 shadow-lg border" style={{ borderColor: "var(--brand)" }}>
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--brand-tint)" }}
                aria-hidden="true"
              >
                <Download className="w-5 h-5" style={{ color: "var(--brand)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  加到主畫面
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  點底部分享 <Share className="inline w-3 h-3 mx-0.5 align-text-bottom" aria-hidden="true" />,再選「加入主畫面」<Plus className="inline w-3 h-3 mx-0.5 align-text-bottom" aria-hidden="true" />
                </p>
              </div>
              <button
                onClick={dismiss}
                className="p-1 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
                aria-label="關閉"
              >
                <X className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Android Chrome 安裝提示（被動，等事件觸發）──────────────────

const ANDROID_DISMISS_KEY = "taskflow_android_install_dismissed";

export function AndroidInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAndroid()) return;
    if (isInStandalone()) return;
    if (localStorage.getItem(ANDROID_DISMISS_KEY) === "1") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const showHandler = () => setVisible(true);
    window.addEventListener("taskflow:pwa-install-prompt", showHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("taskflow:pwa-install-prompt", showHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toast.success("已加入主畫面,隨時點圖示開啟");
      }
    } catch (err) {
      console.warn("[PWA] Install prompt failed:", err);
    } finally {
      setDeferredPrompt(null);
      setVisible(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(ANDROID_DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.18 }}
          className="fixed bottom-20 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-40"
          role="dialog"
          aria-label="安裝 App 引導"
        >
          <div className="card p-4 shadow-lg border" style={{ borderColor: "var(--brand)" }}>
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--brand-tint)" }}
                aria-hidden="true"
              >
                <Download className="w-5 h-5" style={{ color: "var(--brand)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  安裝 TaskFlow App
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  加到主畫面,離線也能開,啟動更快。
                </p>
              </div>
              <button
                onClick={dismiss}
                className="p-1 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
                aria-label="關閉"
              >
                <X className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>
            <button
              onClick={handleInstall}
              className="w-full py-2 rounded-xl text-[13px] font-semibold transition-all active:scale-95"
              style={{ background: "var(--brand)", color: "white" }}
            >
              立即安裝
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Aha Moment：全員觸發，不論是否安裝 PWA ─────────────────────

export function AhaMoment() {
  const [visible, setVisible] = useState(false);

  const trigger = useCallback(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(AHA_KEY) === "1") return;
    localStorage.setItem(AHA_KEY, "1");
    setVisible(true);
  }, []);

  useEffect(() => {
    const handler = () => trigger();
    window.addEventListener("taskflow:aha-moment", handler);
    return () => window.removeEventListener("taskflow:aha-moment", handler);
  }, [trigger]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setVisible(false)}
          role="dialog"
          aria-modal="true"
          aria-label="恭喜你完成第一個任務"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="card w-full max-w-sm p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: "var(--brand-tint)" }}
              aria-hidden="true"
            >
              <PartyPopper className="w-8 h-8" style={{ color: "var(--brand)" }} />
            </div>
            <h3 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              恭喜你完成第一個任務!
            </h3>
            <p className="text-[13px] mb-5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              TaskFlow 已為你準備好：循環任務、子任務、心流計時器、艾森豪四象限⋯⋯
              隨時可以再新增更多任務。
            </p>
            <button
              onClick={() => setVisible(false)}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
              style={{ background: "var(--brand)", color: "white" }}
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              了解了
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── 統一路由：完成首個任務 / 首次番茄鐘 ────────────────────────

/**
 * 雙保險觸發點（OR 邏輯）：
 *  - 條件 A：完成第一個任務
 *  - 條件 B：完成第一次番茄鐘
 *
 * 觸發後只打擾使用者一次，milestone flag 存在 localStorage。
 */
export function dispatchPwaInstallPrompt() {
  if (typeof window === "undefined") return;

  // 確保只觸發一次（無論是任務完成或番茄鐘完成）
  if (localStorage.getItem(INSTALL_MILESTONE_KEY) === "1") return;
  localStorage.setItem(INSTALL_MILESTONE_KEY, "1");

  // Step 1：全員觸發 Aha Moment（多巴胺先分泌）
  window.dispatchEvent(new CustomEvent("taskflow:aha-moment"));

  // Step 2：等 Aha Moment 淡出（3 秒）→ 再滑出安裝提示
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("taskflow:pwa-install-prompt"));
  }, 3000);
}

/** 向下相容舊名稱 */
export const dispatchFirstTaskDone = dispatchPwaInstallPrompt;
