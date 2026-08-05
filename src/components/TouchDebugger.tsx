"use client";
import { useEffect, useState } from "react";

export function TouchDebugger() {
  const [log, setLog] = useState<string>("V19-C0");
  const [clicks, setClicks] = useState(0);
  const [touchInfo, setTouchInfo] = useState<string>("");
  const [tick, setTick] = useState(0);

  // 心跳計時器：每秒跳動，確認 App 是否存活
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      console.log('[Capture Phase V19] 偵測到 touchstart 事件！');
      
      // 防呆：印出原始事件物件，看是不是 e.touches 異常
      if (!e.touches || e.touches.length === 0) {
        console.log('[Capture Phase V19] 警告：e.touches 為空 (可能是 iOS x:0 Bug)');
        setLog(prev => {
          const base = prev.split('|')[0];
          return `${base}|T0|EMPTY`;
        });
        setTouchInfo(`TS:EMPTY_TOUCHES`);
        return;
      }

      const t = e.touches[0];
      console.log(`[Capture Phase V19] 座標: x=${t.clientX}, y=${t.clientY}`);
      const realTarget = document.elementFromPoint(t.clientX, t.clientY);
      const targetInfo = realTarget ? `${realTarget.tagName}.${realTarget.className}` : '找不到元素';
      console.log('[Capture Phase V19] 命中元素:', targetInfo);
      
      setLog(prev => {
        const base = prev.split('|')[0];
        return `${base}|T`;
      });
      setTouchInfo(`TS:${t.clientX},${t.clientY}|${targetInfo.substring(0, 20)}`);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      console.log('[Capture Phase V19] 偵測到 touchend 事件！');
      const t = e.changedTouches[0];
      if (!t) {
        console.log('[Capture Phase V19] 警告：changedTouches[0] 為空');
        setLog(prev => {
          const base = prev.split('|')[0];
          return `${base}|TE0`;
        });
        return;
      }
      console.log(`[Capture Phase V19] touchend 座標: x=${t.clientX}, y=${t.clientY}`);
      setLog(prev => {
        const base = prev.split('|')[0];
        return `${base}|TE`;
      });
      setTouchInfo(`TE:${t.clientX},${t.clientY}`);
    };
    const handleClick = (e: MouseEvent) => {
      console.log('[Capture Phase V19] 偵測到 click 事件！');
      setClicks(c => c + 1);
      setLog(prev => {
        const base = prev.split('|')[0];
        return `${base}|CK`;
      });
      setTouchInfo(`CK:${e.clientX},${e.clientY}`);
    };
    const handleTouchCancel = (e: TouchEvent) => {
      console.log('[Capture Phase V19] 偵測到 touchcancel 事件！');
      setLog(prev => {
        const base = prev.split('|')[0];
        return `${base}|TC`;
      });
    };
    
    // 升級：使用 capture: true + passive: true（Capture 階段可無視 stopPropagation）
    document.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
    document.addEventListener("touchend", handleTouchEnd, { capture: true, passive: true });
    document.addEventListener("touchcancel", handleTouchCancel, { capture: true, passive: true });
    document.addEventListener("click", handleClick, { capture: true, passive: true });
    
    console.log('[TouchDebugger V19] 已掛載，所有事件使用 Capture Phase');
    
    return () => {
      console.log('[TouchDebugger V19] 卸載');
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
      {log} | C:{clicks} | Tick:{tick} | {touchInfo}
    </div>
  );
}
