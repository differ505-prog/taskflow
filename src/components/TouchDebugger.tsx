"use client";
import { useEffect, useState } from "react";

export function TouchDebugger() {
  const [log, setLog] = useState<string>("V12-C0");
  const [clicks, setClicks] = useState(0);
  const [touchInfo, setTouchInfo] = useState<string>("");

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      setLog(prev => {
        const base = prev.split('|')[0];
        return `${base}|T`;
      });
      setTouchInfo(`TS:${t.clientX},${t.clientY}`);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      setLog(prev => {
        const base = prev.split('|')[0];
        return `${base}|TE`;
      });
      setTouchInfo(`TE:${t.clientX},${t.clientY}`);
    };
    const handleClick = (e: MouseEvent) => {
      setClicks(c => c + 1);
      setLog(prev => {
        const base = prev.split('|')[0];
        return `${base}|CK`;
      });
      setTouchInfo(`CK:${e.clientX},${e.clientY}`);
    };
    const handleTouchCancel = (e: TouchEvent) => {
      setLog(prev => {
        const base = prev.split('|')[0];
        return `${base}|TC`;
      });
    };
    
    document.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
    document.addEventListener("touchend", handleTouchEnd, { capture: true, passive: true });
    document.addEventListener("touchcancel", handleTouchCancel, { capture: true, passive: true });
    document.addEventListener("click", handleClick, { capture: true, passive: true });
    
    return () => {
      document.removeEventListener("touchstart", handleTouchStart, { capture: true });
      document.removeEventListener("touchend", handleTouchEnd, { capture: true });
      document.removeEventListener("touchcancel", handleTouchCancel, { capture: true });
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        background: "rgba(0,0,0,0.8)",
        color: "#0f0",
        padding: "4px 8px",
        fontSize: "12px",
        zIndex: 999999,
        pointerEvents: "none",
        fontFamily: "monospace",
        borderRadius: "0 0 8px 0"
      }}
    >
      {log} | C:{clicks} | {touchInfo}
    </div>
  );
}
