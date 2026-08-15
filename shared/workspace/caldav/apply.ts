/**
 * Applies inbound CalDAV changes through the normal Workspace command
 * pipeline. Used twice: by the protocol handler to simulate the post-change
 * state (for the response ETag and anchor), and by the Durable Object to
 * persist through `resolveSyncCommand` — the same pattern as the HTTP
 * capture path (ADR 0002).
 */

import type { WorkspaceDocument } from "../model.ts";
import {
  resolveSyncCommand,
  type WorkspaceSyncSnapshot,
  type WorkspaceSyncResult,
} from "../sync.ts";
import { createWorkspace, type WorkspaceChange, type WorkspaceDependencies } from "../workspace.ts";
import type { InboundChange } from "./adapter.ts";

export type ResolvedInboundChanges =
  | { ok: true; document: WorkspaceDocument; toDoId: string | null }
  | { ok: false; errors: string[] };

/**
 * Applies `create`/`follow`/`change` sequences, substituting the created
 * to-do's identity into follow-up changes (completeToDo / setToDoTags after
 * a create). Rejection leaves state untouched.
 */
export function resolveInboundChanges(
  document: WorkspaceDocument,
  inbound: InboundChange[],
  dependencies: WorkspaceDependencies,
): ResolvedInboundChanges {
  const workspace = createWorkspace(document, dependencies);
  let toDoId: string | null = null;
  for (const entry of inbound) {
    const change = { ...(entry.change as unknown as WorkspaceChange) };
    if (entry.kind === "create") {
      const result = workspace.change(change);
      if (result.status === "rejected") return { ok: false, errors: result.errors };
      toDoId = result.affected.find((item) => item.kind === "toDo")?.id ?? null;
    } else if (entry.kind === "follow") {
      if (!toDoId) return { ok: false, errors: ["A follow-up CalDAV change lost its to-do."] };
      (change as { id: string }).id = toDoId;
      const result = workspace.change(change);
      if (result.status === "rejected") return { ok: false, errors: result.errors };
    } else {
      const result = workspace.change(change);
      if (result.status === "rejected") return { ok: false, errors: result.errors };
    }
  }
  return { ok: true, document: workspace.read(), toDoId };
}

export type AppliedCalDavChanges =
  | {
      ok: true;
      result: WorkspaceSyncResult;
      next: WorkspaceSyncSnapshot | null;
      document: WorkspaceDocument;
    }
  | { ok: false; errors: string[] };

/** Persists resolved inbound changes as one revisioned, idempotent command. */
export function applyCalDavChanges(
  current: WorkspaceSyncSnapshot,
  inbound: InboundChange[],
  mutationId: string,
  dependencies: WorkspaceDependencies,
): AppliedCalDavChanges {
  const resolved = resolveInboundChanges(current.document, inbound, dependencies);
  if (!resolved.ok) return { ok: false, errors: resolved.errors };
  const command = {
    expectedRevision: current.revision,
    mutationId,
    document: resolved.document,
  };
  const persisted = resolveSyncCommand(current, command, dependencies.now());
  if (persisted.result.status === "rejected") return { ok: false, errors: persisted.result.errors };
  return {
    ok: true,
    result: persisted.result,
    next: persisted.next,
    document: resolved.document,
  };
}
