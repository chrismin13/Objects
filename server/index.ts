import { capsule, endpoint, json, mutation, query, string, table } from "lakebed/server";
import { addCapturedTask, createSeed, isObjectsState } from "../shared/state";

const CHUNK_SIZE = 48_000;
const MAX_STATE_SIZE = 750_000;

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
