import { SignInWithGoogle, signOut, useAuth, useMutation, useQuery } from "lakebed/client";
import { Component } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { mountObjects, syncObjectsState } from "./objects";
import { initializePwa } from "./pwa";
import { responsiveStyles } from "./responsive-styles";
import { styles } from "./styles";
import { featureStyles } from "./feature-styles";
import { tagStyles } from "./tag-styles";
import { thingsStyles } from "./things-styles";

type AuthIdentity = ReturnType<typeof useAuth>;

function BrandMark() {
  return <div className="auth-mark" aria-hidden="true"><span /><span /><span /></div>;
}

function SignInScreen({ loading = false }: { loading?: boolean }) {
  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <BrandMark />
        <p className="auth-brand">Objects on Lakebed</p>
        <h1 id="auth-title">{loading ? "Opening Objects" : "Your tasks, privately yours"}</h1>
        <p className="auth-copy">
          {loading
            ? "Lakebed is checking your session."
            : "Sign in with Google to create a private workspace that follows you across devices."}
        </p>
        {loading ? (
          <div className="auth-loading" role="status"><span /> Checking session…</div>
        ) : (
          <SignInWithGoogle className="button primary auth-submit" />
        )}
        <p className="auth-footnote">Authentication and identity are provided by Lakebed. Objects never uses your email as an authorization key.</p>
      </section>
    </main>
  );
}

function OfflineScreen() {
  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="offline-title">
        <BrandMark />
        <p className="auth-brand">Objects on Lakebed</p>
        <h1 id="offline-title">Objects is offline</h1>
        <p className="auth-copy">The installed app shell is ready. Reconnect to unlock your private workspace and resume syncing.</p>
        <div className="auth-loading" role="status"><span /> Waiting for a connection…</div>
        <p className="auth-footnote">Objects deliberately does not store private Lakebed API or authentication responses in the shared app cache.</p>
      </section>
    </main>
  );
}

function SessionRecoveryScreen() {
  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="session-title">
        <BrandMark />
        <p className="auth-brand">Objects on Lakebed</p>
        <h1 id="session-title">The session check is taking longer than expected</h1>
        <p className="auth-copy">Your data is safe. Reconnect the current tab to Lakebed without closing it.</p>
        <button className="button primary auth-submit" type="button" onClick={() => window.location.reload()}>Retry session</button>
      </section>
    </main>
  );
}

const OBJECTS_SHELL = `
  <div id="objects-shell" class="app-shell" aria-busy="true">
    <aside id="sidebar" class="sidebar" aria-label="Lists">
      <div class="window-bar">
        <button id="sidebar-close" class="icon-button sidebar-close" type="button" aria-label="Close sidebar"></button>
        <div id="space-controls" class="space-controls" aria-label="Task Space"></div>
        <div class="window-actions">
          <button id="space-settings-button" class="icon-button space-settings-button" type="button" aria-label="Spaces and launch schedule"></button>
          <button id="search-button" class="icon-button" type="button" aria-label="Quick find"></button>
        </div>
      </div>
      <nav id="sidebar-nav" class="sidebar-nav"></nav>
      <div class="sidebar-footer">
        <button id="new-list-button" class="quiet-button" type="button"></button>
        <div class="sidebar-tools">
          <button id="settings-button" class="icon-button" type="button" aria-label="Settings"></button>
          <button id="theme-button" class="icon-button" type="button" aria-label="Change theme"></button>
        </div>
      </div>
    </aside>
    <main class="main-pane">
      <header class="mobile-header">
        <button id="sidebar-open" class="icon-button" type="button" aria-label="Open sidebar"></button>
        <span class="mobile-brand">Objects</span>
        <button id="mobile-search" class="icon-button" type="button" aria-label="Quick find"></button>
      </header>
      <section id="content" class="content" aria-live="polite"></section>
      <button id="magic-add" class="magic-add" type="button" aria-label="Quick add to-do"></button>
    </main>
    <aside id="inspector" class="inspector" aria-label="To-do details"></aside>
    <div id="sidebar-scrim" class="scrim"></div>
  </div>
  <div id="modal-root"></div>
  <div id="context-menu" class="context-menu" role="menu" hidden></div>
  <div id="toast-region" class="toast-region" aria-live="polite"></div>`;

class StableObjectsDom extends Component {
  shouldComponentUpdate() { return false; }
  render() { return <div dangerouslySetInnerHTML={{ __html: OBJECTS_SHELL }} />; }
}

function ObjectsShell({ auth, online }: { auth: AuthIdentity; online: boolean }) {
  const serializedState = useQuery<string>("state");
  const initializeNormalized = useMutation<[serialized: string], string>("initializeNormalized");
  const applyChanges = useMutation<[serialized: string], string>("applyChanges");
  const initialState = useRef<string | null>(null);
  const [stateTimedOut, setStateTimedOut] = useState(false);
  if (!initialState.current && typeof serializedState === "string" && serializedState.length > 0) initialState.current = serializedState;
  const ready = Boolean(initialState.current);

  useEffect(() => {
    if (!ready) return;
    return mountObjects(initialState.current!, {
      initializeState: initializeNormalized,
      saveChanges: applyChanges,
      user: auth,
      signOut: async () => {
        await signOut();
        window.location.reload();
      }
    });
  }, [ready]);

  useEffect(() => {
    if (typeof serializedState === "string" && serializedState.length > 0) syncObjectsState(serializedState);
  }, [serializedState]);

  useEffect(() => {
    if (ready) { setStateTimedOut(false); return; }
    const timer = window.setTimeout(() => setStateTimedOut(true), 4000);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (!ready) return !online ? <OfflineScreen /> : stateTimedOut ? <SessionRecoveryScreen /> : <SignInScreen loading />;

  return <StableObjectsDom />;
}

export function App() {
  const auth = useAuth();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const wasAuthenticated = useRef(false);
  const localGuest = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

  useEffect(() => {
    document.title = "Objects";
    const metadata = [
      ["meta", "meta[name='viewport']", { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" }],
      ["link", "link[rel='manifest']", { rel: "manifest", href: "/manifest.webmanifest" }],
      ["meta", "meta[name='theme-color']", { name: "theme-color", content: "#2f80ed" }],
      ["meta", "meta[name='mobile-web-app-capable']", { name: "mobile-web-app-capable", content: "yes" }],
      ["meta", "meta[name='apple-mobile-web-app-capable']", { name: "apple-mobile-web-app-capable", content: "yes" }],
      ["meta", "meta[name='apple-mobile-web-app-title']", { name: "apple-mobile-web-app-title", content: "Objects" }],
      ["meta", "meta[name='apple-mobile-web-app-status-bar-style']", { name: "apple-mobile-web-app-status-bar-style", content: "default" }]
    ] as const;
    for (const [tag, selector, attributes] of metadata) {
      let element = document.head.querySelector(selector);
      if (!element) { element = document.createElement(tag); document.head.appendChild(element); }
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    }
    return initializePwa();
  }, []);

  useEffect(() => {
    if (!auth.isLoading) { setAuthTimedOut(false); sessionStorage.removeItem('objects-auth-loading-recovery'); return; }
    const timer = window.setTimeout(() => setAuthTimedOut(true), 4000);
    return () => window.clearTimeout(timer);
  }, [auth.isLoading]);

  useEffect(() => {
    const recoveryKey = 'objects-auth-recovery';
    if (!auth.isLoading && !auth.isGuest) {
      wasAuthenticated.current = true;
      sessionStorage.removeItem(recoveryKey);
      return;
    }
    if (!online || auth.isLoading || !auth.isGuest || !wasAuthenticated.current || sessionStorage.getItem(recoveryKey)) return;
    sessionStorage.setItem(recoveryKey, String(Date.now()));
    window.location.reload();
  }, [auth.isLoading, auth.isGuest, online]);

  useEffect(() => {
    const retryStalledSession = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || !auth.isLoading || !authTimedOut || sessionStorage.getItem('objects-auth-loading-recovery')) return;
      sessionStorage.setItem('objects-auth-loading-recovery', String(Date.now()));
      window.location.reload();
    };
    document.addEventListener('visibilitychange', retryStalledSession);
    return () => document.removeEventListener('visibilitychange', retryStalledSession);
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
      <style>{`${styles}\n${responsiveStyles}\n${featureStyles}\n${tagStyles}\n${thingsStyles}`}</style>
      {auth.isLoading ? !online ? <OfflineScreen /> : authTimedOut ? <SessionRecoveryScreen /> : <SignInScreen loading /> : auth.isGuest && !localGuest ? <SignInScreen /> : <ObjectsShell auth={auth} online={online} />}
    </>
  );
}
