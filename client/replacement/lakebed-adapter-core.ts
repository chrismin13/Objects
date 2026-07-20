import type {
  WorkspaceSyncAdapter,
  WorkspaceSyncCommand,
  WorkspaceSyncResult,
  WorkspaceSyncSnapshot,
} from "../../shared/replacement/sync";

export type LakebedWorkspaceGateway = {
  readSnapshot(): string | null | undefined;
  saveCommand(serialized: string): Promise<string>;
  subscribe(listener: () => void): () => void;
};

export type LakebedWorkspaceQuery = {
  ownerIdentity: string;
  snapshot: WorkspaceSyncSnapshot | null;
  migrationRequired?: boolean;
};

function migrationMutationId(updatedAt: string, sourceMutationId: string): string {
  const fullIdentity = `legacy-migration-${updatedAt}-${sourceMutationId}`;
  if (fullIdentity.length <= 200) return fullIdentity;
  let hash = 2166136261;
  for (const character of sourceMutationId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `legacy-migration-${updatedAt}-${sourceMutationId.length}-${(hash >>> 0).toString(16)}`;
}

export function migrationCommandForQuery(query: LakebedWorkspaceQuery): WorkspaceSyncCommand | null {
  const snapshot = query.snapshot;
  const migration = snapshot?.document.sync.legacyMigration;
  if (!query.migrationRequired || !snapshot || !migration) return null;
  return {
    expectedRevision: snapshot.revision,
    mutationId: migrationMutationId(migration.updatedAt, migration.mutationId),
    document: snapshot.document,
  };
}

export function parseLakebedWorkspaceQuery(value: unknown): LakebedWorkspaceQuery | undefined {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) return undefined;
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (
    !parsed
    || typeof parsed !== "object"
    || Array.isArray(parsed)
    || typeof (parsed as { ownerIdentity?: unknown }).ownerIdentity !== "string"
    || !("snapshot" in parsed)
  ) throw new Error("Invalid Lakebed Workspace query result");
  const snapshot = (parsed as { snapshot: unknown }).snapshot;
  if (snapshot !== null && (typeof snapshot !== "object" || Array.isArray(snapshot))) {
    throw new Error("Invalid Lakebed Workspace snapshot");
  }
  if (
    "migrationRequired" in parsed
    && typeof (parsed as { migrationRequired?: unknown }).migrationRequired !== "boolean"
  ) throw new Error("Invalid Lakebed Workspace migration state");
  return parsed as LakebedWorkspaceQuery;
}

export function createLakebedWorkspaceAdapter(gateway: LakebedWorkspaceGateway): WorkspaceSyncAdapter {
  return {
    async load(): Promise<WorkspaceSyncSnapshot | null> {
      const serialized = gateway.readSnapshot();
      if (serialized === undefined) throw new Error("Session unavailable");
      return serialized === null ? null : JSON.parse(serialized) as WorkspaceSyncSnapshot;
    },
    async save(command: WorkspaceSyncCommand): Promise<WorkspaceSyncResult> {
      const result = await gateway.saveCommand(JSON.stringify(command));
      return JSON.parse(result) as WorkspaceSyncResult;
    },
    subscribe: (listener) => gateway.subscribe(listener),
  };
}

export function scopeWorkspaceAdapter(
  adapter: WorkspaceSyncAdapter,
  expectedOwnerIdentity: string,
  confirmedOwnerIdentity: () => string | null,
): WorkspaceSyncAdapter {
  const identityMatches = () => confirmedOwnerIdentity() === expectedOwnerIdentity;
  const unavailable = () => Promise.reject(new Error("Session unavailable"));
  return {
    load: () => identityMatches() ? adapter.load() : unavailable(),
    save: (command) => identityMatches() ? adapter.save(command) : unavailable(),
    subscribe(listener) {
      if (!identityMatches()) return () => undefined;
      return adapter.subscribe?.(() => { if (identityMatches()) listener(); }) ?? (() => undefined);
    },
  };
}
