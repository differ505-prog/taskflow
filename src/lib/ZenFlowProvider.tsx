"use client";

import { ZenFlowContext, FlowTimerContext } from "./ZenFlowContext";
import { useZenFlow } from "./useZenFlow";
import { useFlowTimer } from "./usePomodoro";

export function ZenFlowProvider({ children, omnisonicBaseUrl }: { children: React.ReactNode; omnisonicBaseUrl: string }) {
  const controller = useZenFlow(omnisonicBaseUrl);
  const flowTimer = useFlowTimer();

  return (
    <ZenFlowContext.Provider value={controller}>
      <FlowTimerContext.Provider value={flowTimer}>
        {children}
      </FlowTimerContext.Provider>
    </ZenFlowContext.Provider>
  );
}