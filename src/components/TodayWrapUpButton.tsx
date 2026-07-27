"use client";

import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { useHunterStatus } from "@/hooks/useHunterStatus";
import { useStatusWindow } from "@/hooks/useStatusWindow";
import type { Task } from "@/lib/types";

/**
 * 「今天先這樣」 — 主動封存今日剩餘任務
 *
 * 設計基調(使用者 spec):
 * - 絕對無罪惡感。沒有警告彈窗,沒有「你還有 N 個任務未完成」提示
 * - 動畫語境「蓋棉被 / 沉水底」:由 FocusCard/SortableQueueItem 既有 motion.exit 觸發
 *   (fade + scale + slide down),本元件只負責狀態切換 + 寫入
 * - 點擊後任務 dueDate → undefined,回歸軍機處 Backlog,不延期、不加紅標
 * - +5 EXP 休息獎勵 — 「懂得休息也是升級」
 *
 * 走既有 sync 層(§23 確認):
 * - useApp().updateTask → batchSaveTasksFirebase + markRecentlyWritten(§26-A 防 echo)
 *
 * 顯示條件:傳入的 tasks 不為空(呼叫端控制)
 *
 * 為什麼卡片動畫不寫在本元件:
 * - FocusCard / SortableQueueItem 是任務卡的「presentational + 動畫」單位
 * - 改 dueDate 後,visibleTasks filter 自然過濾掉,卡片透過 AnimatePresence 自然 exit
 * - 本元件只需管「按鈕交互 + 副作用」,職責分離乾淨(§5 DRY)
 */

const REST_EXP = 5;

type Props = {
  tasks: Task[];
};

export function TodayWrapUpButton({ tasks }: Props) {
  const { updateTask } = useApp();
  const { addExp } = useHunterStatus();
  const showWindow = useStatusWindow();

  const [wrapping, setWrapping] = useState(false);

  if (tasks.length === 0) return null;

  const handleWrapUp = () => {
    if (wrapping) return;
    setWrapping(true);

    // 資料層:dueDate → undefined,讓任務回歸 Backlog
    // 卡片會在 useMemo 重算 visibleTasks 後透過 AnimatePresence 自然 exit
    tasks.forEach((task) => updateTask(task.id, { dueDate: undefined }));

    // +5 EXP 休息獎勵(永不倒扣原則,§hunterRank)
    addExp(REST_EXP);

    // 安撫 toast — 200ms 後,讓卡片動畫先演出一瞬再說話
    window.setTimeout(() => {
      showWindow({
        title: "辛苦了",
        message: "剩下的任務已安全送回大廳。去享受現實世界吧！🌙",
        xpDelta: REST_EXP,
        icon: "🌙",
      });
    }, 200);

    // 1.5s 後釋放按鈕,允許再次操作(以防 user 想再封存剛剛漏的)
    window.setTimeout(() => setWrapping(false), 1500);
  };

  return (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        onClick={handleWrapUp}
        disabled={wrapping}
        className="group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-slate-400 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-slate-600 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="今天先這樣 — 把剩餘的今日任務送回任務大廳"
      >
        <span aria-hidden className="transition-transform duration-300 group-hover:rotate-12">
          🌙
        </span>
        <span>今天先這樣</span>
      </button>
    </div>
  );
}