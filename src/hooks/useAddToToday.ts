import { getLocalToday } from "@/lib/dateUtils";
/**
 * 加入今日 (Add to Today) — 共用動作 hook
 *
 * 對齊 §26 類別 A「最近寫入保護窗」:updateTask 內部已呼叫 markRecentlyWritten,
 * 因此 toast/dismiss 與資料寫入在同一 React 事件內完成,5 秒內雲端 echo 不會覆蓋本地。
 *
 * Toast 用 Sonner 固定 id="add-to-today-toast" 機制:連續呼叫會「取代」而非「堆疊」,
 * 符合 VibeList 禪意設計(畫面永遠只有一個安靜的提示)。
 *
 * - 一鍵入禪(由 AppShell handleFocusNow 觸發)前,呼叫 dismissAddToTodayToast()
 *   把 toast 提前清掉,避免「設為今日」殘留到 Zen 模式。
 *
 * 用法:
 *   const { addToToday } = useAddToToday();
 *   addToToday(task.id); // 任務移到今日(若已是今日則靜默不顯示)
 */
import { useCallback } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/AppContext";

const ADD_TO_TODAY_TOAST_ID = "add-to-today-toast";
const SUCCESS_VARIANT = {
  style: { background: "var(--brand-tint)", color: "var(--brand)", border: "1px solid var(--brand)" },
} as const;

export function useAddToToday() {
  const { updateTask, updateSharedTask, sharedLists } = useApp();

  const addToToday = useCallback(
    (taskId: string) => {
      // §23 同步層:統一走 AppContext.updateTask,享有 markRecentlyWritten 保護
      const today = getLocalToday();
      let targetSharedListId: string | undefined;
      for (const [listId, data] of Object.entries(sharedLists)) {
        if (data.tasks.some(t => t.id === taskId)) {
          targetSharedListId = listId;
          break;
        }
      }

      if (targetSharedListId) {
        updateSharedTask(targetSharedListId, taskId, { dueDate: today });
      } else {
        updateTask(taskId, { dueDate: today });
      }
      // Sonner 固定 id → 連續按 T 鍵自動取代前一顆,只留最新
      toast.success("☀ 已排定為今日 (v3)", {
        id: ADD_TO_TODAY_TOAST_ID,
        duration: 2000,
        ...SUCCESS_VARIANT,
      });
    },
    [updateTask, updateSharedTask, sharedLists],
  );

  /**
   * 主動關閉 toast(由一鍵入禪的 handleFocusNow 在 router.push 前呼叫)。
   * 即使 toast 已自動消失,toast.dismiss 對不存在的 id 是 no-op,無副作用。
   */
  const dismissAddToTodayToast = useCallback(() => {
    toast.dismiss(ADD_TO_TODAY_TOAST_ID);
  }, []);

  return { addToToday, dismissAddToTodayToast };
}