import { SignInWithGoogle, signOut, useAuth } from "lakebed/client";
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { activatePwaUpdate, getPwaStatus, initializePwa, requestPwaInstall, showTaskReminder as showToDoReminder } from "../pwa";
import { useLakebedWorkspaceAdapter } from "./lakebed-adapter";
import { scopeWorkspaceAdapter } from "./lakebed-adapter-core";
import { replacementRuntimeReady, type ReplacementAppControls } from "./loader";

const LAST_OWNER_STORAGE_KEY = "objects-replacement-last-owner";

function ensureApplicationMetadata(): void {
  document.title = "Objects";
  const metadata = [
    ["meta", "meta[name='viewport']", { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" }],
    ["link", "link[rel='manifest']", { rel: "manifest", href: "/manifest.webmanifest" }],
    ["meta", "meta[name='theme-color']", { name: "theme-color", content: "#2f80ed" }],
    ["meta", "meta[name='mobile-web-app-capable']", { name: "mobile-web-app-capable", content: "yes" }],
    ["meta", "meta[name='apple-mobile-web-app-capable']", { name: "apple-mobile-web-app-capable", content: "yes" }],
    ["meta", "meta[name='apple-mobile-web-app-title']", { name: "apple-mobile-web-app-title", content: "Objects" }],
    ["meta", "meta[name='apple-mobile-web-app-status-bar-style']", { name: "apple-mobile-web-app-status-bar-style", content: "default" }],
  ] as const;
  for (const [tag, selector, attributes] of metadata) {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement(tag);
      document.head.appendChild(element);
    }
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  }
}

function rememberedOwnerIdentity(): string | null {
  try { return localStorage.getItem(LAST_OWNER_STORAGE_KEY); } catch { return null; }
}

function State({ title, copy, retry = false, children }: { title: string; copy: string; retry?: boolean; children?: ComponentChildren }) {
  return <main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#f4f3ef;color:#222321;font-family:Inter,system-ui,sans-serif"><section style="box-sizing:border-box;width:min(100%,440px);padding:32px;border:1px solid #deddd8;border-radius:22px;background:white;text-align:center"><p style="color:#3077d8;font-size:13px;font-weight:700;text-transform:uppercase">Objects</p><h1>{title}</h1><p style="color:#676863;line-height:1.55">{copy}</p>{children}{retry ? <button type="button" onClick={() => window.location.reload()}>Retry</button> : null}</section></main>;
}

function ReplacementHost({ appControls, offlineIdentity = null }: { appControls: ReplacementAppControls; offlineIdentity?: string | null }) {
  const { adapter, loading, ownerIdentity } = useLakebedWorkspaceAdapter();
  const effectiveIdentity = loading ? offlineIdentity : ownerIdentity;
  const waitingForIdentity = loading && !effectiveIdentity;
  const identityConfirmed = !loading && ownerIdentity === effectiveIdentity;
  const confirmedOwnerRef = useRef<string | null>(null);
  confirmedOwnerRef.current = identityConfirmed ? ownerIdentity : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const scopedAdapter = useMemo(
    () => scopeWorkspaceAdapter(adapter, effectiveIdentity ?? "", () => confirmedOwnerRef.current),
    [adapter, effectiveIdentity],
  );

  useEffect(() => () => { confirmedOwnerRef.current = null; }, []);

  useEffect(() => {
    if (loading) return;
    try { localStorage.setItem(LAST_OWNER_STORAGE_KEY, ownerIdentity); } catch { /* Local storage can be unavailable. */ }
  }, [loading, ownerIdentity]);

  useEffect(() => {
    if (waitingForIdentity || !effectiveIdentity || !rootRef.current) return;
    let active = true;
    let dispose: (() => void) | undefined;
    void replacementRuntimeReady.then((runtime) => {
      if (active && rootRef.current) dispose = runtime.mountReplacement(rootRef.current, scopedAdapter, (toDo) => showToDoReminder(toDo, { replacement: true }), effectiveIdentity, appControls);
    });
    return () => { active = false; dispose?.(); };
  }, [waitingForIdentity, effectiveIdentity, scopedAdapter, appControls]);

  return waitingForIdentity ? <State title="Loading your Workspace" copy="Checking the private Lakebed copy for this account." /> : <div ref={rootRef} />;
}

export function ReplacementApp() {
  const auth = useAuth();
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const localGuest = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  useEffect(() => {
    if (!auth.isLoading) { setSessionUnavailable(false); return; }
    const timer = window.setTimeout(() => setSessionUnavailable(true), 4000);
    return () => window.clearTimeout(timer);
  }, [auth.isLoading]);
  useEffect(() => {
    ensureApplicationMetadata();
    return initializePwa();
  }, []);

  const appControls: ReplacementAppControls = {
    accountName: auth.displayName || auth.email || (auth.isLoading ? "Offline Workspace" : "Lakebed account"),
    signOut,
    getPwaStatus,
    requestInstall: requestPwaInstall,
    applyUpdate: activatePwaUpdate,
  };

  if (auth.isLoading) {
    const offlineIdentity = rememberedOwnerIdentity();
    if (offlineIdentity) return <ReplacementHost appControls={appControls} offlineIdentity={offlineIdentity} />;
    return <State title={sessionUnavailable ? "Your session is unavailable" : "Checking your private session"} copy={sessionUnavailable ? "Lakebed has not confirmed the session yet. Pending changes remain safe on this device while you reconnect." : "Objects opens after Lakebed confirms your account."} retry={sessionUnavailable} />;
  }
  if (auth.isGuest && !localGuest) return <State title="Sign in to your Workspace" copy="Google sign-in keeps every read and change private to your account."><SignInWithGoogle /></State>;
  return <ReplacementHost appControls={appControls} />;
}
