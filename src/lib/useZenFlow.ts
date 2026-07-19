"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Howl, Howler } from "howler";
import type {
  OmniSonicTrack,
  OmniSonicSessionPlan,
  fetchAutoDjPlaylist,
} from "./zenflow-api";

export type ZenFlowTrack = OmniSonicTrack;

export type ZenFlowState = {
  isPlaying: boolean;
  currentTrack: ZenFlowTrack | null;
  nextTrack: ZenFlowTrack | null;
  playlist: ZenFlowTrack[];
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  isCrossfading: boolean;
  sessionPlan: OmniSonicSessionPlan | null;
  error: string | null;
};

const CROSSFADE_POLL_MS = 200;
const CROSSFADE_WINDOW_MS = 1200;

export function useZenFlow(omnisonicBaseUrl: string) {
  const [state, setState] = useState<ZenFlowState>({
    isPlaying: false,
    currentTrack: null,
    nextTrack: null,
    playlist: [],
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isLoading: true,
    isCrossfading: false,
    sessionPlan: null,
    error: null,
  });

  const playlistRef = useRef<ZenFlowTrack[]>([]);
  const currentIndexRef = useRef(-1);
  const currentHowlRef = useRef<Howl | null>(null);
  const nextHowlRef = useRef<Howl | null>(null);
  const preparedHowlRef = useRef<Howl | null>(null);
  const preparedTrackIdRef = useRef<string | null>(null);
  const crossfadeMonitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crossfadeTriggerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crossfadeFinalizeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedVolumeRef = useRef<number | null>(null);
  const isCrossfadingRef = useRef(false);
  const volumeRef = useRef(0.8);
  // Per-track crossfade duration — updated whenever the current track changes
  const currentCrossfadeSecondsRef = useRef(4.36);

  // ── Helpers ───────────────────────────────────────────────

  const getNextTrack = useCallback(
    (currentIdx: number, playlist: ZenFlowTrack[]) => {
      const nextIdx = currentIdx + 1;
      return nextIdx < playlist.length ? playlist[nextIdx] : playlist[0] ?? null;
    },
    [],
  );

  const getPrevTrack = useCallback(
    (currentIdx: number, playlist: ZenFlowTrack[]) => {
      if (currentIdx <= 0) return playlist[playlist.length - 1] ?? null;
      return playlist[currentIdx - 1] ?? null;
    },
    [],
  );

  const buildAudioUrl = useCallback(
    (track: ZenFlowTrack) =>
      `${omnisonicBaseUrl}/api/zenflow/stream/${track.slug}`,
    [omnisonicBaseUrl],
  );

  const createHowl = useCallback(
    (track: ZenFlowTrack, initialVolume = 1) => {
      const howl = new Howl({
        src: [buildAudioUrl(track)],
        html5: true,
        preload: true,
        volume: initialVolume,
      });

      howl.on("end", () => {
        if (!isCrossfadingRef.current) handleTrackEnd();
      });

      return howl;
    },
    [buildAudioUrl],
  );

  // ── State emitter ────────────────────────────────────────

  const emit = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPlaying: Boolean(currentHowlRef.current?.playing()),
      currentTrack: playlistRef.current[currentIndexRef.current] ?? null,
      nextTrack:
        currentIndexRef.current >= 0
          ? getNextTrack(currentIndexRef.current, playlistRef.current)
          : null,
      currentTime: Number(currentHowlRef.current?.seek() ?? 0),
      duration: currentHowlRef.current?.duration() ?? 0,
    }));
  }, [getNextTrack]);

  // ── Core playback ────────────────────────────────────────

  const handleTrackEnd = useCallback(() => {
    const nextIdx = currentIndexRef.current + 1;
    if (nextIdx < playlistRef.current.length) {
      startTrack(nextIdx);
    } else {
      startTrack(0);
    }
  }, []);

  const startTrack = useCallback(
    (index: number, fadeInMs = 0) => {
      const track = playlistRef.current[index];
      if (!track) return;

      // Update crossfade duration for this track
      currentCrossfadeSecondsRef.current = track.transition.crossfadeSeconds;

      if (currentHowlRef.current) {
        currentHowlRef.current.stop();
        currentHowlRef.current.unload();
      }

      currentIndexRef.current = index;

      const startsMuted = fadeInMs > 0;
      const howl = createHowl(track, startsMuted ? 0 : 1);
      currentHowlRef.current = howl;

      howl.once("play", () => {
        const introCue = track.transition.introCueSeconds;
        const duration = howl.duration();
        if (introCue > 0 && introCue < duration) {
          howl.seek(introCue);
        }

        if (startsMuted) {
          howl.fade(0, volumeRef.current, fadeInMs);
        }
      });

      howl.play();
      scheduleCrossfadeMonitor();
      startTicker();
      emit();
    },
    [createHowl, emit],
  );

  const play = useCallback(
    (trackId?: string) => {
      if (!currentHowlRef.current) {
        if (playlistRef.current.length === 0) return;
        const idx = trackId
          ? playlistRef.current.findIndex((t) => t.id === trackId)
          : 0;
        startTrack(idx >= 0 ? idx : 0, 800);
        return;
      }

      if (!currentHowlRef.current.playing()) {
        currentHowlRef.current.play();
        scheduleCrossfadeMonitor();
        startTicker();
        emit();
      }
    },
    [emit, startTrack],
  );

  const pause = useCallback(() => {
    if (!currentHowlRef.current) return;

    if (nextHowlRef.current) {
      nextHowlRef.current.stop();
      nextHowlRef.current.unload();
      nextHowlRef.current = null;
      clearCrossfadeTrigger();
      clearCrossfadeFinalize();
      currentHowlRef.current.volume(volumeRef.current);
    }

    currentHowlRef.current.pause();
    stopTicker();
    emit();
  }, [emit]);

  const next = useCallback(() => {
    if (playlistRef.current.length === 0) return;
    const nextIdx = currentIndexRef.current + 1;
    startTrack(
      nextIdx < playlistRef.current.length ? nextIdx : 0,
    );
  }, [startTrack]);

  const previous = useCallback(() => {
    if (playlistRef.current.length === 0) return;
    const prevIdx = currentIndexRef.current - 1;
    startTrack(
      prevIdx >= 0 ? prevIdx : playlistRef.current.length - 1,
    );
  }, [startTrack]);

  const seekTo = useCallback((seconds: number) => {
    if (!currentHowlRef.current) return;
    const duration = currentHowlRef.current.duration();
    if (!Number.isFinite(duration) || duration <= 0) return;
    currentHowlRef.current.seek(Math.min(Math.max(seconds, 0), duration));
    emit();
  }, [emit]);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    Howler.volume(clamped);
    currentHowlRef.current?.volume(clamped);
    nextHowlRef.current?.volume(clamped);
    preparedHowlRef.current?.volume(clamped);
    volumeRef.current = clamped;
    setState((prev) => ({ ...prev, volume: clamped }));
  }, []);

  const toggleMute = useCallback(() => {
    const currentVol = currentHowlRef.current?.volume() ?? 1;
    if (currentVol > 0) {
      mutedVolumeRef.current = currentVol;
      Howler.volume(0);
      currentHowlRef.current?.volume(0);
      nextHowlRef.current?.volume(0);
      preparedHowlRef.current?.volume(0);
    } else {
      const restored = mutedVolumeRef.current ?? 1;
      Howler.volume(restored);
      currentHowlRef.current?.volume(restored);
      nextHowlRef.current?.volume(restored);
      preparedHowlRef.current?.volume(restored);
    }
  }, []);

  const setPlaylist = useCallback((tracks: ZenFlowTrack[]) => {
    const prevId = playlistRef.current[currentIndexRef.current]?.id ?? null;
    playlistRef.current = tracks;

    if (tracks.length === 0) {
      destroy();
      return;
    }

    if (prevId) {
      const newIdx = tracks.findIndex((t) => t.id === prevId);
      currentIndexRef.current = newIdx >= 0 ? newIdx : -1;
    }

    emit();
  }, [emit]);

  const destroy = useCallback(() => {
    stopAllTimers();
    if (currentHowlRef.current) {
      currentHowlRef.current.stop();
      currentHowlRef.current.unload();
      currentHowlRef.current = null;
    }
    if (nextHowlRef.current) {
      nextHowlRef.current.stop();
      nextHowlRef.current.unload();
      nextHowlRef.current = null;
    }
    if (preparedHowlRef.current) {
      preparedHowlRef.current.stop();
      preparedHowlRef.current.unload();
      preparedHowlRef.current = null;
    }
    playlistRef.current = [];
    currentIndexRef.current = -1;
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTrack: null,
      nextTrack: null,
      currentTime: 0,
      duration: 0,
      isCrossfading: false,
    }));
  }, []);

  // ── Crossfade ────────────────────────────────────────────

  const runCrossfade = useCallback(
    (duration: number) => {
      if (nextHowlRef.current) return;

      const nextTrack = getNextTrack(
        currentIndexRef.current,
        playlistRef.current,
      );
      if (!nextTrack) return;

      isCrossfadingRef.current = true;
      setState((prev) => ({ ...prev, isCrossfading: true }));

      nextHowlRef.current = preparedTrackIdRef.current === nextTrack.id
        ? preparedHowlRef.current!
        : createHowl(nextTrack, 0);
      preparedHowlRef.current = null;
      preparedTrackIdRef.current = null;

      nextHowlRef.current.play();
      nextHowlRef.current.volume(0);
      currentHowlRef.current?.volume(volumeRef.current);

      const fadeMs = currentCrossfadeSecondsRef.current * 1000;
      let startedAt = Date.now();

      const tick = () => {
        const elapsed = Date.now() - startedAt;
        const progress = Math.min(elapsed / fadeMs, 1);
        const outVol = Math.cos((progress * Math.PI) / 2) * volumeRef.current;
        const inVol = Math.sin((progress * Math.PI) / 2) * volumeRef.current;

        currentHowlRef.current?.volume(outVol);
        nextHowlRef.current?.volume(inVol);

        if (progress >= 1) {
          clearInterval(crossfadeMonitorRef.current!);
          crossfadeMonitorRef.current = null;

          currentHowlRef.current?.stop();
          currentHowlRef.current?.unload();

          const incoming = nextHowlRef.current;
          currentHowlRef.current = incoming;
          nextHowlRef.current = null;
          currentIndexRef.current = currentIndexRef.current + 1;

          if (currentIndexRef.current >= playlistRef.current.length) {
            currentIndexRef.current = 0;
          }

          // Update crossfade duration for the NEW current track
          const newTrack = playlistRef.current[currentIndexRef.current];
          if (newTrack) {
            currentCrossfadeSecondsRef.current = newTrack.transition.crossfadeSeconds;
          }

          setState((prev) => ({ ...prev, isCrossfading: false }));
          isCrossfadingRef.current = false;
          primeNext();
          scheduleCrossfadeMonitor();
          emit();
        }
      };

      crossfadeMonitorRef.current = setInterval(tick, 40);
    },
    [createHowl, emit, getNextTrack],
  );

  const scheduleCrossfadeMonitor = useCallback(() => {
    if (crossfadeMonitorRef.current) return;
    crossfadeMonitorRef.current = setInterval(() => {
      if (!currentHowlRef.current || !currentHowlRef.current.playing()) return;

      const track = playlistRef.current[currentIndexRef.current];
      if (!track) return;

      const duration = currentHowlRef.current.duration();
      const seek = Number(currentHowlRef.current.seek() ?? 0);
      const nextT = getNextTrack(currentIndexRef.current, playlistRef.current);
      if (!nextT || !Number.isFinite(duration) || duration <= 0) return;

      emit();

      const crossfadeSeconds = currentCrossfadeSecondsRef.current;
      const outgoingStart = duration - crossfadeSeconds;
      const remainingMs = (outgoingStart - seek) * 1000;

      if (seek >= outgoingStart) {
        runCrossfade(duration);
        return;
      }

      if (
        remainingMs > 0 &&
        remainingMs <= CROSSFADE_WINDOW_MS &&
        !crossfadeTriggerRef.current
      ) {
        crossfadeTriggerRef.current = setTimeout(() => {
          crossfadeTriggerRef.current = null;
          runCrossfade(
            currentHowlRef.current?.duration() ?? duration,
          );
        }, remainingMs);
      }
    }, CROSSFADE_POLL_MS);
  }, [emit, getNextTrack, runCrossfade]);

  const primeNext = useCallback(() => {
    if (preparedHowlRef.current) return;
    const nextTrack = getNextTrack(
      currentIndexRef.current,
      playlistRef.current,
    );
    if (!nextTrack) return;

    preparedTrackIdRef.current = nextTrack.id;
    preparedHowlRef.current = createHowl(nextTrack, 0);
  }, [createHowl, getNextTrack]);

  const clearCrossfadeTrigger = useCallback(() => {
    if (crossfadeTriggerRef.current) {
      clearTimeout(crossfadeTriggerRef.current);
      crossfadeTriggerRef.current = null;
    }
  }, []);

  const clearCrossfadeFinalize = useCallback(() => {
    if (crossfadeFinalizeRef.current) {
      clearTimeout(crossfadeFinalizeRef.current);
      crossfadeFinalizeRef.current = null;
    }
  }, []);

  const stopAllTimers = useCallback(() => {
    if (crossfadeMonitorRef.current) {
      clearInterval(crossfadeMonitorRef.current);
      crossfadeMonitorRef.current = null;
    }
    clearCrossfadeTrigger();
    clearCrossfadeFinalize();
    stopTicker();
  }, [clearCrossfadeTrigger, clearCrossfadeFinalize]);

  // ── Ticker ───────────────────────────────────────────────

  const startTicker = useCallback(() => {
    if (tickerRef.current) return;
    tickerRef.current = setInterval(() => {
      if (currentHowlRef.current?.playing()) {
        emit();
      } else if (tickerRef.current) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    }, 250);
  }, [emit]);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  // ── Init: fetch Auto DJ playlist from OmniSonic ─────────────────────

  useEffect(() => {
    if (!omnisonicBaseUrl) {
      setState((prev) => ({ ...prev, isLoading: false, error: null }));
      return;
    }

    let cancelled = false;

    const currentTrackId = playlistRef.current[currentIndexRef.current]?.id ?? null;
    const nextTrackId = currentTrackId
      ? (() => {
          const idx = playlistRef.current.findIndex((t) => t.id === currentTrackId);
          return playlistRef.current[idx + 1]?.id ?? playlistRef.current[0]?.id ?? null;
        })()
      : null;

    fetch(
      `${omnisonicBaseUrl}/api/zenflow/autodj/playlist${
        currentTrackId || nextTrackId
          ? `?${new URLSearchParams({
              ...(currentTrackId ? { currentTrackId } : {}),
              ...(nextTrackId ? { nextTrackId } : {}),
            }).toString()}`
          : ""
      }`,
      { next: { revalidate: 10 } },
    )
      .then((r) => r.json())
      .then((data: {
        tracks: ZenFlowTrack[];
        sessionPlan: OmniSonicSessionPlan;
      }) => {
        if (cancelled) return;
        const tracks = data.tracks ?? [];
        const sessionPlan = data.sessionPlan ?? null;
        playlistRef.current = tracks;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          playlist: tracks,
          currentTrack: tracks[0] ?? null,
          nextTrack: tracks[1] ?? null,
          duration: tracks[0]?.durationSeconds ?? 0,
          sessionPlan,
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "無法載入音樂曲目",
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [omnisonicBaseUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroy();
    };
  }, [destroy]);

  return {
    state,
    play,
    pause,
    next,
    previous,
    seekTo,
    setVolume,
    toggleMute,
    setPlaylist,
    destroy,
  };
}
