import type { IsoDateTime, WorkspaceDocument } from "./model.ts";
import {
  applyWorkspaceDelta,
  cloneJsonValue,
  createWorkspaceDelta,
  validateSyncDocument,
  type WorkspaceDelta,
  type WorkspaceSyncAdapter,
  type WorkspaceSyncConflict,
  type WorkspaceSyncSnapshot,
} from "./sync.ts";

export type WorkspaceSyncPersistence = {
  load(): string | null;
  save(serialized: string): void;
};

export type WorkspaceSyncClientStatus =
  | "loading"
  | "saved"
  | "saving"
  | "offline"
  | "retrying"
  | "recovered"
  | "conflict"
  | "session-expired";

export type RejectedWorkspaceMutation = {
  mutationId: string;
  errors: string[];
};

export type WorkspaceSyncClientState = {
  snapshot: WorkspaceSyncSnapshot | null;
  pendingCount: number;
  status: WorkspaceSyncClientStatus;
  conflicts: WorkspaceSyncConflict[];
  rejected: RejectedWorkspaceMutation[];
};

export type WorkspaceSyncClient = {
  initialize(createInitial: () => WorkspaceDocument): Promise<WorkspaceSyncClientState>;
  read(): WorkspaceSyncClientState;
  stage(document: WorkspaceDocument, mutationId: string): WorkspaceSyncClientState;
  flush(): Promise<WorkspaceSyncClientState>;
  refresh(): Promise<WorkspaceSyncClientState>;
  subscribe(listener: (state: WorkspaceSyncClientState) => void): () => void;
};

type PendingWorkspaceMutation = {
  mutationId: string;
  changes: WorkspaceDelta;
  createdAt: IsoDateTime;
};

type StoredWorkspaceSyncState = {
  version: 1;
  snapshot: WorkspaceSyncSnapshot;
  pending: PendingWorkspaceMutation[];
  rejected: RejectedWorkspaceMutation[];
};

function sessionExpired(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /auth|session|sign.?in|unauthor/i.test(message);
}

function validSnapshot(value: unknown): value is WorkspaceSyncSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<WorkspaceSyncSnapshot>;
  return Number.isInteger(snapshot.revision) && snapshot.revision! >= 0 && validateSyncDocument(snapshot.document).length === 0;
}

function parseStored(serialized: string | null): StoredWorkspaceSyncState | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as Partial<StoredWorkspaceSyncState>;
    if (value.version !== 1 || !validSnapshot(value.snapshot) || !Array.isArray(value.pending) || !Array.isArray(value.rejected)) return null;
    const pending = value.pending.filter((item): item is PendingWorkspaceMutation => Boolean(
      item && typeof item.mutationId === "string" && item.mutationId && item.changes && Array.isArray(item.changes.operations)
    ));
    return { version: 1, snapshot: cloneJsonValue(value.snapshot), pending: cloneJsonValue(pending), rejected: cloneJsonValue(value.rejected) };
  } catch {
    return null;
  }
}

export function createWorkspaceSyncClient(
  adapter: WorkspaceSyncAdapter,
  persistence: WorkspaceSyncPersistence,
  now: () => IsoDateTime,
): WorkspaceSyncClient {
  let base: WorkspaceSyncSnapshot | null = null;
  let optimistic: WorkspaceSyncSnapshot | null = null;
  let pending: PendingWorkspaceMutation[] = [];
  let rejected: RejectedWorkspaceMutation[] = [];
  let status: WorkspaceSyncClientStatus = "loading";
  let conflicts: WorkspaceSyncConflict[] = [];
  let flushing: Promise<WorkspaceSyncClientState> | null = null;
  let needsRecoveryFeedback = false;
  const listeners = new Set<(state: WorkspaceSyncClientState) => void>();

  function currentState(): WorkspaceSyncClientState {
    return {
      snapshot: optimistic ? cloneJsonValue(optimistic) : null,
      pendingCount: pending.length,
      status,
      conflicts: cloneJsonValue(conflicts),
      rejected: cloneJsonValue(rejected),
    };
  }

  function emit(): WorkspaceSyncClientState {
    const next = currentState();
    for (const listener of listeners) listener(next);
    return next;
  }

  function rebuildOptimistic(): void {
    if (!base) {
      optimistic = null;
      return;
    }
    let document = cloneJsonValue(base.document);
    for (const item of pending) {
      const applied = applyWorkspaceDelta(document, item.changes);
      if (!applied.errors.length) document = applied.document;
    }
    optimistic = { revision: base.revision, document };
  }

  function persist(): void {
    if (!base) return;
    try {
      const stored: StoredWorkspaceSyncState = { version: 1, snapshot: base, pending, rejected };
      persistence.save(JSON.stringify(stored));
    } catch {
      // Some browsers limit or disable local storage. The in-memory queue still works for this session.
    }
  }

  async function initialize(createInitial: () => WorkspaceDocument): Promise<WorkspaceSyncClientState> {
    const stored = parseStored(persistence.load());
    base = stored?.snapshot ?? { revision: 0, document: createInitial() };
    pending = stored?.pending ?? [];
    rejected = stored?.rejected ?? [];
    rebuildOptimistic();
    emit();
    try {
      const remote = await adapter.load();
      if (remote && !validSnapshot(remote)) throw new Error("Remote Workspace data is malformed");
      if (remote) base = remote;
      else if (!stored) base = { revision: 0, document: createInitial() };
      rebuildOptimistic();
      status = pending.length ? "retrying" : "saved";
      needsRecoveryFeedback = pending.length > 0;
      persist();
    } catch (error) {
      status = sessionExpired(error) ? "session-expired" : "offline";
      needsRecoveryFeedback = true;
      persist();
    }
    return emit();
  }

  function stage(document: WorkspaceDocument, mutationId: string): WorkspaceSyncClientState {
    if (!optimistic || !mutationId || mutationId.length > 200) return currentState();
    const changes = createWorkspaceDelta(optimistic.document, document);
    if (!changes.operations.length && !changes.orderings?.length) return currentState();
    pending.push({ mutationId, changes, createdAt: now() });
    optimistic = { revision: optimistic.revision, document: cloneJsonValue(document) };
    if (status === "saved" || status === "recovered") status = "saving";
    persist();
    return emit();
  }

  async function runFlush(): Promise<WorkspaceSyncClientState> {
    if (!base || !pending.length) {
      if (status === "saving" || status === "retrying") status = needsRecoveryFeedback ? "recovered" : "saved";
      return emit();
    }
    status = needsRecoveryFeedback ? "retrying" : "saving";
    emit();
    for (let attempt = 0; attempt < 100_000 && base && pending.length; attempt += 1) {
      const item = pending[0];
      const applied = applyWorkspaceDelta(base.document, item.changes);
      if (applied.errors.length) {
        rejected.push({ mutationId: item.mutationId, errors: applied.errors });
        pending.shift();
        status = "conflict";
        persist();
        rebuildOptimistic();
        continue;
      }
      try {
        const result = await adapter.save({
          expectedRevision: base.revision,
          mutationId: item.mutationId,
          changes: item.changes,
          document: applied.document,
        });
        if (result.status === "conflict") {
          base = result.snapshot;
          needsRecoveryFeedback = true;
          persist();
          rebuildOptimistic();
          continue;
        }
        if (result.status === "rejected") {
          rejected.push({ mutationId: item.mutationId, errors: result.errors });
          pending.shift();
          status = "conflict";
          persist();
          rebuildOptimistic();
          continue;
        }
        base = result.snapshot;
        pending.shift();
        if (result.conflicts.length) {
          conflicts.push(...result.conflicts);
          needsRecoveryFeedback = true;
        }
        persist();
        rebuildOptimistic();
        emit();
      } catch (error) {
        status = sessionExpired(error) ? "session-expired" : "offline";
        needsRecoveryFeedback = true;
        persist();
        return emit();
      }
    }
    if (rejected.length || conflicts.length) status = "conflict";
    else status = needsRecoveryFeedback ? "recovered" : "saved";
    const next = emit();
    needsRecoveryFeedback = false;
    return next;
  }

  function flush(): Promise<WorkspaceSyncClientState> {
    if (flushing) return flushing;
    flushing = runFlush().finally(() => { flushing = null; });
    return flushing;
  }

  async function refresh(): Promise<WorkspaceSyncClientState> {
    try {
      const remote = await adapter.load();
      if (remote && !validSnapshot(remote)) throw new Error("Remote Workspace data is malformed");
      if (remote && (!base || remote.revision >= base.revision)) base = remote;
      rebuildOptimistic();
      status = pending.length ? "retrying" : needsRecoveryFeedback ? "recovered" : "saved";
      persist();
      emit();
      if (pending.length) return flush();
      return currentState();
    } catch (error) {
      status = sessionExpired(error) ? "session-expired" : "offline";
      needsRecoveryFeedback = true;
      return emit();
    }
  }

  return {
    initialize,
    read: currentState,
    stage,
    flush,
    refresh,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
