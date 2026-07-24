"use client";

import { useStatusWindowStore, type StatusWindowPayload } from "@/lib/statusWindowStore";

/**
 * useStatusWindow - 呼叫狀態窗的便利 Hook
 *
 * 用法:
 *   const window = useStatusWindow();
 *   <button onClick={() => window({ message: "任務已完成。經驗值 +100", xpDelta: 100 })}>
 *
 * 設計為函式而非布林,符合「XXX 是一個動作」語感。
 */
export function useStatusWindow() {
  const show = useStatusWindowStore((s) => s.show);
  return (payload: StatusWindowPayload) => show(payload);
}
