"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUserPreferences } from "@/hooks/useUserPreferences";

export function DebugConsole() {
  const searchParams = useSearchParams();
  const { defaultView, isHydrated } = useUserPreferences();
  const [mounted, setMounted] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    const handleError = (e: ErrorEvent) => {
      setGlobalError(`Error: ${e.message} at ${e.filename}:${e.lineno}`);
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      setGlobalError(`Unhandled Promise: ${String(e.reason)}`);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  if (!mounted) return null;

  const isBoardOpen = searchParams.get("board") === "1";
  const shouldRenderBoardFullscreen = isHydrated && defaultView === "board";

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-black/80 text-green-400 font-mono text-xs p-2 pointer-events-none backdrop-blur-sm shadow-lg max-h-[40vh] overflow-y-auto">
      <div className="font-bold text-white mb-1 flex justify-between">
        <span>Safari Debug Console (v6)</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>
      {globalError && <div className="text-red-400 font-bold mb-1">{globalError}</div>}
      <div>URL: {typeof window !== 'undefined' ? window.location.href : ''}</div>
      <div>board Param: {searchParams.get("board") || "none"}</div>
      <div>isHydrated: {isHydrated ? "true" : "false"}</div>
      <div>defaultView: {defaultView}</div>
      <div>isBoardOpen: {isBoardOpen ? "true" : "false"}</div>
      <div>shouldRenderBoardFullscreen: {shouldRenderBoardFullscreen ? "true" : "false"}</div>
      <div>body.style.pointerEvents: {typeof window !== 'undefined' ? document.body.style.pointerEvents || "none (default)" : ''}</div>
      <button 
        onClick={() => {
          document.body.style.pointerEvents = 'auto';
          alert('Tried to force pointer-events: auto on body');
        }}
        className="mt-2 bg-red-500 text-white px-2 py-1 rounded text-[10px] pointer-events-auto"
      >
        Force Pointer Events Auto
      </button>
    </div>
  );
}