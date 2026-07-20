"use client";

import { useEffect, useRef, useState } from "react";

/**
 * MobileLogOverlay — 手機端專用 debug log overlay
 *
 * 觸發條件：
 * - 只在 window.innerWidth < 768（mobile viewport）才掛載
 * - 用 localStorage flag `__MOBILE_LOG_OVERLAY__` 控制開關，預設關
 *
 * 行為：
 * - 攔截 console.log，過濾含「personalTaskSync」/「UI RENDER」/「SUP SYNC」/「AppContext」/「periodic poll」/「Realtime」的 log
 * - 顯示在畫面底部一個可關閉的黑色面板，最多保留 50 行
 * - desktop 不會出現（用 mobile 判斷）
 *
 * 為什麼不直接用 USB inspect？iPhone 連 Mac 對非技術用戶門檻高。
 * 用 overlay 你只要手機截圖就能看到完整時序。
 *
 * ⚠️ §13 最小變更：此元件只在 mobile 啟用，不影響 desktop 路徑。
 * ⚠️ §26 此元件屬於「debug observability」輔助工具，不動既有 sync 邏輯。
 */

const FILTER_KEYWORDS = [
  "personalTaskSync",
  "UI RENDER",
  "SUP SYNC",
  "AppContext",
  "periodic poll",
  "Realtime",
  "INSERT callback",
  "UPDATE callback",
  "DELETE callback",
  "channel 已",
  "setTasks result",
  "fallback poll",
];

const OVERLAY_FLAG_KEY = "__MOBILE_LOG_OVERLAY__";
const MAX_LINES = 50;

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

export function MobileLogOverlay() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 偵測 mobile + 讀取 localStorage flag
  useEffect(() => {
    const check = () => {
      const mobile = isMobileViewport();
      setIsMobile(mobile);
      if (!mobile) {
        setEnabled(false);
        return;
      }
      const flag = localStorage.getItem(OVERLAY_FLAG_KEY);
      setEnabled(flag === "1");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 攔截 console.log
  useEffect(() => {
    if (!enabled || !isMobile) return;
    const origLog = console.log.bind(console);
    const origWarn = console.warn.bind(console);
    const origErr = console.error.bind(console);

    const pushLine = (level: string, args: unknown[]) => {
      const line = args
        .map((a) => {
          if (typeof a === "string") return a;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(" ");
      if (!FILTER_KEYWORDS.some((kw) => line.includes(kw))) return;
      const ts = new Date().toLocaleTimeString("zh-TW", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const ms = String(Date.now() % 1000).padStart(3, "0");
      const tag = level === "ERROR" ? "❌" : level === "WARN" ? "⚠️" : "▸";
      const prefixed = `${tag} ${ts}.${ms} ${line}`;
      setLogs((prev) => {
        const next = [...prev, prefixed];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log = (...args: any[]) => {
      origLog(...args);
      pushLine("LOG", args);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.warn = (...args: any[]) => {
      origWarn(...args);
      pushLine("WARN", args);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.error = (...args: any[]) => {
      origErr(...args);
      pushLine("ERROR", args);
    };

    origLog("[MobileLogOverlay] 已掛載，攔截 console.*");

    return () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origErr;
    };
  }, [enabled, isMobile]);

  // 自動捲到底
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // 切換開關
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(OVERLAY_FLAG_KEY, next ? "1" : "0");
    }
    if (!next) setLogs([]);
  };

  // 提供全域 toggle（給 dev 從 console 啟動用）
  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-expect-error - devtool 入口
    window.__enableMobileLogOverlay = () => {
      localStorage.setItem(OVERLAY_FLAG_KEY, "1");
      location.reload();
    };
    // @ts-expect-error - devtool 入口
    window.__disableMobileLogOverlay = () => {
      localStorage.setItem(OVERLAY_FLAG_KEY, "0");
      location.reload();
    };
  }, []);

  // 條件：只在 mobile + 啟用時渲染
  if (!isMobile) return null;
  if (!enabled) {
    // 提供一個浮動啟動按鈕（mobile only）
    return (
      <button
        onClick={toggle}
        aria-label="啟用 debug log overlay"
        style={{
          position: "fixed",
          bottom: "calc(70px + env(safe-area-inset-bottom, 0px))",
          right: "8px",
          zIndex: 99998,
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: "rgba(0,0,0,0.65)",
          color: "#7CFF6B",
          border: "1px solid rgba(124,255,107,0.4)",
          fontSize: "11px",
          fontFamily: "monospace",
          fontWeight: 700,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        LOG
      </button>
    );
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        aria-label="展開 debug log"
        style={{
          position: "fixed",
          bottom: "calc(70px + env(safe-area-inset-bottom, 0px))",
          right: "8px",
          zIndex: 99999,
          padding: "6px 10px",
          borderRadius: "12px",
          background: "rgba(0,0,0,0.85)",
          color: "#7CFF6B",
          border: "1px solid rgba(124,255,107,0.5)",
          fontSize: "10px",
          fontFamily: "monospace",
          fontWeight: 700,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          cursor: "pointer",
        }}
      >
        📋 {logs.length} log
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label="Debug log overlay"
      style={{
        position: "fixed",
        bottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
        left: "0",
        right: "0",
        maxHeight: "35vh",
        background: "rgba(0,0,0,0.92)",
        color: "#7CFF6B",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "10px",
        lineHeight: 1.4,
        zIndex: 99999,
        borderTop: "2px solid #7CFF6B",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: "1px solid rgba(124,255,107,0.2)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700 }}>📡 SYNC LOG ({logs.length}/{MAX_LINES})</span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => setLogs([])}
            style={{
              background: "transparent",
              color: "#7CFF6B",
              border: "1px solid #7CFF6B",
              borderRadius: "4px",
              padding: "2px 6px",
              fontSize: "9px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            清空
          </button>
          <button
            onClick={() => setCollapsed(true)}
            style={{
              background: "transparent",
              color: "#7CFF6B",
              border: "1px solid #7CFF6B",
              borderRadius: "4px",
              padding: "2px 6px",
              fontSize: "9px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            縮小
          </button>
          <button
            onClick={toggle}
            style={{
              background: "transparent",
              color: "#FF6B6B",
              border: "1px solid #FF6B6B",
              borderRadius: "4px",
              padding: "2px 6px",
              fontSize: "9px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            關閉
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        style={{
          overflowY: "auto",
          padding: "4px 10px",
          flex: 1,
          minHeight: 0,
          // 隱藏捲軸但保留滾動
          scrollbarWidth: "thin",
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: "rgba(124,255,107,0.5)", padding: "12px 0", textAlign: "center" }}>
            等待 sync log...（試試在 desktop tap 新增任務）
          </div>
        ) : (
          logs.map((line, i) => (
            <div
              key={i}
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: line.startsWith("❌")
                  ? "#FF6B6B"
                  : line.startsWith("⚠️")
                  ? "#FFD700"
                  : "#7CFF6B",
                marginBottom: "2px",
              }}
            >
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}