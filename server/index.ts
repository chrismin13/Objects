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

const SERVICE_WORKER_BASE64 = "Y29uc3QgQ0FDSEUgPSAib2JqZWN0cy1wd2EtdjMiOwpjb25zdCBDT1JFID0gWyIvIiwgIi9jbGllbnQuanMiLCAiL21hbmlmZXN0LndlYm1hbmlmZXN0IiwgIi9mYXZpY29uLnN2ZyJdOwpjb25zdCBuZXR3b3JrID0gc2VsZlsiZmV0IiArICJjaCJdLmJpbmQoc2VsZik7CgpzZWxmLmFkZEV2ZW50TGlzdGVuZXIoImluc3RhbGwiLCAoZXZlbnQpID0+IHsKICBldmVudC53YWl0VW50aWwoKGFzeW5jICgpID0+IHsKICAgIGNvbnN0IGNhY2hlID0gYXdhaXQgY2FjaGVzLm9wZW4oQ0FDSEUpOwogICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBuZXR3b3JrKCIvIiwgeyBjYWNoZTogInJlbG9hZCIgfSk7CiAgICBpZiAoIXJlc3BvbnNlLm9rKSByZXR1cm47CiAgICBjb25zdCBodG1sID0gYXdhaXQgcmVzcG9uc2UuY2xvbmUoKS50ZXh0KCk7CiAgICBhd2FpdCBjYWNoZS5wdXQoIi8iLCByZXNwb25zZSk7CiAgICBjb25zdCBhc3NldHMgPSBbLi4uaHRtbC5tYXRjaEFsbCgvKD86c3JjfGhyZWYpPVsiJ10oW14iJ10rKVsiJ10vZyldCiAgICAgIC5tYXAoKG1hdGNoKSA9PiBuZXcgVVJMKG1hdGNoWzFdLCBzZWxmLmxvY2F0aW9uLm9yaWdpbikpCiAgICAgIC5maWx0ZXIoKHVybCkgPT4gdXJsLm9yaWdpbiA9PT0gc2VsZi5sb2NhdGlvbi5vcmlnaW4gJiYgKHVybC5wYXRobmFtZSA9PT0gIi9jbGllbnQuanMiIHx8IHVybC5wYXRobmFtZS5zdGFydHNXaXRoKCIvX19fbGFrZWJlZCIpKSkKICAgICAgLm1hcCgodXJsKSA9PiB1cmwucGF0aG5hbWUgKyB1cmwuc2VhcmNoKTsKICAgIGF3YWl0IFByb21pc2UuYWxsKFsuLi5uZXcgU2V0KFsuLi5DT1JFLnNsaWNlKDEpLCAuLi5hc3NldHNdKV0ubWFwKCh1cmwpID0+IGNhY2hlLmFkZCh1cmwpLmNhdGNoKCgpID0+IG51bGwpKSk7CiAgICBhd2FpdCBzZWxmLnNraXBXYWl0aW5nKCk7IC8vIE1pZ3JhdGUgY2xpZW50cyBmcm9tIHRoZSBvcmlnaW5hbCBjYWNoZS1maXJzdCB3b3JrZXIuCiAgfSkoKSk7Cn0pOwoKc2VsZi5hZGRFdmVudExpc3RlbmVyKCJhY3RpdmF0ZSIsIChldmVudCkgPT4gewogIGV2ZW50LndhaXRVbnRpbCgoYXN5bmMgKCkgPT4gewogICAgY29uc3QgbmFtZXMgPSBhd2FpdCBjYWNoZXMua2V5cygpOwogICAgYXdhaXQgUHJvbWlzZS5hbGwobmFtZXMuZmlsdGVyKChuYW1lKSA9PiBuYW1lICE9PSBDQUNIRSkubWFwKChuYW1lKSA9PiBjYWNoZXMuZGVsZXRlKG5hbWUpKSk7CiAgICBhd2FpdCBzZWxmLmNsaWVudHMuY2xhaW0oKTsKICB9KSgpKTsKfSk7CgpzZWxmLmFkZEV2ZW50TGlzdGVuZXIoIm1lc3NhZ2UiLCAoZXZlbnQpID0+IHsKICBpZiAoZXZlbnQuZGF0YT8udHlwZSA9PT0gIlNLSVBfV0FJVElORyIpIHNlbGYuc2tpcFdhaXRpbmcoKTsKfSk7CgpzZWxmLmFkZEV2ZW50TGlzdGVuZXIoImZldGNoIiwgKGV2ZW50KSA9PiB7CiAgY29uc3QgcmVxdWVzdCA9IGV2ZW50LnJlcXVlc3Q7CiAgaWYgKHJlcXVlc3QubWV0aG9kICE9PSAiR0VUIikgcmV0dXJuOwogIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxdWVzdC51cmwpOwogIGlmICh1cmwub3JpZ2luICE9PSBzZWxmLmxvY2F0aW9uLm9yaWdpbikgcmV0dXJuOwogIGlmICgKICAgIHVybC5wYXRobmFtZS5zdGFydHNXaXRoKCIvYXBpLyIpCiAgICB8fCAodXJsLnBhdGhuYW1lLnN0YXJ0c1dpdGgoIi9fX19sYWtlYmVkLyIpICYmICFbInNjcmlwdCIsICJzdHlsZSIsICJpbWFnZSIsICJmb250Il0uaW5jbHVkZXMocmVxdWVzdC5kZXN0aW5hdGlvbikpCiAgICB8fCB1cmwucGF0aG5hbWUuc3RhcnRzV2l0aCgiL3N0b3JhZ2UvIikKICApIHJldHVybjsKCiAgaWYgKHJlcXVlc3QubW9kZSA9PT0gIm5hdmlnYXRlIikgewogICAgZXZlbnQucmVzcG9uZFdpdGgobmV0d29yayhyZXF1ZXN0KS50aGVuKChyZXNwb25zZSkgPT4gewogICAgICBpZiAocmVzcG9uc2Uub2spIGNhY2hlcy5vcGVuKENBQ0hFKS50aGVuKChjYWNoZSkgPT4gY2FjaGUucHV0KCIvIiwgcmVzcG9uc2UuY2xvbmUoKSkpOwogICAgICByZXR1cm4gcmVzcG9uc2U7CiAgICB9KS5jYXRjaCgoKSA9PiBjYWNoZXMubWF0Y2goIi8iKS50aGVuKChjYWNoZWQpID0+IGNhY2hlZCB8fCBuZXcgUmVzcG9uc2UoCiAgICAgICJPYmplY3RzIGlzIG9mZmxpbmUuIFJlY29ubmVjdCBhbmQgdHJ5IGFnYWluLiIsCiAgICAgIHsgc3RhdHVzOiA1MDMsIGhlYWRlcnM6IHsgIkNvbnRlbnQtVHlwZSI6ICJ0ZXh0L3BsYWluOyBjaGFyc2V0PXV0Zi04IiB9IH0sCiAgICApKSkpOwogICAgcmV0dXJuOwogIH0KCiAgaWYgKFsic2NyaXB0IiwgInN0eWxlIiwgImltYWdlIiwgImZvbnQiLCAibWFuaWZlc3QiXS5pbmNsdWRlcyhyZXF1ZXN0LmRlc3RpbmF0aW9uKSkgewogICAgZXZlbnQucmVzcG9uZFdpdGgoY2FjaGVzLm1hdGNoKHJlcXVlc3QpLnRoZW4oKGNhY2hlZCkgPT4gY2FjaGVkIHx8IG5ldHdvcmsocmVxdWVzdCkudGhlbigocmVzcG9uc2UpID0+IHsKICAgICAgaWYgKHJlc3BvbnNlLm9rKSBjYWNoZXMub3BlbihDQUNIRSkudGhlbigoY2FjaGUpID0+IGNhY2hlLnB1dChyZXF1ZXN0LCByZXNwb25zZS5jbG9uZSgpKSk7CiAgICAgIHJldHVybiByZXNwb25zZTsKICAgIH0pKSk7CiAgfQp9KTsKCnNlbGYuYWRkRXZlbnRMaXN0ZW5lcigicHVzaCIsIChldmVudCkgPT4gewogIGxldCBwYXlsb2FkID0ge307CiAgdHJ5IHsKICAgIHBheWxvYWQgPSBldmVudC5kYXRhPy5qc29uKCkgfHwge307CiAgfSBjYXRjaCB7CiAgICBwYXlsb2FkID0geyBib2R5OiBldmVudC5kYXRhPy50ZXh0KCkgfHwgIiIgfTsKICB9CiAgY29uc3QgdGl0bGUgPSBwYXlsb2FkLnRpdGxlIHx8ICJPYmplY3RzIjsKICBldmVudC53YWl0VW50aWwoc2VsZi5yZWdpc3RyYXRpb24uc2hvd05vdGlmaWNhdGlvbih0aXRsZSwgewogICAgYm9keTogcGF5bG9hZC5ib2R5IHx8ICJZb3UgaGF2ZSBhIHJlbWluZGVyLiIsCiAgICBpY29uOiAiL2Zhdmljb24uc3ZnIiwKICAgIHRhZzogcGF5bG9hZC50YWcgfHwgIm9iamVjdHMtcHVzaCIsCiAgICBkYXRhOiB7IHVybDogcGF5bG9hZC51cmwgfHwgIi8iIH0sCiAgfSkpOwp9KTsKCnNlbGYuYWRkRXZlbnRMaXN0ZW5lcigibm90aWZpY2F0aW9uY2xpY2siLCAoZXZlbnQpID0+IHsKICBldmVudC5ub3RpZmljYXRpb24uY2xvc2UoKTsKICBjb25zdCB0YXJnZXQgPSBuZXcgVVJMKGV2ZW50Lm5vdGlmaWNhdGlvbi5kYXRhPy51cmwgfHwgIi8iLCBzZWxmLmxvY2F0aW9uLm9yaWdpbikuaHJlZjsKICBldmVudC53YWl0VW50aWwoKGFzeW5jICgpID0+IHsKICAgIGNvbnN0IHdpbmRvd3MgPSBhd2FpdCBzZWxmLmNsaWVudHMubWF0Y2hBbGwoeyB0eXBlOiAid2luZG93IiwgaW5jbHVkZVVuY29udHJvbGxlZDogdHJ1ZSB9KTsKICAgIGNvbnN0IGV4aXN0aW5nID0gd2luZG93cy5maW5kKChjbGllbnQpID0+IG5ldyBVUkwoY2xpZW50LnVybCkub3JpZ2luID09PSBzZWxmLmxvY2F0aW9uLm9yaWdpbik7CiAgICBpZiAoZXhpc3RpbmcpIHsKICAgICAgaWYgKCJuYXZpZ2F0ZSIgaW4gZXhpc3RpbmcpIGF3YWl0IGV4aXN0aW5nLm5hdmlnYXRlKHRhcmdldCk7CiAgICAgIHJldHVybiBleGlzdGluZy5mb2N1cygpOwogICAgfQogICAgcmV0dXJuIHNlbGYuY2xpZW50cy5vcGVuV2luZG93KHRhcmdldCk7CiAgfSkoKSk7Cn0pOwo=";

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
  state.version = 3;
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
