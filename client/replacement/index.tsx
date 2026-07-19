import { SignInWithGoogle, useAuth } from "lakebed/client";
import { Component, type ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

import { createEmptyWorkspace, createWorkspace, FULL_IMPORT_CONFIRMATION } from "../../shared/replacement/workspace";
import type { ImportReport } from "../../shared/replacement/importer";
import type { WorkspaceDocument } from "../../shared/replacement/model";
import { useLakebedWorkspaceAdapter } from "./lakebed-adapter";
import { replacementStyles } from "./styles";

type BoundaryState = { failed: boolean };

class ReplacementLoadBoundary extends Component<{ children: ComponentChildren }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <ReplacementState title="The replacement Workspace could not load" copy="Your current Objects app is unchanged. Retry this comparison view when the connection is ready.">
        <button className="replacement-button" type="button" onClick={() => window.location.reload()}>Retry loading</button>
      </ReplacementState>;
    }
    return this.props.children;
  }
}

function ReplacementState({ title, copy, children }: { title: string; copy: string; children?: ComponentChildren }) {
  return <main className="replacement-state">
    <section className="replacement-state-card" aria-labelledby="replacement-state-title">
      <p className="replacement-kicker">Objects replacement</p>
      <h1 id="replacement-state-title">{title}</h1>
      <p>{copy}</p>
      {children}
    </section>
  </main>;
}

function newWorkspaceDocument(): WorkspaceDocument {
  return createEmptyWorkspace(new Date().toISOString());
}

function workspaceFor(document: WorkspaceDocument) {
  return createWorkspace(document, {
    now: () => new Date().toISOString(),
    createId: (kind) => `${kind}-${crypto.randomUUID()}`,
  });
}

function reportText(report: ImportReport): string {
  const imported = report.imported;
  const total = imported.spaces + imported.areas + imported.projects + imported.headings + imported.tags
    + imported.toDos + imported.repeatingTemplates + imported.calendarEvents;
  return `Imported ${total} items. Corrected ${report.corrected}, skipped ${report.skipped}, rejected ${report.rejected}.`;
}

function ReplacementWorkspace() {
  const { adapter, loading } = useLakebedWorkspaceAdapter();
  const [snapshot, setSnapshot] = useState<{ revision: number; document: WorkspaceDocument } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [backup, setBackup] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [report, setReport] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    let active = true;
    adapter.load().then((next) => {
      if (!active) return;
      setSnapshot(next ?? { revision: 0, document: newWorkspaceDocument() });
      setLoaded(true);
      setLoadError(false);
    }).catch(() => {
      if (active) setLoadError(true);
    });
    return () => { active = false; };
  }, [adapter, loading]);

  const workspace = useMemo(() => snapshot ? workspaceFor(snapshot.document) : null, [snapshot]);
  const today = new Date().toISOString().slice(0, 10);

  if (loadError) return <ReplacementState title="The replacement data is unavailable" copy="The comparison shell is safe to retry. The current production Workspace has not been changed.">
    <button className="replacement-button" type="button" onClick={() => window.location.reload()}>Retry loading</button>
  </ReplacementState>;
  if (!loaded || !workspace || !snapshot) return <ReplacementState title="Loading your replacement Workspace" copy="Checking the private Lakebed sync copy for this account." />;

  const importBackup = async () => {
    setSaving(true);
    try {
      const stagedWorkspace = workspaceFor(snapshot.document);
      const result = stagedWorkspace.importPortableBackup(backup, confirmation);
      if (result.status === "rejected") {
        const errors = result.errors.join(" ");
        setReport({ text: `${errors ? `${errors} ` : ""}${reportText(result.report)}`, error: true });
        return;
      }
      const mutationId = `import-${crypto.randomUUID()}`;
      const stagedDocument = stagedWorkspace.read();
      const syncResult = await adapter.save({ expectedRevision: snapshot.revision, mutationId, document: stagedDocument });
      if (syncResult.status !== "acknowledged") {
        setReport({ text: syncResult.status === "rejected" ? syncResult.errors.join(" ") : "The Workspace changed on another device. Reload and review before importing again.", error: true });
        return;
      }
      setSnapshot({ revision: syncResult.revision, document: stagedDocument });
      setReport({ text: reportText(result.report), error: false });
      setBackup("");
      setConfirmation("");
    } catch {
      setReport({ text: "The import could not be saved. Your previous replacement Workspace is still available.", error: true });
    } finally {
      setSaving(false);
    }
  };

  const document = workspace.read();
  return <div className="replacement-shell">
    <aside className="replacement-sidebar" aria-label="Replacement lists">
      <div className="replacement-brand"><span className="replacement-brand-mark" aria-hidden="true">O</span>Objects <span className="replacement-badge">Preview</span></div>
      <nav className="replacement-nav">
        <div className="replacement-nav-row active"><span>Today</span><span>{workspace.view({ kind: "today", date: today }).length}</span></div>
        <div className="replacement-nav-row"><span>Inbox</span><span>{workspace.view({ kind: "inbox", date: today }).length}</span></div>
        <div className="replacement-nav-row"><span>Upcoming</span><span>{workspace.view({ kind: "upcoming", date: today }).length}</span></div>
        <div className="replacement-nav-row"><span>Anytime</span><span>{workspace.view({ kind: "anytime", date: today }).length}</span></div>
        <div className="replacement-nav-row"><span>Someday</span><span>{workspace.view({ kind: "someday", date: today }).length}</span></div>
      </nav>
      <p className="replacement-sidebar-note">This is the parallel replacement foundation. The normal Objects URL still opens the current app.</p>
    </aside>
    <main className="replacement-main">
      <div className="replacement-main-inner">
        <header><p className="replacement-kicker">Comparison shell</p><h1>Today</h1><p className="replacement-subtitle">A typed Preact view backed by the new pure Workspace module.</p></header>
        <section className="replacement-grid" aria-label="Workspace summary">
          <article className="replacement-stat"><strong>{document.toDos.length}</strong><span>to-dos</span></article>
          <article className="replacement-stat"><strong>{document.projects.length}</strong><span>Projects</span></article>
          <article className="replacement-stat"><strong>{document.spaces.length}</strong><span>Spaces</span></article>
        </section>
        <section className="replacement-import" aria-labelledby="replacement-import-title">
          <h2 id="replacement-import-title">Import the current portable backup</h2>
          <p>This replaces only this account’s replacement Workspace. The current production Workspace and normal Objects URL stay unchanged. Type <strong>{FULL_IMPORT_CONFIRMATION}</strong> before importing.</p>
          <div className="replacement-import-controls">
            <input className="replacement-file" type="file" accept="application/json,.json" aria-label="Choose Objects JSON backup" onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void file.text().then(setBackup);
            }} />
            <input className="replacement-confirmation" value={confirmation} onInput={(event) => setConfirmation(event.currentTarget.value)} placeholder={FULL_IMPORT_CONFIRMATION} aria-label="Full import confirmation" />
            <button className="replacement-button" type="button" disabled={!backup || saving} onClick={() => void importBackup()}>{saving ? "Importing…" : "Import backup"}</button>
          </div>
          {report ? <div className={`replacement-report${report.error ? " error" : ""}`} role="status">{report.text}</div> : null}
        </section>
      </div>
    </main>
  </div>;
}

export function ReplacementApp() {
  const auth = useAuth();
  const [sessionUnavailable, setSessionUnavailable] = useState(false);

  useEffect(() => {
    if (!auth.isLoading) {
      setSessionUnavailable(false);
      return;
    }
    const timer = window.setTimeout(() => setSessionUnavailable(true), 4000);
    return () => window.clearTimeout(timer);
  }, [auth.isLoading]);

  useEffect(() => { document.title = "Objects replacement preview"; }, []);

  return <>
    <style>{replacementStyles}</style>
    {auth.isLoading
      ? <ReplacementState title={sessionUnavailable ? "Your session is unavailable" : "Checking your private session"} copy={sessionUnavailable ? "Lakebed has not confirmed the session yet. Retry without leaving the current Objects app." : "The replacement only opens after Lakebed confirms your account."}>{sessionUnavailable ? <button className="replacement-button" type="button" onClick={() => window.location.reload()}>Retry session</button> : null}</ReplacementState>
      : auth.isGuest
        ? <ReplacementState title="Sign in to the replacement Workspace" copy="Google sign-in keeps every replacement read and change private to your account."><SignInWithGoogle className="replacement-button" /></ReplacementState>
        : <ReplacementLoadBoundary><ReplacementWorkspace /></ReplacementLoadBoundary>}
  </>;
}
