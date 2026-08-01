/**
 * VAPID 公鑰常數 — 用於瀏覽器端 pushManager.subscribe()
 *
 * 🔑 私鑰配對從 npx web-push generate-vapid-keys 產生
 * 公鑰：safe to expose via NEXT_PUBLIC_ 前綴（瀏覽器必須看得到）
 * 私鑰：僅 server-side 用（推播時帶入 Authorization header）
 *
 * ⚠️ 重要：公鑰改了 = 所有裝置訂閱失效，必須重新訂閱一次
 *
 * 生成指令（未來如需 rotate）：
 *   npx web-push generate-vapid-keys
 * 然後：
 *   1. 把新公鑰填到這裡
 *   2. 把新私鑰填到 Vercel env: VAPID_PRIVATE_KEY
 *   3. push 一個 commit 觸發 SW 重載
 */

export const VAPID_PUBLIC_KEY =
  "BEGIwtReUeUUWsreqpsPKeuNw53ylHxUleF6sF4j5DgICL21jKz1TZ693ShTeAfT5dNVNtumq2193VpNyI-Ei-0";

/**
 * 把 base64url VAPID 公鑰轉成 Uint8Array（pushManager.subscribe 需要的格式）
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * 訂閱瀏覽器推播，回傳 PushSubscription 或 null（未授權 / 不支援）
 *
 * 用法：
 *   const sub = await subscribeToPush();
 *   if (sub) await fetch('/api/push/subscribe', { method: 'POST', body: JSON.stringify(sub) });
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[push] Service Worker / PushManager not supported");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.info("[push] Notification permission:", permission);
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  return subscription;
}

/**
 * 取消訂閱（使用者從設定頁關閉推播時呼叫）
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;
  return subscription.unsubscribe();
}

/**
 * 查詢目前推播訂閱狀態（給設定頁 UI 用）
 */
export async function getPushSubscriptionStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { supported: false, permission: "unsupported", subscribed: false };
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!subscription,
  };
}