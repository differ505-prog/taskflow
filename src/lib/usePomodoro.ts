"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type FlowTimerType = "focus" | "break" | "long-break";
export type FlowTimerPhase = "idle" | "running" | "paused" | "completed";

export type FlowTimerConfig = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
};

export type FlowTimerSnapshot = {
  type: FlowTimerType;
  phase: FlowTimerPhase;
  /** Absolute end timestamp (ms epoch). null when not running. */
  endAt: number | null;
  /** Remaining ms captured at pause moment. null when running. */
  remainingMs: number | null;
  /** Total ms of the current type at the moment start() was called. */
  totalMs: number;
  completedSessions: number;
  boundTaskId: string | undefined;
  boundHabitId: string | undefined;
  customMinutes?: number; // 自訂時長（分鐘），存在時覆寫 config 的 focusMinutes
};

export type FlowTimerController = {
  snapshot: FlowTimerSnapshot;
  /** Seconds remaining derived from endAt. Recomputed every render. */
  secondsLeft: number;
  start: (opts?: { type?: FlowTimerType; taskId?: string; habitId?: string; customMinutes?: number }) => void;
  pause: () => void;
  resume: () => void;
  reset: (opts?: { type?: FlowTimerType }) => void;
  cycleType: (newType: FlowTimerType) => void;
  setBoundTask: (taskId: string | undefined) => void;
  setBoundHabit: (habitId: string | undefined) => void;
  /** Subscribe to "session completed" events. Returns unsubscribe. */
  onComplete: (cb: (snapshot: FlowTimerSnapshot) => void) => () => void;
  config: FlowTimerConfig;
};

const DEFAULT_CONFIG: FlowTimerConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

const typeToMinutes = (type: FlowTimerType, cfg: FlowTimerConfig): number => {
  if (type === "focus") return cfg.focusMinutes;
  if (type === "break") return cfg.shortBreakMinutes;
  return cfg.longBreakMinutes;
};

/**
 * Provider-scoped flow timer controller.
 *
 * Time is tracked as an absolute `endAt` timestamp so the countdown is
 * accurate even after the component unmounts (page navigation inside the app)
 * — render just computes `Math.max(0, endAt - Date.now())`.
 *
 * A 250ms ticker only triggers re-renders; it does NOT own the countdown.
 *
 * §閉包陷阱（番茄入帳失敗的根因）：
 * `startTicker()` 建立的 `setInterval` 回呼會存活整個 session。若回呼透過
 * React state 讀取 `boundHabitId` / `totalMs` / `type`，它抓到的是「interval
 * 建立當下」的快照——`start()` 裡的 `setBoundHabitId(opts.habitId)` 是非同步
 * 更新，React state 尚未提交，回呼永遠讀到 `undefined`，導致完成時
 * `HabitPomodoroBridge` 直接略過寫入。
 *
 * 因此所有「計時進行中必須保持正確」的值一律存於 ref，state 僅供渲染。
 */
export function useFlowTimer(configOverride?: Partial<FlowTimerConfig>): FlowTimerController {
  const config: FlowTimerConfig = { ...DEFAULT_CONFIG, ...(configOverride ?? {}) };

  const [type, setType] = useState<FlowTimerType>("focus");
  const [phase, setPhase] = useState<FlowTimerPhase>("idle");
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [totalMs, setTotalMs] = useState<number>(config.focusMinutes * 60 * 1000);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [boundTaskId, setBoundTaskId] = useState<string | undefined>(undefined);
  const [boundHabitId, setBoundHabitId] = useState<string | undefined>(undefined);
  const [, force] = useState(0);

  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedFiredRef = useRef<boolean>(false);
  const completeListenersRef = useRef<Set<(s: FlowTimerSnapshot) => void>>(new Set());

  // ── Ref 鏡像：計時器內部真相（不依賴 React render 提交）──────────────
  const typeRef = useRef<FlowTimerType>("focus");
  const phaseRef = useRef<FlowTimerPhase>("idle");
  const endAtRef = useRef<number | null>(null);
  const remainingMsRef = useRef<number | null>(null);
  const totalMsRef = useRef<number>(config.focusMinutes * 60 * 1000);
  const completedSessionsRef = useRef<number>(0);
  const boundTaskIdRef = useRef<string | undefined>(undefined);
  const boundHabitIdRef = useRef<string | undefined>(undefined);
  /** pause() 暫存的習慣綁定；resume() 時還原，否則暫停後續跑會遺失入帳對象 */
  const pausedHabitIdRef = useRef<string | undefined>(undefined);

  const configRef = useRef<FlowTimerConfig>(config);
  configRef.current = config;

  // state + ref 同步寫入器（保證兩者永不分歧）
  const syncType = useCallback((t: FlowTimerType) => {
    typeRef.current = t;
    setType(t);
  }, []);
  const syncPhase = useCallback((p: FlowTimerPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);
  const syncEndAt = useCallback((v: number | null) => {
    endAtRef.current = v;
    setEndAt(v);
  }, []);
  const syncRemainingMs = useCallback((v: number | null) => {
    remainingMsRef.current = v;
    setRemainingMs(v);
  }, []);
  const syncTotalMs = useCallback((v: number) => {
    totalMsRef.current = v;
    setTotalMs(v);
  }, []);
  const syncCompletedSessions = useCallback((v: number) => {
    completedSessionsRef.current = v;
    setCompletedSessions(v);
  }, []);
  const syncBoundTaskId = useCallback((v: string | undefined) => {
    boundTaskIdRef.current = v;
    setBoundTaskId(v);
  }, []);
  const syncBoundHabitId = useCallback((v: string | undefined) => {
    boundHabitIdRef.current = v;
    setBoundHabitId(v);
  }, []);

  // Public snapshot for subscribers
  const snapshot: FlowTimerSnapshot = {
    type,
    phase,
    endAt,
    remainingMs,
    totalMs,
    completedSessions,
    boundTaskId,
    boundHabitId,
    customMinutes: undefined,
  };

  const totalMsForType = useCallback((t: FlowTimerType) => {
    return typeToMinutes(t, configRef.current) * 60 * 1000;
  }, []);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const startTicker = useCallback(() => {
    if (tickerRef.current) return;
    tickerRef.current = setInterval(() => {
      // Force re-render so secondsLeft is recomputed from endAt
      force((n) => n + 1);

      const current = endAtRef.current;
      if (current == null) return;
      if (completedFiredRef.current) return;
      if (Date.now() < current) return;

      completedFiredRef.current = true;
      stopTicker();

      const finalType = typeRef.current;
      const finalSnapshot: FlowTimerSnapshot = {
        type: finalType,
        phase: "completed",
        endAt: null,
        remainingMs: 0,
        totalMs: totalMsRef.current,
        completedSessions: completedSessionsRef.current,
        boundTaskId: boundTaskIdRef.current,
        boundHabitId: boundHabitIdRef.current,
      };
      completeListenersRef.current.forEach((cb) => {
        try { cb(finalSnapshot); } catch { /* listener error swallowed */ }
      });

      // Auto-advance: focus → break/long-break, break → focus
      if (finalType === "focus") {
        const next = completedSessionsRef.current + 1;
        syncCompletedSessions(next);
        syncType(next % configRef.current.sessionsBeforeLongBreak === 0 ? "long-break" : "break");
      } else {
        syncType("focus");
      }
      syncPhase("idle");
      syncEndAt(null);
      syncRemainingMs(null);

      // 沿用原語意：totalMs 依「剛完成的類型」重設（閒置時顯示的是上一輪長度）
      if (finalType === "focus") {
        syncTotalMs(configRef.current.focusMinutes * 60 * 1000);
      } else if (finalType === "break") {
        syncTotalMs(configRef.current.shortBreakMinutes * 60 * 1000);
      } else {
        syncTotalMs(configRef.current.longBreakMinutes * 60 * 1000);
      }
    }, 250);
  }, [stopTicker, syncCompletedSessions, syncEndAt, syncPhase, syncRemainingMs, syncTotalMs, syncType, totalMsForType]);

  // Cleanup on full unmount (Provider itself)
  useEffect(() => {
    return () => {
      stopTicker();
    };
  }, [stopTicker]);

  const start = useCallback(
    (opts?: { type?: FlowTimerType; taskId?: string; habitId?: string; customMinutes?: number }) => {
      const targetType = opts?.type ?? typeRef.current;
      // 優先用 customMinutes，否則用 config 預設
      const ms =
        opts?.customMinutes != null
          ? opts.customMinutes * 60 * 1000
          : totalMsForType(targetType);
      completedFiredRef.current = false;
      syncType(targetType);
      syncPhase("running");
      syncTotalMs(ms);
      syncEndAt(Date.now() + ms);
      syncRemainingMs(null);
      if (opts?.taskId !== undefined) syncBoundTaskId(opts.taskId);
      if (opts?.habitId !== undefined) syncBoundHabitId(opts.habitId);
      pausedHabitIdRef.current = undefined;
      startTicker();
    },
    [startTicker, syncBoundHabitId, syncBoundTaskId, syncEndAt, syncPhase, syncRemainingMs, syncTotalMs, syncType, totalMsForType],
  );

  const pause = useCallback(() => {
    if (phaseRef.current !== "running" || endAtRef.current == null) return;
    const remaining = Math.max(0, endAtRef.current - Date.now());
    completedFiredRef.current = false;
    syncPhase("paused");
    syncEndAt(null);
    syncRemainingMs(remaining);
    // 暫存習慣綁定（resume 會還原），並清除目前綁定避免計時中切換被誤記
    pausedHabitIdRef.current = boundHabitIdRef.current;
    syncBoundHabitId(undefined);
    stopTicker();
  }, [stopTicker, syncBoundHabitId, syncEndAt, syncPhase, syncRemainingMs]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused" || remainingMsRef.current == null) return;
    completedFiredRef.current = false;
    syncPhase("running");
    syncEndAt(Date.now() + remainingMsRef.current);
    syncRemainingMs(null);
    // 還原 pause() 暫存的習慣綁定，確保續跑結束仍會入帳
    if (pausedHabitIdRef.current) {
      syncBoundHabitId(pausedHabitIdRef.current);
      pausedHabitIdRef.current = undefined;
    }
    startTicker();
  }, [startTicker, syncBoundHabitId, syncEndAt, syncPhase, syncRemainingMs]);

  const reset = useCallback(
    (opts?: { type?: FlowTimerType }) => {
      const targetType = opts?.type ?? typeRef.current;
      const ms = totalMsForType(targetType);
      completedFiredRef.current = false;
      syncType(targetType);
      syncPhase("idle");
      syncEndAt(null);
      syncRemainingMs(null);
      syncTotalMs(ms);
      syncBoundHabitId(undefined);
      pausedHabitIdRef.current = undefined;
      stopTicker();
    },
    [stopTicker, syncBoundHabitId, syncEndAt, syncPhase, syncRemainingMs, syncTotalMs, syncType, totalMsForType],
  );

  const cycleType = useCallback(
    (newType: FlowTimerType) => {
      const ms = totalMsForType(newType);
      completedFiredRef.current = false;
      syncType(newType);
      syncPhase("idle");
      syncEndAt(null);
      syncRemainingMs(null);
      syncTotalMs(ms);
      stopTicker();
    },
    [stopTicker, syncEndAt, syncPhase, syncRemainingMs, syncTotalMs, syncType, totalMsForType],
  );

  const onComplete = useCallback(
    (cb: (s: FlowTimerSnapshot) => void) => {
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
    setBoundTask: syncBoundTaskId,
    setBoundHabit: syncBoundHabitId,
    onComplete,
    config,
  };
}
