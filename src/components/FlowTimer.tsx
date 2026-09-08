"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Pause, Play } from "lucide-react";
import {
  useFlowTimerContext,
  useZenFlowContext,
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
  const zenFlow = useZenFlowContext();

  const {
    snapshot,
    secondsLeft,
    start,
    pause: pauseFlowTimer,
    resume,
  } = useFlowTimerContext();

  const isRunning = snapshot.phase === "running";


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
          onClick={() => {
            if (!isRunning) {
              toast("請先開啟心流計時器 🎯", { id: "flow-timer-guard", duration: 2200 });
              return;
            }
            if (zenFlow.state.isPlaying) {
              zenFlow.pause();
            } else {
              zenFlow.play();
            }
          }}
          aria-label={zenFlow.state.isPlaying ? "心流音樂播放中 🎵" : "點這裡播放心流音樂 🎵"}
          title={zenFlow.state.isPlaying ? "心流音樂暫停 🎵" : (isRunning ? "點這裡播放心流音樂 🎵" : "請先開啟心流計時器")}
          className={`group/omnibox relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border transition-all ${isRunning ? "cursor-pointer hover:scale-105 active:scale-95 border-purple-500/30 bg-purple-50/50 shadow-[0_0_12px_rgba(var(--flow-glow-color,192,38,211),0.25)]" : "cursor-not-allowed opacity-60 border-zinc-200 bg-zinc-100"}`}
        >
          <MusicNoteIcon className={`h-3 w-3 ${zenFlow.state.isPlaying ? "text-purple-500 animate-pulse" : (isRunning ? "text-purple-500" : "text-zinc-400")}`} />
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
