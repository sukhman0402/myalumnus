// My Alumnus service worker: shows admin alerts for held visitors (planning/02 D13, Q2).
// It caches nothing: every page still comes from the server, so nothing personal is stored by it.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "My Alumnus", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "My Alumnus";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    tag: data.tag || "ma-alert",
    renotify: true,
    requireInteraction: Boolean(data.requireInteraction),
    icon: "/icon-192.png",
    badge: "/badge-96.png", // white silhouette: Android draws the badge from its transparency only
    data: { url: data.url || "/admin" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/admin", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin)) { await w.focus(); return w.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});
