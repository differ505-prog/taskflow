"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStatusWindowStore } from "@/lib/statusWindowStore";

/**
 * 全域狀態窗渲染器
 *
 * 掛在 AppLayout 內(確保任何頁面可見)
 * 2.5s 自動消失 · 無遮罩 · pointer-events-none 避免打斷操作
 */
export function StatusWindow() {
  const payload = useStatusWindowStore((s) => s.payload);
  const dismiss = useStatusWindowStore((s) => s.dismiss);

  useEffect(() => {
    if (!payload) return;
    const timer = window.setTimeout(() => dismiss(), 2500);
    return () => window.clearTimeout(timer);
  }, [payload, dismiss]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-0 z-[100] flex items-start justify-center"
      style={{ paddingTop: "max(7rem, env(safe-area-inset-top, 0px))" }}
    >
      <AnimatePresence>
        {payload && (
          <motion.div
            key={payload.message + (payload.xpDelta ?? 0)}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="relative mx-4 max-w-md"
            role="status"
          >
            {/* 霓虹外發光 */}
            <div
              aria-hidden
              className="absolute -inset-3 rounded-3xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.45), rgba(168,85,247,0.45), rgba(236,72,153,0.35))",
                filter: "blur(24px)",
                opacity: 0.55,
              }}
            />

            {/* 主體:深色玻璃擬物 + 霓虹邊框 */}
            <div
              className="relative overflow-hidden rounded-2xl px-6 py-5 text-slate-50 shadow-2xl"
              style={{
                background: "rgba(10, 10, 15, 0.85)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid transparent",
                backgroundImage:
                  "linear-gradient(rgba(10,10,15,0.85), rgba(10,10,15,0.85)), linear-gradient(135deg, #6366f1, #a855f7, #ec4899)",
                backgroundOrigin: "border-box",
                backgroundClip: "padding-box, border-box",
              }}
            >
              {/* 角落裝飾刻線 */}
              <div
                aria-hidden
                className="absolute left-3 top-3 h-3 w-3 border-l-2 border-t-2"
                style={{ borderColor: "rgba(168,85,247,0.6)" }}
              />
              <div
                aria-hidden
                className="absolute right-3 bottom-3 h-3 w-3 border-r-2 border-b-2"
                style={{ borderColor: "rgba(168,85,247,0.6)" }}
              />

              <div className="flex items-center gap-4">
                {payload.icon && (
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))",
                      boxShadow: "inset 0 0 0 1px rgba(168,85,247,0.4)",
                    }}
                  >
                    {payload.icon}
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-1">
                  {payload.title && (
                    <p
                      className="text-balance text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: "rgba(196,181,253,0.9)" }}
                    >
                      {payload.title}
                    </p>
                  )}
                  <p className="text-balance text-sm font-medium leading-relaxed text-slate-100">
                    {payload.message}
                  </p>

                  <div className="mt-1 flex items-center gap-3">
                    {typeof payload.xpDelta === "number" && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums"
                        style={{
                          background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3))",
                          color: "#c4b5fd",
                          boxShadow: "inset 0 0 0 1px rgba(168,85,247,0.5)",
                        }}
                      >
                        <span aria-hidden>✦</span>
                        +{payload.xpDelta} XP
                      </span>
                    )}
                    {typeof payload.levelUpTo === "number" && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          background: "linear-gradient(135deg, rgba(236,72,153,0.3), rgba(168,85,247,0.3))",
                          color: "#fbcfe8",
                          boxShadow: "inset 0 0 0 1px rgba(236,72,153,0.5)",
                        }}
                      >
                        <span aria-hidden>▲</span>
                        Lv. {payload.levelUpTo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
