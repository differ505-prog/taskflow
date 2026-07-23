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
const CACHE_NAME = "taskflow-q6Dt3e1B_B1M"; // ← build/dev 時由 scripts/patch-sw.js 自動替換為 taskflow-{hash}
// STATIC_ASSETS 不再放 HTML("/") ，否則 cache-first 永遠命中舊 HTML 導致 SW 更新也吃不到新內容
const STATIC_ASSETS = [
  "/manifest.json",
  "/favicon.svg",
];

// ─── Install ──────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // 立即啟用新 SW，跳過等待
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
  // 接管所有客戶端
  self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 僅處理同源請求
  if (url.origin !== self.location.origin) return;

  // API 路由：network-first（保持即時性）
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 只對 GET 請求做快取（避免污染寫入）
          if (request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // 網路失敗時回退快取
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(JSON.stringify({ error: "offline" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            });
          });
        })
    );
    return;
  }

  // 靜態資源（含 JS/CSS/圖片/_next/*）：cache-first（速度優先）
  // 例外：HTML / 導航請求（request.mode === 'navigate'）改走 network-first
  // 確保 SW 更新後，用戶重新整理能立刻拿到新版 HTML，不會被舊 cache 卡住
  const isNavigation = request.mode === "navigate" ||
    (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response.ok) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
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
  const options = {
    body: data.body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: data.tag || "taskflow-notification",
    data: data.url ? { url: data.url } : undefined,
    actions: data.actions || [],
  };
  event.waitUntil(
    self.registration.showNotification(
      data.title || "TaskFlow",
      options
    )
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
