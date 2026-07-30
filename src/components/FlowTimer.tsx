"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Pause, Play } from "lucide-react";
import { useZenFlowContext } from "@/lib/ZenFlowContext";

const FOCUS_DURATION = 25 * 60; // 25 分鐘（秒）

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FlowTimer() {
  const [remaining, setRemaining] = useState(FOCUS_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const omnisonicIframeRef = useRef<HTMLIFrameElement | null>(null);

  // §音樂控制對接:FlowTimer 是禪模式唯一的音樂入口,小紫圓 iframe 只負責啟動。
  // 但用戶一旦進禪模式開始專注,iframe 內按鈕被焦點任務卡片遮住,找不到停止入口。
  // 補一顆絕對定位的 ⏸/▶ overlay,綁 zenState.isPlaying,點擊 → controller[isPlaying ? 'pause' : 'play']()。
  const { state: zenState, play: zenPlay, pause: zenPause } = useZenFlowContext();
  const handleZenToggle = useCallback(() => {
    if (zenState.isPlaying) {
      zenPause();
    } else {
      zenPlay();
    }
  }, [zenState.isPlaying, zenPause, zenPlay]);

  // §React 19 hydration workaround:iframe src 在 useEffect 才注入,
  // 避免 SSR 階段 React 將 iframe 標記為 hydration mismatch 而跳過 element
  useEffect(() => {
    if (!omnisonicIframeRef.current) return;
    omnisonicIframeRef.current.src = `${process.env.NEXT_PUBLIC_OMNISONIC_URL ?? ""}/embed/button`;
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // §Free Tier:25 分鐘倒數中
  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          toast("🍅 25 分鐘專注達成！讓大腦休息一下吧。", {
            duration: 5000,
            id: "flow-timer-break",
          });
          setIsRunning(false);
          return FOCUS_DURATION;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearTimer();
  }, [isRunning, clearTimer]);

  const handlePlayPause = () => {
    if (isRunning) {
      clearTimer();
      setIsRunning(false);
    } else {
      setIsRunning(true);
    }
  };

  const handleProClick = () => {
    console.log("clicked_pro_infinite_flow");
    toast(
      "✨ 想要一直聽下去嗎？\n\n「無限心流模式（無中斷連播）」目前正在秘密開發中！\n\n這將是未來 Pro 版的專屬能力。我們已經記錄下你的願望了 😉",
      { duration: 6000, id: "flow-pro-ghost" },
    );
  };

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className="inline-flex items-center rounded-full bg-white/70 py-1.5 pl-3 pr-1.5 shadow-sm ring-1 ring-zinc-100 backdrop-blur"
        role="group"
        aria-label="心流計時器"
      >
        {/* 播放 / 暫停 + 音樂圖示指示燈 */}
        <button
          type="button"
          onClick={handlePlayPause}
          aria-label={isRunning ? "暫停專注倒數" : "開始專注倒數"}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors duration-150 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          {/* 音樂圖示（播放中微微亮起） */}
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden
            className={`mr-0.5 transition-colors duration-300 ${isRunning ? "text-purple-500" : "text-zinc-400"}`}
          >
            <path d="M10.5 8.5v-7A1.5 1.5 0 0 0 9 0H1.5A1.5 1.5 0 0 0 0 1.5v9A1.5 1.5 0 0 0 1.5 12h7.5A1.5 1.5 0 0 0 10.5 10.5V8.5z" fill="currentColor" opacity="0.3" />
            <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
          </svg>
          {isRunning ? (
            /* Pause icon */
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden className="ml-0.5">
              <rect x="1.5" y="1" width="3.5" height="10" rx="0.5" />
              <rect x="7" y="1" width="3.5" height="10" rx="0.5" />
            </svg>
          ) : (
            /* Play icon */
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden className="ml-0.5">
              <path d="M2.5 1.5L10.5 6L2.5 10.5V1.5Z" />
            </svg>
          )}
        </button>

        {/* 倒數顯示 */}
        <span
          className={`ml-1.5 font-mono text-[13px] tabular-nums font-medium tracking-tight transition-colors duration-300 ${
            isRunning ? "text-zinc-800" : "text-zinc-400"
          }`}
          aria-live="polite"
          aria-label={`剩餘 ${formatTime(remaining)}`}
        >
          {formatTime(remaining)}
        </span>

        {/* §Fake Door:Pro 無限心流 */}
        <button
          type="button"
          onClick={handleProClick}
          className="ml-2 text-[11px] font-medium text-purple-400/80 transition-colors duration-150 hover:text-purple-500 focus-visible:outline-none focus-visible:underline"
          aria-label="解鎖無限心流模式（Pro 版專屬）"
        >
          ✨ 無限心流
        </button>

        {/* 視覺分隔線 */}
        <div className="mx-2 h-3.5 w-px bg-zinc-200/80" />

        {/* §OmniSonic 迷你播放圈圈 */}
        <div
          className="group/omnibox relative flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-purple-50/50 shadow-[0_0_12px_rgba(192,38,211,0.25)] transition-all hover:scale-105 active:scale-95"
          aria-label={isRunning ? "心流音樂播放中 🎵 點擊調整" : "點這裡播放心流音樂 🎵"}
        >
          {/* 獨立一層 overflow-hidden 處理 iframe 裁切，不再影響 overlay 按鈕 */}
          <div className="pointer-events-none relative h-full w-full overflow-hidden rounded-full">
            <iframe
              ref={omnisonicIframeRef}
              title="OmniSonic Deep Focus Button"
              className="absolute top-1/2 left-1/2 h-[40px] w-[40px] -translate-x-1/2 -translate-y-1/2 border-none bg-transparent"
              style={{
                transform: "scale(0.7)",
                transformOrigin: "center center",
                colorScheme: "light",
              }}
              allow="autoplay"
            />
          </div>

          {/* §音樂控制 overlay */}
          <button
            type="button"
            onClick={handleZenToggle}
            aria-label={zenState.isPlaying ? "暫停心流音樂" : "播放心流音樂"}
            aria-pressed={zenState.isPlaying}
            className="absolute -bottom-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-white/95 text-purple-600 shadow-md ring-1 ring-purple-200/60 transition-all duration-200 ease-out hover:scale-110 hover:bg-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 sm:opacity-0 sm:group-hover/omnibox:opacity-100"
          >
            {zenState.isPlaying ? (
              <Pause className="h-2 w-2" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="h-2 w-2 ml-px" fill="currentColor" strokeWidth={0} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
