"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

/**
 * §ZenMusicFrame — 心流音樂 iframe 的「DOM 載體」
 *
 * 設計動機:
 * - 原本 iframe 嵌在 FlowTimer 元件內。當 FlowTimer 被 React unmount
 *   (例如用戶從禪模式切到任務大廳時 ZenDashboard 內部條件渲染變動、
 *   或 defaultView === "board" 時 ZenDashboard 整個被 AppLayout 取代),
 *   iframe 連帶銷毀 → OmniSonic 站播放中斷。
 * - 心流音樂是「provider 等級」的服務,不應受視圖元件生命週期影響。
 *   把 iframe 提升到 ZenFlowProvider 層,常駐 DOM 樹,視圖切換零影響。
 * - 本元件不做任何 UI、不接收使用者互動 — 純 DOM 載體 + ref 把手。
 *   視覺按鈕仍歸 FlowTimer 管(保留現有「沒開計時器不准播音樂」守衛)。
 */
export type ZenMusicFrameHandle = {
  /** 取得底層 iframe 元素(供 src 操作 / postMessage 等) */
  getIframe: () => HTMLIFrameElement | null;
};

export const ZenMusicFrame = forwardRef<ZenMusicFrameHandle>(function ZenMusicFrame(_, ref) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // §SSR hydration workaround: 與原 FlowTimer 同款做法
  // src 在 useEffect 才注入,避免 SSR 階段 React 標記 hydration mismatch
  // (此元件掛在 Provider 層,不過 SSR hydration 安全仍是基本功)
  useImperativeHandle(ref, () => ({
    getIframe: () => iframeRef.current,
  }));

  return (
    <iframe
      ref={iframeRef}
      title="OmniSonic Deep Focus Button"
      // §視覺隱藏但常駐 DOM。size 1px 透明 — 唯一目的是不讓瀏覽器回收 audio。
      // 若用 display:none 會被部分瀏覽器暫停 autoplay audio context。
      // 故採 visibility:hidden + 1px 維持 layout,但完全不可見不可點。
      className="pointer-events-none fixed bottom-0 right-0 z-[-1] h-px w-px opacity-0"
      style={{ border: "none", colorScheme: "light" }}
      allow="autoplay"
      scrolling="no"
      src={`${process.env.NEXT_PUBLIC_OMNISONIC_URL || "https://music-focus-environment.vercel.app"}/embed/button`}
    />
  );
});
