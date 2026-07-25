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

const MAX_WORKSPACE_SIZE = 2_000_000;
const MAX_COMMAND_SIZE = 5_000_000;
const CHUNK_SIZE = 50_000;

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
 * transactionSync makes every mutation atomic. This is the Cloudflare port
 * of the Lakebed `replacementWorkspace` query and `saveReplacementWorkspace`
 * mutation (retained-legacy migration is intentionally dropped: the new
 * platform starts fresh and users import backups client-side).
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
