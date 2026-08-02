"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { GhostFeatureId } from "./GhostButton";

/**
 * ProWaitlistModal — 幽靈按鈕統一候補名單 Modal
 *
 * 用途:
 *   點擊任一幽靈按鈕(4 個 featureId)後彈出,
 *   誠實告知用戶「功能還沒做好」,並收集加入 Pro 候補意願。
 *
 * 4 個 featureId 對應文案(教練任務 spec,完全照抄):
 *   - time_bar      : ⏳ 時間感知魔法醞釀中...
 *   - infinite_ai   : ✨ 無限粉碎魔法醞釀中...
 *   - pro_themes    : 👑 Pro 版專屬功能醞釀中...
 *   - body_doubling : 🎧 無聲討伐營地醞釀中...
 *
 * 設計哲學(對應教練任務規範 §3 嚴格禁止地雷):
 * 1. 🚫 禁止欺騙感 — 標題用「正在醞釀...」誠實幽默地表達
 * 2. 🚫 禁止付費要求 — Modal 內絕不出現信用卡 / Email 輸入欄位
 * 3. 🚫 禁止煩人 — 透過 useGhostButton hook 管理 1 週靜默
 * 4. 深灰玻璃擬物背景 — 對齊 §3 設計紀律(不要純黑)
 * 5. 兩個 CTA:主按鈕「加入候補」 + 次按鈕「先不用了」
 *
 * 沿用既有 modal pattern:
 *   - createPortal + framer-motion (與 QuickCaptureModal 一致)
 *   - Esc 關閉 / 點 backdrop 關閉
 *   - 背景 scroll lock
 */

/** 4 個 featureId 對應文案(SSOT — 教練任務 spec §假門測試) */
const PRO_WAITLIST_COPY: Record<GhostFeatureId, { title: string; body: string }> = {
  time_bar: {
    title: "⏳ 時間感知魔法醞釀中...",
    body: "「你發現了未來的 Pro 版能力!魔力消耗條將抽象的時間具象化為色塊倒數,徹底治癒時間盲。想第一時間獲得解鎖通知嗎?」",
  },
  infinite_ai: {
    title: "✨ 無限粉碎魔法醞釀中...",
    body: "「你發現了未來的 Pro 版能力!解除每日 3 次限制,讓 AI 成為你大腦永遠的外接運算單元,告別啟動癱瘓。想第一時間獲得解鎖通知嗎?」",
  },
  pro_themes: {
    title: "👑 Pro 版專屬功能醞釀中...",
    body: "「你發現了未來的 Pro 版能力！解鎖專屬主題、自訂稱號，以及極致降噪的深黑模式。想第一時間獲得解鎖通知嗎？」",
  },
  body_doubling: {
    title: "🎧 無聲專注室醞釀中...",
    body: "「你發現了未來的隱藏空間！沒有語音、沒有鏡頭、零社交壓力。這是一個與全球用戶一起無聲專注的虛擬空間。想第一時間獲得解鎖通知嗎？」",
  },
  infinite_focus: {
    title: "⏳ 解鎖 25 分鐘限制醞釀中...",
    body: "「你發現了未來的 Pro 版能力！免費版心流計時器每 25 分鐘自動停止音樂;Pro 版將解除這層限制,讓音樂與心流無縫接軌。想第一時間獲得解鎖通知嗎？」",
  },
};

export interface ProWaitlistModalProps {
  open: boolean;
  onClose: () => void;
  /** 功能 ID — 決定 Modal 標題與內文(必填,防止忘記傳) */
  featureId: GhostFeatureId;
  /** 點擊「加入候補名單」後呼叫(通常串 API 標記 waitlist) */
  onJoin?: () => void | Promise<void>;
}

export function ProWaitlistModal({ open, onClose, featureId, onJoin }: ProWaitlistModalProps) {
  const [mounted, setMounted] = useState(false);
  const [joining, setJoining] = useState(false);

  // Portal mount (SSR-safe)
  useEffect(() => {
    setMounted(true);
  }, []);

  // §15.4:背景 scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);
    try {
      if (onJoin) await onJoin();
    } finally {
      setJoining(false);
      onClose();
    }
  };

  if (!mounted) return null;

  const copy = PRO_WAITLIST_COPY[featureId];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="pro-waitlist-backdrop"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={onClose}
          className="fixed inset-0 z-[90] flex items-center justify-center px-4"
          style={{ background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(8px)" }}
        >
          <motion.div
            key="pro-waitlist-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pro-waitlist-title"
            aria-describedby="pro-waitlist-desc"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-[min(440px,calc(100vw-32px))] overflow-hidden rounded-3xl"
            style={{
              // 深灰玻璃擬物 — 不要純黑
              background:
                "linear-gradient(180deg, rgba(30, 41, 59, 0.92) 0%, rgba(15, 23, 42, 0.95) 100%)",
              backdropFilter: "blur(20px)",
              boxShadow:
                "0 24px 64px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08) inset",
            }}
          >
            {/* 星空裝飾 — 微弱光點,呼應「星空中醞釀」文案 */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(1px 1px at 12% 18%, rgba(167, 139, 250, 0.6), transparent), radial-gradient(1px 1px at 78% 28%, rgba(96, 165, 250, 0.5), transparent), radial-gradient(1px 1px at 42% 72%, rgba(167, 139, 250, 0.5), transparent), radial-gradient(1px 1px at 88% 84%, rgba(96, 165, 250, 0.4), transparent), radial-gradient(1px 1px at 22% 88%, rgba(255, 255, 255, 0.5), transparent)",
              }}
            />

            <div className="relative px-7 pt-8 pb-6 text-center">
              {/* 圖示 — 星芒 + 紫色微光 */}
              <div
                aria-hidden
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.15))",
                  boxShadow: "0 0 24px -4px rgba(139, 92, 246, 0.4)",
                }}
              >
                <Sparkles
                  className="h-7 w-7"
                  style={{ color: "#a78bfa" }}
                  strokeWidth={1.8}
                />
              </div>

              <h2
                id="pro-waitlist-title"
                className="mb-3 text-balance text-[19px] font-semibold leading-snug text-white"
              >
                {copy.title}
              </h2>

              <p
                id="pro-waitlist-desc"
                className="mb-7 text-balance text-[14px] leading-relaxed text-slate-300"
              >
                {copy.body}
              </p>

              {/* CTA 主按鈕 — 紫色漸層(對應幽靈按鈕 B 同色系) */}
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining}
                className="mb-2 w-full rounded-2xl px-5 py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                style={{
                  background:
                    "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                  boxShadow:
                    "0 8px 24px -6px rgba(139, 92, 246, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) inset",
                }}
              >
                {joining ? "加入中..." : "加入 Pro 候補名單"}
              </button>

              {/* 次按鈕 — 中性 ghost,符合 §4 微互動 */}
              <button
                type="button"
                onClick={onClose}
                disabled={joining}
                className="w-full rounded-2xl px-5 py-3 text-[14px] font-medium text-slate-400 transition-all duration-200 ease-out hover:bg-white/5 hover:text-slate-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                先不用了，謝謝
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
