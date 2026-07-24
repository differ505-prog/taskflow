"use client";

import { CommandCenter } from "@/components/CommandCenter";

export default function CommandCenterPage() {
  // 向後相容:直接打 /command-center 仍可進入軍機處
  // 但建議從禪模式「任務大廳」→ 軍機處切換面板進入,UX 更順
  return <CommandCenter onClose={() => (window.location.href = "/")} />;
}
