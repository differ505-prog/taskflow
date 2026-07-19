"use client";

import { useState } from "react";
import { useZenFlowContext } from "@/lib/ZenFlowContext";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  X,
  Music,
  RefreshCw,
} from "lucide-react";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ZenFlowPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ZenFlowPanel({ isOpen, onClose }: ZenFlowPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const { state, play, pause, next, setVolume, toggleMute } = useZenFlowContext();
  const { isPlaying, currentTrack, currentTime, duration, volume, isLoading, error } = state;

  if (!isOpen) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const hasTrack = Boolean(currentTrack);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Streaming mode: seeking not supported, but show feedback
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    // Seek disabled in stream mode
    void ratio;
  };

  const handleClose = () => {
    pause();
    onClose();
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex flex-col items-center"
      style={{ pointerEvents: "none" }}
    >
      {/* Expanded panel */}
      {expanded && (
        <div
          className="w-full max-w-lg mx-auto rounded-t-2xl p-4 space-y-3"
          style={{
            background: "var(--surface-elevated)",
            boxShadow: "var(--shadow-xl)",
            borderTop: "1px solid var(--border)",
            pointerEvents: "auto",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Music className="w-4 h-4 flex-shrink-0" style={{ color: "var(--brand)" }} />
              <span className="text-[12px] font-medium truncate" style={{ color: "var(--brand)" }}>
                OmniSonic · Auto DJ Random
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="關閉播放器"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="收合播放器"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Loading / Error state */}
          {isLoading && (
            <div className="text-center py-4">
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>正在連接 OmniSonic...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="text-center py-4">
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{error}</p>
            </div>
          )}

          {/* Track info */}
          {hasTrack && !isLoading && (
            <>
              <div className="text-center space-y-1">
                <p className="text-[15px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {currentTrack!.title}
                </p>
                <p className="text-[12px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {currentTrack!.descriptionZh.slice(0, 60)}
                  {currentTrack!.descriptionZh.length > 60 ? "…" : ""}
                </p>
              </div>

              {/* Progress (read-only for stream) */}
              <div>
                <div
                  className="h-1 rounded-full overflow-hidden cursor-not-allowed"
                  style={{ background: "var(--border)" }}
                  onClick={handleProgressClick}
                  role="slider"
                  aria-label="播放進度（直播模式不支援拖動）"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration)}
                  aria-valuenow={Math.round(currentTime)}
                  aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress * 100}%`,
                      background: "var(--brand)",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {formatTime(currentTime)}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={next}
                  className="p-2 rounded-full transition-all duration-150 active:scale-90"
                  style={{ color: "var(--text-secondary)" }}
                  aria-label="切換下一首"
                  title="切換下一首（OmniSonic Auto DJ）"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>

                <button
                  onClick={() => isPlaying ? pause() : play()}
                  className="p-4 rounded-full transition-all duration-150 active:scale-95"
                  style={{ background: "var(--brand)", color: "white" }}
                  aria-label={isPlaying ? "暫停" : "播放"}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>

                <div className="w-9" /> {/* Spacer to balance layout */}
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="p-1 transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  aria-label={volume === 0 ? "取消靜音" : "靜音"}
                >
                  {volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "var(--brand)" }}
                  aria-label="音量"
                />
              </div>

              {/* Attribution */}
              <div className="text-center">
                <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  OmniSonic Auto DJ · 曲目順序由 OmniSonic 隨機決定
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mini bar */}
      <div
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-t-xl"
        style={{
          background: "var(--surface-elevated)",
          boxShadow: "var(--shadow-lg)",
          borderTop: "1px solid var(--border)",
          borderLeft: "1px solid var(--border)",
          borderRight: "1px solid var(--border)",
          pointerEvents: "auto",
        }}
      >
        {/* Progress line */}
        <div
          className="absolute top-0 left-0 h-0.5 rounded-full transition-all"
          style={{
            width: `${progress * 100}%`,
            background: "var(--brand)",
          }}
        />

        {/* Play/Pause */}
        <button
          onClick={() => isPlaying ? pause() : play()}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-150 active:scale-90"
          style={{ background: "var(--brand)", color: "white" }}
          aria-label={isPlaying ? "暫停" : "播放"}
          disabled={isLoading}
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {isLoading ? "連接中…" : currentTrack?.title ?? "尚未播放"}
          </p>
          <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
            {error ?? "OmniSonic · Auto DJ Random"}
          </p>
        </div>

        {/* Refresh / skip next */}
        <button
          onClick={next}
          className="p-2 rounded-full transition-colors flex-shrink-0"
          style={{ color: "var(--text-tertiary)" }}
          aria-label="切換下一首"
          disabled={isLoading || !isPlaying}
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Expand / dismiss */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-2 rounded-full transition-colors flex-shrink-0"
          style={{ color: "var(--text-tertiary)" }}
          aria-label={expanded ? "收合" : "展開"}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
