"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ZenFlowContext } from "./ZenFlowContext";
import type { ZenFlowTrack } from "./zenflow-api";

export function ZenFlowProvider({ children, omnisonicBaseUrl }: { children: React.ReactNode; omnisonicBaseUrl: string }) {
  const [state, setState] = useState({
    isPlaying: false,
    currentTrack: null as ZenFlowTrack | null,
    nextTrack: null as ZenFlowTrack | null,
    playlist: [] as ZenFlowTrack[],
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isLoading: true,
    isCrossfading: false,
    error: null as string | null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamUrlRef = useRef<string>("");
  const volumeRef = useRef(0.8);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedVolRef = useRef<number | null>(null);

  // Build the Auto DJ stream URL
  const buildStreamUrl = useCallback(() => {
    return `${omnisonicBaseUrl}/api/zenflow/autodj/stream`;
  }, [omnisonicBaseUrl]);

  // Keep state in sync with audio element
  const emit = useCallback(() => {
    if (!audioRef.current) return;
    setState((prev) => ({
      ...prev,
      isPlaying: !audioRef.current!.paused && !audioRef.current!.ended,
    }));
  }, []);

  // Stop time ticker
  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  // Start ticker (updates currentTime)
  const startTicker = useCallback(() => {
    if (tickerRef.current) return;
    tickerRef.current = setInterval(() => {
      if (audioRef.current) {
        setState((prev) => ({
          ...prev,
          currentTime: audioRef.current!.currentTime,
          duration: audioRef.current!.duration || 0,
        }));
      }
    }, 250);
  }, []);

  // Fetch track list for metadata (title, description)
  useEffect(() => {
    if (!omnisonicBaseUrl) {
      setState((prev) => ({ ...prev, isLoading: false, error: "未設定 OmniSonic URL" }));
      return;
    }

    let cancelled = false;

    fetch(`${omnisonicBaseUrl}/api/zenflow/tracks`, { next: { revalidate: 3600 } })
      .then((r) => r.json())
      .then((data: { tracks: ZenFlowTrack[] }) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          playlist: data.tracks ?? [],
          currentTrack: data.tracks?.[0] ?? null,
          nextTrack: data.tracks?.[1] ?? null,
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, isLoading: false, error: "無法載入曲目資訊" }));
      });

    return () => { cancelled = true; };
  }, [omnisonicBaseUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTicker();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, [stopTicker]);

  // ── Controllers ──────────────────────────────────────────────────────────

  const play = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.loop = false;
      audioRef.current = audio;

      audio.addEventListener("timeupdate", () => {
        setState((prev) => ({ ...prev, currentTime: audio.currentTime }));
      });
      audio.addEventListener("durationchange", () => {
        setState((prev) => ({ ...prev, duration: audio.duration || 0 }));
      });
      audio.addEventListener("play", () => {
        setState((prev) => ({ ...prev, isPlaying: true }));
        startTicker();
      });
      audio.addEventListener("pause", () => {
        setState((prev) => ({ ...prev, isPlaying: false }));
        stopTicker();
      });
      audio.addEventListener("ended", () => {
        // Stream auto-advances; nothing to do — reconnect if needed
        stopTicker();
        setState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
      });
      audio.addEventListener("error", () => {
        setState((prev) => ({ ...prev, isPlaying: false, error: "播放失敗" }));
        stopTicker();
      });
    }

    if (!streamUrlRef.current) {
      streamUrlRef.current = buildStreamUrl();
    }

    audioRef.current.src = streamUrlRef.current;
    audioRef.current.volume = volumeRef.current;
    audioRef.current.play().catch(() => {
      setState((prev) => ({ ...prev, error: "播放失敗，請檢查網路連線" }));
    });
  }, [buildStreamUrl, startTicker, stopTicker]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    stopTicker();
  }, [stopTicker]);

  const stop = useCallback(() => {
    stopTicker();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    streamUrlRef.current = "";
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTime: 0,
      error: null,
    }));
  }, [stopTicker]);

  // Stream player: no next/prev, just reconnect
  const next = useCallback(() => {
    // Reconnect to stream (starts fresh from new random point)
    if (audioRef.current && state.isPlaying) {
      streamUrlRef.current = buildStreamUrl();
      audioRef.current.src = streamUrlRef.current;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [buildStreamUrl, state.isPlaying]);

  const previous = useCallback(() => {
    // Same as next — stream restarts from random point
    next();
  }, [next]);

  const seekTo = useCallback((_seconds: number) => {
    // Not supported for stream — no seeking in live audio
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    volumeRef.current = clamped;
    audioRef.current && (audioRef.current.volume = clamped);
    setState((prev) => ({ ...prev, volume: clamped }));
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const currentVol = audioRef.current.volume;
    if (currentVol > 0) {
      mutedVolRef.current = currentVol;
      audioRef.current.volume = 0;
    } else {
      audioRef.current.volume = mutedVolRef.current ?? 0.8;
      mutedVolRef.current = null;
    }
  }, []);

  // No-op for stream mode
  const setPlaylist = useCallback((_tracks: ZenFlowTrack[]) => {
    // Stream mode: playlist comes from server-side Auto DJ
  }, []);

  const destroy = useCallback(() => {
    stop();
  }, [stop]);

  const controller = {
    state,
    play,
    pause,
    stop,
    next,
    previous,
    seekTo,
    setVolume,
    toggleMute,
    setPlaylist,
    destroy,
  };

  return (
    <ZenFlowContext.Provider value={controller}>
      {children}
    </ZenFlowContext.Provider>
  );
}
