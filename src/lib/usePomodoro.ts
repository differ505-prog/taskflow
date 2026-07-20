"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PomodoroType = "focus" | "break" | "long-break";
export type PomodoroPhase = "idle" | "running" | "paused" | "completed";

export type PomodoroConfig = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
};

export type PomodoroSnapshot = {
  type: PomodoroType;
  phase: PomodoroPhase;
  /** Absolute end timestamp (ms epoch). null when not running. */
  endAt: number | null;
  /** Remaining ms captured at pause moment. null when running. */
  remainingMs: number | null;
  /** Total ms of the current type at the moment start() was called. */
  totalMs: number;
  completedSessions: number;
  boundTaskId: string | undefined;
};

export type PomodoroController = {
  snapshot: PomodoroSnapshot;
  /** Seconds remaining derived from endAt. Recomputed every render. */
  secondsLeft: number;
  start: (opts?: { type?: PomodoroType; taskId?: string }) => void;
  pause: () => void;
  resume: () => void;
  reset: (opts?: { type?: PomodoroType }) => void;
  cycleType: (newType: PomodoroType) => void;
  setBoundTask: (taskId: string | undefined) => void;
  /** Subscribe to "session completed" events. Returns unsubscribe. */
  onComplete: (cb: (snapshot: PomodoroSnapshot) => void) => () => void;
  config: PomodoroConfig;
};

const DEFAULT_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

const typeToMinutes = (type: PomodoroType, cfg: PomodoroConfig): number => {
  if (type === "focus") return cfg.focusMinutes;
  if (type === "break") return cfg.shortBreakMinutes;
  return cfg.longBreakMinutes;
};

/**
 * Provider-scoped pomodoro controller.
 *
 * Time is tracked as an absolute `endAt` timestamp so the countdown is
 * accurate even after the component unmounts (page navigation inside the app)
 * — render just computes `Math.max(0, endAt - Date.now())`.
 *
 * A 250ms ticker only triggers re-renders; it does NOT own the countdown.
 */
export function usePomodoro(configOverride?: Partial<PomodoroConfig>): PomodoroController {
  const config: PomodoroConfig = { ...DEFAULT_CONFIG, ...(configOverride ?? {}) };

  const [type, setType] = useState<PomodoroType>("focus");
  const [phase, setPhase] = useState<PomodoroPhase>("idle");
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [totalMs, setTotalMs] = useState<number>(config.focusMinutes * 60 * 1000);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [boundTaskId, setBoundTaskId] = useState<string | undefined>(undefined);
  const [, force] = useState(0);

  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedFiredRef = useRef<boolean>(false);
  const completeListenersRef = useRef<Set<(s: PomodoroSnapshot) => void>>(new Set());

  // Public snapshot for subscribers
  const snapshot: PomodoroSnapshot = {
    type,
    phase,
    endAt,
    remainingMs,
    totalMs,
    completedSessions,
    boundTaskId,
  };

  const totalMsForType = useCallback(
    (t: PomodoroType) => typeToMinutes(t, config) * 60 * 1000,
    [config],
  );

  const startTicker = useCallback(() => {
    if (tickerRef.current) return;
    tickerRef.current = setInterval(() => {
      // Force re-render so secondsLeft is recomputed from endAt
      force((n) => n + 1);

      // Detect completion via wall clock — survives unmount/remount
      setEndAt((current) => {
        if (current == null) return current;
        if (!completedFiredRef.current && Date.now() >= current) {
          completedFiredRef.current = true;
          // Use microtask to avoid setState-during-render
          queueMicrotask(() => {
            const finalSnapshot: PomodoroSnapshot = {
              type,
              phase: "completed",
              endAt: null,
              remainingMs: 0,
              totalMs,
              completedSessions,
              boundTaskId,
            };
            completeListenersRef.current.forEach((cb) => {
              try { cb(finalSnapshot); } catch { /* listener error swallowed */ }
            });

            // Auto-advance: focus → break/long-break, break → focus
            if (type === "focus") {
              setCompletedSessions((s) => {
                const next_ = s + 1;
                setType(next_ % config.sessionsBeforeLongBreak === 0 ? "long-break" : "break");
                return next_;
              });
            } else {
              setType("focus");
            }
            setPhase("idle");
            setEndAt(null);
            setRemainingMs(null);
            if (type === "focus") {
              setTotalMs(config.focusMinutes * 60 * 1000);
            } else if (type === "break") {
              setTotalMs(config.shortBreakMinutes * 60 * 1000);
            } else {
              setTotalMs(config.longBreakMinutes * 60 * 1000);
            }
          });
        }
        return current;
      });
    }, 250);
  }, [type, totalMs, completedSessions, boundTaskId]);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  // Cleanup on full unmount (Provider itself)
  useEffect(() => {
    return () => {
      stopTicker();
    };
  }, [stopTicker]);

  const start = useCallback(
    (opts?: { type?: PomodoroType; taskId?: string }) => {
      const targetType = opts?.type ?? type;
      const ms = totalMsForType(targetType);
      completedFiredRef.current = false;
      setType(targetType);
      setPhase("running");
      setTotalMs(ms);
      setEndAt(Date.now() + ms);
      setRemainingMs(null);
      if (opts?.taskId !== undefined) setBoundTaskId(opts.taskId);
      startTicker();
    },
    [type, totalMsForType, startTicker],
  );

  const pause = useCallback(() => {
    if (phase !== "running" || endAt == null) return;
    const remaining = Math.max(0, endAt - Date.now());
    completedFiredRef.current = false;
    setPhase("paused");
    setEndAt(null);
    setRemainingMs(remaining);
    stopTicker();
  }, [phase, endAt, stopTicker]);

  const resume = useCallback(() => {
    if (phase !== "paused" || remainingMs == null) return;
    completedFiredRef.current = false;
    setPhase("running");
    setEndAt(Date.now() + remainingMs);
    setRemainingMs(null);
    startTicker();
  }, [phase, remainingMs, startTicker]);

  const reset = useCallback(
    (opts?: { type?: PomodoroType }) => {
      const targetType = opts?.type ?? type;
      const ms = totalMsForType(targetType);
      completedFiredRef.current = false;
      setType(targetType);
      setPhase("idle");
      setEndAt(null);
      setRemainingMs(null);
      setTotalMs(ms);
      stopTicker();
    },
    [type, totalMsForType, stopTicker],
  );

  const cycleType = useCallback(
    (newType: PomodoroType) => {
      const ms = totalMsForType(newType);
      completedFiredRef.current = false;
      setType(newType);
      setPhase("idle");
      setEndAt(null);
      setRemainingMs(null);
      setTotalMs(ms);
      stopTicker();
    },
    [totalMsForType, stopTicker],
  );

  const onComplete = useCallback(
    (cb: (s: PomodoroSnapshot) => void) => {
      completeListenersRef.current.add(cb);
      return () => {
        completeListenersRef.current.delete(cb);
      };
    },
    [],
  );

  // Derive secondsLeft from endAt (running) or remainingMs (paused/idle)
  const secondsLeft = (() => {
    if (endAt != null) return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (remainingMs != null) return Math.max(0, Math.ceil(remainingMs / 1000));
    return Math.ceil(totalMs / 1000);
  })();

  return {
    snapshot,
    secondsLeft,
    start,
    pause,
    resume,
    reset,
    cycleType,
    setBoundTask: setBoundTaskId,
    onComplete,
    config,
  };
}