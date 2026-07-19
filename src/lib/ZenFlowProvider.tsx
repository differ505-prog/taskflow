"use client";

import { ZenFlowContext } from "./ZenFlowContext";
import { useZenFlow } from "./useZenFlow";

export function ZenFlowProvider({ children, omnisonicBaseUrl }: { children: React.ReactNode; omnisonicBaseUrl: string }) {
  const controller = useZenFlow(omnisonicBaseUrl);

  return (
    <ZenFlowContext.Provider value={controller}>
      {children}
    </ZenFlowContext.Provider>
  );
}
