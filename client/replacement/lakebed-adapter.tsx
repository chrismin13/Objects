import { useMutation, useQuery } from "lakebed/client";
import { useMemo } from "preact/hooks";

import type {
  WorkspaceSyncAdapter,
  WorkspaceSyncCommand,
  WorkspaceSyncResult,
  WorkspaceSyncSnapshot,
} from "../../shared/replacement/sync";

export type LakebedAdapterState = {
  adapter: WorkspaceSyncAdapter;
  loading: boolean;
};

export function useLakebedWorkspaceAdapter(): LakebedAdapterState {
  const serializedSnapshot = useQuery<string | null>("replacementWorkspace");
  const saveWorkspace = useMutation<[serialized: string], string>("saveReplacementWorkspace");

  const adapter = useMemo<WorkspaceSyncAdapter>(() => ({
    async load(): Promise<WorkspaceSyncSnapshot | null> {
      return typeof serializedSnapshot === "string"
        ? JSON.parse(serializedSnapshot) as WorkspaceSyncSnapshot
        : null;
    },
    async save(command: WorkspaceSyncCommand): Promise<WorkspaceSyncResult> {
      const result = await saveWorkspace(JSON.stringify(command));
      return JSON.parse(result) as WorkspaceSyncResult;
    },
  }), [serializedSnapshot, saveWorkspace]);

  return { adapter, loading: serializedSnapshot === undefined };
}
