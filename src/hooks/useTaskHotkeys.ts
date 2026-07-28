/**
 * useTaskHotkeys — 全域任務快捷鍵(目前只有「T = 加入今日」)
 *
 * 觸發鏈:
 *   1. 使用者 hover 任務卡片 → AppShell 維護 hoveredTaskId 全域 state
 *   2. 按下 `T` 鍵 → 觸發 onAddToToday(hoveredTaskId)
 *
 * 防護(§15.4 mobile input + §18 既有 TaskDetailPanel 模式):
 *   - INPUT/TEXTAREA/contentEditable 焦點中 → 不觸發(避免輸入文字時誤觸)
 *   - IME composition (中文選字)→ 不觸發
 *   - Meta/Ctrl/Alt 組合鍵 → 不觸發(讓 Cmd+T / Ctrl+T 保留給瀏覽器)
 *   - 對話框/Modal 開啟中 → 不觸發(避免彈窗時誤觸)
 *   - hoveredTaskId 為空 → 不觸發(必須 hover 任務才能用熱鍵)
 *
 * 用法(在 AppShell):
 *   const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
 *   useTaskHotkeys({ hoveredTaskId, onAddToToday: addToToday });
 *   // TaskListItem / TaskCard onMouseEnter 設 setHoveredTaskId(task.id)
 */
import { useEffect } from "react";
import { isComposingKey } from "@/utils/imeGuard";

interface UseTaskHotkeysOptions {
  /** AppShell 維護的全域 hover task id,若 null 則 hotkey 不觸發 */
  hoveredTaskId: string | null;
  /** 「T」鍵按下時執行,接收 hoveredTaskId */
  onAddToToday: (taskId: string) => void;
  /** 自訂觸發鍵(預設 "t") */
  key?: string;
  /** 是否啟用(預設 true) */
  enabled?: boolean;
}

function isInEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useTaskHotkeys({
  hoveredTaskId,
  onAddToToday,
  key = "t",
  enabled = true,
}: UseTaskHotkeysOptions): void {
  useEffect(() => {
    if (!enabled) return;
    const targetKey = key.toLowerCase();

    const handler = (e: KeyboardEvent) => {
      // §15.4 / §18:輸入欄位 / IME / Modal / 修飾鍵 全部跳過
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isComposingKey(e as unknown as Parameters<typeof isComposingKey>[0])) return;
      if (isInEditableTarget(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;

      if (e.key.toLowerCase() !== targetKey) return;
      if (!hoveredTaskId) return; // 必須 hover 任務才能用

      e.preventDefault();
      onAddToToday(hoveredTaskId);
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [hoveredTaskId, onAddToToday, key, enabled]);
}