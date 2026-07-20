import { useMutation, useQuery } from "lakebed/client";
import { useEffect, useMemo, useRef } from "preact/hooks";

import type { WorkspaceSyncAdapter } from "../../shared/replacement/sync";
import {
  createLakebedWorkspaceAdapter,
  migrationCommandForQuery,
  parseLakebedWorkspaceQuery,
} from "./lakebed-adapter-core";

export type LakebedAdapterState = {
  adapter: WorkspaceSyncAdapter;
  loading: boolean;
  ownerIdentity: string;
};

export function useLakebedWorkspaceAdapter(): LakebedAdapterState {
  const serializedWorkspace = useQuery<string>("replacementWorkspace");
  const saveWorkspace = useMutation<[serialized: string], string>("saveReplacementWorkspace");
  const workspace = parseLakebedWorkspaceQuery(serializedWorkspace);
  const serializedSnapshot = workspace === undefined ? undefined : workspace.snapshot ? JSON.stringify(workspace.snapshot) : null;
  const ownerIdentity = workspace?.ownerIdentity;
  const snapshotRef = useRef<string | null | undefined>(serializedSnapshot);
  const saveRef = useRef(saveWorkspace);
  const listeners = useRef(new Set<() => void>());
  const previousOwnerIdentity = useRef<string | undefined>(ownerIdentity);
  const migrationSaveKey = useRef<string | null>(null);
  snapshotRef.current = serializedSnapshot;
  saveRef.current = saveWorkspace;

  useEffect(() => {
    if (ownerIdentity && ownerIdentity === previousOwnerIdentity.current) {
      for (const listener of listeners.current) listener();
    }
    previousOwnerIdentity.current = ownerIdentity;
  }, [serializedSnapshot, ownerIdentity]);

  useEffect(() => {
    if (!workspace) return;
    const command = migrationCommandForQuery(workspace);
    if (!command) return;
    const key = `${workspace.ownerIdentity}:${command.mutationId}`;
    if (migrationSaveKey.current === key) return;
    migrationSaveKey.current = key;
    void saveWorkspace(JSON.stringify(command)).catch(() => {
      if (migrationSaveKey.current === key) migrationSaveKey.current = null;
    });
  }, [workspace?.migrationRequired, serializedSnapshot, ownerIdentity, saveWorkspace]);

  const adapter = useMemo<WorkspaceSyncAdapter>(() => createLakebedWorkspaceAdapter({
    readSnapshot: () => snapshotRef.current,
    saveCommand: (serialized) => saveRef.current(serialized),
    subscribe(listener) {
      listeners.current.add(listener);
      return () => listeners.current.delete(listener);
    },
  }), []);

  return { adapter, loading: workspace === undefined, ownerIdentity: ownerIdentity ?? "guest" };
}
