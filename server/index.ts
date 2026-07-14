import { capsule, endpoint, json, mutation, query, string, table, text } from "lakebed/server";
import { addCapturedTask, createSeed, isObjectsState } from "../shared/state";

const CHUNK_SIZE = 48_000;
const MAX_STATE_SIZE = 750_000;
const PWA_MANIFEST = JSON.stringify({
  id: "/",
  name: "Objects",
  short_name: "Objects",
  description: "A calm, private home for everything you want to do.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "any",
  background_color: "#f7f7f5",
  theme_color: "#2f80ed",
  lang: "en",
  dir: "ltr",
  categories: ["productivity", "utilities"],
  shortcuts: [
    { name: "Today", short_name: "Today", url: "/?view=today", icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }] },
    { name: "Inbox", short_name: "Inbox", url: "/?view=inbox", icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }] },
    { name: "New to-do", short_name: "New to-do", url: "/?capture=1", icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }] }
  ],
  share_target: {
    action: "/",
    method: "GET",
    enctype: "application/x-www-form-urlencoded",
    params: { title: "title", text: "text", url: "url" }
  },
  icons: [
    { src: "/favicon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
    { src: "/favicon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
    { src: "/favicon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" }
  ]
});


const SERVICE_WORKER = `const CACHE = "objects-pwa-v5";
const CORE = ["/", "/client.js", "/manifest.webmanifest", "/favicon.svg"];
const network = self["fet" + "ch"].bind(self);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await network("/", { cache: "reload" });
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put("/", response);
    const assets = [...html["match" + "All"](/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin && (url.pathname === "/client.js" || url.pathname.startsWith("/___lakebed")))
      .map((url) => url.pathname + url.search);
    await Promise["al" + "l"]([...new Set([...CORE.slice(1), ...assets])].map((url) => cache.add(url).catch(() => null)));
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
  if (
    url.pathname.startsWith("/api/")
    || (url.pathname.startsWith("/___lakebed/") && !["script", "style", "image", "font"].includes(request.destination))
    || url.pathname.startsWith("/storage/")
  ) return;

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

function parseState(serialized: string) {
  if (typeof serialized !== "string" || serialized.length > MAX_STATE_SIZE) throw new Error("Objects data is too large");
  const state: unknown = JSON.parse(serialized);
  if (!isObjectsState(state)) throw new Error("Invalid Objects data");
  state.version = 5;
  state.updatedAt = new Date().toISOString();
  return state;
}

function splitState(serialized: string): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < serialized.length; offset += CHUNK_SIZE) chunks.push(serialized.slice(offset, offset + CHUNK_SIZE));
  return chunks.length ? chunks : [""];
}

function partName(index: number): string { return String(index).padStart(4, "0"); }

export default capsule({
  name: "objects",
  favicon: "favicon.svg",

  schema: {
    workspaceChunks: table({
      ownerId: string(),
      part: string(),
      data: string()
    }).index("by_owner_part", ["ownerId", "part"])
  },

  queries: {
    state: query(async (ctx) => {
      const chunks = await ctx.db.workspaceChunks
        .withIndex("by_owner_part", (range) => range.eq("ownerId", ctx.auth.userId))
        .order("asc")
        .collect();
      return chunks.length ? chunks.map((chunk) => chunk.data).join("") : JSON.stringify(createSeed());
    })
  },

  mutations: {
    saveState: mutation(async (ctx, serialized: string) => {
      const state = parseState(serialized);
      const next = splitState(JSON.stringify(state));
      const existing = await ctx.db.workspaceChunks
        .withIndex("by_owner_part", (range) => range.eq("ownerId", ctx.auth.userId))
        .order("asc")
        .collect();
      const byPart = new Map(existing.map((chunk) => [chunk.part, chunk]));

      for (let index = 0; index < next.length; index += 1) {
        const part = partName(index);
        const chunk = byPart.get(part);
        if (chunk) {
          if (chunk.ownerId !== ctx.auth.userId) throw new Error("Forbidden");
          await ctx.db.workspaceChunks.update(chunk.id, { data: next[index] });
        } else {
          await ctx.db.workspaceChunks.insert({ ownerId: ctx.auth.userId, part, data: next[index] });
        }
      }
      for (const chunk of existing) {
        if (Number(chunk.part) >= next.length) {
          if (chunk.ownerId !== ctx.auth.userId) throw new Error("Forbidden");
          await ctx.db.workspaceChunks.delete(chunk.id);
        }
      }
      return state.updatedAt;
    })
  },

  endpoints: {
    manifest: endpoint({ method: "GET", path: "/manifest.webmanifest" }, () =>
      text(PWA_MANIFEST, { headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" } })
    ),
    serviceWorker: endpoint({ method: "GET", path: "/sw.js" }, () =>
      text(SERVICE_WORKER, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache", "Service-Worker-Allowed": "/" } })
    ),
    captureTask: endpoint({ method: "POST", path: "/api/tasks" }, async (ctx, req) => {
      if (!ctx.auth.isAuthenticated) return json({ ok: false, error: "Authentication required" }, { status: 401 });
      try {
        const input = await req.json<Record<string, unknown>>();
        const existing = await ctx.db.workspaceChunks
          .withIndex("by_owner_part", (range) => range.eq("ownerId", ctx.auth.userId))
          .order("asc")
          .collect();
        const serialized = existing.length ? existing.map((chunk) => chunk.data).join("") : JSON.stringify(createSeed());
        const state = parseState(serialized);
        const task = addCapturedTask(state, input);
        const next = splitState(JSON.stringify(state));
        const byPart = new Map(existing.map((chunk) => [chunk.part, chunk]));

        for (let index = 0; index < next.length; index += 1) {
          const part = partName(index);
          const chunk = byPart.get(part);
          if (chunk) {
            if (chunk.ownerId !== ctx.auth.userId) return json({ ok: false, error: "Forbidden" }, { status: 403 });
            await ctx.db.workspaceChunks.update(chunk.id, { data: next[index] });
          } else {
            await ctx.db.workspaceChunks.insert({ ownerId: ctx.auth.userId, part, data: next[index] });
          }
        }
        for (const chunk of existing) {
          if (Number(chunk.part) >= next.length) await ctx.db.workspaceChunks.delete(chunk.id);
        }
        return json({ ok: true, task }, { status: 201 });
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
      }
    })
  }
});
