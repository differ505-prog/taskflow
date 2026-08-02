"use client";

/**
 * DebugConsole — 在 PWA / mobile 環境注入 vConsole
 *
 * 觸發條件(任一):
 * - window.location.hostname 是 localhost / 127.0.0.1
 * - URL 帶 ?debug=1 query
 *
 * 為什麼需要:
 * - iOS PWA 從主畫 icon 啟動時,**Mac Safari Web Inspector 看不到** (§24.1)
 * - chrome://inspect 也看不到 PWA
 * - vConsole 注入後,PWA 內會出現浮動按鈕,點開是完整 web console
 *
 * vConsole 動態 import — 避免 SSR error(沒有 window)。
 */
import { useEffect } from "react";

export function DebugConsole() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    const params = new URLSearchParams(window.location.search);
    const isLocal = host === "localhost" || host === "127.0.0.1";
    const isDebugQuery = params.get("debug") === "1";
    if (!isLocal && !isDebugQuery) return;

    let cancelled = false;
    import("vconsole").then(({ default: VConsole }) => {
      if (cancelled) return;
      new VConsole({ theme: "light" });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}