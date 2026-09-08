"use client";

import { createContext, useContext, type MutableRefObject } from "react";
import type {
  ZenFlowTrack,
  OmniSonicSessionPlan,
} from "./zenflow-api";
import type { FlowTimerController } from "./usePomodoro";

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

export const FlowTimerContext = createContext<FlowTimerController | null>(null);

export function useFlowTimerContext() {
  const ctx = useContext(FlowTimerContext);
  if (!ctx) {
    throw new Error("useFlowTimerContext must be used inside ZenFlowProvider");
  }
  return ctx;
}

/**
 * §心流音樂 iframe ref context
 *
 * 設計動機: 心流音樂是 provider 等級服務,iframe 常駐 ZenFlowProvider DOM。
 * FlowTimer 等 UI 元件需要操作這個 iframe 的 src / reload 時,
 * 透過 context 拿 ref,而不是自己再 embed 一個 iframe。
 */
export type ZenMusicFrameRef = MutableRefObject<HTMLIFrameElement | null>;

export const ZenMusicFrameContext = createContext<ZenMusicFrameRef | null>(null);

export function useZenMusicFrame(): ZenMusicFrameRef {
  const ctx = useContext(ZenMusicFrameContext);
  if (!ctx) {
    throw new Error("useZenMusicFrame must be used inside ZenFlowProvider");
  }
  return ctx;
}
