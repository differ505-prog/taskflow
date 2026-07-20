"use client";

import { ZenFlowContext, PomodoroContext } from "./ZenFlowContext";
import { useZenFlow } from "./useZenFlow";
import { usePomodoro } from "./usePomodoro";

export function ZenFlowProvider({ children, omnisonicBaseUrl }: { children: React.ReactNode; omnisonicBaseUrl: string }) {
  const controller = useZenFlow(omnisonicBaseUrl);
  const pomodoro = usePomodoro();

  return (
    <ZenFlowContext.Provider value={controller}>
      <PomodoroContext.Provider value={pomodoro}>
        {children}
      </PomodoroContext.Provider>
    </ZenFlowContext.Provider>
  );
}