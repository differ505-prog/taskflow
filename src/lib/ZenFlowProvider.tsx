"use client";

import { useEffect, useRef, useCallback } from "react";
import { Howl, Howler } from "howler";
import {
  ZenFlowContext,
  FlowTimerContext,
} from "./ZenFlowContext";
import { useZenFlow } from "./useZenFlow";
import { useFlowTimer } from "./usePomodoro";
import { useHabitsContext } from "@/lib/AppContextInternal/HabitsProvider";
import { getLocalToday } from "@/lib/dateUtils";

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

/**
 * 習慣番茄橋接器
 *
 * 負責：focus session 完成時，自動寫入對應習慣的 pomodoros。
 * 掛在 Provider 層，跨頁面持續生效（不因切頁 unmount）。
 *
 * 設計邊界：
 * - 只在 focus session 完成時寫入；break/long-break 不寫入習慣
 * - 寫入後清除 boundHabitId，防止下一個無關 focus session 被誤記
 */
function HabitPomodoroBridge({
  flowTimer,
  onPomodoroComplete,
  today,
}: {
  flowTimer: ReturnType<typeof useFlowTimer>;
  onPomodoroComplete: (habitId: string, date: string, minutes: number) => void;
  today: string;
}) {
  useEffect(() => {
    const unsubscribe = flowTimer.onComplete((snapshot) => {
      // 只處理 focus session；break/long-break 不寫入習慣
      if (snapshot.type !== "focus") return;
      const habitId = snapshot.boundHabitId;
      if (!habitId) return;
      // 從 totalMs 反推時長（session 完成時 totalMs 已被重置，
      // 但 onComplete 在 reset 之前觸發，totalMs 仍是 session 開始時設定的值）
      const elapsedMs = snapshot.totalMs;
      const minutes = Math.round(elapsedMs / 60000);
      onPomodoroComplete(habitId, today, minutes);
      // 清除 boundHabitId，防止下一個無關 session 被誤記
      flowTimer.setBoundHabit(undefined);
      // ── 播放完成提示音 ────────────────────────────────
      try {
        const completionSound = new Howl({
          src: ["/sounds/alarm.mp3"],
          volume: 0.7,
          html5: true, // 提升 iOS / PWA 環境的播放可靠性
        });
        completionSound.play();
      } catch (err) {
        // 啞巴 fail：音效失敗不影響核心功能
        console.warn("[HabitPomodoroBridge] 播放提示音失敗", err);
      }
    });
    return unsubscribe;
  }, [flowTimer, onPomodoroComplete, today]);

  return null;
}

function HabitPomodoroBridgeWithContext({
  flowTimer,
}: {
  flowTimer: ReturnType<typeof useFlowTimer>;
}) {
  const { incrementHabitPomodoro } = useHabitsContext();
  const today = getLocalToday();

  const onPomodoroComplete = useCallback(
    (habitId: string, date: string, minutes: number) => {
      incrementHabitPomodoro(habitId, date, minutes);
    },
    [incrementHabitPomodoro]
  );

  return (
    <HabitPomodoroBridge
      flowTimer={flowTimer}
      onPomodoroComplete={onPomodoroComplete}
      today={today}
    />
  );
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
        <HabitPomodoroBridgeWithContext flowTimer={flowTimer} />
        {children}
      </FlowTimerContext.Provider>
    </ZenFlowContext.Provider>
  );
}
