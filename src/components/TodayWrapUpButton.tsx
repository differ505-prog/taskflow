"use client";

import { useHunterStatus } from "@/hooks/useHunterStatus";
import { useStatusWindow } from "@/hooks/useStatusWindow";
import { useProactiveClosure } from "@/hooks/useProactiveClosure";

/**
 * 「今天先這樣」 — Zen 模式卡片底部按鈕
 *
 * 資料行為:dueDate → undefined,任務回 Backlog（戰略性撤退）
 * 透過 useProactiveClosure hook 統一,確保與主清單 toolbar 同源
 *
 * 設計基調(使用者 spec):
 * - 絕對無罪惡感。沒有警告彈窗,沒有「你還有 N 個任務未完成」提示
 * - 動畫語境「蓋棉被 / 沉水底」:由 FocusCard/SortableQueueItem 既有 motion.exit 觸發
 *   (fade + scale + slide down),本元件只負責狀態切換 + 寫入
 * - +5 EXP 休息獎勵 — 「懂得休息也是升級」
 */

const REST_EXP = 5;

type Props = {
  tasks: import("@/lib/types").Task[];
};

export function TodayWrapUpButton({ tasks }: Props) {
  const { addExp } = useHunterStatus();
  const showWindow = useStatusWindow();

  const { wrapUp, wrapping } = useProactiveClosure({
    onWrapComplete: () => {
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
    },
  });

  if (tasks.length === 0) return null;

  const handleClick = () => {
    void wrapUp(tasks);
  };

  return (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        onClick={handleClick}
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
