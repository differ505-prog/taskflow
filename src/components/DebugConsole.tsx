"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useUserPreferences } from "@/hooks/useUserPreferences";

export function DebugConsole() {
  const searchParams = useSearchParams();
  const { defaultView, isHydrated } = useUserPreferences();
  const [mounted, setMounted] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [touchLog, setTouchLog] = useState<string[]>([]);
  const touchLogRef = useRef<string[]>([]);

  useEffect(() => {
    setMounted(true);

    const handleError = (e: ErrorEvent) => {
      setGlobalError(`Error: ${e.message} at ${e.filename}:${e.lineno}`);
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      setGlobalError(`Unhandled Promise: ${String(e.reason)}`);
    };

    // 全域觸控事件偵測 — 在 capture 階段攔截，看看到底有沒有在發 touch event
    const logTouch = (type: string) => (e: Event) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase() || "?";
      const cls = Array.from(target?.classList || []).slice(0, 3).join(".");
      const text = (target?.textContent || "").slice(0, 20).trim();
      const entry = `${type}: <${tag}>.${cls} "${text}"`;
      touchLogRef.current = [entry, ...touchLogRef.current].slice(0, 8);
      setTouchLog([...touchLogRef.current]);
    };

    // capture: true = 在最外層攔截，不管子元素有沒有 stopPropagation
    document.addEventListener("touchstart", logTouch("touchstart"), { capture: true, passive: true });
    document.addEventListener("touchend", logTouch("touchend"), { capture: true, passive: true });
    document.addEventListener("click", logTouch("click"), { capture: true, passive: true });
    document.addEventListener("pointerdown", logTouch("pointerdown"), { capture: true, passive: true });

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      document.removeEventListener("touchstart", logTouch("touchstart"), { capture: true } as EventListenerOptions);
      document.removeEventListener("touchend", logTouch("touchend"), { capture: true } as EventListenerOptions);
      document.removeEventListener("click", logTouch("click"), { capture: true } as EventListenerOptions);
      document.removeEventListener("pointerdown", logTouch("pointerdown"), { capture: true } as EventListenerOptions);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-black/90 text-green-400 font-mono text-[10px] p-2 pointer-events-none backdrop-blur-sm shadow-lg max-h-[45vh] overflow-y-auto">
      <div className="font-bold text-white mb-1 flex justify-between">
        <span>Debug (v11-touch)</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>
      {globalError && <div className="text-red-400 font-bold mb-1">{globalError}</div>}
      <div>board: {searchParams.get("board") || "none"} | hydrated: {isHydrated ? "Y" : "N"} | view: {defaultView}</div>
      <div className="text-yellow-300 font-bold mt-1">👇 Touch Event Log (tap anywhere):</div>
      {touchLog.length === 0 && <div className="text-slate-400">（還沒偵測到任何觸控事件，請點擊畫面任何位置）</div>}
      {touchLog.map((entry, i) => (
        <div key={i} className={i === 0 ? "text-cyan-300" : "text-green-600"}>{entry}</div>
      ))}
    </div>
  );
}