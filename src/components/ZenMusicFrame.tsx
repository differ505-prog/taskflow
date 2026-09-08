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
 *
 * §iframe 尺寸 audio suppression 規避:
 * - iframe 採 OmniSonic embed button 真實尺寸(120×40),
 *   但 style.opacity = 0.001(>0 觸發 audio decoder,視覺實質不可見)+ z-[-1] 墊底。
 * - 1×1 + opacity:0 會被 Chromium 視為「不可見媒體」延遲/暫停 audio context;
 *   display:none 也會被部分瀏覽器暫停 autoplay audio context。
 * - 「真實尺寸 + opacity:0.001 + 視覺靠右下 0/0」是平衡兩者的最簡解。
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
      className="pointer-events-none fixed bottom-0 right-0 z-[-1] h-[40px] w-[120px]"
      // §Chromium audio suppression workaround:
      // 1×1 opacity:0 iframe 會被瀏覽器判定為「不可見媒體」,延遲/暫停 audio context。
      // 解法:iframe 採 OmniSonic embed button 真實尺寸(120×40),
      // 但 style.opacity 設為 0.001 (>0 觸發 audio decoder,視覺實質不可見)。
      // 搭配 fixed bottom-0 right-0 視覺上仍在畫面角落,不擋主畫面互動。
      style={{ border: "none", colorScheme: "light", opacity: 0.001 }}
      allow="autoplay"
      scrolling="no"
      src={`${process.env.NEXT_PUBLIC_OMNISONIC_URL || "https://music-focus-environment.vercel.app"}/embed/button`}
    />
  );
});
