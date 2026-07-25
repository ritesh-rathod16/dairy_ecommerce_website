// Minimal service worker: caches the app shell so the storefront still
// loads (with cached data) when the connection drops. API calls always
// go to the network — we don't want to serve stale product/order data.
const CACHE_NAME = "katlkar-dairy-v1";
const APP_SHELL = ["/", "/manifest.json", "/icon-192.svg", "/icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — always hit the network for fresh data.
  if (url.pathname.startsWith("/api")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        }).catch(() => cached)
      );
    })
  );
});

// ---- Web Push ----
// The backend sends {"title", "body", "url"} as the push payload (see
// backend/app/services/push.py). This just shows the notification and
// remembers which URL to open on click.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Katlkar Dairy", body: event.data.text() };
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title || "Katlkar Dairy", {
        body: payload.body || "",
        icon: "/icon-192.svg",
        badge: "/icon-192.svg",
        data: { url: payload.url || "/" },
        tag: payload.url || undefined, // same-order notifications replace each other instead of stacking
      }),
      self.clients.matchAll({ type: "window" }).then((clientList) => {
        clientList.forEach((c) => c.postMessage({ type: "push-received", payload }));
      }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Focus an already-open tab and navigate it, rather than opening a new one.
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl);
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
