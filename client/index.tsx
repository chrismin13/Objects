import { SignInWithGoogle, signOut, useAuth, useMutation, useQuery } from "lakebed/client";
import { Component } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { initializePwa } from "./pwa";
import { objectsTheme } from "./theme";
import { webAwesomeReady } from "./vendor/webawesome/loader";
import { objectsRuntimeReady } from "./runtime/loader";
import { ComponentGallery, isComponentGalleryLocation } from "./features/gallery/component-gallery";
import { ReplacementApp } from "./replacement";

type AuthIdentity = ReturnType<typeof useAuth>;

void webAwesomeReady;

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

const WaDropdown = "wa-dropdown" as never;

class StableObjectsDom extends Component {
  shouldComponentUpdate() { return false; }
  render() {
    return <>
      <div id="objects-shell" className="app-shell" aria-busy="true">
        <span id="sidebar-anchor" hidden />
        <aside id="sidebar" className="sidebar" aria-label="Lists">
          <div className="window-bar">
            <button id="sidebar-close" className="icon-button sidebar-close" type="button" aria-label="Close sidebar" />
            <div id="space-controls" className="space-controls" aria-label="Task Space" />
            <div className="window-actions">
              <button id="space-settings-button" className="icon-button space-settings-button" type="button" aria-label="Spaces and launch schedule" />
              <button id="search-button" className="icon-button" type="button" aria-label="Quick find" />
            </div>
          </div>
          <nav id="sidebar-nav" className="sidebar-nav" />
          <div className="sidebar-footer">
            <button id="new-list-button" className="quiet-button" type="button" />
            <div className="sidebar-tools">
              <button id="settings-button" className="icon-button" type="button" aria-label="Settings" />
              <button id="theme-button" className="icon-button" type="button" aria-label="Change theme" />
            </div>
          </div>
        </aside>
        <main className="main-pane">
          <header className="mobile-header">
            <button id="sidebar-open" className="icon-button" type="button" aria-label="Open sidebar" />
            <span className="mobile-brand">Objects</span>
            <button id="mobile-search" className="icon-button" type="button" aria-label="Quick find" />
          </header>
          <section id="content" className="content" aria-live="polite" />
          <button id="magic-add" className="magic-add" type="button" aria-label="Quick add to-do" />
        </main>
        <span id="inspector-anchor" hidden />
        <aside id="inspector" className="inspector" aria-label="To-do details" />
        <div id="sidebar-scrim" className="scrim" />
      </div>
      <div id="drawer-root" />
      <div id="modal-root" />
      <WaDropdown id="context-menu" class="context-menu" placement="bottom-start" distance="0">
        <button className="context-menu-trigger" slot="trigger" type="button" tabIndex={-1} aria-hidden="true" />
        <div id="context-menu-items" />
      </WaDropdown>
      <div id="toast-region" className="toast-region" aria-live="polite" />
    </>;
  }
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
    let active = true;
    let dispose: (() => void) | undefined;
    void objectsRuntimeReady.then(({ mountObjects }) => {
      if (!active) return;
      dispose = mountObjects(initialState.current!, {
        initializeState: initializeNormalized,
        saveChanges: applyChanges,
        user: auth,
        signOut: async () => {
          await signOut();
          window.location.reload();
        }
      });
    });
    return () => { active = false; dispose?.(); };
  }, [ready]);

  useEffect(() => {
    if (typeof serializedState === "string" && serializedState.length > 0) {
      void objectsRuntimeReady.then(({ syncObjectsState }) => syncObjectsState(serializedState));
    }
  }, [serializedState]);

  useEffect(() => {
    if (ready) { setStateTimedOut(false); return; }
    const timer = window.setTimeout(() => setStateTimedOut(true), 4000);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (!ready) return !online ? <OfflineScreen /> : stateTimedOut ? <SessionRecoveryScreen /> : <SignInScreen loading />;

  return <StableObjectsDom />;
}

function CurrentApp() {
  const auth = useAuth();
  const componentGallery = isComponentGalleryLocation();
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
      <style>{objectsTheme}</style>
      {componentGallery ? <ComponentGallery /> : auth.isLoading ? !online ? <OfflineScreen /> : authTimedOut ? <SessionRecoveryScreen /> : <SignInScreen loading /> : auth.isGuest && !localGuest ? <SignInScreen /> : <ObjectsShell auth={auth} online={online} />}
    </>
  );
}

export function App() {
  const replacement = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("replacement") === "1";
  return replacement ? <ReplacementApp /> : <CurrentApp />;
}
