import { DurableObject } from "cloudflare:workers";

import {
  resolveSyncCommand,
  type WorkspaceSyncCommand,
  type WorkspaceSyncConflict,
  type WorkspaceSyncSnapshot,
} from "../shared/workspace/sync.ts";
import { captureIntoSnapshot, selectCaptureBase } from "../shared/workspace/http-capture.ts";
import { createEmptyWorkspace } from "../shared/workspace/workspace.ts";
import { dateInTimeZone } from "../shared/workspace/dates.ts";
import type { WorkspaceDocument } from "../shared/workspace/model.ts";
import { applyCalDavChanges } from "../shared/workspace/caldav/apply.ts";
import {
  handleCalDavRequest,
  type CalDavEffects,
  type CalDavHttpRequest,
} from "../shared/workspace/caldav/protocol.ts";
import type { CalDavAnchor, CalDavTombstone } from "../shared/workspace/caldav/adapter.ts";
import type { CalDavTokenRecord } from "./caldav.ts";

const MAX_WORKSPACE_SIZE = 2_000_000;
const MAX_COMMAND_SIZE = 5_000_000;
const CHUNK_SIZE = 50_000;
const LAST_USED_THROTTLE_MS = 3_600_000;

type CaptureOutcome =
  | {
      status: number;
      body: { ok: true; duplicate: boolean; toDo: WorkspaceDocument["toDos"][number] | undefined };
    }
  | { status: number; body: { ok: false; error: string } }
  | { status: number; body: { ok: false; errors: string[] } };

function newServerWorkspace(now: string): WorkspaceDocument {
  const document = createEmptyWorkspace(now);
  const spaceId = `space-${now}-${Math.random().toString(36).slice(2, 10)}`;
  document.spaces.push({
    id: spaceId,
    title: "Personal",
    color: "#e49b3c",
    pinned: true,
    order: 0,
  });
  document.settings.defaultSpaceId = spaceId;
  return document;
}

/**
 * One Durable Object per owner. The object is single-threaded, so each
 * read-resolve-write sequence is serialized by the runtime, and
 * transactionSync makes every mutation atomic. Saves follow the revisioned,
 * idempotent sync contract in shared/workspace/sync.ts.
 */
export class WorkspaceDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
      );
      ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS chunks (part TEXT PRIMARY KEY, data TEXT NOT NULL)`,
      );
      ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS receipts (
          mutation_id TEXT PRIMARY KEY,
          conflicts TEXT NOT NULL
        )`,
      );
      ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS caldav_tokens (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          hash TEXT NOT NULL,
          time_zone TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_used_at TEXT
        )`,
      );
      ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS caldav_anchors (
          resource TEXT PRIMARY KEY,
          to_do_id TEXT NOT NULL,
          list TEXT NOT NULL,
          served TEXT NOT NULL
        )`,
      );
      ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS caldav_tombstones (
          resource TEXT PRIMARY KEY,
          revision INTEGER NOT NULL
        )`,
      );
      ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS caldav_token_index (
          hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL
        )`,
      );
    });
  }

  load(): WorkspaceSyncSnapshot | null {
    return this.readSnapshot();
  }

  save(serializedCommand: string): string {
    const command = this.parseCommand(serializedCommand);
    return this.ctx.storage.transactionSync(() => {
      const current = this.readSnapshot();
      if (current) {
        const receipt = this.ctx.storage.sql
          .exec(`SELECT conflicts FROM receipts WHERE mutation_id = ?`, command.mutationId)
          .toArray();
        if (receipt.length) {
          return JSON.stringify({
            status: "acknowledged",
            mutationId: command.mutationId,
            revision: current.revision,
            snapshot: current,
            conflicts: JSON.parse(receipt[0].conflicts as string) as WorkspaceSyncConflict[],
          });
        }
      }
      const resolved = resolveSyncCommand(current, command, new Date().toISOString());
      if (resolved.next) {
        this.writeSnapshot(resolved.next);
        this.writeReceipt(
          command.mutationId,
          resolved.result.status === "acknowledged" ? resolved.result.conflicts : [],
        );
      }
      return JSON.stringify(resolved.result);
    });
  }

  capture(input: Record<string, unknown>, timeZone: string): CaptureOutcome {
    const now = new Date().toISOString();
    let today: string;
    try {
      today = dateInTimeZone(new Date(now), timeZone);
    } catch {
      return {
        status: 400,
        body: { ok: false, errors: ["timeZone must be an IANA time-zone name."] },
      };
    }
    return this.ctx.storage.transactionSync(() => {
      const current = this.readSnapshot();
      const base = selectCaptureBase(current, null, () => newServerWorkspace(now));
      let sequence = 0;
      const captured = captureIntoSnapshot(base.current, base.initial, input, {
        now,
        today,
        createId: (kind) =>
          `${kind}-${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2, 8)}`,
      });
      if (captured.status === "conflict") {
        return {
          status: 409,
          body: { ok: false, error: "The Workspace changed. Retry this same submission." },
        };
      }
      if (captured.status === "invalid") {
        return { status: 400, body: { ok: false, errors: captured.errors } };
      }
      if (captured.next) this.writeSnapshot(captured.next);
      return {
        status: captured.status === "duplicate" ? 200 : 201,
        body: { ok: true, duplicate: captured.status === "duplicate", toDo: captured.toDo },
      };
    });
  }

  // ── CalDAV (iOS Reminders sync) ───────────────────────────────────────

  private calDavDeps(now: string) {
    let sequence = 0;
    return {
      now: () => now,
      createId: (kind: string) =>
        `${kind}-${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  private readAnchors(): CalDavAnchor[] {
    return this.ctx.storage.sql
      .exec(`SELECT resource, to_do_id, list, served FROM caldav_anchors`)
      .toArray()
      .map((row) => ({
        resource: row.resource as string,
        toDoId: row.to_do_id as string,
        list: row.list as string,
        served: JSON.parse(row.served as string),
      }));
  }

  private readTombstones(): CalDavTombstone[] {
    return this.ctx.storage.sql
      .exec(`SELECT resource, revision FROM caldav_tombstones`)
      .toArray()
      .map((row) => ({ resource: row.resource as string, revision: Number(row.revision) }));
  }

  private receiptExists(mutationId: string): boolean {
    return (
      this.ctx.storage.sql
        .exec(`SELECT 1 FROM receipts WHERE mutation_id = ?`, mutationId)
        .toArray().length > 0
    );
  }

  private applyCalDavEffectChanges(
    snapshot: WorkspaceSyncSnapshot,
    effects: CalDavEffects,
    now: string,
  ): WorkspaceSyncSnapshot {
    let current = snapshot;
    for (const change of effects.changes) {
      if (this.receiptExists(change.mutationId)) continue;
      const persisted = resolveSyncCommand(
        current,
        {
          expectedRevision: current.revision,
          mutationId: change.mutationId,
          document: change.document,
        },
        now,
      );
      if (persisted.result.status === "rejected") continue; // rejected changes leave state untouched
      if (persisted.next) {
        this.writeSnapshot(persisted.next);
        current = persisted.next;
      }
      if (persisted.result.status === "acknowledged")
        this.writeReceipt(change.mutationId, persisted.result.conflicts);
    }
    for (const anchor of effects.anchorUpserts)
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO caldav_anchors (resource, to_do_id, list, served) VALUES (?, ?, ?, ?)`,
        anchor.resource,
        anchor.toDoId,
        anchor.list,
        JSON.stringify(anchor.served),
      );
    for (const resource of effects.anchorDeletes)
      this.ctx.storage.sql.exec(`DELETE FROM caldav_anchors WHERE resource = ?`, resource);
    for (const tombstone of effects.tombstoneUpserts)
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO caldav_tombstones (resource, revision) VALUES (?, ?)`,
        tombstone.resource,
        tombstone.revision,
      );
    for (const resource of effects.tombstoneDeletes)
      this.ctx.storage.sql.exec(`DELETE FROM caldav_tombstones WHERE resource = ?`, resource);
    return current;
  }

  /** One CalDAV request: token check, pure handler, effect persistence. */
  caldav(request: {
    method: string;
    path: string;
    depth: string | null;
    ifMatch: string | null;
    ifNoneMatch: string | null;
    destination: string | null;
    body: string | null;
    bodyHash: string;
    tokenHash: string;
    baseUrl: string;
  }): {
    status: number;
    headers: Record<string, string>;
    body: string | null;
    unauthorized?: boolean;
  } {
    const now = new Date().toISOString();
    return this.ctx.storage.transactionSync(() => {
      const token = this.ctx.storage.sql
        .exec(
          `SELECT id, time_zone, last_used_at FROM caldav_tokens WHERE hash = ?`,
          request.tokenHash,
        )
        .toArray();
      if (!token.length) return { status: 401, headers: {}, body: null, unauthorized: true };
      const timeZone = token[0].time_zone as string;
      const lastUsedAt = token[0].last_used_at as string | null;
      if (!lastUsedAt || Date.now() - Date.parse(lastUsedAt) > LAST_USED_THROTTLE_MS)
        this.ctx.storage.sql.exec(
          `UPDATE caldav_tokens SET last_used_at = ? WHERE id = ?`,
          now,
          token[0].id as string,
        );

      let snapshot = this.readSnapshot();
      if (!snapshot) return { status: 404, headers: {}, body: null };

      // Occurrence generation bound exactly like the web client: at most
      // once per token-timezone day (receipt-deduped), before any query is
      // answered.
      if (
        request.method.toUpperCase() === "REPORT" &&
        (request.body ?? "").includes("calendar-query")
      ) {
        let today: string;
        try {
          today = dateInTimeZone(new Date(now), timeZone);
        } catch {
          today = now.slice(0, 10);
        }
        const generateMutation = `caldav:generate:${today}`;
        const due = snapshot.document.repeatingTemplates.some(
          (template) => template.state === "active" && template.nextDate <= today,
        );
        if (due && !this.receiptExists(generateMutation)) {
          const applied = applyCalDavChanges(
            snapshot,
            [
              {
                kind: "change",
                change: { type: "generateRepeatingOccurrences", throughDate: today },
              },
            ],
            generateMutation,
            this.calDavDeps(now),
          );
          if (applied.ok && applied.next) {
            this.writeSnapshot(applied.next);
            if (applied.result.status === "acknowledged")
              this.writeReceipt(generateMutation, applied.result.conflicts);
            snapshot = applied.next;
          }
        }
      }

      const resource = request.path.split("/").filter(Boolean).at(-1) ?? "";
      const putReplay =
        request.method.toUpperCase() === "PUT" && request.bodyHash
          ? this.receiptExists(`caldav:put:${resource}:${request.bodyHash}`)
          : false;

      const handlerRequest: CalDavHttpRequest = {
        method: request.method,
        path: request.path,
        depth: request.depth,
        ifMatch: request.ifMatch,
        ifNoneMatch: request.ifNoneMatch,
        destination: request.destination,
        body: request.body,
        bodyHash: request.bodyHash,
        putReplay,
      };
      const result = handleCalDavRequest(
        handlerRequest,
        {
          userId: this.ctx.id.name ?? "unknown",
          snapshot,
          anchors: this.readAnchors(),
          tombstones: this.readTombstones(),
        },
        {
          now,
          baseUrl: request.baseUrl,
          createResourceId: () => crypto.randomUUID(),
          createId: this.calDavDeps(now).createId,
        },
      );
      this.applyCalDavEffectChanges(snapshot, result.effects, now);
      return { status: result.status, headers: result.headers, body: result.body };
    });
  }

  caldavTokens(): CalDavTokenRecord[] {
    return this.ctx.storage.sql
      .exec(
        `SELECT id, label, time_zone, created_at, last_used_at FROM caldav_tokens ORDER BY created_at`,
      )
      .toArray()
      .map((row) => ({
        id: row.id as string,
        label: row.label as string,
        timeZone: row.time_zone as string,
        createdAt: row.created_at as string,
        lastUsedAt: (row.last_used_at as string | null) ?? null,
      }));
  }

  caldavCreateToken(input: {
    id: string;
    label: string;
    timeZone: string;
    hash: string;
  }): CalDavTokenRecord {
    const createdAt = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `INSERT INTO caldav_tokens (id, label, hash, time_zone, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      input.id,
      input.label,
      input.hash,
      input.timeZone,
      createdAt,
    );
    return {
      id: input.id,
      label: input.label,
      timeZone: input.timeZone,
      createdAt,
      lastUsedAt: null,
    };
  }

  caldavRevokeToken(id: string): string | null {
    const rows = this.ctx.storage.sql
      .exec(`SELECT hash FROM caldav_tokens WHERE id = ?`, id)
      .toArray();
    if (!rows.length) return null;
    this.ctx.storage.sql.exec(`DELETE FROM caldav_tokens WHERE id = ?`, id);
    return rows[0].hash as string;
  }

  // Singleton token index (the `caldav-index` instance): maps token hashes
  // to owner ids so the userId-less well-known probe can route home.

  caldavIndexSet(hash: string, userId: string): void {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO caldav_token_index (hash, user_id) VALUES (?, ?)`,
      hash,
      userId,
    );
  }

  caldavIndexDrop(hash: string): void {
    this.ctx.storage.sql.exec(`DELETE FROM caldav_token_index WHERE hash = ?`, hash);
  }

  caldavIndexLookup(hash: string): string | null {
    const rows = this.ctx.storage.sql
      .exec(`SELECT user_id FROM caldav_token_index WHERE hash = ?`, hash)
      .toArray();
    return rows.length ? (rows[0].user_id as string) : null;
  }

  private parseCommand(serialized: string): WorkspaceSyncCommand {
    if (serialized.length > MAX_COMMAND_SIZE)
      throw new Error("Replacement Workspace data is too large");
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Invalid replacement Workspace change");
    }
    return value as WorkspaceSyncCommand;
  }

  private readSnapshot(): WorkspaceSyncSnapshot | null {
    const meta = this.ctx.storage.sql.exec(`SELECT value FROM meta WHERE key = 'meta'`).toArray();
    if (!meta.length) return null;
    const { revision } = JSON.parse(meta[0].value as string) as { revision: number };
    const chunks = this.ctx.storage.sql.exec(`SELECT data FROM chunks ORDER BY part ASC`).toArray();
    const document = JSON.parse(
      chunks.map((chunk) => chunk.data as string).join(""),
    ) as WorkspaceDocument;
    return { revision, document };
  }

  private writeSnapshot(snapshot: WorkspaceSyncSnapshot): void {
    const document = JSON.stringify(snapshot.document);
    if (document.length > MAX_WORKSPACE_SIZE)
      throw new Error("Replacement Workspace data is too large");
    this.ctx.storage.sql.exec(`DELETE FROM chunks`);
    for (let start = 0, index = 0; start < document.length; start += CHUNK_SIZE, index += 1) {
      this.ctx.storage.sql.exec(
        `INSERT INTO chunks (part, data) VALUES (?, ?)`,
        String(index).padStart(6, "0"),
        document.slice(start, start + CHUNK_SIZE),
      );
    }
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('meta', ?)`,
      JSON.stringify({ revision: snapshot.revision }),
    );
  }

  private writeReceipt(mutationId: string, conflicts: WorkspaceSyncConflict[]): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO receipts (mutation_id, conflicts) VALUES (?, ?)`,
      mutationId,
      JSON.stringify(conflicts),
    );
  }
}
