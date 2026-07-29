"use client";

import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import type { Task } from "@/lib/types";

/**
 * useProactiveClosure — 「今天先這樣」共用行為 hook
 *
 * 設計動機(§5 DRY):
 * - Zen 模式 TodayWrapUpButton 與 AppShell 主清單 toolbar 的「今天先這樣」按鈕
 *   底層意圖完全相同:把未完成任務「逃生」回 Backlog
 * - 但兩處 UX 細節不同:Zen 模式給 PP 獎勵 + 安撫 toast,toolbar 給 confirm 確認窗
 * - 把「資料層行為 + wrapping 鎖 + 副作用 hook」統一,UX 細節留 callback 注入
 *
 * 統一逃生邏輯(§Unified Escape Protocol):
 * - 區間任務(有 startDate):startDate 推進 1 天,絕對不清空(防忘記死線)
 * - 單日任務(無 startDate):dueDate → undefined(無罪赦免,退回收集箱)
 * 實作走 AppContext.escapeTask(§23 sync 層)+ markRecentlyWritten(§26-A)
 *
 * @example
 *   const { wrapUp, wrapping } = useProactiveClosure({
 *     onBeforeWrap: async (tasks) => confirm({ ... }),
 *     onWrapComplete: (count) => addExp(5),
 *   });
 *   <button disabled={wrapping} onClick={() => wrapUp(tasks)}>今天先這樣</button>
 */

type Options = {
  /** 確認 gate:回傳 true 才執行,false 中止。例:confirm modal */
  onBeforeWrap?: (tasks: Task[]) => Promise<boolean> | boolean;
  /** 寫入完成後的副作用 hook:例:addExp / showWindow */
  onWrapComplete?: (taskCount: number) => void;
  /** wrapping 鎖釋放時間(ms)。預設 1500ms,防用戶短時間內重複觸發 */
  cooldownMs?: number;
};

export function useProactiveClosure(opts: Options = {}) {
  const { escapeTask } = useApp();
  const [wrapping, setWrapping] = useState(false);
  const { onBeforeWrap, onWrapComplete, cooldownMs = 1500 } = opts;

  const wrapUp = async (tasks: Task[]): Promise<boolean> => {
    if (wrapping) return false;

    const pending = tasks.filter((t) => t.status !== "done");
    if (pending.length === 0) return false;

    if (onBeforeWrap) {
      const ok = await onBeforeWrap(pending);
      if (!ok) return false;
    }

    setWrapping(true);

    // 統一逃生:區間任務(有 startDate)推遲 1 天,單日任務 dueDate → undefined
    // 透過 escapeTask 走 updateTask sync 路徑,確保雲端同步
    pending.forEach((task) => escapeTask(task.id));

    onWrapComplete?.(pending.length);

    window.setTimeout(() => setWrapping(false), cooldownMs);
    return true;
  };

  return { wrapUp, wrapping };
}
