import { SignInWithGoogle, signOut, useAuth, useMutation, useQuery } from "lakebed/client";
import { Component } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { mountObjects, syncObjectsState } from "./objects";
import { styles } from "./styles";

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

const OBJECTS_SHELL = `
  <div id="app" class="app-shell" aria-busy="true">
    <aside id="sidebar" class="sidebar" aria-label="Lists">
      <div class="window-bar">
        <button id="sidebar-close" class="icon-button sidebar-close" type="button" aria-label="Close sidebar"></button>
        <span aria-hidden="true" style="flex:1"></span>
        <button id="search-button" class="icon-button" type="button" aria-label="Quick find"></button>
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
  <div id="toast-region" class="toast-region" aria-live="polite"></div>`;

class StableObjectsDom extends Component {
  shouldComponentUpdate() { return false; }
  render() { return <div dangerouslySetInnerHTML={{ __html: OBJECTS_SHELL }} />; }
}

function ObjectsShell({ auth }: { auth: AuthIdentity }) {
  const serializedState = useQuery<string>("state");
  const saveState = useMutation<[serialized: string], string>("saveState");
  const initialState = useRef<string | null>(null);
  if (!initialState.current && typeof serializedState === "string" && serializedState.length > 0) initialState.current = serializedState;
  const ready = Boolean(initialState.current);

  useEffect(() => {
    if (!ready) return;
    return mountObjects(initialState.current!, {
      saveState,
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

  if (!ready) return <SignInScreen loading />;

  return <StableObjectsDom />;
}

export function App() {
  const auth = useAuth();
  const localGuest = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

  useEffect(() => {
    document.title = "Objects";
    const metadata = [
      ["link", "link[rel='manifest']", { rel: "manifest", href: "/manifest.webmanifest" }],
      ["link", "link[rel='apple-touch-icon']", { rel: "apple-touch-icon", href: "/favicon.svg" }],
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
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return (
    <>
      <style>{styles}</style>
      {auth.isLoading ? <SignInScreen loading /> : auth.isGuest && !localGuest ? <SignInScreen /> : <ObjectsShell auth={auth} />}
    </>
  );
}
