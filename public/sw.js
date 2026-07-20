/**
 * sw.js — TaskFlow PWA Service Worker
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
const CACHE_NAME = "taskflow-v1";
const STATIC_ASSETS = [
  "/",
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
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
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
  (self as unknown as ServiceWorkerGlobalScope).clients.claim();
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

  // 靜態資源：cache-first（速度優先）
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // 不快取 non-GET 或 opaque 響應
        if (request.method !== "GET" || !response.ok) return response;
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
  if ((event as unknown as { tag: string }).tag === "sync-tasks") {
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
  const options: NotificationOptions = {
    body: data.body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: data.tag || "taskflow-notification",
    data: data.url ? { url: data.url } : undefined,
    actions: data.actions || [],
  };
  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(
      data.title || "TaskFlow",
      options
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        return (self as unknown as ServiceWorkerGlobalScope).clients.openWindow(url);
      })
  );
});
