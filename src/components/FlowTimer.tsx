"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // §Free Tier:初始化 placeholder audio
  useEffect(() => {
    audioRef.current = new Audio("/audio/focus-bgm-placeholder.mp3");
    audioRef.current.loop = true;
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopAndReset = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [clearTimer]);

  // §Free Tier:25 分鐘倒數中
  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          // §Free Tier:倒數結束 → fade out → 重置
          if (audioRef.current) {
            const audio = audioRef.current;
            const fadeStep = 0.05;
            const fadeInterval = setInterval(() => {
              if (audio.volume > fadeStep) {
                audio.volume = Math.max(0, audio.volume - fadeStep);
              } else {
                clearInterval(fadeInterval);
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 1;
              }
            }, 150); // 1.5s fade out
          }
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
      audioRef.current?.pause();
    } else {
      setIsRunning(true);
      audioRef.current?.play().catch(() => {
        // audio play may be blocked by browser autoplay policy — silently ignore
      });
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
    <div
      className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 shadow-sm ring-1 ring-zinc-100 backdrop-blur"
      role="group"
      aria-label="心流計時器"
    >
      {/* 播放 / 暫停 */}
      <button
        type="button"
        onClick={handlePlayPause}
        aria-label={isRunning ? "暫停專注音樂" : "開始專注倒數"}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors duration-150 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        {isRunning ? (
          /* Pause icon */
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <rect x="1.5" y="1" width="3.5" height="10" rx="0.5" />
            <rect x="7" y="1" width="3.5" height="10" rx="0.5" />
          </svg>
        ) : (
          /* Play icon */
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <path d="M2.5 1.5L10.5 6L2.5 10.5V1.5Z" />
          </svg>
        )}
      </button>

      {/* 倒數顯示 */}
      <span
        className={`font-mono text-[13px] tabular-nums font-medium tracking-tight transition-colors duration-300 ${
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
        className="ml-0.5 text-[11px] font-medium text-purple-400/80 transition-colors duration-150 hover:text-purple-500 focus-visible:outline-none focus-visible:underline"
        aria-label="解鎖無限心流模式（Pro 版專屬）"
      >
        ✨ 無限心流
      </button>

      {/* §Ecosystem:生態系導流 */}
      <a
        href="https://your-music-saas.com"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-0.5 text-[11px] text-zinc-300 transition-colors duration-150 hover:text-zinc-400 focus-visible:outline-none"
        aria-label="探索專注音樂（外部連結）"
      >
        🎵 探索 60/120bpm
      </a>
    </div>
  );
}
