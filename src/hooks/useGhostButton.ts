"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { logEvent } from "@/lib/eventLog";

/**
 * useGhostButton — 幽靈按鈕共用邏輯
 *
 * 職責：
 *   1. 處理點擊 → logEvent + 開 Modal + 1 週靜默檢查
 *   2. 處理 Modal 「先不用了」 → 寫 localStorage (1 週內不再彈)
 *   3. 處理 Modal 「加入候補」 → logEvent CTA + 委派給 onJoinWaitlist callback
 *
 * 為什麼是 hook 而不是 HOC：
 *   - 同一頁可能有多個幽靈按鈕 (禪模式 + TaskForm),各自獨立計數
 *   - hook 讓元件本身保持純視覺,邏輯集中
 *
 * SSR-safe：所有 localStorage 操作都在 useEffect 內,避免 hydration mismatch
 */

const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 一週

interface DismissRecord {
  /** 拒絕的時間戳 (ms) */
  dismissedAt: number;
}

function getDismissKey(buttonId: string): string {
  return `vibelist:ghostDismissed:${buttonId}`;
}

function readDismiss(buttonId: string): DismissRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getDismissKey(buttonId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DismissRecord>;
    if (typeof parsed.dismissedAt !== "number") return null;
    // 過期視同未拒絕
    if (Date.now() - parsed.dismissedAt > DISMISS_DURATION_MS) {
      window.localStorage.removeItem(getDismissKey(buttonId));
      return null;
    }
    return { dismissedAt: parsed.dismissedAt };
  } catch {
    return null;
  }
}

function writeDismiss(buttonId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getDismissKey(buttonId),
      JSON.stringify({ dismissedAt: Date.now() })
    );
  } catch {
    // quota / private mode → silently ignore
  }
}

export interface UseGhostButtonOptions {
  /** 幽靈按鈕唯一 ID (用於事件追蹤 + 獨立靜默計數) */
  buttonId: string;
  /** 點擊事件名 (預設 click_ghost_button_<buttonId>) */
  clickEvent?: string;
  /** Modal 中 CTA 點擊時呼叫;通常接 API 標記 pro_waitlist */
  onJoinWaitlist?: () => void | Promise<void>;
}

export interface UseGhostButtonReturn {
  /** Modal 是否開啟 */
  open: boolean;
  /** 該按鈕是否已訂閱提醒（1 週內不再彈窗）— 父層可據此渲染徽章,避免「按鍵故障」誤判 */
  dismissed: boolean;
  /** 點擊幽靈按鈕(對外暴露的單一入口) */
  handleClick: () => void;
  /** Modal 內「先不用了」 */
  handleDismiss: () => void;
  /** Modal 內「加入候補名單」 */
  handleJoin: () => void | Promise<void>;
}

export function useGhostButton(options: UseGhostButtonOptions): UseGhostButtonReturn {
  const { buttonId, clickEvent, onJoinWaitlist } = options;
  const [open, setOpen] = useState(false);

  // Mount 後檢查是否曾被拒絕過 — SSR-safe 處理
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(readDismiss(buttonId) !== null);
  }, [buttonId]);

  const handleClick = useCallback(() => {
    // 已拒絕過(且未過期)→ 點擊不再彈,只記點擊事件(統計用) + 提示用戶「已訂閱」
    if (dismissed) {
      logEvent(clickEvent ?? `click_ghost_button_${buttonId}`, {
        buttonId,
        metadata: { suppressed: true },
      });
      toast.success("已加入提醒,1 週內不再彈窗", {
        description: "這是尚未推出的 Pro 功能預約,到時會通知你。",
      });
      return;
    }
    // 第一次點 / 一週後再點 → 記錄 + 開 modal
    logEvent(clickEvent ?? `click_ghost_button_${buttonId}`, { buttonId });
    setOpen(true);
  }, [dismissed, buttonId, clickEvent]);

  const handleDismiss = useCallback(() => {
    // 寫 localStorage + 關 modal
    writeDismiss(buttonId);
    setDismissed(true);
    setOpen(false);
    // 記錄拒絕事件(分析「點了但不加入」比例)
    logEvent(`dismiss_waitlist_${buttonId}`, { buttonId });
  }, [buttonId]);

  const handleJoin = useCallback(async () => {
    // 記錄 CTA 點擊
    logEvent(`click_waitlist_cta_${buttonId}`, {
      buttonId,
      metadata: { action: "join" },
    });
    // 委派給元件 (例如 fetch /api/pro-waitlist)
    if (onJoinWaitlist) {
      await onJoinWaitlist();
    }
    // 成功後關閉 (即使 onJoinWaitlist throw 也照樣關 — 失敗不擾民)
    setOpen(false);
  }, [buttonId, onJoinWaitlist]);

  return {
    open,
    dismissed,
    handleClick,
    handleDismiss,
    handleJoin,
  };
}
