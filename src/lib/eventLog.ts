/**
 * eventLog — 前端事件追蹤客戶端
 *
 * 用途：
 *   統一的客戶端事件發送介面,對接 /api/event-log
 *   供假門測試 (Fake Door Test)、CTA 點擊統計使用
 *
 * 設計：
 *   - Fire-and-forget:不 await,不影響主流程
 *   - 失敗靜默:console.warn 但不 throw
 *   - SSR-safe:在 server-side 直接 no-op
 *   - 介面精簡:logEvent(eventName, metadata) 一行搞定
 *
 * 為什麼不在前端 console.log 就好？
 *   - console.log 只在本機 dev 看得見
 *   - 假門測試需要「跨用戶、跨 session」的資料,Vercel log 才能保留
 */

export interface LogEventOptions {
  /** 哪個幽靈按鈕/位置,用於跨事件關聯(例如 "timebar" / "unlimited_shred") */
  buttonId?: string;
  /** 附帶資訊(版本號、A/B test bucket、task 數量等) */
  metadata?: Record<string, unknown>;
}

/**
 * 發送事件到 /api/event-log
 *
 * @param event 事件名 (snake_case,例如 "click_ghost_button_timebar")
 * @param options 額外資訊
 *
 * @example
 *   logEvent("click_ghost_button_timebar", { buttonId: "timebar" });
 *   logEvent("click_waitlist_cta", { buttonId: "timebar", metadata: { action: "join" } });
 */
export function logEvent(event: string, options: LogEventOptions = {}): void {
  // SSR-safe:server-side 不送
  if (typeof window === "undefined") return;

  // Fire-and-forget:不 await,失敗靜默
  // 使用 fetch 的 promise 但不讓呼叫端處理
  void fetch("/api/event-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      buttonId: options.buttonId,
      metadata: options.metadata,
    }),
    keepalive: true, // 頁面 unload 也能送出
  }).catch((err) => {
    // 事件追蹤失敗絕不影響主流程 UX
    if (typeof console !== "undefined") {
      console.warn("[eventLog] failed:", err);
    }
  });
}
