import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { WorkspaceSyncAdapter } from "../../shared/workspace/sync";
import { createGatewayWorkspaceAdapter } from "./adapter-core";

export type HttpAdapterState = {
  adapter: WorkspaceSyncAdapter;
  loading: boolean;
  ownerIdentity: string;
};

type WorkspaceQueryBody = {
  ownerIdentity: string;
  snapshot: unknown;
};

/**
 * WorkspaceSyncAdapter over the Objects Worker HTTP API. The Lakebed
 * adapter's live-query invalidation becomes explicit refresh signals:
 * window focus, coming back online, and tab visibility — the sync client
 * already rebuilds pending deltas over whatever the server returns.
 */
export function useHttpWorkspaceAdapter(session: { userId: string }): HttpAdapterState {
  const ownerIdentity = session.userId;
  const snapshotRef = useRef<string | null | undefined>(undefined);
  const listeners = useRef(new Set<() => void>());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    snapshotRef.current = undefined;
    setLoading(true);
    void fetch("/api/workspace", { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(`Workspace load failed (${response.status})`);
        return response.json() as Promise<WorkspaceQueryBody>;
      })
      .then((body) => {
        if (!active) return;
        snapshotRef.current = body.snapshot ? JSON.stringify(body.snapshot) : null;
        setLoading(false);
        for (const listener of listeners.current) listener();
      })
      .catch(() => {
        if (!active) return;
        // Keep the undefined snapshot: the sync client treats it as
        // "session unavailable" and stays on its durable local queue.
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ownerIdentity]);

  useEffect(() => {
    const refresh = () => {
      void fetch("/api/workspace", { credentials: "same-origin" })
        .then(
          (response) =>
            (response.ok ? response.json() : null) as Promise<WorkspaceQueryBody | null>,
        )
        .then((body) => {
          if (!body) return;
          const next = body.snapshot ? JSON.stringify(body.snapshot) : null;
          if (next === snapshotRef.current) return;
          snapshotRef.current = next;
          for (const listener of listeners.current) listener();
        })
        .catch(() => undefined);
    };
    const onFocus = () => refresh();
    const onOnline = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ownerIdentity]);

  const adapter = useMemo<WorkspaceSyncAdapter>(
    () =>
      createGatewayWorkspaceAdapter({
        readSnapshot: () => snapshotRef.current,
        async saveCommand(serialized) {
          const response = await fetch("/api/workspace", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: serialized,
          });
          if (!response.ok) throw new Error(`Workspace save failed (${response.status})`);
          const text = await response.text();
          const result = JSON.parse(text) as { snapshot?: unknown };
          if (result.snapshot !== undefined) {
            snapshotRef.current = result.snapshot ? JSON.stringify(result.snapshot) : null;
          }
          return text;
        },
        subscribe(listener) {
          listeners.current.add(listener);
          return () => listeners.current.delete(listener);
        },
      }),
    [],
  );

  return { adapter, loading, ownerIdentity };
}
