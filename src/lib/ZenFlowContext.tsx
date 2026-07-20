"use client";

import { createContext, useContext } from "react";
import type {
  ZenFlowTrack,
  OmniSonicSessionPlan,
} from "./zenflow-api";
import type { PomodoroController } from "./usePomodoro";

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

export type ZenFlowController = {
  state: ZenFlowState;
  play: (trackId?: string) => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setPlaylist: (tracks: ZenFlowTrack[]) => void;
  destroy: () => void;
};

export const ZenFlowContext = createContext<ZenFlowController | null>(null);

export function useZenFlowContext() {
  const ctx = useContext(ZenFlowContext);
  if (!ctx) {
    throw new Error("useZenFlowContext must be used inside ZenFlowProvider");
  }
  return ctx;
}

export const PomodoroContext = createContext<PomodoroController | null>(null);

export function usePomodoroContext() {
  const ctx = useContext(PomodoroContext);
  if (!ctx) {
    throw new Error("usePomodoroContext must be used inside ZenFlowProvider");
  }
  return ctx;
}
