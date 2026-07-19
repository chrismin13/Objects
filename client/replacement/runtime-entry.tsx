import { Component, render, type ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { ImportReport } from "../../shared/replacement/importer";
import type { Project, Schedule, ToDo, WorkspaceDocument, WorkspaceUndo } from "../../shared/replacement/model";
import {
  EMPTY_TRASH_CONFIRMATION,
  FULL_IMPORT_CONFIRMATION,
  PERMANENT_DELETE_CONFIRMATION,
  createEmptyWorkspace,
  createWorkspace,
  type WorkspaceChange,
  type WorkspaceView,
} from "../../shared/replacement/workspace";
import type { WorkspaceSyncCommand } from "../../shared/replacement/sync";
import type { WorkspaceSyncAdapter } from "../../shared/replacement/sync";
import { replacementStyles } from "./styles";

type BoundaryState = { failed: boolean };
type Feedback = { text: string; error: boolean; undo?: WorkspaceUndo; undoDocument?: WorkspaceDocument };

const QUICK_DRAFT_KEY = "objects-replacement-quick-draft";

class ReplacementLoadBoundary extends Component<{ children: ComponentChildren }, BoundaryState> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }
  render() {
    if (this.state.failed) return <ReplacementState title="The replacement Workspace could not load" copy="Your saved work is safe. Retry when the connection is ready."><button className="replacement-button" type="button" onClick={() => window.location.reload()}>Retry loading</button></ReplacementState>;
    return this.props.children;
  }
}

function ReplacementState({ title, copy, children }: { title: string; copy: string; children?: ComponentChildren }) {
  return <main className="replacement-state"><section className="replacement-state-card" aria-labelledby="replacement-state-title"><p className="replacement-kicker">Objects replacement</p><h1 id="replacement-state-title">{title}</h1><p>{copy}</p>{children}</section></main>;
}

function newWorkspaceDocument(): WorkspaceDocument { return createEmptyWorkspace(new Date().toISOString()); }

function workspaceFor(document: WorkspaceDocument) {
  return createWorkspace(document, { now: () => new Date().toISOString(), createId: (kind) => `${kind}-${crypto.randomUUID()}` });
}

function reportText(report: ImportReport): string {
  const imported = report.imported;
  const total = imported.spaces + imported.areas + imported.projects + imported.headings + imported.tags + imported.toDos + imported.repeatingTemplates + imported.calendarEvents;
  return `Imported ${total} items. Corrected ${report.corrected}, skipped ${report.skipped}, rejected ${report.rejected}.`;
}

function datePlus(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function viewTitle(view: WorkspaceView, document: WorkspaceDocument): string {
  const standard: Record<string, string> = { today: "Today", thisEvening: "This Evening", tomorrow: "Tomorrow", upcoming: "Upcoming", inbox: "Inbox", anytime: "Anytime", someday: "Someday", deadlines: "Deadlines", logbook: "Logbook", trash: "Trash" };
  if (standard[view.kind]) return standard[view.kind];
  if (!("id" in view)) return "Objects";
  const collection = view.kind === "space" ? document.spaces : view.kind === "area" ? document.areas : view.kind === "project" ? document.projects : document.headings;
  return collection.find((item) => item.id === view.id)?.title ?? "Missing list";
}

function createDefaults(view: WorkspaceView): { schedule: Schedule; location?: ToDo["location"] } {
  if (view.kind === "today") return { schedule: { kind: "scheduled", date: view.date, evening: false } };
  if (view.kind === "thisEvening") return { schedule: { kind: "scheduled", date: view.date, evening: true } };
  if (view.kind === "tomorrow") return { schedule: { kind: "scheduled", date: view.date, evening: false } };
  if (view.kind === "anytime" || view.kind === "someday" || view.kind === "inbox") return { schedule: { kind: view.kind } };
  if (view.kind === "area") return { schedule: { kind: "inbox" }, location: { kind: "area", areaId: view.id } };
  if (view.kind === "project") return { schedule: { kind: "inbox" }, location: { kind: "project", projectId: view.id } };
  if (view.kind === "heading") return { schedule: { kind: "inbox" }, location: { kind: "heading", headingId: view.id } };
  if (view.kind === "space") return { schedule: { kind: "inbox" }, location: { kind: "unfiled", spaceId: view.id } };
  return { schedule: { kind: "inbox" } };
}

function MarkdownPreview({ value }: { value: string }) {
  if (!value.trim()) return <p className="replacement-muted">Nothing to preview yet.</p>;
  return <div className="replacement-markdown">{value.split("\n").map((line, index) => line.startsWith("## ") ? <h3 key={index}>{line.slice(3)}</h3> : line.startsWith("# ") ? <h2 key={index}>{line.slice(2)}</h2> : line.startsWith("- ") ? <li key={index}>{line.slice(2)}</li> : <p key={index}>{line || " "}</p>)}</div>;
}

function Inspector({ item, document, saving, runChange, close }: {
  item: ToDo;
  document: WorkspaceDocument;
  saving: boolean;
  runChange: (change: WorkspaceChange) => Promise<boolean>;
  close: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const tags = item.tags.map((id) => document.tags.find((tag) => tag.id === id)?.title).filter(Boolean).join(", ");
  const noteMatches = noteSearch ? item.notes.split("\n").filter((line) => line.toLowerCase().includes(noteSearch.toLowerCase())) : [];
  const scheduleKind = item.schedule.kind;

  const update = (changes: Extract<WorkspaceChange, { type: "updateToDo" }>["changes"]) => runChange({ type: "updateToDo", id: item.id, changes });
  return <aside className="replacement-inspector" aria-label="To-do inspector" aria-busy={saving}>
    <div className="replacement-inspector-head"><span>To-do details</span><button className="replacement-icon-button" type="button" onClick={close} aria-label="Close inspector">×</button></div>
    <label>Title<input defaultValue={item.title} onBlur={(event) => { if (event.currentTarget.value !== item.title) void update({ title: event.currentTarget.value }); }} /></label>
    <div className="replacement-tabs"><button type="button" className={!preview ? "active" : ""} onClick={() => setPreview(false)}>Markdown notes</button><button type="button" className={preview ? "active" : ""} onClick={() => setPreview(true)}>Preview</button></div>
    {preview ? <MarkdownPreview value={item.notes} /> : <textarea rows={7} defaultValue={item.notes} onBlur={(event) => { if (event.currentTarget.value !== item.notes) void update({ notes: event.currentTarget.value }); }} placeholder="Add notes with Markdown…" />}
    <label>Search notes<input type="search" value={noteSearch} onInput={(event) => setNoteSearch(event.currentTarget.value)} placeholder="Find text in notes" /></label>
    {noteSearch ? <p className="replacement-search-result">{noteMatches.length ? `${noteMatches.length} matching line${noteMatches.length === 1 ? "" : "s"}` : "No matches"}</p> : null}

    <fieldset><legend>Checklist</legend>{item.checklist.map((checklistItem) => <div className="replacement-checklist" key={checklistItem.id}><input aria-label={`Complete ${checklistItem.title}`} type="checkbox" checked={checklistItem.completed} onChange={(event) => void runChange({ type: "updateChecklistItem", toDoId: item.id, itemId: checklistItem.id, changes: { completed: event.currentTarget.checked } })} /><input defaultValue={checklistItem.title} onBlur={(event) => { if (event.currentTarget.value !== checklistItem.title) void runChange({ type: "updateChecklistItem", toDoId: item.id, itemId: checklistItem.id, changes: { title: event.currentTarget.value } }); }} /><button type="button" aria-label={`Remove ${checklistItem.title}`} onClick={() => void runChange({ type: "removeChecklistItem", toDoId: item.id, itemId: checklistItem.id })}>×</button></div>)}<form onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("checklist-title") as HTMLInputElement; void runChange({ type: "addChecklistItem", toDoId: item.id, title: input.value }).then((saved) => { if (saved) input.value = ""; }); }}><input name="checklist-title" placeholder="New checklist item" /><button type="submit">Add</button></form></fieldset>

    <label>Schedule<select value={scheduleKind} onChange={(event) => { const kind = event.currentTarget.value; void update({ schedule: kind === "scheduled" ? { kind, date: item.schedule.kind === "scheduled" ? item.schedule.date : new Date().toISOString().slice(0, 10), evening: false } : { kind } as Schedule }); }}><option value="inbox">Inbox</option><option value="anytime">Anytime</option><option value="someday">Someday</option><option value="scheduled">Date</option></select></label>
    {item.schedule.kind === "scheduled" ? <><label>Schedule date<input type="date" value={item.schedule.date} onChange={(event) => void update({ schedule: { ...item.schedule as Extract<Schedule, { kind: "scheduled" }>, date: event.currentTarget.value } })} /></label><label className="replacement-inline-check"><input type="checkbox" checked={item.schedule.evening} onChange={(event) => void update({ schedule: { ...item.schedule as Extract<Schedule, { kind: "scheduled" }>, evening: event.currentTarget.checked } })} />This Evening</label></> : null}
    <label>Reminder<input type="datetime-local" value={item.reminder?.at.slice(0, 16) ?? ""} onChange={(event) => void update({ reminder: event.currentTarget.value ? { at: `${event.currentTarget.value}:00.000Z`, sentAt: null } : null })} /></label>
    {item.reminder ? <button className="replacement-snooze" type="button" onClick={() => void runChange({ type: "snoozeReminder", id: item.id, until: new Date(Date.now() + 15 * 60 * 1000).toISOString() })}>Snooze Reminder 15 minutes</button> : null}
    <label>Deadline<input type="date" value={item.deadline ?? ""} onChange={(event) => void update({ deadline: event.currentTarget.value || null })} /></label>
    <label>Tags<input defaultValue={tags} onBlur={(event) => void runChange({ type: "setToDoTags", id: item.id, titles: event.currentTarget.value.split(",") })} placeholder="work, urgent" /></label>

    <div className="replacement-actions">
      {item.trashedAt ? <><button type="button" onClick={() => void runChange({ type: "restoreToDo", id: item.id })}>Restore</button><button className="danger" type="button" onClick={() => { if (window.confirm("Permanently delete this to-do? This cannot be undone.")) void runChange({ type: "permanentlyDeleteToDo", id: item.id, confirmation: PERMANENT_DELETE_CONFIRMATION }).then(close); }}>Delete forever</button></> : <>
        {item.outcome === "open" ? <><button className="replacement-button" type="button" onClick={() => void runChange({ type: "completeToDo", id: item.id })}>Complete</button><button type="button" onClick={() => void runChange({ type: "cancelToDo", id: item.id })}>Cancel</button></> : <><button type="button" onClick={() => void runChange({ type: "reopenToDo", id: item.id })}>Reopen</button>{!item.logbookAt ? <button type="button" onClick={() => void runChange({ type: "logToDo", id: item.id })}>Move to Logbook</button> : null}</>}
        <button type="button" onClick={() => void runChange({ type: "duplicateToDo", id: item.id })}>Duplicate</button>
        <button type="button" onClick={() => void navigator.clipboard.writeText(`${location.origin}${location.pathname}?replacement=1&todo=${item.id}`)}>Copy link</button>
        {navigator.share ? <button type="button" onClick={() => void navigator.share({ title: item.title, text: item.notes, url: `${location.origin}${location.pathname}?replacement=1&todo=${item.id}` })}>Share</button> : null}
        <button className="danger" type="button" onClick={() => void runChange({ type: "trashToDo", id: item.id })}>Move to Trash</button>
      </>}
    </div>
  </aside>;
}

function ReplacementWorkspace({ adapter, showReminder }: { adapter: WorkspaceSyncAdapter; showReminder: (toDo: { id: string; title: string; notes?: string }) => Promise<boolean> }) {
  const [snapshot, setSnapshot] = useState<{ revision: number; document: WorkspaceDocument } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedView, setSelectedView] = useState<WorkspaceView>(() => ({ kind: "today", date: new Date().toISOString().slice(0, 10) }));
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(location.search).get("todo"));
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => localStorage.getItem(QUICK_DRAFT_KEY) ?? "");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backup, setBackup] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const pending = useRef<{ command: WorkspaceSyncCommand; document: WorkspaceDocument } | null>(null);
  const quickInput = useRef<HTMLInputElement>(null);
  const dailyLogbookDate = useRef<string | null>(null);
  const notificationSnoozeHandled = useRef(false);

  useEffect(() => {
    let active = true;
    adapter.load().then((next) => {
      if (!active) return;
      const loadedSnapshot = next ?? { revision: 0, document: newWorkspaceDocument() };
      setSnapshot(loadedSnapshot);
      setActiveSpaceId((current) => current ?? loadedSnapshot.document.settings.defaultSpaceId);
      if (!localStorage.getItem(QUICK_DRAFT_KEY) && loadedSnapshot.document.settings.quickDraft?.value) setDraft(loadedSnapshot.document.settings.quickDraft.value);
      setLoaded(true);
      setLoadError(false);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [adapter]);

  const saveDocument = async (command: WorkspaceSyncCommand, document: WorkspaceDocument): Promise<boolean> => {
    setSaving(true);
    pending.current = { command, document };
    try {
      const result = await adapter.save(command);
      if (result.status === "acknowledged") {
        document.sync = { revision: result.revision, lastMutationId: command.mutationId, updatedAt: new Date().toISOString() };
        setSnapshot({ revision: result.revision, document });
        pending.current = null;
        return true;
      }
      if (result.status === "conflict") setSnapshot(result.snapshot);
      setFeedback({ text: result.status === "rejected" ? result.errors.join(" ") : "This Workspace changed somewhere else. Your copy was reloaded; please try the action again.", error: true });
      return false;
    } catch {
      setFeedback({ text: "This change could not be saved. Your action is still shown and can be retried safely.", error: true });
      return false;
    } finally { setSaving(false); }
  };

  const retrySave = async () => {
    if (!pending.current) return;
    const saved = await saveDocument(pending.current.command, pending.current.document);
    if (saved) setFeedback({ text: "The change was saved.", error: false });
  };

  const runChange = async (change: WorkspaceChange): Promise<boolean> => {
    if (!snapshot || saving) return false;
    const workspace = workspaceFor(snapshot.document);
    const result = workspace.change(change);
    if (result.status === "rejected") {
      setFeedback({ text: result.errors.join(" "), error: true });
      return false;
    }
    const document = workspace.read();
    setSnapshot({ revision: snapshot.revision, document });
    setFeedback({ text: result.outcome.replaceAll("-", " "), error: false, ...(result.undo ? { undo: result.undo, undoDocument: snapshot.document } : {}) });
    const command = { expectedRevision: snapshot.revision, mutationId: `workspace-${crypto.randomUUID()}`, document };
    return saveDocument(command, document);
  };

  useEffect(() => {
    if (!loaded || !snapshot || dailyLogbookDate.current === new Date().toISOString().slice(0, 10)) return;
    const today = new Date().toISOString().slice(0, 10);
    dailyLogbookDate.current = today;
    const needsDailyLog = snapshot.document.settings.logCompletedItems === "daily" && snapshot.document.toDos.some((item) => item.outcome !== "open" && !item.logbookAt && !item.trashedAt && item.completedAt && item.completedAt.slice(0, 10) < today);
    if (needsDailyLog) void runChange({ type: "runDailyLogbook" });
  }, [loaded, snapshot?.revision]);

  useEffect(() => {
    if (!loaded || !snapshot || !selectedId || notificationSnoozeHandled.current) return;
    const params = new URLSearchParams(location.search);
    const minutes = Number(params.get("snooze"));
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    notificationSnoozeHandled.current = true;
    const until = new Date(Date.now() + Math.min(1440, minutes) * 60_000).toISOString();
    void runChange({ type: "snoozeReminder", id: selectedId, until }).then((saved) => {
      if (!saved) return;
      params.delete("snooze");
      history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
    });
  }, [loaded, selectedId, snapshot?.revision]);

  useEffect(() => {
    if (!loaded || !snapshot?.document.settings.notifications) return;
    const checkReminders = () => {
      if (saving) return;
      const due = snapshot.document.toDos.find((item) => item.outcome === "open" && !item.trashedAt && item.reminder && !item.reminder.sentAt && Date.parse(item.reminder.at) <= Date.now());
      if (!due?.reminder) return;
      void showReminder(due).then((shown) => {
        if (shown) void runChange({ type: "updateToDo", id: due.id, changes: { reminder: { ...due.reminder!, sentAt: new Date().toISOString() } } });
      });
    };
    checkReminders();
    const timer = window.setInterval(checkReminders, 30_000);
    return () => window.clearInterval(timer);
  }, [loaded, saving, snapshot?.revision]);

  const undo = async (undoInfo: WorkspaceUndo, undoDocument: WorkspaceDocument | undefined) => {
    if (!snapshot || saving || !undoDocument) return;
    const document = JSON.parse(JSON.stringify(undoDocument)) as WorkspaceDocument;
    setSnapshot({ revision: snapshot.revision, document });
    const saved = await saveDocument({ expectedRevision: snapshot.revision, mutationId: `undo-${undoInfo.token}-${crypto.randomUUID()}`, document }, document);
    setFeedback({ text: saved ? "The change was undone." : "The undo could not be saved yet.", error: !saved });
  };

  const today = new Date().toISOString().slice(0, 10);
  const normalizedView: WorkspaceView = selectedView.kind === "tomorrow" ? { ...selectedView, date: datePlus(today, 1) } : { ...selectedView, date: today } as WorkspaceView;
  const workspace = useMemo(() => snapshot ? workspaceFor(snapshot.document) : null, [snapshot]);

  if (loadError) return <ReplacementState title="The replacement data is unavailable" copy="Your saved Workspace has not been changed."><button className="replacement-button" type="button" onClick={() => window.location.reload()}>Retry loading</button></ReplacementState>;
  if (!loaded || !workspace || !snapshot) return <ReplacementState title="Loading your Workspace" copy="Checking the private Lakebed copy for this account." />;

  const document = snapshot.document;
  const items = workspace.view(normalizedView);
  const selected = selectedId ? document.toDos.find((item) => item.id === selectedId) ?? null : null;
  const nav = (view: WorkspaceView, label: string) => <button type="button" className={`replacement-nav-row${selectedView.kind === view.kind && (!("id" in view) || ("id" in selectedView && selectedView.id === view.id)) ? " active" : ""}`} onClick={() => { setSelectedView(view); setSelectedId(null); setActiveSpaceId(workspace.spaceIdForView(view) ?? activeSpaceId); }}><span>{label}</span><span>{workspace.view(view).length}</span></button>;

  const submitQuickEntry = async () => {
    const value = draft.trim();
    if (!value) return;
    const defaults = createDefaults(normalizedView);
    const saved = await runChange({ type: "createToDo", title: value, ...defaults, quickEntry: { referenceDate: today } });
    if (saved) { setDraft(""); localStorage.removeItem(QUICK_DRAFT_KEY); }
  };

  const importBackup = async () => {
    const staged = workspaceFor(document);
    const result = staged.importPortableBackup(backup, confirmation);
    if (result.status === "rejected") { setFeedback({ text: `${result.errors.join(" ")} ${reportText(result.report)}`, error: true }); return; }
    const next = staged.read();
    setSnapshot({ revision: snapshot.revision, document: next });
    const saved = await saveDocument({ expectedRevision: snapshot.revision, mutationId: `import-${crypto.randomUUID()}`, document: next }, next);
    if (saved) { setFeedback({ text: reportText(result.report), error: false }); setBackup(""); setConfirmation(""); setBackupOpen(false); }
  };

  return <div className={`replacement-shell${selected ? " inspector-open" : ""}`} aria-busy={saving}>
    <aside className="replacement-sidebar" aria-label="Lists">
      <div className="replacement-brand"><span className="replacement-brand-mark" aria-hidden="true">O</span>Objects <span className="replacement-badge">Preview</span></div>
      <nav className="replacement-nav">
        {nav({ kind: "inbox", date: today }, "Inbox")}{nav({ kind: "today", date: today }, "Today")}{nav({ kind: "thisEvening", date: today }, "This Evening")}{nav({ kind: "tomorrow", date: datePlus(today, 1) }, "Tomorrow")}{nav({ kind: "upcoming", date: today }, "Upcoming")}{nav({ kind: "anytime", date: today }, "Anytime")}{nav({ kind: "someday", date: today }, "Someday")}{nav({ kind: "deadlines", date: today }, "Deadlines")}{nav({ kind: "logbook", date: today }, "Logbook")}{nav({ kind: "trash", date: today }, "Trash")}
      </nav>
      {document.spaces.length ? <div className="replacement-nav-group"><h2>Spaces</h2>{document.spaces.map((space) => nav({ kind: "space", id: space.id, date: today }, space.title))}</div> : null}
      {document.areas.length ? <div className="replacement-nav-group"><h2>Areas</h2>{document.areas.map((area) => nav({ kind: "area", id: area.id, date: today }, area.title))}</div> : null}
      {document.projects.length ? <div className="replacement-nav-group"><h2>Projects</h2>{document.projects.map((project) => nav({ kind: "project", id: project.id, date: today }, project.title))}</div> : null}
      {document.headings.length ? <div className="replacement-nav-group"><h2>Headings</h2>{document.headings.map((heading) => nav({ kind: "heading", id: heading.id, date: today }, heading.title))}</div> : null}
      <label className="replacement-policy">Logbook policy<select value={document.settings.logCompletedItems} onChange={(event) => void runChange({ type: "setLogbookPolicy", policy: event.currentTarget.value as WorkspaceDocument["settings"]["logCompletedItems"] })}><option value="immediately">Immediately</option><option value="daily">Daily</option><option value="manually">Manually</option></select></label>
      <button className="replacement-sidebar-action" type="button" onClick={() => setBackupOpen((open) => !open)}>Import backup</button>
    </aside>

    <main className="replacement-main">
      <div className="replacement-main-inner">
        <header><p className="replacement-kicker">{saving ? "Saving…" : "Workspace"}</p><h1>{viewTitle(normalizedView, document)}</h1><p className="replacement-subtitle">{items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "Nothing here yet"}</p></header>
        {backupOpen ? <section className="replacement-import" aria-labelledby="replacement-import-title"><h2 id="replacement-import-title">Import the current portable backup</h2><p>Type <strong>{FULL_IMPORT_CONFIRMATION}</strong> before replacing this replacement Workspace.</p><div className="replacement-import-controls"><input className="replacement-file" type="file" accept="application/json,.json" aria-label="Choose Objects JSON backup" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void file.text().then(setBackup); }} /><input className="replacement-confirmation" value={confirmation} onInput={(event) => setConfirmation(event.currentTarget.value)} placeholder={FULL_IMPORT_CONFIRMATION} aria-label="Full import confirmation" /><button className="replacement-button" type="button" disabled={!backup || saving} onClick={() => void importBackup()}>Import backup</button></div></section> : null}

        {normalizedView.kind !== "trash" && normalizedView.kind !== "logbook" && normalizedView.kind !== "deadlines" ? <form className="replacement-quick-entry" onSubmit={(event) => { event.preventDefault(); void submitQuickEntry(); }}><input ref={quickInput} value={draft} onInput={(event) => { const value = event.currentTarget.value; setDraft(value); localStorage.setItem(QUICK_DRAFT_KEY, value); }} onBlur={() => { if (draft) void runChange({ type: "saveQuickDraft", value: draft, view: normalizedView }); }} placeholder={`New to-do in ${viewTitle(normalizedView, document)}`} aria-label="New to-do" /><button className="replacement-button" type="submit" disabled={!draft.trim() || saving}>Add</button><p>Try “Call Sam tomorrow at 2pm due Friday #people”.</p></form> : null}

        {items.length ? <section className="replacement-list" aria-label={`${viewTitle(normalizedView, document)} items`}>{items.map((item) => {
          const isToDo = "checklist" in item;
          const toDoItem = item as ToDo;
          return <article className={`replacement-row${selectedId === item.id ? " selected" : ""}`} key={item.id}>
            {isToDo && item.outcome === "open" && !item.trashedAt ? <button className="replacement-complete" type="button" aria-label={`Complete ${item.title}`} onClick={() => void runChange({ type: "completeToDo", id: item.id })} /> : <span className={`replacement-outcome ${item.outcome}`} aria-label={item.outcome} />}
            <button className="replacement-row-body" type="button" onClick={() => isToDo && setSelectedId(item.id)}><strong>{item.title}</strong><span>{isToDo ? toDoItem.schedule.kind === "scheduled" ? `${toDoItem.schedule.date}${toDoItem.schedule.evening ? " · This Evening" : ""}` : toDoItem.schedule.kind : "Project"}{item.deadline ? ` · Deadline ${item.deadline}` : ""}</span></button>
            {isToDo && item.trashedAt ? <button type="button" onClick={() => void runChange({ type: "restoreToDo", id: item.id })}>Restore</button> : null}
          </article>;
        })}</section> : <section className="replacement-empty"><div aria-hidden="true">✓</div><h2>{normalizedView.kind === "trash" ? "Trash is empty" : normalizedView.kind === "logbook" ? "No history yet" : "All clear"}</h2><p>{normalizedView.kind === "trash" ? "Removed to-dos will wait here until you restore or permanently delete them." : "Use inline entry or Magic Plus to add a to-do."}</p></section>}

        {normalizedView.kind === "trash" && items.length && activeSpaceId ? <button className="replacement-danger-button" type="button" onClick={() => { if (window.confirm("Permanently delete every to-do in the active Space's Trash?")) void runChange({ type: "emptyTrash", spaceId: activeSpaceId, confirmation: EMPTY_TRASH_CONFIRMATION }); }}>Empty active Space’s Trash</button> : null}
      </div>
    </main>

    <button className="replacement-magic-plus" type="button" aria-label="Magic Plus: add to-do" onClick={() => { quickInput.current?.focus(); quickInput.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>+</button>
    {selected ? <Inspector key={`${selected.id}-${snapshot.revision}`} item={selected} document={document} saving={saving} runChange={runChange} close={() => setSelectedId(null)} /> : null}
    {feedback ? <div className={`replacement-toast${feedback.error ? " error" : ""}`} role="status"><span>{feedback.text}</span>{feedback.error && pending.current ? <button type="button" onClick={() => void retrySave()}>Retry</button> : null}{feedback.undo ? <button type="button" onClick={() => void undo(feedback.undo!, feedback.undoDocument)}>Undo</button> : null}<button type="button" aria-label="Dismiss message" onClick={() => setFeedback(null)}>×</button></div> : null}
  </div>;
}

export function mountReplacement(root: Element, adapter: WorkspaceSyncAdapter, showReminder: (toDo: { id: string; title: string; notes?: string }) => Promise<boolean>): () => void {
  document.title = "Objects replacement preview";
  render(<ReplacementLoadBoundary><style>{replacementStyles}</style><ReplacementWorkspace adapter={adapter} showReminder={showReminder} /></ReplacementLoadBoundary>, root);
  return () => render(null, root);
}
