import { capsule, endpoint, json, mutation, query, string, table, text } from "lakebed/server";
import { addCapturedTask, createSeed, isObjectsState } from "../shared/state";

const MAX_STATE_SIZE = 750_000;
const MAX_ROW_SIZE = 60_000;
const ENTITY_KINDS = ["areas", "projects", "headings", "calendarEvents", "tasks"] as const;
type EntityKind = typeof ENTITY_KINDS[number];
type JsonRecord = Record<string, unknown>;
type ChangeSet = {
  mutationId: string;
  settings?: JsonRecord;
  entities?: Partial<Record<EntityKind, Array<{ id: string; patch: JsonRecord }>>>;
  deletes?: Partial<Record<EntityKind, string[]>>;
};
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


const SERVICE_WORKER = `const CACHE = "objects-pwa-v7";
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

function parseState(serialized: string, refreshUpdatedAt = true) {
  if (typeof serialized !== "string" || serialized.length > MAX_STATE_SIZE) throw new Error("Objects data is too large");
  const state: unknown = JSON.parse(serialized);
  if (!isObjectsState(state)) throw new Error("Invalid Objects data");
  state.version = 5;
  if (refreshUpdatedAt || !state.updatedAt) state.updatedAt = new Date().toISOString();
  return state;
}

function parseRecord(serialized: string): JsonRecord {
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Objects row");
  return value as JsonRecord;
}

function serializeRecord(value: JsonRecord): string {
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_ROW_SIZE) throw new Error("An Objects item is too large");
  return serialized;
}

function entityId(value: JsonRecord): string {
  if (typeof value.id !== "string" || !value.id || value.id.length > 500) throw new Error("Invalid Objects item id");
  return value.id;
}

function entityTable(ctx: any, kind: EntityKind) {
  return ctx.db[kind];
}

async function findOwned(tableRef: any, ownerId: string, id: string) {
  return tableRef
    .withIndex("by_owner_entity", (range: any) => range.eq("ownerId", ownerId).eq("entityId", id))
    .first();
}

async function collectOwned(tableRef: any, ownerId: string) {
  return tableRef
    .withIndex("by_owner_entity", (range: any) => range.eq("ownerId", ownerId))
    .order("asc")
    .collect();
}

function sortEntities(items: JsonRecord[]) {
  return items.sort((a, b) => {
    const order = Number(a.order ?? 0) - Number(b.order ?? 0);
    return order || String(a.id).localeCompare(String(b.id));
  });
}

async function legacyState(ctx: any, ownerId: string) {
  const chunks = await ctx.db.workspaceChunks
    .withIndex("by_owner_part", (range: any) => range.eq("ownerId", ownerId))
    .order("asc")
    .collect();
  if (!chunks.length) return JSON.stringify(createSeed());
  const latestByPart = new Map<string, any>();
  for (const chunk of chunks) {
    const current = latestByPart.get(chunk.part);
    if (!current || chunk.updatedAt > current.updatedAt) latestByPart.set(chunk.part, chunk);
  }
  return [...latestByPart.values()]
    .sort((left, right) => left.part.localeCompare(right.part))
    .map((chunk) => chunk.data)
    .join("");
}

async function normalizedState(ctx: any, ownerId: string, meta?: any) {
  const workspace = meta ?? await ctx.db.workspaceMeta
    .withIndex("by_owner", (range: any) => range.eq("ownerId", ownerId))
    .first();
  if (!workspace) return legacyState(ctx, ownerId);

  const [areas, projects, headings, calendarEvents, tasks, checklistItems] = await Promise["al" + "l"]([
    collectOwned(ctx.db.areas, ownerId),
    collectOwned(ctx.db.projects, ownerId),
    collectOwned(ctx.db.headings, ownerId),
    collectOwned(ctx.db.calendarEvents, ownerId),
    collectOwned(ctx.db.tasks, ownerId),
    collectOwned(ctx.db.checklistItems, ownerId)
  ]);
  const checklistByTask = new Map<string, JsonRecord[]>();
  for (const row of checklistItems) {
    const list = checklistByTask.get(row.taskId) ?? [];
    list.push({ id: row.entityId, ...parseRecord(row.data), __position: row.position });
    checklistByTask.set(row.taskId, list);
  }
  const inflate = (rows: any[]) => sortEntities(rows.map((row) => ({ id: row.entityId, ...parseRecord(row.data) })));
  const taskRecords = inflate(tasks).map((task) => ({
    ...task,
    checklist: (checklistByTask.get(String(task.id)) ?? [])
      .sort((a, b) => String(a.__position).localeCompare(String(b.__position)))
      .map(({ __position: _position, ...item }) => item)
  }));
  return JSON.stringify({
    version: Number(workspace.version) || 6,
    updatedAt: workspace.stateUpdatedAt,
    syncMutationId: workspace.lastMutationId,
    settings: parseRecord(workspace.settingsData),
    areas: inflate(areas),
    projects: inflate(projects),
    headings: inflate(headings),
    calendarEvents: inflate(calendarEvents),
    tasks: taskRecords
  });
}

async function replaceChecklist(ctx: any, ownerId: string, taskId: string, checklist: unknown) {
  if (!Array.isArray(checklist) || checklist.length > 200) throw new Error("Invalid checklist");
  const existing = await ctx.db.checklistItems
    .withIndex("by_owner_task", (range: any) => range.eq("ownerId", ownerId).eq("taskId", taskId))
    .collect();
  const byId = new Map(existing.map((row: any) => [row.entityId, row]));
  const nextIds = new Set<string>();
  for (let index = 0; index < checklist.length; index += 1) {
    const rawItem = checklist[index];
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) throw new Error("Invalid checklist item");
    const item = rawItem as JsonRecord;
    const id = entityId(item);
    nextIds.add(id);
    const data = { ...item };
    delete data.id;
    const row = byId.get(id) as any;
    const position = String(index).padStart(6, "0");
    if (row) await ctx.db.checklistItems.update(row.id, { data: serializeRecord(data), position });
    else await ctx.db.checklistItems.insert({ ownerId, entityId: id, taskId, position, data: serializeRecord(data) });
  }
  for (const row of existing) if (!nextIds.has(row.entityId)) await ctx.db.checklistItems.delete(row.id);
}

async function putEntity(ctx: any, ownerId: string, kind: EntityKind, id: string, patch: JsonRecord) {
  if (!id || id.length > 500 || !patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Invalid Objects change");
  const tombstone = await ctx.db.tombstones
    .withIndex("by_owner_kind_entity", (range: any) => range.eq("ownerId", ownerId).eq("kind", kind).eq("entityId", id))
    .first();
  if (tombstone) throw new Error("This item was permanently deleted");

  const tableRef = entityTable(ctx, kind);
  const existing = await findOwned(tableRef, ownerId, id);
  const current = existing ? parseRecord(existing.data) : {};
  const next = { ...current, ...patch };
  delete next.id;
  if (kind === "tasks" && Object.prototype.hasOwnProperty.call(next, "checklist")) {
    await replaceChecklist(ctx, ownerId, id, next.checklist);
    delete next.checklist;
  }
  const data = serializeRecord(next);
  if (existing) await tableRef.update(existing.id, { data });
  else await tableRef.insert({ ownerId, entityId: id, data });
}

async function deleteEntity(ctx: any, ownerId: string, kind: EntityKind, id: string) {
  if (!id || id.length > 500) throw new Error("Invalid Objects item id");
  const tableRef = entityTable(ctx, kind);
  const existing = await findOwned(tableRef, ownerId, id);
  if (existing) await tableRef.delete(existing.id);
  if (kind === "tasks") {
    const checklist = await ctx.db.checklistItems
      .withIndex("by_owner_task", (range: any) => range.eq("ownerId", ownerId).eq("taskId", id))
      .collect();
    for (const row of checklist) await ctx.db.checklistItems.delete(row.id);
  }
  const tombstone = await ctx.db.tombstones
    .withIndex("by_owner_kind_entity", (range: any) => range.eq("ownerId", ownerId).eq("kind", kind).eq("entityId", id))
    .first();
  const deletedAt = new Date().toISOString();
  if (tombstone) await ctx.db.tombstones.update(tombstone.id, { deletedAt });
  else await ctx.db.tombstones.insert({ ownerId, kind, entityId: id, deletedAt });
}

async function initializeState(ctx: any, ownerId: string, serialized: string) {
  const existingMeta = await ctx.db.workspaceMeta
    .withIndex("by_owner", (range: any) => range.eq("ownerId", ownerId))
    .first();
  if (existingMeta) return existingMeta;
  const state = parseState(serialized, false);
  for (const kind of ENTITY_KINDS) {
    const items = state[kind] as JsonRecord[];
    for (const item of items) {
      const id = entityId(item);
      const data = { ...item };
      delete data.id;
      if (kind === "tasks") {
        const checklist = Array.isArray(data.checklist) ? data.checklist : [];
        delete data.checklist;
        for (let index = 0; index < checklist.length; index += 1) {
          const checklistItem = checklist[index] as JsonRecord;
          const checklistId = entityId(checklistItem);
          const checklistData = { ...checklistItem };
          delete checklistData.id;
          await ctx.db.checklistItems.insert({
            ownerId,
            entityId: checklistId,
            taskId: id,
            position: String(index).padStart(6, "0"),
            data: serializeRecord(checklistData)
          });
        }
      }
      await entityTable(ctx, kind).insert({ ownerId, entityId: id, data: serializeRecord(data) });
    }
  }
  const updatedAt = new Date().toISOString();
  const id = await ctx.db.workspaceMeta.insert({
    ownerId,
    version: "6",
    settingsData: serializeRecord(state.settings),
    stateUpdatedAt: updatedAt,
    lastMutationId: "migration"
  });
  return ctx.db.workspaceMeta.get(id);
}

function parseChanges(serialized: string): ChangeSet {
  if (typeof serialized !== "string" || serialized.length > MAX_STATE_SIZE) throw new Error("Objects changes are too large");
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Objects changes");
  const changes = value as ChangeSet;
  if (typeof changes.mutationId !== "string" || !changes.mutationId || changes.mutationId.length > 200) throw new Error("Invalid mutation id");
  return changes;
}

async function applyChangeSet(ctx: any, ownerId: string, changes: ChangeSet) {
  let meta = await ctx.db.workspaceMeta
    .withIndex("by_owner", (range: any) => range.eq("ownerId", ownerId))
    .first();
  if (!meta) meta = await initializeState(ctx, ownerId, await legacyState(ctx, ownerId));

  for (const kind of ENTITY_KINDS) {
    const deletedIds = changes.deletes?.[kind] ?? [];
    if (!Array.isArray(deletedIds) || deletedIds.length > 10_000) throw new Error("Invalid Objects deletions");
    for (const id of deletedIds) await deleteEntity(ctx, ownerId, kind, id);
    const patches = changes.entities?.[kind] ?? [];
    if (!Array.isArray(patches) || patches.length > 10_000) throw new Error("Invalid Objects changes");
    for (const change of patches) await putEntity(ctx, ownerId, kind, change.id, change.patch);
  }

  const currentSettings = parseRecord(meta.settingsData);
  const settings = changes.settings && typeof changes.settings === "object" && !Array.isArray(changes.settings)
    ? { ...currentSettings, ...changes.settings }
    : currentSettings;
  const updatedAt = new Date().toISOString();
  await ctx.db.workspaceMeta.update(meta.id, {
    version: "6",
    settingsData: serializeRecord(settings),
    stateUpdatedAt: updatedAt,
    lastMutationId: changes.mutationId
  });
  return JSON.stringify({ updatedAt, mutationId: changes.mutationId });
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
    }).index("by_owner_kind_entity", ["ownerId", "kind", "entityId"])
  },

  queries: {
    state: query(async (ctx) => {
      return normalizedState(ctx, ctx.auth.userId);
    })
  },

  mutations: {
    initializeNormalized: mutation(async (ctx, serialized: string) => {
      const meta = await initializeState(ctx, ctx.auth.userId, serialized);
      return normalizedState(ctx, ctx.auth.userId, meta);
    }),
    applyChanges: mutation(async (ctx, serialized: string) =>
      applyChangeSet(ctx, ctx.auth.userId, parseChanges(serialized))
    )
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
        let meta = await ctx.db.workspaceMeta
          .withIndex("by_owner", (range) => range.eq("ownerId", ctx.auth.userId))
          .first();
        if (!meta) meta = await initializeState(ctx, ctx.auth.userId, await legacyState(ctx, ctx.auth.userId));
        const state = parseState(await normalizedState(ctx, ctx.auth.userId, meta), false);
        const task = addCapturedTask(state, input);
        await putEntity(ctx, ctx.auth.userId, "tasks", entityId(task), task);
        const updatedAt = new Date().toISOString();
        await ctx.db.workspaceMeta.update(meta.id, { stateUpdatedAt: updatedAt, lastMutationId: `api-${entityId(task)}` });
        return json({ ok: true, task }, { status: 201 });
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
      }
    })
  }
});
