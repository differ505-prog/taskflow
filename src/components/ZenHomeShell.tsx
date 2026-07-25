"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import ZenDashboard from "@/components/ZenDashboard";
import { useUserPreferences } from "@/hooks/useUserPreferences";

/**
 * 禪模式家頁 / 抽屜殼
 * - URL `?board=1` 開啟任務大廳抽屜(內含 AppLayout)
 * - 不開新路由,純 query string 開關(§26-M 預防:Provider 已在 root layout)
 * - Esc 鍵關閉 + 背景點擊關閉
 * - 手機全寬 / 桌面 1024px 限寬
 * - 抽屜內 AppLayout 自帶 sidebar(內含「軍機處」+ 全部視圖切換)
 *
 * 啟動偏好讀取(useUserPreferences):
 * - 出廠預設 "zen":開啟禪模式背景 + 不開抽屜
 * - 用戶偏好 "board":自動加 `?board=1` query 開啟任務大廳抽屜
 * - SSR 期間不讀 localStorage(避免 hydration mismatch)
 * - 偏好設定 hydration 完成後才決定是否 redirect
 */
export default function ZenHomeShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBoardOpen = searchParams.get("board") === "1";
  const { defaultView, isHydrated } = useUserPreferences();

  // §15.6 對齊:SSR 期間 defaultView = "zen"(SSR-safe lazy init)
  // hydration 完成後才決定是否全螢幕渲染任務大廳
  // §26-G 預防:SSR 渲染的 DOM 結構必須與首次 client render 一致
  const shouldRenderBoardFullscreen = isHydrated && defaultView === "board";

  const closeBoard = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("board");
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });
  };

  // 暫時開啟任務大廳抽屜(用戶在禪模式頁想看任務列表時用,沿用既有 ?board=1 行為)
  // 用 router.push 而非 replace — 保留 back 按鈕回到禪模式
  useEffect(() => {
    if (!isHydrated) return;
    if (isBoardOpen) return;
    if (!shouldRenderBoardFullscreen) return;
    // 全螢幕模式:直接渲染 AppLayout,不開 query
    // (此 effect 留著是為了 SSR/CSR 邊界統一 — 進入 / 後無 query 直接渲染任務大廳)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, shouldRenderBoardFullscreen]);

  // Esc 關閉抽屜
  useEffect(() => {
    if (!isBoardOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeBoard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBoardOpen, searchParams]);

  // 開啟時鎖住 body 滾動(避免禪模式背景跟著上下滑)
  useEffect(() => {
    if (!isBoardOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isBoardOpen]);

  return (
    <>
      {shouldRenderBoardFullscreen ? (
        <AppLayout />
      ) : (
        <>
          <ZenDashboard />
          <BoardDrawer
            isOpen={isBoardOpen}
            onClose={closeBoard}
            content={<AppLayout />}
          />
        </>
      )}
    </>
  );
}

function BoardDrawer({
  isOpen,
  onClose,
  content,
}: {
  isOpen: boolean;
  onClose: () => void;
  content: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={onClose}
            aria-hidden
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
          />
          <motion.div
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="任務大廳"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[var(--surface-muted)] shadow-2xl md:max-w-[1280px] lg:max-w-[1440px]"
          >
            <div className="flex items-center justify-end px-4 pt-3 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉任務大廳,返回禪模式"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-slate-500 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-slate-700 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <svg
                  aria-hidden
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>關閉</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
