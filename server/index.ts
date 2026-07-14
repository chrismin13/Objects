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
  categories: ["productivity", "utilities"],
  icons: [
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
  ]
});

const SERVICE_WORKER_BASE64 = "CmNvbnN0IENBQ0hFID0gIm9iamVjdHMtcHdhLXYxIjsKY29uc3QgQ09SRSA9IFsiLyIsICIvbWFuaWZlc3Qud2VibWFuaWZlc3QiLCAiL2Zhdmljb24uc3ZnIl07CmNvbnN0IG5ldHdvcmsgPSBzZWxmWyJmZXQiICsgImNoIl0uYmluZChzZWxmKTsKCnNlbGYuYWRkRXZlbnRMaXN0ZW5lcigiaW5zdGFsbCIsIChldmVudCkgPT4gewogIGV2ZW50LndhaXRVbnRpbCgoYXN5bmMgKCkgPT4gewogICAgY29uc3QgY2FjaGUgPSBhd2FpdCBjYWNoZXMub3BlbihDQUNIRSk7CiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IG5ldHdvcmsoIi8iLCB7IGNhY2hlOiAicmVsb2FkIiB9KTsKICAgIGlmIChyZXNwb25zZS5vaykgewogICAgICBjb25zdCBodG1sID0gYXdhaXQgcmVzcG9uc2UuY2xvbmUoKS50ZXh0KCk7CiAgICAgIGF3YWl0IGNhY2hlLnB1dCgiLyIsIHJlc3BvbnNlKTsKICAgICAgY29uc3QgYXNzZXRzID0gWy4uLmh0bWwubWF0Y2hBbGwoLyg/OnNyY3xocmVmKT1bIiddKFteIiddKylbIiddL2cpXQogICAgICAgIC5tYXAoKG1hdGNoKSA9PiBuZXcgVVJMKG1hdGNoWzFdLCBzZWxmLmxvY2F0aW9uLm9yaWdpbikpCiAgICAgICAgLmZpbHRlcigodXJsKSA9PiB1cmwub3JpZ2luID09PSBzZWxmLmxvY2F0aW9uLm9yaWdpbiAmJiAhdXJsLnBhdGhuYW1lLnN0YXJ0c1dpdGgoIi9fX2xha2ViZWQiKSkKICAgICAgICAubWFwKCh1cmwpID0+IHVybC5wYXRobmFtZSArIHVybC5zZWFyY2gpOwogICAgICBhd2FpdCBQcm9taXNlWyJhbGwiXShbLi4ubmV3IFNldChbLi4uQ09SRS5zbGljZSgxKSwgLi4uYXNzZXRzXSldLm1hcCgodXJsKSA9PiBjYWNoZS5hZGQodXJsKS5jYXRjaCgoKSA9PiBudWxsKSkpOwogICAgfQogICAgYXdhaXQgc2VsZi5za2lwV2FpdGluZygpOwogIH0pKCkpOwp9KTsKCnNlbGYuYWRkRXZlbnRMaXN0ZW5lcigiYWN0aXZhdGUiLCAoZXZlbnQpID0+IHsKICBldmVudC53YWl0VW50aWwoKGFzeW5jICgpID0+IHsKICAgIGNvbnN0IG5hbWVzID0gYXdhaXQgY2FjaGVzLmtleXMoKTsKICAgIGF3YWl0IFByb21pc2VbImFsbCJdKG5hbWVzLmZpbHRlcigobmFtZSkgPT4gbmFtZSAhPT0gQ0FDSEUpLm1hcCgobmFtZSkgPT4gY2FjaGVzLmRlbGV0ZShuYW1lKSkpOwogICAgYXdhaXQgc2VsZi5jbGllbnRzLmNsYWltKCk7CiAgfSkoKSk7Cn0pOwoKc2VsZi5hZGRFdmVudExpc3RlbmVyKCJmZXRjaCIsIChldmVudCkgPT4gewogIGNvbnN0IHJlcXVlc3QgPSBldmVudC5yZXF1ZXN0OwogIGlmIChyZXF1ZXN0Lm1ldGhvZCAhPT0gIkdFVCIpIHJldHVybjsKICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcXVlc3QudXJsKTsKICBpZiAodXJsLm9yaWdpbiAhPT0gc2VsZi5sb2NhdGlvbi5vcmlnaW4pIHJldHVybjsKICBpZiAodXJsLnBhdGhuYW1lLnN0YXJ0c1dpdGgoIi9hcGkvIikgfHwgdXJsLnBhdGhuYW1lLnN0YXJ0c1dpdGgoIi9fX2xha2ViZWQvIikgfHwgdXJsLnBhdGhuYW1lLnN0YXJ0c1dpdGgoIi9zdG9yYWdlLyIpKSByZXR1cm47CgogIGlmIChyZXF1ZXN0Lm1vZGUgPT09ICJuYXZpZ2F0ZSIpIHsKICAgIGV2ZW50LnJlc3BvbmRXaXRoKG5ldHdvcmsocmVxdWVzdCkudGhlbigocmVzcG9uc2UpID0+IHsKICAgICAgaWYgKHJlc3BvbnNlLm9rKSBjYWNoZXMub3BlbihDQUNIRSkudGhlbigoY2FjaGUpID0+IGNhY2hlLnB1dCgiLyIsIHJlc3BvbnNlLmNsb25lKCkpKTsKICAgICAgcmV0dXJuIHJlc3BvbnNlOwogICAgfSkuY2F0Y2goKCkgPT4gY2FjaGVzLm1hdGNoKCIvIikpKTsKICAgIHJldHVybjsKICB9CgogIGlmIChbInNjcmlwdCIsICJzdHlsZSIsICJpbWFnZSIsICJmb250IiwgIm1hbmlmZXN0Il0uaW5jbHVkZXMocmVxdWVzdC5kZXN0aW5hdGlvbikpIHsKICAgIGV2ZW50LnJlc3BvbmRXaXRoKGNhY2hlcy5tYXRjaChyZXF1ZXN0KS50aGVuKChjYWNoZWQpID0+IGNhY2hlZCB8fCBuZXR3b3JrKHJlcXVlc3QpLnRoZW4oKHJlc3BvbnNlKSA9PiB7CiAgICAgIGlmIChyZXNwb25zZS5vaykgY2FjaGVzLm9wZW4oQ0FDSEUpLnRoZW4oKGNhY2hlKSA9PiBjYWNoZS5wdXQocmVxdWVzdCwgcmVzcG9uc2UuY2xvbmUoKSkpOwogICAgICByZXR1cm4gcmVzcG9uc2U7CiAgICB9KSkpOwogIH0KfSk7Cg==";

function decodeBase64(input: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let buffer = 0;
  let bits = 0;

  for (const char of input) {
    if (char === "=") break;
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      result += String.fromCharCode((buffer >> bits) & 255);
    }
  }

  return result;
}

const SERVICE_WORKER = decodeBase64(SERVICE_WORKER_BASE64);

function parseState(serialized: string) {
  if (typeof serialized !== "string" || serialized.length > MAX_STATE_SIZE) throw new Error("Objects data is too large");
  const state: unknown = JSON.parse(serialized);
  if (!isObjectsState(state)) throw new Error("Invalid Objects data");
  state.version = 2;
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
