"use client";

import { useState, useEffect } from "react";
import { useZenFlow } from "@/lib/useZenFlow";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  X,
  Music,
} from "lucide-react";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ZenFlowPanelProps {
  omnisonicUrl: string;
}

export function ZenFlowPanel({ omnisonicUrl }: ZenFlowPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const {
    state,
    play,
    pause,
    next,
    previous,
    seekTo,
    setVolume,
    toggleMute,
  } = useZenFlow(omnisonicUrl);

  const { isLoading, isPlaying, currentTrack, nextTrack, currentTime, duration, volume, error, playlist } = state;

  // Auto-resume on mount if there are tracks
  useEffect(() => {
    if (!isLoading && playlist.length > 0 && !currentTrack) {
      // do nothing — wait for user to press play
    }
  }, [isLoading, playlist, currentTrack]);

  if (dismissed || isLoading || !currentTrack) return null;

  const progress = duration > 0 ? currentTime / duration : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio * duration);
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
                CEO Deep Focus · 85 BPM
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDismissed(true)}
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

          {/* Track info */}
          <div className="text-center space-y-1">
            <p className="text-[15px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {currentTrack.title}
            </p>
            <p className="text-[12px] truncate" style={{ color: "var(--text-secondary)" }}>
              {currentTrack.descriptionZh.slice(0, 60)}
              {currentTrack.descriptionZh.length > 60 ? "…" : ""}
            </p>
          </div>

          {/* Progress */}
          <div>
            <div
              className="h-1 rounded-full cursor-pointer overflow-hidden"
              style={{ background: "var(--border)" }}
              onClick={handleProgressClick}
              role="slider"
              aria-label="播放進度"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
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
              onClick={previous}
              className="p-2 rounded-full transition-all duration-150 active:scale-90"
              style={{ color: "var(--text-secondary)" }}
              aria-label="上一首"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={() => isPlaying ? pause() : play()}
              className="p-4 rounded-full transition-all duration-150 active:scale-95"
              style={{ background: "var(--brand)", color: "white" }}
              aria-label={isPlaying ? "暫停" : "播放"}
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>

            <button
              onClick={next}
              className="p-2 rounded-full transition-all duration-150 active:scale-90"
              style={{ color: "var(--text-secondary)" }}
              aria-label="下一首"
            >
              <SkipForward className="w-5 h-5" />
            </button>
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
              取自 OmniSonic · 85 BPM · CEO Deep Focus
            </p>
          </div>

          {/* Next track */}
          {nextTrack && (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              <span>下一首</span>
              <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                {nextTrack.title}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Mini bar — always visible when not dismissed */}
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
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {currentTrack.title}
          </p>
          <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
            OmniSonic · 85 BPM
          </p>
        </div>

        {/* Skip controls */}
        <button
          onClick={next}
          className="p-2 rounded-full transition-colors flex-shrink-0"
          style={{ color: "var(--text-tertiary)" }}
          aria-label="下一首"
        >
          <SkipForward className="w-4 h-4" />
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

// ─── ZenFlow toggle button for Sidebar ────────────────────────────────
interface ZenFlowToggleProps {
  omnisonicUrl: string;
  onOpen?: () => void;
}

export function ZenFlowToggle({ omnisonicUrl }: ZenFlowToggleProps) {
  const [hasTracks, setHasTracks] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!omnisonicUrl) return;
    let cancelled = false;
    fetch(`${omnisonicUrl}/api/zenflow/tracks`)
      .then((r) => r.json())
      .then((data: { tracks: unknown[] }) => {
        if (!cancelled) setHasTracks(data.tracks?.length > 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [omnisonicUrl]);

  if (!omnisonicUrl || !hasTracks) return null;

  return (
    <button
      title="心流專注模式"
      onClick={() => setIsActive((v) => !v)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150"
      style={
        isActive
          ? { background: "var(--brand-tint)", color: "var(--brand)" }
          : { color: "var(--text-secondary)" }
      }
    >
      <Music className="w-[18px] h-[18px] flex-shrink-0" />
      <span className="flex-1 text-left">心流專注</span>
    </button>
  );
}
