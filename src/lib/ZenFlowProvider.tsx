"use client";

import { useEffect, useRef } from "react";
import { ZenFlowContext, FlowTimerContext } from "./ZenFlowContext";
import { useZenFlow } from "./useZenFlow";
import { useFlowTimer } from "./usePomodoro";

/**
 * §計時器 ↔ 音樂 集中式橋接 (§6 DRY):
 *
 * 需求:計時器「停止」(phase: idle / paused / completed) ↔ 音樂同步停止。
 *
 * 原本兩處元件(FlowTimer / FlowTimerModal)各自訂閱 useFlowTimer.onComplete +
 * useEffect 觀察 snapshot.phase,邏輯重複且依賴元件是否掛載;若任一處忘記訂閱,
 * 「切頁面 unmount 後計時器仍跑、音樂卻停」這類 bug 就會出現。
 *
 * 統一在此 Provider 內訂閱:Provider 不會隨頁面切換 unmount,所以音樂↔計時器
 * 同步邏輯保證跨頁面持續生效。
 *
 * 設計邊界:
 * - 「計時器在跑 → 音樂能否播放」由各 UI 元件守衛(handleZenToggle 內檢查 phase),
 *   Provider 不主動 start 音樂(避免「使用者只想計時不聽音樂」被破壞)。
 * - 「計時器停止 → 音樂停止」由 Provider 主動 zenPause(需求:計時停音樂就停)。
 */
function FlowTimerMusicBridge({
  flowTimer,
  zenIsPlaying,
  zenPause,
}: {
  flowTimer: ReturnType<typeof useFlowTimer>;
  zenIsPlaying: boolean;
  zenPause: () => void;
}) {
  const prevPhaseRef = useRef(flowTimer.snapshot.phase);

  // §自然完成 → 停止音樂
  useEffect(() => {
    const unsubscribe = flowTimer.onComplete(() => {
      if (zenIsPlaying) zenPause();
    });
    return unsubscribe;
  }, [flowTimer, zenIsPlaying, zenPause]);

  // §使用者手動暫停 / reset → phase 從 running 變 idle / paused → 停止音樂
  useEffect(() => {
    const wasRunning = prevPhaseRef.current === "running";
    const nowIdleOrPaused =
      flowTimer.snapshot.phase === "idle" || flowTimer.snapshot.phase === "paused";

    if (wasRunning && nowIdleOrPaused && zenIsPlaying) {
      zenPause();
    }

    prevPhaseRef.current = flowTimer.snapshot.phase;
  }, [flowTimer.snapshot.phase, zenIsPlaying, zenPause]);

  return null;
}

export function ZenFlowProvider({ children, omnisonicBaseUrl }: { children: React.ReactNode; omnisonicBaseUrl: string }) {
  const controller = useZenFlow(omnisonicBaseUrl);
  const flowTimer = useFlowTimer();

  return (
    <ZenFlowContext.Provider value={controller}>
      <FlowTimerContext.Provider value={flowTimer}>
        <FlowTimerMusicBridge
          flowTimer={flowTimer}
          zenIsPlaying={controller.state.isPlaying}
          zenPause={controller.pause}
        />
        {children}
      </FlowTimerContext.Provider>
    </ZenFlowContext.Provider>
  );
}
