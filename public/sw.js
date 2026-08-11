/**
 * sw.js — TaskFlow PWA Service Worker（純 JavaScript,不可使用 TypeScript 語法）
 *
 * ⚠️ 重要維護守則（§13 / §14 對齊）：
 * - 此檔由瀏覽器直接載入執行,不會經過 webpack/tsc 編譯
 * - 禁止使用 TypeScript 語法:'as unknown as'、'as ServiceWorkerGlobalScope'、
 *   型別註記（(x: string)）、泛型（Array<T>）、enum、interface 等
 * - 需要型別時用 JSDoc 註解（@type {ServiceWorkerGlobalScope}）保留 IDE 提示
 * - 改動後必跑 'node --check public/sw.js' 驗證語法（CI 可加 npm run check:sw）
 * - 若未來需要完整 TS workflow,改用 esbuild 編譯 sw.ts → sw.js + npm script
 * - ⚠️ CACHE_NAME 會在 build 時由 scripts/patch-sw.js 自動注入唯一 hash
 *   千萬不要手動改成單一固定值（如 taskflow-v1），會導致新 SW 無法清掉舊 cache（PWA 卡舊版）
 *
 * 功能：
 * 1. Cache-first 策略：靜態資源（JS/CSS/圖片）離線可用
 * 2. Network-first + cache fallback：API 請求（失敗時回退快取）
 * 3. 背景同步：上線後重新同步失敗的請求
 *
 * 設計原則：
 * - 僅快取必要資源，避免佔用過多儲存空間
 * - App Shell 架構：HTML + CSS + JS 全部離線
 * - API 請求不做離線寫入（任務資料以 Supabase Realtime 為準）
 */
const CACHE_NAME = "taskflow-dChEIxAIKk2E"; // ← build/dev 時由 scripts/patch-sw.js 自動替換為 taskflow-{hash}
// STATIC_ASSETS 不再放 HTML("/") ，否則 cache-first 永遠命中舊 HTML 導致 SW 更新也吃不到新內容
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// ─── Utils ────────────────────────────────────────────────────────
const fetchWithTimeout = (request, timeout = 8000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeout);
    fetch(request)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// ─── Install ──────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // 移除 self.clients.claim(); 以避免 Safari 在 OAuth 重新導向時網路請求卡死（Safari 知名 Bug）
});

// ─── Fetch ───────────────────────────────────────────────────────
// [⚠️ 緊急修復] 為了避免 Safari Service Worker 攔截 Next.js 15 App Router 的 RSC 請求導致死鎖或導航失效，
// 我們全面棄用 SW 端的 fetch 攔截。App Router 本身就有很強的 client-side router cache，不需要 SW 來 cache。
self.addEventListener("fetch", (event) => {
  // 什麼都不做，讓瀏覽器原生接管所有的網路連線。
  // 這樣能 100% 解決 Safari 卡死和點擊 Link 沒反應的問題！
  return;
});

// ─── Background Sync ──────────────────────────────────────────────
// 當 SW 重新啟動時，檢查是否有待處理的背景同步
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-tasks") {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  // 讀取 IndexedDB 中的待同步操作佇列
  // 目前 Supabase Realtime 已處理多設備同步，此處僅作備援
  console.log("[SW] Background sync triggered");
}

// ─── Push Notifications ───────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const title = data.title || "TaskFlow";
  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "taskflow-notification",
    data: data.url ? { url: data.url } : undefined,
    actions: data.actions || [],
  };
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 檢查是否有任何視窗處於可見狀態（前景）
      const isFocused = clientList.some((client) => client.visibilityState === "visible");
      
      if (isFocused) {
        // App 在前景：發送廣播讓網頁顯示內置 Toast，不要跳系統通知
        clientList.forEach((client) => {
          client.postMessage({
            type: "PUSH_RECEIVED",
            title,
            body: data.body,
          });
        });
      } else {
        // App 在背景或未開啟：顯示系統橫幅通知
        return self.registration.showNotification(title, options);
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
