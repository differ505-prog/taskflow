"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

/**
 * ReturnHook — 回訪觸發鉤子
 *
 * 觸發時機（Day 1 完成後）：
 *  - Day 3 ±1 天：顯示「回來了 ☕」卡片（輕量問候）
 *  - Day 7 ±1 天：顯示「一週堅持 💫」卡片（慶祝里程碑）
 *  - 每次進入時檢查，符合條件就顯示
 *  - 顯示後 7 天內不重現（避免用戶連續多天看到）
 *
 * 設計原則（對應教練 §3 ADHD 平靜設計）：
 *  - 非 modal，點擊外部/自動 5 秒消失，不阻斷工作流
 *  - 純文字 + 暖色豎條裝飾，資訊量極低
 *  - 30 天後若未回訪，重新出現（適用中斷後回來的用戶）
 */

const RETURN_HOOK_DONE_KEY = "taskflow_return_hook_done";
const ONBOARDING_COMPLETE_KEY = "taskflow_onboarding_complete_timestamp";

function getDaysDiff(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

export function ReturnHook() {
  const { user, loading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"day3" | "day7" | null>(null);
  const [initialized, setInitialized] = useState(false);

  const checkReturn = useCallback(() => {
    if (!user?.uid) return;
    if (typeof window === "undefined") return;

    const key = `${ONBOARDING_COMPLETE_KEY}_${user.uid}`;
    const ts = parseInt(localStorage.getItem(key) || "0", 10);
    if (!ts) return;

    const days = getDaysDiff(ts);

    // Day 3 (±1 天)
    if (days >= 2 && days <= 4) {
      const doneKey = `${RETURN_HOOK_DONE_KEY}_day3_${user.uid}`;
      const lastDone = parseInt(localStorage.getItem(doneKey) || "0", 10);
      const daysSinceLast = getDaysDiff(lastDone);
      if (daysSinceLast >= 7) {
        setPhase("day3");
        setVisible(true);
        localStorage.setItem(doneKey, String(Date.now()));
      }
    }

    // Day 7 (±1 天)
    if (days >= 6 && days <= 8) {
      const doneKey = `${RETURN_HOOK_DONE_KEY}_day7_${user.uid}`;
      const lastDone = parseInt(localStorage.getItem(doneKey) || "0", 10);
      const daysSinceLast = getDaysDiff(lastDone);
      if (daysSinceLast >= 7) {
        setPhase("day7");
        setVisible(true);
        localStorage.setItem(doneKey, String(Date.now()));
      }
    }

    setInitialized(true);
  }, [user?.uid]);

  useEffect(() => {
    if (loading) return;
    if (!user?.uid) { setInitialized(true); return; }
    checkReturn();

    // 5 秒自動消失
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [loading, user?.uid, checkReturn]);

  const messages = {
    day3: {
      title: "回來了 ☕",
      body: "今天的任務，已經在等你了。",
    },
    day7: {
      title: "一週了 💫",
      body: "你連續一週都在。這本身，就是一種成就。",
    },
  };

  if (!initialized) return null;

  return (
    <AnimatePresence>
      {visible && phase && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed top-4 left-1/2 z-30 w-[90%] max-w-sm -translate-x-1/2"
          role="note"
          aria-label="回訪問候"
        >
          <div
            className="relative overflow-hidden rounded-2xl px-4 py-3 shadow-md"
            style={{
              background: "color-mix(in srgb, var(--accent-warm-start) 8%, white)",
              border: "1px solid color-mix(in srgb, var(--accent-warm-start) 20%, transparent)",
              backdropFilter: "blur(8px)",
            }}
          >
            {/* 暖色左側豎條 */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
              style={{ background: "linear-gradient(to bottom, var(--accent-warm-start), var(--accent-warm-end))" }}
              aria-hidden
            />

            <div className="flex items-center gap-3 pl-2">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb, var(--accent-warm-start) 15%, transparent)" }}
                aria-hidden
              >
                <Sparkles className="h-4 w-4" style={{ color: "var(--accent-warm-start)" }} />
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="text-[14px] font-medium leading-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {messages[phase].title}
                </p>
                <p
                  className="mt-0.5 text-[12px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {messages[phase].body}
                </p>
              </div>

              {/* 關閉 */}
              <button
                onClick={() => setVisible(false)}
                className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="關閉問候"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* 自動消失 progress */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-2xl" aria-hidden>
              <motion.div
                className="h-full rounded-b-2xl"
                style={{ background: "var(--accent-warm-end)" }}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 5, ease: "linear" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 記錄 Day 1 完成時間戳（在 Onboarding 完成後呼叫） */
export function markOnboardingComplete(uid?: string | null) {
  if (!uid || typeof window === "undefined") return;
  const key = `${ONBOARDING_COMPLETE_KEY}_${uid}`;
  const existing = localStorage.getItem(key);
  // 不覆蓋已有時間戳
  if (!existing) {
    localStorage.setItem(key, String(Date.now()));
  }
}
