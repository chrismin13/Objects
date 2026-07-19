import { SignInWithGoogle, useAuth } from "lakebed/client";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { WorkspaceSyncAdapter } from "../../shared/replacement/sync";
import { initializePwa, showTaskReminder as showToDoReminder } from "../pwa";
import { webAwesomeReady } from "../vendor/webawesome/loader";
import { useLakebedWorkspaceAdapter } from "./lakebed-adapter";
import { replacementRuntimeReady } from "./loader";

function State({ title, copy, retry = false, children }: { title: string; copy: string; retry?: boolean; children?: ComponentChildren }) {
  return <main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#f4f3ef;color:#222321;font-family:Inter,system-ui,sans-serif"><section style="box-sizing:border-box;width:min(100%,440px);padding:32px;border:1px solid #deddd8;border-radius:22px;background:white;text-align:center"><p style="color:#3077d8;font-size:13px;font-weight:700;text-transform:uppercase">Objects</p><h1>{title}</h1><p style="color:#676863;line-height:1.55">{copy}</p>{children}{retry ? <button type="button" onClick={() => window.location.reload()}>Retry</button> : null}</section></main>;
}

function ReplacementHost() {
  const { adapter, loading } = useLakebedWorkspaceAdapter();
  const adapterRef = useRef(adapter);
  const rootRef = useRef<HTMLDivElement>(null);
  const proxyRef = useRef<WorkspaceSyncAdapter>({
    load: () => adapterRef.current.load(),
    save: (command) => adapterRef.current.save(command),
  });
  adapterRef.current = adapter;

  useEffect(() => {
    if (loading || !rootRef.current) return;
    let active = true;
    let dispose: (() => void) | undefined;
    void Promise.all([replacementRuntimeReady, webAwesomeReady]).then(([runtime]) => {
      if (active && rootRef.current) dispose = runtime.mountReplacement(rootRef.current, proxyRef.current, (toDo) => showToDoReminder(toDo, { replacement: true }));
    });
    return () => { active = false; dispose?.(); };
  }, [loading]);

  return loading ? <State title="Loading your Workspace" copy="Checking the private Lakebed copy for this account." /> : <div ref={rootRef} />;
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
  useEffect(() => initializePwa(), []);

  if (auth.isLoading) return <State title={sessionUnavailable ? "Your session is unavailable" : "Checking your private session"} copy={sessionUnavailable ? "Lakebed has not confirmed the session yet." : "Objects opens after Lakebed confirms your account."} retry={sessionUnavailable} />;
  if (auth.isGuest && !localGuest) return <State title="Sign in to your Workspace" copy="Google sign-in keeps every read and change private to your account."><SignInWithGoogle /></State>;
  return <ReplacementHost />;
}
