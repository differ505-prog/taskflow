"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Zap, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

/**
 * ZenFirstVisitGuide — 首次進入禪模式的引導
 *
 * 觸發條件：
 *  - 今日（today）沒有待辦任務
 *  - 首次來到禪模式（per-user localStorage flag）
 *  - 使用者已登入
 *
 * 設計原則：
 *  - 只說一句話 + 一個 CTA（不阻斷、不說教）
 *  - 8 秒後自動消失（用戶來不及讀完也無所謂）
 *  - 用戶可主動關閉，關閉後 30 天不再出現
 *  - 非 modal，點擊外部可繼續工作
 */
const ZEN_GUIDE_KEY = "taskflow_zen_first_visit_done";

export function ZenFirstVisitGuide() {
  const { user, loading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;
    if (dismissed) return;

    const guideKey = `${ZEN_GUIDE_KEY}_${user.uid}`;
    const dismissKey = `${ZEN_GUIDE_KEY}_dismissed_${user.uid}`;

    // 已看過 → 不顯示
    if (typeof window !== "undefined") {
      if (localStorage.getItem(guideKey) === "1") return;
      // 被用戶主動關閉且在 30 天內
      const dismissTime = localStorage.getItem(dismissKey);
      if (dismissTime) {
        const daysSinceDismiss = (Date.now() - parseInt(dismissTime)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismiss < 30) return;
      }
    }

    setInitialized(true);
    setVisible(true);

    // 8 秒後自動消失（消失後才寫 sentinel，下次不再現）
    const timer = setTimeout(() => {
      setVisible(false);
      try { localStorage.setItem(guideKey, "1"); } catch {}
    }, 8000);
    return () => clearTimeout(timer);
  }, [loading, user?.uid, dismissed]);

  const handleDismiss = useCallback(() => {
    if (!user?.uid) return;
    const dismissKey = `${ZEN_GUIDE_KEY}_dismissed_${user.uid}`;
    try { localStorage.setItem(dismissKey, String(Date.now())); } catch {}
    setDismissed(true);
    setVisible(false);
  }, [user?.uid]);

  if (!initialized) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute top-4 left-1/2 z-30 w-[90%] max-w-sm -translate-x-1/2"
          role="note"
          aria-label="禪模式使用提示"
        >
          <div
            className="relative overflow-hidden rounded-2xl px-4 py-3 shadow-lg"
            style={{
              background: "color-mix(in srgb, var(--accent-warm-start) 8%, white)",
              border: "1px solid color-mix(in srgb, var(--accent-warm-start) 25%, transparent)",
              backdropFilter: "blur(8px)",
            }}
          >
            {/* 暖色左側豎條 */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
              style={{ background: "linear-gradient(to bottom, var(--accent-warm-start), var(--accent-warm-end))" }}
              aria-hidden
            />

            <div className="flex items-start gap-3 pl-2">
              {/* Icon */}
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb, var(--accent-warm-start) 15%, transparent)" }}
                aria-hidden
              >
                <Sparkles className="h-4 w-4" style={{ color: "var(--accent-warm-start)" }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-medium leading-snug"
                  style={{ color: "var(--text-primary)" }}
                >
                  把任務排到今天，它們會出現在這裡
                </p>
                <p
                  className="mt-0.5 text-[11px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  用指令中心（⌘K）或左側大廳，把任務設為今日。
                </p>

                {/* CTA */}
                <a
                  href="/?board=1"
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium transition-all hover:gap-2"
                  style={{ color: "var(--accent-warm-start)" }}
                  aria-label="開啟任務大廳安排今日任務"
                >
                  <Zap className="h-3 w-3" aria-hidden />
                  開啟大廳
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </a>
              </div>

              {/* Dismiss */}
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="關閉提示"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Auto-dismiss progress bar */}
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl overflow-hidden"
              aria-hidden
            >
              <motion.div
                className="h-full rounded-b-2xl"
                style={{ background: "var(--accent-warm-end)" }}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 8, ease: "linear" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
