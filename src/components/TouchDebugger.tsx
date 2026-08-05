"use client";
import { useEffect, useState } from "react";

export function TouchDebugger() {
  const [log, setLog] = useState<string>("V12");
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    const handleTouch = (e: TouchEvent) => {
      setLog(prev => prev + " T");
    };
    const handleClick = (e: MouseEvent) => {
      setClicks(c => c + 1);
    };
    
    document.addEventListener("touchstart", handleTouch, { capture: true, passive: true });
    document.addEventListener("click", handleClick, { capture: true, passive: true });
    
    return () => {
      document.removeEventListener("touchstart", handleTouch, { capture: true });
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
      {log} | C:{clicks}
    </div>
  );
}
