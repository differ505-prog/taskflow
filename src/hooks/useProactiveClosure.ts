"use client";

import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import type { Task } from "@/lib/types";

/**
 * useProactiveClosure — 「今天先這樣」共用行為 hook
 *
 * 設計動機（§5 DRY）：
 * - Zen 模式 TodayWrapUpButton 與 AppShell 主清單 toolbar 的「今天先這樣」按鈕
 *   底層意圖完全相同:把未完成任務的 dueDate 清空,送回 Backlog
 * - 但兩處 UX 細節不同:Zen 模式給 PP 獎勵 + 安撫 toast,toolbar 給 confirm 確認窗
 * - 把「資料層行為 + wrapping 鎖 + 副作用 hook」統一,UX 細節留 callback 注入
 *
 * 絕對約束（§5-L 防線 + §X 戰略性撤退設定）:
 * - 永遠是 dueDate → undefined,絕對不可呼叫 archiveTask / isArchived
 * - 封存是「🍃 無罪赦免」的專屬特權
 *
 * sync 層（§23 確認）:
 * - 走 useApp().updateTask → batchSaveTasksFirebase + markRecentlyWritten(§26-A)
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
  const { updateTask } = useApp();
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

    // 資料層:dueDate → undefined,任務回 Backlog
    pending.forEach((task) => updateTask(task.id, { dueDate: undefined }));

    onWrapComplete?.(pending.length);

    window.setTimeout(() => setWrapping(false), cooldownMs);
    return true;
  };

  return { wrapUp, wrapping };
}
