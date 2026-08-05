"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useUserPreferences } from "@/hooks/useUserPreferences";

type DebugTab = "C0" | "C1" | "C2";

export function DebugConsole() {
  const searchParams = useSearchParams();
  const { defaultView, isHydrated } = useUserPreferences();
  const [mounted, setMounted] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [touchLog, setTouchLog] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<DebugTab>("C0");
  const touchLogRef = useRef<string[]>([]);

  useEffect(() => {
    setMounted(true);

    const handleError = (e: ErrorEvent) => {
      setGlobalError(`Error: ${e.message} at ${e.filename}:${e.lineno}`);
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      setGlobalError(`Unhandled Promise: ${String(e.reason)}`);
    };

    // 全域觸控事件偵測 — 在 capture 階段攔截
    const logTouch = (type: string) => (e: Event) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase() || "?";
      const cls = Array.from(target?.classList || []).slice(0, 3).join(".");
      const text = (target?.textContent || "").slice(0, 20).trim();
      const entry = `${type}: <${tag}>.${cls} "${text}"`;
      touchLogRef.current = [entry, ...touchLogRef.current].slice(0, 8);
      setTouchLog([...touchLogRef.current]);
    };

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

  const getActiveContent = () => {
    switch (activeTab) {
      case "C0":
        return (
          <>
            <div className="text-yellow-300 font-bold mt-1">🔴 C0: Touch Event Status</div>
            <div className="text-red-400 text-[9px] mb-1">login x:0 y:0 t:touch</div>
            {touchLog.length === 0 && <div className="text-slate-400">（還沒偵測到任何觸控事件）</div>}
            {touchLog.map((entry, i) => (
              <div key={i} className={i === 0 ? "text-cyan-300" : "text-green-600"}>{entry}</div>
            ))}
          </>
        );
      case "C1":
        return (
          <>
            <div className="text-green-400 font-bold mt-1">🟢 C1: Google Login Works</div>
            <div className="text-green-600 text-[9px] mb-1">All buttons functional</div>
          </>
        );
      case "C2":
        return (
          <>
            <div className="text-blue-400 font-bold mt-1">🔵 C2: Debug Info</div>
            <div>board: {searchParams.get("board") || "none"} | hydrated: {isHydrated ? "Y" : "N"} | view: {defaultView}</div>
            {globalError && <div className="text-red-400 font-bold mb-1">{globalError}</div>}
          </>
        );
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-black/90 text-green-400 font-mono text-[10px] p-2 pointer-events-none backdrop-blur-sm shadow-lg max-h-[45vh] overflow-y-auto">
      <div className="font-bold text-white mb-1 flex justify-between items-center">
        <span>Debug (v12-touch)</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>
      
      {/* Tab buttons */}
      <div className="flex gap-1 mb-1">
        {(["C0", "C1", "C2"] as DebugTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2 py-0.5 rounded text-[9px] ${
              activeTab === tab ? "bg-green-500 text-black" : "bg-slate-700 text-slate-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      
      {getActiveContent()}
    </div>
  );
}