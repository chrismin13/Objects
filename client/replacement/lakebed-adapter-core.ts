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
