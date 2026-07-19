import { capsule, endpoint, json, mutation, query, string, table, text } from "lakebed/server";
import {
  resolveSyncCommand,
  type WorkspaceSyncCommand,
  type WorkspaceSyncSnapshot,
} from "../shared/replacement/sync";
import { dateInTimeZone } from "../shared/replacement/dates";
import { captureIntoSnapshot } from "../shared/replacement/http-capture";
import { createEmptyWorkspace } from "../shared/replacement/workspace";

const MAX_REPLACEMENT_WORKSPACE_SIZE = 2_000_000;
const REPLACEMENT_CHUNK_SIZE = 50_000;
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


const SERVICE_WORKER = `const CACHE = "objects-pwa-v9";
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

function replacementOwner(ctx: any): string {
  if (!ctx.auth.userId) throw new Error("Authentication required");
  return ctx.auth.userId;
}

function parseReplacementCommand(serialized: string): WorkspaceSyncCommand {
  if (typeof serialized !== "string" || serialized.length > MAX_REPLACEMENT_WORKSPACE_SIZE) {
    throw new Error("Replacement Workspace data is too large");
  }
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid replacement Workspace change");
  return value as WorkspaceSyncCommand;
}

async function replacementSnapshot(ctx: any, ownerId: string): Promise<WorkspaceSyncSnapshot | null> {
  const meta = await ctx.db.replacementWorkspaceMeta
    .withIndex("by_owner", (range: any) => range.eq("ownerId", ownerId))
    .first();
  if (!meta) return null;
  const chunks = await ctx.db.replacementWorkspaceChunks
    .withIndex("by_owner_part", (range: any) => range.eq("ownerId", ownerId))
    .order("asc")
    .collect();
  const document = chunks
    .sort((left: any, right: any) => left.part.localeCompare(right.part))
    .map((chunk: any) => chunk.data)
    .join("");
  return { revision: Number(meta.revision), document: JSON.parse(document) } as WorkspaceSyncSnapshot;
}

async function writeReplacementSnapshot(ctx: any, ownerId: string, snapshot: WorkspaceSyncSnapshot): Promise<void> {
  const existingMeta = await ctx.db.replacementWorkspaceMeta
    .withIndex("by_owner", (range: any) => range.eq("ownerId", ownerId))
    .first();
  const existingChunks = await ctx.db.replacementWorkspaceChunks
    .withIndex("by_owner_part", (range: any) => range.eq("ownerId", ownerId))
    .order("asc")
    .collect();
  const document = JSON.stringify(snapshot.document);
  if (document.length > MAX_REPLACEMENT_WORKSPACE_SIZE) throw new Error("Replacement Workspace data is too large");
  const chunks: string[] = [];
  for (let start = 0; start < document.length; start += REPLACEMENT_CHUNK_SIZE) chunks.push(document.slice(start, start + REPLACEMENT_CHUNK_SIZE));
  for (let index = 0; index < chunks.length; index += 1) {
    const part = String(index).padStart(6, "0");
    const existing = existingChunks.find((chunk: any) => chunk.part === part);
    if (existing) await ctx.db.replacementWorkspaceChunks.update(existing.id, { data: chunks[index] });
    else await ctx.db.replacementWorkspaceChunks.insert({ ownerId, part, data: chunks[index] });
  }
  for (const existing of existingChunks) if (Number(existing.part) >= chunks.length) await ctx.db.replacementWorkspaceChunks.delete(existing.id);
  const meta = {
    ownerId,
    revision: String(snapshot.revision),
    mutationId: snapshot.document.sync.lastMutationId ?? "",
    syncUpdatedAt: snapshot.document.sync.updatedAt,
    partCount: String(chunks.length),
  };
  if (existingMeta) await ctx.db.replacementWorkspaceMeta.update(existingMeta.id, meta);
  else await ctx.db.replacementWorkspaceMeta.insert(meta);
}

function newServerWorkspace(now: string) {
  const document = createEmptyWorkspace(now);
  const spaceId = `space-${now}-${Math.random().toString(36).slice(2, 10)}`;
  document.spaces.push({ id: spaceId, title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = spaceId;
  return document;
}

export default capsule({
  name: "objects",
  favicon: "favicon.svg",

  schema: {
    workspaceChunks: table({
      ownerId: string(),
      part: string(),
      data: string()
    }).index("by_owner_part", ["ownerId", "part"]),
    workspaceMeta: table({
      ownerId: string(),
      version: string(),
      settingsData: string(),
      stateUpdatedAt: string(),
      lastMutationId: string()
    }).index("by_owner", ["ownerId"]),
    spaces: table({ ownerId: string(), entityId: string(), data: string() }).index("by_owner_entity", ["ownerId", "entityId"]),
    areas: table({ ownerId: string(), entityId: string(), data: string() }).index("by_owner_entity", ["ownerId", "entityId"]),
    projects: table({ ownerId: string(), entityId: string(), data: string() }).index("by_owner_entity", ["ownerId", "entityId"]),
    headings: table({ ownerId: string(), entityId: string(), data: string() }).index("by_owner_entity", ["ownerId", "entityId"]),
    calendarEvents: table({ ownerId: string(), entityId: string(), data: string() }).index("by_owner_entity", ["ownerId", "entityId"]),
    tasks: table({ ownerId: string(), entityId: string(), data: string() }).index("by_owner_entity", ["ownerId", "entityId"]),
    checklistItems: table({
      ownerId: string(),
      entityId: string(),
      taskId: string(),
      position: string(),
      data: string()
    })
      .index("by_owner_entity", ["ownerId", "entityId"])
      .index("by_owner_task", ["ownerId", "taskId"]),
    tombstones: table({
      ownerId: string(),
      kind: string(),
      entityId: string(),
      deletedAt: string()
    }).index("by_owner_kind_entity", ["ownerId", "kind", "entityId"]),
    replacementWorkspaceMeta: table({
      ownerId: string(),
      revision: string(),
      mutationId: string(),
      syncUpdatedAt: string(),
      partCount: string()
    }).index("by_owner", ["ownerId"]),
    replacementWorkspaceChunks: table({
      ownerId: string(),
      part: string(),
      data: string()
    }).index("by_owner_part", ["ownerId", "part"])
  },

  queries: {
    replacementWorkspace: query(async (ctx) => {
      const ownerId = replacementOwner(ctx);
      const snapshot = await replacementSnapshot(ctx, ownerId);
      return snapshot ? JSON.stringify(snapshot) : null;
    }),
    replacementOwnerIdentity: query((ctx) => replacementOwner(ctx))
  },

  mutations: {
    saveReplacementWorkspace: mutation(async (ctx, serialized: string) => {
      const ownerId = replacementOwner(ctx);
      const current = await replacementSnapshot(ctx, ownerId);
      const resolved = resolveSyncCommand(current, parseReplacementCommand(serialized), new Date().toISOString());
      if (resolved.next) await writeReplacementSnapshot(ctx, ownerId, resolved.next);
      return JSON.stringify(resolved.result);
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
        const ownerId = replacementOwner(ctx);
        const input = await req.json<Record<string, unknown>>();
        const headerIdentity = req.headers.get("idempotency-key");
        if (!input.submissionId && headerIdentity) input.submissionId = headerIdentity;
        const now = new Date().toISOString();
        const requestedTimeZone = input.timeZone ?? req.headers.get("x-time-zone") ?? "UTC";
        if (typeof requestedTimeZone !== "string") return json({ ok: false, errors: ["timeZone must be an IANA time-zone name."] }, { status: 400 });
        let today: string;
        try {
          today = dateInTimeZone(new Date(now), requestedTimeZone);
        } catch {
          return json({ ok: false, errors: ["timeZone must be an IANA time-zone name such as Europe/Athens."] }, { status: 400 });
        }
        const current = await replacementSnapshot(ctx, ownerId);
        const initial = current?.document ?? newServerWorkspace(now);
        let sequence = 0;
        const captured = captureIntoSnapshot(current, initial, input, {
          now,
          today,
          createId: (kind) => `${kind}-${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2, 8)}`,
        });
        if (captured.status === "conflict") return json({ ok: false, error: "The Workspace changed. Retry this same submission." }, { status: 409 });
        if (captured.status === "invalid") return json({ ok: false, errors: captured.errors }, { status: 400 });
        if (captured.next) await writeReplacementSnapshot(ctx, ownerId, captured.next);
        return json({ ok: true, duplicate: captured.status === "duplicate", toDo: captured.toDo }, { status: captured.status === "duplicate" ? 200 : 201 });
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
      }
    })
  }
});
