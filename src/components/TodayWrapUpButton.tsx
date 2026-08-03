"use client";

import { useProgressStatus } from "@/hooks/useProgressStatus";
import { useStatusWindow } from "@/hooks/useStatusWindow";
import { useProactiveClosure } from "@/hooks/useProactiveClosure";

/**
 * 「今天先這樣」 — Zen 模式卡片底部按鈕
 * +5 PP 休息獎勵 — 「懂得休息也是進步」
 */

const REST_PP = 5;

type Props = {
  tasks: import("@/lib/types").Task[];
};

export function TodayWrapUpButton({ tasks }: Props) {
  const { addPp } = useProgressStatus();
  const showWindow = useStatusWindow();

  const { wrapUp, wrapping } = useProactiveClosure({
    onWrapComplete: () => {
      // +5 PP 休息獎勵
      addPp(REST_PP);

      // 安撫 toast — 200ms 後,讓卡片動畫先演出一瞬再說話
      window.setTimeout(() => {
        showWindow({
          title: "今天先這樣",
          message: "剩下的任務已送回大廳。明天又會是新的開始。",
          xpDelta: REST_PP,
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
