/* eslint-disable no-restricted-globals */
var CACHE_NAME = "taskflow-v1";
var OFFLINE_URL = "/offline";

var PRECACHE_URLS = [
  "/",
];

// ─── Install ────────────────────────────────────────────────
self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ─── Activate ───────────────────────────────────────────────
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ─── Fetch (Stale-While-Revalidate) ────────────────────────
self.addEventListener("fetch", function(event) {
  var request = event.request;
  if (request.method !== "GET") return;
  if (!request.url.startsWith("http")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(request).then(function(cached) {
        var fetched = fetch(request)
          .then(function(response) {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(function() {
            return cached || new Response("Offline", { status: 503 });
          });
        return cached || fetched;
      });
    })
  );
});

// ─── Push Notifications ─────────────────────────────────────
self.addEventListener("push", function(event) {
  if (!event.data) return;
  var data = event.data.json();

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

self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  var url = event.notification.data && event.notification.data.url || "/";
  event.waitUntil(self.clients.matchAll({ type: "window" }).then(function(clients) {
    for (var i = 0; i < clients.length; i++) {
      if (clients[i].url === url && "focus" in clients[i]) return clients[i].focus();
    }
    return self.clients.openWindow(url);
  }));
});

// ─── Background Sync ────────────────────────────────────────
self.addEventListener("sync", function(event) {
  if (event.tag === "sync-tasks") {
    event.waitUntil(syncTasks());
  }
});

function syncTasks() {
  return self.clients.matchAll().then(function(clients) {
    for (var i = 0; i < clients.length; i++) {
      clients[i].postMessage({ type: "SYNC_COMPLETE" });
    }
  }).catch(function() {
    // Background sync failed — will retry on next sync event
  });
}

// ─── Message handler ────────────────────────────────────────
self.addEventListener("message", function(event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
