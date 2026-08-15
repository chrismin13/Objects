import { Component, render } from "preact";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { InterfaceChangeSet } from "../shared/workspace/interface-bridge";
import {
  applyInterfaceChangeSetToWorkspace,
  interfaceLocationForWorkspaceUrl,
  workspaceDocumentToInterfaceState,
} from "../shared/workspace/interface-bridge";
import type { WorkspaceSyncClient } from "../shared/workspace/sync-client";
import { createWorkspaceSyncClient } from "../shared/workspace/sync-client";
import { createEmptyWorkspace } from "../shared/workspace/workspace";
import { initializePwa, initializeStandalonePwaInteractions } from "./pwa";
import { WaDropdown } from "./ui/webawesome";
import { mountObjects, syncObjectsState } from "./objects";
import { useHttpWorkspaceAdapter } from "./workspace/http-adapter";
import { scopeWorkspaceAdapter } from "./workspace/adapter-core";
import { initThemeBoot } from "./theme/boot";
import { objectsTheme } from "./theme";
import "./vendor/webawesome/webawesome.js";

initThemeBoot();
initializeStandalonePwaInteractions();

type AuthState = {
  isLoading: boolean;
  isGuest: boolean;
  userId: string | null;
  displayName: string | null;
  email: string | null;
};

const signedOut: AuthState = {
  isLoading: false,
  isGuest: true,
  userId: null,
  displayName: null,
  email: null,
};

function useSession(): AuthState {
  const [state, setState] = useState<AuthState>({ ...signedOut, isLoading: true });
  useEffect(() => {
    let active = true;
    void fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setState(signedOut);
          return;
        }
        const body = (await response.json()) as {
          user: {
            userId: string;
            email: string;
            firstName: string | null;
            lastName: string | null;
          };
        };
        const displayName =
          [body.user.firstName, body.user.lastName].filter(Boolean).join(" ") || body.user.email;
        setState({
          isLoading: false,
          isGuest: false,
          userId: body.user.userId,
          displayName,
          email: body.user.email,
        });
      })
      .catch(() => {
        // Network failure: stay in the loading state so the offline and
        // recovery cards take over instead of flashing a sign-in prompt.
        if (active) setState((current) => ({ ...current, isLoading: true }));
      });
    return () => {
      active = false;
    };
  }, []);
  return state;
}

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function BrandMark() {
  return (
    <div className="auth-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function SkeletonBar({ className, width }: { className: string; width?: string }) {
  return <span className={`skeleton ${className}`} style={width ? { width } : undefined} />;
}

function SkeletonNavRow({ width }: { width: string }) {
  return (
    <li className="nav-item boot-nav-item">
      <SkeletonBar className="skeleton-icon" />
      <SkeletonBar className="skeleton-line" width={width} />
    </li>
  );
}

function SkeletonTaskRow({ title, meta }: { title: string; meta?: string }) {
  return (
    <li className="task-row boot-task-row">
      <SkeletonBar className="skeleton-check" />
      <div className="task-main">
        <SkeletonBar className="skeleton-line skeleton-task-title" width={title} />
        {meta ? <SkeletonBar className="skeleton-line skeleton-task-meta" width={meta} /> : null}
      </div>
    </li>
  );
}

// Mirrors the real shell geometry (sidebar + main pane) with shimmering
// placeholders, so the app appears to "fill in" once the workspace is ready.
function ShellSkeleton() {
  return (
    <div className="app-shell boot-shell" aria-hidden="true">
      <aside className="sidebar">
        <div className="window-bar">
          <div className="space-controls">
            <div className="space-pill">
              <SkeletonBar className="skeleton-segment" />
            </div>
          </div>
          <div className="window-actions">
            <span className="skeleton-btn skeleton-btn-settings">
              <SkeletonBar className="skeleton-icon" />
            </span>
            <span className="skeleton-btn skeleton-btn-search">
              <SkeletonBar className="skeleton-icon" />
            </span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <ul className="nav-list">
            <SkeletonNavRow width="38%" />
            <SkeletonNavRow width="52%" />
            <SkeletonNavRow width="45%" />
            <SkeletonNavRow width="60%" />
          </ul>
          <SkeletonBar className="skeleton-section" />
          <ul className="nav-list">
            <SkeletonNavRow width="55%" />
            <SkeletonNavRow width="42%" />
            <SkeletonNavRow width="64%" />
          </ul>
        </nav>
        <div className="sidebar-footer">
          <span className="quiet-button">
            <SkeletonBar className="skeleton-icon-16" />
            <SkeletonBar className="skeleton-line" width="58px" />
          </span>
          <div className="sidebar-tools">
            <span className="skeleton-btn">
              <SkeletonBar className="skeleton-icon" />
            </span>
            <span className="skeleton-btn">
              <SkeletonBar className="skeleton-icon" />
            </span>
          </div>
        </div>
      </aside>
      <main className="main-pane">
        <header className="mobile-header">
          <span className="skeleton-btn">
            <SkeletonBar className="skeleton-icon" />
          </span>
          <span className="skeleton-btn">
            <SkeletonBar className="skeleton-icon" />
          </span>
        </header>
        <section className="content">
          <div className="content-inner">
            <div className="view-header">
              <div className="view-title-row">
                <SkeletonBar className="skeleton-view-icon" />
                <SkeletonBar className="skeleton-title" />
              </div>
              <SkeletonBar className="skeleton-progress" />
            </div>
            <ul className="task-list">
              <SkeletonTaskRow title="82%" meta="24%" />
              <SkeletonTaskRow title="64%" />
              <SkeletonTaskRow title="71%" meta="18%" />
              <SkeletonTaskRow title="48%" />
              <SkeletonTaskRow title="76%" meta="31%" />
            </ul>
          </div>
        </section>
        <span className="magic-add">
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.65"
            stroke-linecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </main>
    </div>
  );
}

function BootScreen({ status, children }: { status: string; children?: ComponentChildren }) {
  return (
    <>
      <ShellSkeleton />
      <span className="boot-status" role="status">
        {status}
      </span>
      {children ? <div className="boot-overlay">{children}</div> : null}
    </>
  );
}

function SignInCard() {
  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <BrandMark />
      <p className="auth-brand">Objects</p>
      <h1 id="auth-title">Your tasks, privately yours</h1>
      <p className="auth-copy">
        Sign in to create a private workspace that follows you across devices.
      </p>
      <a className="button primary auth-submit" href="/auth/login">
        Sign in
      </a>
      <p className="auth-footnote">
        Authentication is provided by WorkOS. Objects never uses your email as an authorization key.
      </p>
    </section>
  );
}

function OfflineCard() {
  return (
    <section className="auth-card" aria-labelledby="offline-title">
      <BrandMark />
      <p className="auth-brand">Objects</p>
      <h1 id="offline-title">Objects is offline</h1>
      <p className="auth-copy">
        The installed app shell is ready. Reconnect to unlock your private workspace and resume
        syncing.
      </p>
      <div className="auth-loading" role="status">
        <span /> Waiting for a connection…
      </div>
      <p className="auth-footnote">
        Objects deliberately does not store private API or authentication responses in the shared
        app cache.
      </p>
    </section>
  );
}

function RecoveryCard() {
  return (
    <section className="auth-card" aria-labelledby="session-title">
      <BrandMark />
      <p className="auth-brand">Objects</p>
      <h1 id="session-title">The session check is taking longer than expected</h1>
      <p className="auth-copy">Your data is safe. Reconnect the current tab without closing it.</p>
      <button
        className="button primary auth-submit"
        type="button"
        onClick={() => window.location.reload()}
      >
        Retry session
      </button>
    </section>
  );
}

class StableObjectsDom extends Component {
  shouldComponentUpdate() {
    return false;
  }
  render() {
    return (
      <>
        <div id="objects-shell" className="app-shell" aria-busy="true">
          <span id="sidebar-anchor" hidden />
          <aside id="sidebar" className="sidebar" aria-label="Lists">
            <div className="window-bar">
              <button
                id="sidebar-close"
                className="icon-button sidebar-close"
                type="button"
                aria-label="Close sidebar"
              />
              <div id="space-controls" className="space-controls" aria-label="Task Space" />
              <div className="window-actions">
                <button
                  id="space-settings-button"
                  className="icon-button space-settings-button"
                  type="button"
                  aria-label="Spaces and launch schedule"
                />
                <button
                  id="search-button"
                  className="icon-button"
                  type="button"
                  aria-label="Quick find"
                />
              </div>
            </div>
            <nav id="sidebar-nav" className="sidebar-nav" />
            <div className="sidebar-footer">
              <button id="new-list-button" className="quiet-button" type="button" />
              <div className="sidebar-tools">
                <button
                  id="repeating-button"
                  className="icon-button"
                  type="button"
                  aria-label="Repeating"
                />
                <button
                  id="settings-button"
                  className="icon-button"
                  type="button"
                  aria-label="Settings"
                />
                <button
                  id="theme-button"
                  className="icon-button"
                  type="button"
                  aria-label="Change theme"
                />
              </div>
            </div>
          </aside>
          <main className="main-pane">
            <header className="mobile-header">
              <button
                id="sidebar-open"
                className="icon-button"
                type="button"
                aria-label="Open sidebar"
              />
              <span className="mobile-brand">Objects</span>
              <button
                id="mobile-search"
                className="icon-button"
                type="button"
                aria-label="Quick find"
              />
            </header>
            <section id="content" className="content" aria-live="polite" />
            <button
              id="magic-add"
              className="magic-add"
              type="button"
              aria-label="Quick add to-do"
            />
          </main>
          <span id="inspector-anchor" hidden />
          <aside id="inspector" className="inspector" aria-label="To-do details" />
          <div id="sidebar-scrim" className="scrim" />
        </div>
        <div id="drawer-root" />
        <div id="modal-root" />
        <WaDropdown id="context-menu" class="context-menu" placement="bottom-start" distance="0">
          <button
            className="context-menu-trigger"
            slot="trigger"
            type="button"
            tabIndex={-1}
            aria-hidden="true"
          />
          <div id="context-menu-items" />
        </WaDropdown>
        <span id="toast-anchor" hidden />
        <div id="toast-region" className="toast-region" aria-live="polite" popover="manual" />
      </>
    );
  }
}

function ObjectsShell({ auth, online }: { auth: AuthState; online: boolean }) {
  const { adapter, loading, ownerIdentity } = useHttpWorkspaceAdapter({
    userId: auth.userId ?? "guest",
  });
  const clientRef = useRef<WorkspaceSyncClient | null>(null);
  const [serializedState, setSerializedState] = useState<string | null>(null);
  const [stateTimedOut, setStateTimedOut] = useState(false);
  const ready = Boolean(serializedState);

  useEffect(() => {
    if (loading || !ownerIdentity) return;
    let active = true;
    let activeClient: WorkspaceSyncClient | null = null;
    let unsubscribeClient: (() => void) | undefined;
    let unsubscribeAdapter: (() => void) | undefined;
    const now = () => new Date().toISOString();
    const storageKey = `objects-workspace-interface-sync:${ownerIdentity}`;
    const scopedAdapter = scopeWorkspaceAdapter(adapter, ownerIdentity, () => ownerIdentity);
    const client = createWorkspaceSyncClient(
      scopedAdapter,
      {
        load() {
          try {
            return localStorage.getItem(storageKey);
          } catch {
            return null;
          }
        },
        save(serialized) {
          try {
            localStorage.setItem(storageKey, serialized);
          } catch {
            /* Local storage can be unavailable. */
          }
        },
      },
      now,
    );
    activeClient = client;
    clientRef.current = client;
    const showDocument = () => {
      const document = client.read().snapshot?.document;
      if (active && document)
        setSerializedState(
          JSON.stringify(workspaceDocumentToInterfaceState(document, localToday())),
        );
    };
    unsubscribeClient = client.subscribe(showDocument);
    unsubscribeAdapter = scopedAdapter.subscribe?.(() => void client.refresh());
    void client
      .initialize(() => {
        const document = createEmptyWorkspace(now());
        const spaceId = `space-${crypto.randomUUID()}`;
        document.spaces.push({
          id: spaceId,
          title: "Personal",
          color: "#e49b3c",
          pinned: true,
          order: 0,
        });
        document.settings.defaultSpaceId = spaceId;
        return document;
      })
      .then(() => {
        showDocument();
        if (client.read().pendingCount) void client.flush();
      });
    return () => {
      active = false;
      unsubscribeClient?.();
      unsubscribeAdapter?.();
      if (clientRef.current === activeClient) clientRef.current = null;
    };
  }, [adapter, loading, ownerIdentity]);

  useEffect(() => {
    if (!ready || !serializedState) return;
    const document = clientRef.current?.read().snapshot?.document;
    const directLocation = document
      ? interfaceLocationForWorkspaceUrl(document, window.location.search)
      : null;
    if (directLocation) {
      const identity = auth.userId || auth.displayName || "guest";
      if (directLocation.activeSpaceId) {
        try {
          localStorage.setItem(`objects-active-space:${identity}`, directLocation.activeSpaceId);
        } catch {
          /* Local storage can be unavailable. */
        }
      }
      if (directLocation.search !== window.location.search) {
        history.replaceState({}, "", `${window.location.pathname}${directLocation.search}`);
      }
    }
    const dispose = mountObjects(serializedState, {
      initializeState: async () => {
        const document = clientRef.current?.read().snapshot?.document;
        return document
          ? JSON.stringify(workspaceDocumentToInterfaceState(document, localToday()))
          : serializedState;
      },
      saveChanges: async (serialized: string) => {
        const client = clientRef.current;
        const document = client?.read().snapshot?.document;
        if (!client || !document) throw new Error("The Workspace is not ready to save.");
        const changes = JSON.parse(serialized) as InterfaceChangeSet;
        const next = applyInterfaceChangeSetToWorkspace(document, changes, {
          now: () => new Date().toISOString(),
          createId: (kind) => `${kind}-${crypto.randomUUID()}`,
        });
        if (!next.ok) throw new Error(next.errors.join(" "));
        client.stage(next.document, changes.mutationId);
        const saved = await client.flush();
        if (
          saved.status === "offline" ||
          saved.status === "retrying" ||
          saved.status === "session-expired"
        ) {
          throw new Error("The Workspace is offline. Objects will retry this change.");
        }
        if (saved.rejected.some((item) => item.mutationId === changes.mutationId)) {
          throw new Error(
            saved.rejected.find((item) => item.mutationId === changes.mutationId)!.errors.join(" "),
          );
        }
        return JSON.stringify({
          updatedAt: new Date().toISOString(),
          mutationId: changes.mutationId,
        });
      },
      user: auth,
      signOut: async () => {
        window.location.assign("/auth/logout");
      },
    });
    return () => {
      dispose?.();
    };
  }, [ready]);

  useEffect(() => {
    if (typeof serializedState === "string" && serializedState.length > 0) {
      syncObjectsState(serializedState);
    }
  }, [serializedState]);

  useEffect(() => {
    if (ready) {
      setStateTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setStateTimedOut(true), 4000);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (!ready) {
    if (!online)
      return (
        <BootScreen status="Objects is offline.">
          <OfflineCard />
        </BootScreen>
      );
    if (stateTimedOut)
      return (
        <BootScreen status="The session check is taking longer than expected.">
          <RecoveryCard />
        </BootScreen>
      );
    return <BootScreen status="Opening your workspace…" />;
  }

  return <StableObjectsDom />;
}

export function App() {
  const auth = useSession();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    return initializePwa();
  }, []);

  useEffect(() => {
    if (!auth.isLoading) {
      setAuthTimedOut(false);
      sessionStorage.removeItem("objects-auth-loading-recovery");
      return;
    }
    const timer = window.setTimeout(() => setAuthTimedOut(true), 4000);
    return () => window.clearTimeout(timer);
  }, [auth.isLoading]);

  useEffect(() => {
    const retryStalledSession = () => {
      if (
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        !auth.isLoading ||
        !authTimedOut ||
        sessionStorage.getItem("objects-auth-loading-recovery")
      )
        return;
      sessionStorage.setItem("objects-auth-loading-recovery", String(Date.now()));
      window.location.reload();
    };
    document.addEventListener("visibilitychange", retryStalledSession);
    return () => document.removeEventListener("visibilitychange", retryStalledSession);
  }, [auth.isLoading, authTimedOut]);

  useEffect(() => {
    const syncOnlineState = () => setOnline(navigator.onLine);
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);
    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  return (
    <>
      <style>{objectsTheme}</style>
      {auth.isLoading ? (
        !online ? (
          <BootScreen status="Objects is offline.">
            <OfflineCard />
          </BootScreen>
        ) : authTimedOut ? (
          <BootScreen status="The session check is taking longer than expected.">
            <RecoveryCard />
          </BootScreen>
        ) : (
          <BootScreen status="Checking your session…" />
        )
      ) : auth.isGuest ? (
        <BootScreen status="Sign in to Objects.">
          <SignInCard />
        </BootScreen>
      ) : (
        <ObjectsShell auth={auth} online={online} />
      )}
    </>
  );
}

render(<App />, document.getElementById("app")!);
