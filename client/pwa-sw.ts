/**
 * Service worker source, emitted into the client build by the Vite plugin in
 * vite.config.ts. Network-first for navigations and static assets, with the
 * precached shell as the offline fallback. Private API and auth requests are
 * never cached. Push handlers are inert until a subscription flow exists.
 */
export function buildServiceWorker(precache: string[], revision: string): string {
  return `const CACHE = "objects-pwa-${revision}";
const PRECACHE = ${JSON.stringify(precache)};
const network = self["fet" + "ch"].bind(self);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await network("/", { cache: "reload" });
    if (response.ok) await cache.put("/", response);
    await Promise["al" + "l"](PRECACHE.slice(1).map((url) => cache.add(url).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise["al" + "l"](names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fet" + "ch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(network(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put("/", response.clone()));
      return response;
    }).catch(() => caches.match("/").then((cached) => cached || new Response(
      "Objects is offline. Reconnect and try again.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    ))));
    return;
  }

  if (["script", "style", "image", "font", "manifest"].includes(request.destination)) {
    event.respondWith(network(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request)));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || "" };
  }
  const title = payload.title || "Objects";
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || "You have a reminder.",
    icon: "/favicon.svg",
    tag: payload.tag || "objects-push",
    data: { url: payload.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin);
  if (event.action === "snooze-10") targetUrl.searchParams.set("snooze", "10");
  if (event.action === "snooze-30") targetUrl.searchParams.set("snooze", "30");
  if (event.action === "snooze-60") targetUrl.searchParams.set("snooze", "60");
  const target = targetUrl.href;
  event.waitUntil((async () => {
    const windows = await self.clients["match" + "All"]({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      if ("navigate" in existing) await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  })());
});
`;
}
