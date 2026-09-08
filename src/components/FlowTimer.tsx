"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Pause, Play } from "lucide-react";
import {
  useFlowTimerContext,
  useZenMusicFrame,
} from "@/lib/ZenFlowContext";
import { ProWaitlistModal } from "@/components/ProWaitlistModal";
import { useGhostButton } from "@/hooks/useGhostButton";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** §音樂圖示 — iframe 提升後,FlowTimer 內只剩視覺 icon */
function MusicNoteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

/**
 * §禪模式膠囊計時器
 *
 * 設計動機：
 * - 計時器必須在切換分頁（禪模式 unmount）時持續倒數 — 因此 state 必須在
 *   Provider 層（ZenFlowProvider）而非元件 local 持有。改用 useFlowTimerContext
 *   取代原本自寫的 useState + setInterval（已升級為既有 useFlowTimer hook）。
 * - 音樂 iframe 提升到 ZenFlowProvider 層（§視圖切換零中斷），本元件只持有
 *   「音樂圖示按鈕 + 計時器本體 UI」。透過 useZenMusicFrame 取得 provider
 *   持有的 iframe ref,操作 src 觸發 OmniSonic 站播放/停止。
 * - 計時器停止（自然歸零 / 手動暫停）→ 音樂 iframe 同步 reload 停止播放。
 *   橋接邏輯仍集中在 ZenFlowProvider（集中式 phase → iframe reload）。
 */
export function FlowTimer() {
  const musicFrameRef = useZenMusicFrame();

  const {
    snapshot,
    secondsLeft,
    start,
    pause: pauseFlowTimer,
    resume,
  } = useFlowTimerContext();

  const isRunning = snapshot.phase === "running";

  // §計時器結束或暫停時,reload provider 持有的 iframe 以停止音樂播放
  // (原邏輯搬遷後位置;ref 從 useRef 改成從 context 來)
  const prevPhaseRef = useRef(snapshot.phase);
  useEffect(() => {
    if (prevPhaseRef.current === "running" && snapshot.phase !== "running") {
      const iframe = musicFrameRef.current;
      if (iframe) {
        const currentSrc = iframe.src;
        iframe.src = "";
        setTimeout(() => {
          // §reload 時 ref 可能已被 React 重設;守衛一下避免 stale
          if (musicFrameRef.current) {
            musicFrameRef.current.src = currentSrc;
          }
        }, 50);
      }
    }
    prevPhaseRef.current = snapshot.phase;
  }, [snapshot.phase, musicFrameRef]);

  const handlePlayPause = useCallback(() => {
    if (snapshot.phase === "running") {
      pauseFlowTimer();
    } else if (snapshot.phase === "paused") {
      resume();
    } else {
      start({ type: "focus" });
    }
  }, [snapshot.phase, pauseFlowTimer, resume, start]);


  // §Free Tier:用戶點「無限心流」→ 統一走 ProWaitlistModal 假門 pattern
  const infiniteFlowGhost = useGhostButton({ buttonId: "infinite_focus" });

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
          aria-label={
            snapshot.phase === "running"
              ? "暫停專注倒數"
              : snapshot.phase === "paused"
                ? "繼續專注倒數"
                : "開始專注倒數"
          }
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
          aria-label={`剩餘 ${formatTime(secondsLeft)}`}
        >
          {formatTime(secondsLeft)}
        </span>

        {/* §Fake Door:Pro 無限心流 — 解鎖 25 分鐘限制 */}
        <button
          type="button"
          onClick={infiniteFlowGhost.handleClick}
          className="ml-2 text-[11px] font-medium text-purple-400/80 transition-colors duration-150 hover:text-purple-500 focus-visible:outline-none focus-visible:underline"
          aria-label="解鎖 25 分鐘限制（Pro 版專屬）"
        >
          ✨ 無限心流
        </button>

        {/* 視覺分隔線 */}
        <div className="mx-2 h-3.5 w-px bg-zinc-200/80" />

        {/* §OmniSonic 迷你播放圈圈
            iframe 已提升到 ZenFlowProvider 層常駐(§視圖切換零中斷);
            本元件只剩「視覺圓圈 + 點擊觸發器」。實際音樂由 provider 持有的 iframe 播放。 */}
        <button
          type="button"
          disabled={!isRunning}
          onClick={() => {
            // §計時器未啟動時不允許播放 — 與原行為對齊
            if (!isRunning) {
              toast("請先開啟心流計時器 🎯", { id: "flow-timer-guard", duration: 2200 });
              return;
            }
            const iframe = musicFrameRef.current;
            if (!iframe) return;
            // §點擊觸發 OmniSonic iframe 內部的播放按鈕:
            // 對 iframe.contentWindow 發 click on its internal play button。
            // 簡化做法:切換 src query 觸發 OmniSonic 站的 autoplay handler。
            // (若日後需要更精準的播放/暫停切換,可改用 postMessage。)
            const url = new URL(iframe.src);
            url.searchParams.set("autoplay", "1");
            iframe.src = url.toString();
          }}
          aria-label={isRunning ? "心流音樂播放中 🎵" : "點這裡播放心流音樂 🎵"}
          title={isRunning ? "心流音樂播放中 🎵" : "請先開啟心流計時器"}
          className={`group/omnibox relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-purple-50/50 shadow-[0_0_12px_rgba(var(--flow-glow-color,192,38,211),0.25)] transition-all ${
            isRunning ? "hover:scale-105 active:scale-95 cursor-pointer" : "cursor-not-allowed opacity-60"
          }`}
        >
          <MusicNoteIcon className="h-3 w-3 text-purple-500" />
        </button>
      </div>

      {/* §Free Tier:無限心流 → 解鎖 25 分鐘限制假門 */}
      <ProWaitlistModal
        open={infiniteFlowGhost.open}
        onClose={infiniteFlowGhost.handleDismiss}
        onJoin={infiniteFlowGhost.handleJoin}
        featureId="infinite_focus"
      />
    </div>
  );
}
