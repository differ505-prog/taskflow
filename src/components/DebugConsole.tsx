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

  const [topElement, setTopElement] = useState<string>("loading...");

  useEffect(() => {
    const timer = setInterval(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      if (el) {
        setTopElement(`<${el.tagName.toLowerCase()}>#${el.id}.${Array.from(el.classList).join('.')}`);
      } else {
        setTopElement("null");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div id="debug-console-container" className="fixed top-0 left-0 right-0 z-[9999] bg-black/80 text-green-400 font-mono text-xs p-2 pointer-events-none backdrop-blur-sm shadow-lg max-h-[40vh] overflow-y-auto">
        <div className="font-bold text-white mb-1 flex justify-between">
          <span>Safari Debug Console (v8)</span>
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
        {globalError && <div className="text-red-400 font-bold mb-1">{globalError}</div>}
        <div>URL: {typeof window !== 'undefined' ? window.location.href : ''}</div>
        <div>board Param: {searchParams.get("board") || "none"}</div>
        <div>isHydrated: {isHydrated ? "true" : "false"}</div>
        <div>Top Element @ Center: {topElement}</div>
        <div>body inline ptr-events: {typeof window !== 'undefined' ? document.body.style.pointerEvents || "empty" : ''}</div>
      </div>
    </>
  );
}