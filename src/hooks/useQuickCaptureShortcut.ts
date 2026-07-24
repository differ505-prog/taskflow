"use client";

import { useEffect, useRef } from "react";

/**
 * useQuickCaptureShortcut — 註冊 Cmd/Ctrl + K 全域快捷鍵
 *
 * 行為:
 *  - macOS:Cmd + K
 *  - Windows/Linux:Ctrl + K
 *  - 觸發後呼叫 onFocus(讓 QuickCapture input 自動 focus)
 *  - 自動 preventDefault 避免瀏覽器預設行為(Chrome 預設是 focus URL bar)
 *  - 忽略 IME 組字中(isComposing)
 *  - 忽略 input/textarea 內已 focus 的 Ctrl+K 行為(避免搶用戶輸入)
 *
 * §15.4 相容:isComposing 檢查
 * §26 reuse:沿用 codebase 既有「Cmd+K 開啟命令面板」概念 — 但這裡只做 focus
 */

export function useQuickCaptureShortcut(
  onFocus: () => void,
  enabled: boolean = true,
) {
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // 只接 Cmd+K (mac) / Ctrl+K (其他)
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key !== "k" && e.key !== "K") return;
      if (e.altKey || e.shiftKey) return;
      if (e.isComposing) return;
      // 已在 input/textarea 內 focus 不搶(用戶明確在打字)
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
      ) {
        // 禪模式 QuickCapture 的 input 例外 — 它的 handleKeyDown 內只處理 Enter
        // 但 Cmd+K 仍照觸發 focus(避免擾人)
        const isQuickCapture =
          active.getAttribute("aria-label")?.includes("快速捕捉") ?? false;
        if (!isQuickCapture) return;
      }
      e.preventDefault();
      onFocusRef.current();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
