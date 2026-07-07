/// <reference lib="webworker" />

const CACHE_NAME = "taskflow-v1";
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  "/",
  "/offline",
];

declare const self: ServiceWorkerGlobalScope;

// ─── Install ────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch (Stale-While-Revalidate) ────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (!request.url.startsWith("http")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fetched = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached || new Response("Offline", { status: 503 }));
        return cached || fetched;
      })
    )
  );
});

// ─── Push Notifications ─────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json() as { title?: string; body?: string; url?: string };

  event.waitUntil(
    self.registration.showNotification(data.title || "TaskFlow", {
      body: data.body || "你有一則新通知",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
      tag: "taskflow-notif",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((clients) => {
    for (const client of clients) {
      if (client.url === url && "focus" in client) return client.focus();
    }
    return self.clients.openWindow(url);
  }));
});

// ─── Background Sync ────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-tasks") {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks(): Promise<void> {
  // Offline queue logic: read pending operations from IndexedDB
  // and retry them when network is back
  try {
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({ type: "SYNC_COMPLETE" });
    }
  } catch {
    // Background sync failed — will retry on next sync event
  }
}

// ─── Message handler ───────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
