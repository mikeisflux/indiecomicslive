const CACHE = "icl-shell-v2";
const SHELL = ["/", "/offline"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/ws")) return;
  if (url.pathname.startsWith("/s/") || url.pathname.startsWith("/admin"))
    return;

  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then((r) => r || caches.match("/offline")),
    ),
  );
});

// Web Push handler. We send empty-bodied pushes; this fetches the
// latest unread notification from the server and renders it. Falls
// back to a generic message if the fetch fails (e.g. session expired).
self.addEventListener("push", (e) => {
  e.waitUntil(
    (async () => {
      let title = "Indie Comics Live";
      let body = "You have new activity.";
      let url = "/account/notifications";

      try {
        const r = await fetch("/api/push/latest", { credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          if (data.notification) {
            title = data.notification.title || title;
            body = data.notification.body || body;
            url = data.notification.url || url;
          }
        }
      } catch {
        /* swallow */
      }

      // If the payload was sent inline (rare path / future-proof) prefer it.
      if (e.data) {
        try {
          const inline = e.data.json();
          title = inline.title || title;
          body = inline.body || body;
          url = inline.url || url;
        } catch {
          /* swallow */
        }
      }

      await self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url },
        vibrate: [80, 30, 80],
      });
    })(),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of list) {
        if ("focus" in c && c.url.includes(url)) {
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
