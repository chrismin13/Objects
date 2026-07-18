import { SignInWithGoogle, signOut, useAuth, useMutation, useQuery } from "lakebed/client";
import { createContext, type ComponentChildren } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Area, Bucket, ObjectsState, Project, Task } from "../shared/state";
import {
  activatePwaUpdate,
  getPwaStatus,
  initializePwa,
  requestNotificationAccess,
  requestPwaInstall,
  showTaskReminder,
} from "./pwa";
import {
  addDays,
  applyLogbookPolicy,
  areaById,
  buildChangeSet,
  cloneState,
  effectiveTags,
  formatDate,
  inSpace,
  isLogged,
  isTrashed,
  itemSpaceId,
  localDay,
  materializeRepeats,
  mergeRemoteState,
  normalizeState,
  parseNaturalTask,
  projectById,
  projectProgress,
  relativeDate,
  uid,
  type View,
  type ViewType,
} from "./model";
import { styles } from "./styles";

type AuthIdentity = ReturnType<typeof useAuth>;
type SaveStatus = "idle" | "saving" | "saved" | "error";
type Recipe = (state: ObjectsState) => void;

type WorkspaceContextValue = {
  state: ObjectsState;
  update: (recipe: Recipe) => void;
  saveStatus: SaveStatus;
  activeSpaceId: string;
  setActiveSpaceId: (id: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function useWorkspaceContext(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace context is unavailable");
  return context;
}

type IconName =
  | "inbox" | "star" | "calendar" | "layers" | "archive" | "check" | "trash"
  | "search" | "plus" | "sun" | "moon" | "menu" | "x" | "area" | "list"
  | "more" | "flag" | "tag" | "repeat" | "settings" | "chevron" | "clock"
  | "cloud" | "heading" | "download" | "upload";

const ICON_PATHS: Record<IconName, string[]> = {
  inbox: ["M4 5h16v12H4z", "M4 13h4l2 3h4l2-3h4"],
  star: ["m12 2 3.1 6.3 6.9 1-5 4.8 1.2 6.9-6.2-3.3-6.2 3.3L7 14.1 2 9.3l6.9-1z"],
  calendar: ["M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z", "M8 2v5M16 2v5M3 10h18"],
  layers: ["m12 2 9 5-9 5-9-5 9-5Z", "m3 12 9 5 9-5M3 17l9 5 9-5"],
  archive: ["M4 7v14h16V7M2 3h20v4H2zM9 11h6"],
  check: ["m5 12 4 4L19 6"],
  trash: ["M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"],
  search: ["M18 18 21 21", "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"],
  plus: ["M12 5v14M5 12h14"],
  sun: ["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"],
  moon: ["M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"],
  menu: ["M4 7h16M4 12h16M4 17h16"],
  x: ["M18 6 6 18M6 6l12 12"],
  area: ["m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z", "m4 7.5 8 4.5 8-4.5M12 12v9"],
  list: ["M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"],
  more: ["M5 12h.01M12 12h.01M19 12h.01"],
  flag: ["M5 21V4M5 4h12l-2 4 2 4H5"],
  tag: ["M20.6 13.4 11 3H4v7l9.6 9.6a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8Z", "M7.5 6.5h.01"],
  repeat: ["m17 1 4 4-4 4", "M3 11V9a4 4 0 0 1 4-4h14", "m7 23-4-4 4-4", "M21 13v2a4 4 0 0 1-4 4H3"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.1h-4v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1L4.2 17l.1-.1A1.7 1.7 0 0 0 3.1 14H3v-4h.1a1.7 1.7 0 0 0 1.2-2.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 10 3.1V3h4v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"],
  chevron: ["m9 18 6-6-6-6"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  cloud: ["M17.5 19H6a4 4 0 0 1-.4-8A6.5 6.5 0 0 1 18 9a5 5 0 0 1-.5 10Z"],
  heading: ["M6 4v16M18 4v16M6 12h12"],
  download: ["M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"],
  upload: ["M12 17V5m0 0 5 5m-5-5-5 5M5 21h14"],
};

function Icon({ name, class: className = "" }: { name: IconName; class?: string }) {
  return (
    <svg class={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {ICON_PATHS[name].map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

function BrandMark() {
  return <div class="auth-mark" aria-hidden="true"><span /><span /><span /></div>;
}

function AuthScreen({ mode }: { mode: "loading" | "offline" | "signin" | "recovery" }) {
  const content = {
    loading: ["Opening Objects", "Lakebed is checking your session."],
    offline: ["Objects is offline", "Reconnect to unlock your private workspace and resume syncing."],
    signin: ["Your tasks, privately yours", "Sign in with Google to open your private workspace."],
    recovery: ["The session check is taking longer than expected", "Your data is safe. Reconnect this tab to Lakebed."],
  }[mode];
  return (
    <main class="auth-screen">
      <section class="auth-card">
        <BrandMark />
        <p class="auth-brand">Objects on Lakebed</p>
        <h1>{content[0]}</h1>
        <p>{content[1]}</p>
        {mode === "signin" ? <SignInWithGoogle className="button primary auth-submit" /> : null}
        {mode === "recovery" ? <button class="button primary auth-submit" onClick={() => location.reload()}>Retry session</button> : null}
        {mode === "loading" || mode === "offline" ? <div class="auth-loading" role="status"><span /> {mode === "offline" ? "Waiting for a connection…" : "Checking session…"}</div> : null}
      </section>
    </main>
  );
}

function useWorkspaceModel(
  serialized: string | undefined,
  initialize: (value: string) => Promise<string>,
  persist: (value: string) => Promise<string>,
) {
  const [state, setState] = useState<ObjectsState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const baseline = useRef<ObjectsState | null>(null);
  const latest = useRef<ObjectsState | null>(null);
  const version = useRef(0);
  const initialized = useRef(false);
  const saving = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const ownMutations = useRef(new Set<string>());

  const flush = useCallback(async () => {
    if (saving.current || !baseline.current || !latest.current) return;
    const snapshot = cloneState(latest.current);
    const changes = buildChangeSet(baseline.current, snapshot);
    if (!changes) { setSaveStatus("saved"); return; }
    const capturedVersion = version.current;
    saving.current = true;
    ownMutations.current.add(changes.mutationId);
    setSaveStatus("saving");
    try {
      const ack = JSON.parse(await persist(JSON.stringify(changes))) as { updatedAt: string; mutationId: string };
      snapshot.updatedAt = ack.updatedAt;
      snapshot.syncMutationId = ack.mutationId;
      baseline.current = snapshot;
      ownMutations.current.delete(ack.mutationId);
      setSaveStatus("saved");
    } catch (error) {
      ownMutations.current.delete(changes.mutationId);
      setSaveStatus("error");
      console.error("Objects save failed", error);
    } finally {
      saving.current = false;
      if (version.current !== capturedVersion || buildChangeSet(baseline.current!, latest.current!)) {
        saveTimer.current = window.setTimeout(() => void flush(), 700);
      }
    }
  }, [persist]);

  const update = useCallback((recipe: Recipe) => {
    setState((current) => {
      if (!current) return current;
      const next = cloneState(current);
      recipe(next);
      next.updatedAt = current.updatedAt;
      latest.current = next;
      version.current += 1;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void flush(), 420);
      return next;
    });
  }, [flush]);

  useEffect(() => {
    if (!serialized) return;
    let remote: ObjectsState;
    try { remote = normalizeState(JSON.parse(serialized) as ObjectsState); }
    catch { return; }
    if (!initialized.current) {
      initialized.current = true;
      baseline.current = remote;
      const prepared = applyLogbookPolicy(materializeRepeats(remote));
      latest.current = prepared;
      setState(prepared);
      void initialize(serialized).catch(() => undefined);
      if (buildChangeSet(remote, prepared)) {
        version.current += 1;
        saveTimer.current = window.setTimeout(() => void flush(), 150);
      }
      return;
    }
    if (!baseline.current || !latest.current) return;
    if (remote.syncMutationId && ownMutations.current.has(remote.syncMutationId)) return;
    if (remote.updatedAt === baseline.current.updatedAt && remote.syncMutationId === baseline.current.syncMutationId) return;
    const merged = mergeRemoteState(baseline.current, latest.current, remote);
    baseline.current = remote;
    latest.current = merged;
    setState(merged);
  }, [serialized, initialize, flush]);

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
  }, []);

  return { state, update, saveStatus };
}

function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} class={`dialog ${wide ? "dialog-wide" : ""}`} onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header class="dialog-header"><h2>{title}</h2><button type="button" class="icon-button" aria-label="Close" onClick={onClose}><Icon name="x" /></button></header>
      {children}
    </dialog>
  );
}

function Field({ label, children, hint }: { label: string; children: ComponentChildren; hint?: string }) {
  return <label class="field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function SpacesPill() {
  const { state, activeSpaceId, setActiveSpaceId } = useWorkspaceContext();
  const ordered = [...state.spaces].sort((a, b) => a.order - b.order);
  const visible = ordered.filter((space) => space.pinned).slice(0, 2);
  const hidden = ordered.filter((space) => !visible.some((item) => item.id === space.id));
  return (
    <div class="spaces-pill" role="tablist" aria-label="Space">
      <button type="button" role="tab" class={activeSpaceId === "all" ? "active" : ""} aria-selected={activeSpaceId === "all"} onClick={() => setActiveSpaceId("all")}>All</button>
      {visible.map((space) => <button key={space.id} type="button" role="tab" class={activeSpaceId === space.id ? "active" : ""} aria-selected={activeSpaceId === space.id} style={{ "--space-color": space.color }} onClick={() => setActiveSpaceId(space.id)}>{space.title}</button>)}
      {hidden.length ? <details class="spaces-overflow"><summary aria-label="More spaces">+{hidden.length}</summary><div class="spaces-menu">{hidden.map((space) => <button key={space.id} type="button" onClick={() => setActiveSpaceId(space.id)}><i style={{ background: space.color }} />{space.title}</button>)}</div></details> : null}
    </div>
  );
}

const NAV_ITEMS: Array<[ViewType, string, IconName]> = [
  ["inbox", "Inbox", "inbox"], ["today", "Today", "star"], ["upcoming", "Upcoming", "calendar"],
  ["anytime", "Anytime", "layers"], ["someday", "Someday", "archive"], ["logbook", "Logbook", "check"], ["trash", "Trash", "trash"],
];

function Sidebar({ view, setView, open, onClose, onSearch, onSettings, onNewList }: {
  view: View; setView: (view: View) => void; open: boolean; onClose: () => void; onSearch: () => void; onSettings: () => void; onNewList: () => void;
}) {
  const { state, activeSpaceId } = useWorkspaceContext();
  const today = localDay();
  const count = (type: ViewType) => state.tasks.filter((task) => inSpace(state, task, activeSpaceId) && task.status === "open" && !task.repeat && (type === "inbox" ? task.bucket === "inbox" : task.bucket === "today" || task.scheduledFor === today)).length;
  const areas = state.areas.filter((area) => inSpace(state, area, activeSpaceId)).sort((a, b) => a.order - b.order);
  const projects = state.projects.filter((project) => inSpace(state, project, activeSpaceId) && project.status === "open" && !project.repeat && project.bucket !== "someday").sort((a, b) => a.order - b.order);
  const choose = (next: View) => { setView(next); onClose(); };
  return (
    <>
      <aside class={`sidebar ${open ? "open" : ""}`} aria-label="Lists">
        <div class="sidebar-top"><button class="icon-button mobile-only" onClick={onClose} aria-label="Close sidebar"><Icon name="x" /></button><SpacesPill /><button class="icon-button" onClick={onSearch} aria-label="Quick find"><Icon name="search" /></button></div>
        <nav class="sidebar-nav">
          <ul>{NAV_ITEMS.map(([type, label, icon]) => <li key={type}><button class={`nav-item ${view.type === type ? "active" : ""}`} onClick={() => choose({ type })}><Icon name={icon} /><span>{label}</span>{type === "inbox" || type === "today" ? <em>{count(type) || ""}</em> : null}</button></li>)}</ul>
          <div class="sidebar-lists">
            {areas.map((area) => <section key={area.id}><button class={`nav-item area-item ${view.type === "area" && view.id === area.id ? "active" : ""}`} onClick={() => choose({ type: "area", id: area.id })}><span class="area-dot" style={{ background: area.color }} /><span>{area.title}</span></button>{projects.filter((project) => project.areaId === area.id).map((project) => <button key={project.id} class={`nav-item project-item ${view.type === "project" && view.id === project.id ? "active" : ""}`} onClick={() => choose({ type: "project", id: project.id })}><span class="progress-ring" style={{ "--progress": `${projectProgress(state, project.id) * 3.6}deg` }} /><span>{project.title}</span></button>)}</section>)}
            {projects.filter((project) => !project.areaId).map((project) => <button key={project.id} class={`nav-item ${view.type === "project" && view.id === project.id ? "active" : ""}`} onClick={() => choose({ type: "project", id: project.id })}><span class="progress-ring" style={{ "--progress": `${projectProgress(state, project.id) * 3.6}deg` }} /><span>{project.title}</span></button>)}
          </div>
        </nav>
        <footer class="sidebar-footer"><button class="quiet-button" onClick={onNewList}><Icon name="plus" /> New List</button><button class="icon-button" onClick={onSettings} aria-label="Settings"><Icon name="settings" /></button></footer>
      </aside>
      {open ? <button class="scrim" onClick={onClose} aria-label="Close sidebar" /> : null}
    </>
  );
}

type ViewData = { title: string; eyebrow: string; icon: IconName; subtitle: string; tasks: Task[]; projects: Project[]; area?: Area; project?: Project };

function getViewData(state: ObjectsState, view: View, activeSpaceId: string): ViewData {
  const today = localDay();
  const active = (task: Task) => inSpace(state, task, activeSpaceId) && (task.status === "open" || (task.status !== "trashed" && !task.loggedAt)) && !task.repeat && (!task.projectId || projectById(state, task.projectId)?.status === "open");
  const activeProject = (project: Project) => inSpace(state, project, activeSpaceId) && (project.status === "open" || (project.status !== "trashed" && !project.loggedAt)) && !project.repeat;
  const base: Record<string, ViewData> = {
    inbox: { title: "Inbox", eyebrow: "Collect now, decide later", icon: "inbox", subtitle: "Unsorted thoughts waiting for a home.", tasks: state.tasks.filter((task) => active(task) && task.bucket === "inbox"), projects: [] },
    today: { title: "Today", eyebrow: new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()), icon: "star", subtitle: "Your clear plan for the day.", tasks: state.tasks.filter((task) => active(task) && (task.bucket === "today" || Boolean(task.scheduledFor && task.scheduledFor <= today) || Boolean(task.deadline && task.deadline <= today))), projects: state.projects.filter((project) => activeProject(project) && (project.bucket === "today" || Boolean(project.scheduledFor && project.scheduledFor <= today) || Boolean(project.deadline && project.deadline <= today))) },
    upcoming: { title: "Upcoming", eyebrow: "Plan ahead", icon: "calendar", subtitle: "Everything with a future start date or deadline.", tasks: state.tasks.filter((task) => active(task) && Boolean((task.scheduledFor && task.scheduledFor > today) || (task.deadline && task.deadline > today))), projects: state.projects.filter((project) => activeProject(project) && Boolean((project.scheduledFor && project.scheduledFor > today) || (project.deadline && project.deadline > today))) },
    anytime: { title: "Anytime", eyebrow: "Available now", icon: "layers", subtitle: "Work you can make progress on whenever you like.", tasks: state.tasks.filter((task) => active(task) && (task.bucket === "anytime" || task.bucket === "today") && (!task.scheduledFor || task.scheduledFor <= today)), projects: state.projects.filter((project) => activeProject(project) && project.bucket === "anytime") },
    someday: { title: "Someday", eyebrow: "Ideas for later", icon: "archive", subtitle: "Possibilities without a commitment.", tasks: state.tasks.filter((task) => active(task) && task.bucket === "someday"), projects: state.projects.filter((project) => activeProject(project) && project.bucket === "someday") },
    logbook: { title: "Logbook", eyebrow: "Completed", icon: "check", subtitle: "A record of your progress.", tasks: state.tasks.filter((task) => inSpace(state, task, activeSpaceId) && isLogged(task)), projects: state.projects.filter((project) => inSpace(state, project, activeSpaceId) && isLogged(project)) },
    trash: { title: "Trash", eyebrow: "Discarded", icon: "trash", subtitle: "Items remain recoverable until permanently deleted.", tasks: state.tasks.filter((task) => inSpace(state, task, activeSpaceId) && isTrashed(task)), projects: state.projects.filter((project) => inSpace(state, project, activeSpaceId) && isTrashed(project)) },
    deadlines: { title: "Deadlines", eyebrow: "Commitments", icon: "flag", subtitle: "Open work ordered by deadline.", tasks: state.tasks.filter((task) => active(task) && Boolean(task.deadline)).sort((a, b) => (a.deadline || "").localeCompare(b.deadline || "")), projects: state.projects.filter((project) => activeProject(project) && Boolean(project.deadline)).sort((a, b) => (a.deadline || "").localeCompare(b.deadline || "")) },
    repeating: { title: "Repeating", eyebrow: "Templates", icon: "repeat", subtitle: "Routines that create fresh work on schedule.", tasks: state.tasks.filter((task) => inSpace(state, task, activeSpaceId) && task.status === "open" && Boolean(task.repeat)), projects: state.projects.filter((project) => inSpace(state, project, activeSpaceId) && project.status === "open" && Boolean(project.repeat)) },
    allProjects: { title: "Projects", eyebrow: "Open outcomes", icon: "list", subtitle: "Every active project in this Space.", tasks: [], projects: state.projects.filter(activeProject) },
  };
  if (base[view.type]) return base[view.type];
  if (view.type === "project") {
    const project = projectById(state, view.id);
    if (project) return { title: project.title, eyebrow: areaById(state, project.areaId)?.title || "Project", icon: "list", subtitle: project.notes || "A focused set of steps toward one outcome.", tasks: state.tasks.filter((task) => task.projectId === project.id && (project.status === "trashed" ? isTrashed(task) : project.loggedAt ? isLogged(task) : task.status === "open" || (!task.loggedAt && task.status !== "trashed")) && !task.repeat), projects: [], project };
  }
  if (view.type === "area") {
    const area = areaById(state, view.id);
    if (area) return { title: area.title, eyebrow: "Area", icon: "area", subtitle: "An ongoing part of life.", tasks: state.tasks.filter((task) => task.areaId === area.id && !task.projectId && active(task)), projects: state.projects.filter((project) => project.areaId === area.id && activeProject(project)), area };
  }
  if (view.type === "tag") return { title: `#${view.id || "Tag"}`, eyebrow: "Tag", icon: "tag", subtitle: "Matching items from the active Space.", tasks: state.tasks.filter((task) => active(task) && effectiveTags(state, task).includes(view.id || "")), projects: [] };
  return base.today;
}

function CalendarStrip({ events }: { events: ObjectsState["calendarEvents"] }) {
  if (!events.length) return null;
  return <section class="calendar-strip" aria-label="Calendar events">{events.map((event) => <div key={event.id} class="calendar-event"><time>{event.allDay ? "all day" : new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(event.start))}</time><i /><div><strong>{event.title}</strong><span>{event.calendar}</span></div></div>)}</section>;
}

function TaskRow({ task, selected, onSelect }: { task: Task; selected: boolean; onSelect: () => void }) {
  const { state, update } = useWorkspaceContext();
  const project = projectById(state, task.projectId);
  const area = areaById(state, task.areaId);
  const toggle = () => update((draft) => {
    const item = draft.tasks.find((candidate) => candidate.id === task.id);
    if (!item) return;
    if (item.status === "open") {
      item.status = "completed"; item.completedAt = new Date().toISOString();
      if (draft.settings.logCompletedItems === "immediately") item.loggedAt = item.completedAt;
    } else { item.status = "open"; item.completedAt = null; item.loggedAt = null; }
  });
  return (
    <li class={`task-row ${selected ? "selected" : ""} ${task.status !== "open" ? "completed" : ""}`}>
      <button type="button" class="check-button" aria-label={task.status === "open" ? `Complete ${task.title}` : `Reopen ${task.title}`} onClick={toggle}><span>{task.status !== "open" ? <Icon name="check" /> : null}</span></button>
      <button type="button" class="task-main" onClick={onSelect}>
        <span class="task-title">{task.title || "New To-Do"}</span>
        <span class="task-meta">{task.deadline ? <em class={task.deadline <= localDay() ? "urgent" : ""}><Icon name="flag" /> {relativeDate(task.deadline)}</em> : null}{task.checklist.some((item) => !item.done) ? <em>{task.checklist.filter((item) => !item.done).length} steps</em> : null}{project || area ? <em>{project?.title || area?.title}</em> : null}{task.tags.slice(0, 2).map((tag) => <em key={tag}>#{tag}</em>)}</span>
      </button>
      {task.evening ? <Icon name="moon" class="evening-mark" /> : <Icon name="chevron" class="row-chevron" />}
    </li>
  );
}

type TaskSection = { key: string; title: string; tasks: Task[]; icon?: IconName };

function makeSections(state: ObjectsState, data: ViewData, view: View): TaskSection[] {
  const tasks = [...data.tasks].sort((a, b) => {
    if (view.type === "upcoming") return (a.scheduledFor || a.deadline || "").localeCompare(b.scheduledFor || b.deadline || "");
    if (view.type === "logbook") return (b.completedAt || "").localeCompare(a.completedAt || "");
    return a.order - b.order;
  });
  if (view.type === "today") {
    const day = tasks.filter((task) => !task.evening);
    const evening = tasks.filter((task) => task.evening);
    return [{ key: "today", title: "", tasks: day }, ...(evening.length ? [{ key: "evening", title: "This Evening", tasks: evening, icon: "moon" as IconName }] : [])];
  }
  if (view.type === "upcoming") {
    const groups = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = task.scheduledFor || task.deadline || "Later";
      groups.set(key, [...(groups.get(key) || []), task]);
    }
    return [...groups].map(([key, items]) => ({ key, title: key === "Later" ? key : relativeDate(key), tasks: items }));
  }
  if (view.type === "project" || view.type === "area") {
    const headings = state.headings.filter((heading) => !heading.archived && (view.type === "project" ? heading.projectId === view.id : heading.areaId === view.id)).sort((a, b) => a.order - b.order);
    const result: TaskSection[] = [{ key: "none", title: "", tasks: tasks.filter((task) => !task.headingId) }];
    for (const heading of headings) result.push({ key: heading.id, title: heading.title, tasks: tasks.filter((task) => task.headingId === heading.id) });
    return result.filter((section) => section.tasks.length || section.title);
  }
  return [{ key: view.type, title: "", tasks }];
}

function QuickAdd({ view, activeSpaceId, onCreated, request }: { view: View; activeSpaceId: string; onCreated: (id: string) => void; request: number }) {
  const { state, update } = useWorkspaceContext();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { if (request) setOpen(true); }, [request]);
  const submit = (event: Event) => {
    event.preventDefault();
    const parsed = parseNaturalTask(value);
    if (!parsed.title.trim()) return;
    const id = uid("task");
    const project = view.type === "project" ? projectById(state, view.id) : undefined;
    const area = view.type === "area" ? areaById(state, view.id) : project ? areaById(state, project.areaId) : undefined;
    update((draft) => draft.tasks.push({
      id,
      spaceId: activeSpaceId === "all" ? project?.spaceId || area?.spaceId || draft.settings.defaultSpaceId || draft.spaces[0]?.id || null : activeSpaceId,
      title: parsed.title, notes: "", status: "open",
      bucket: view.type === "project" || view.type === "area" ? (parsed.scheduledFor ? parsed.bucket : "anytime") : view.type === "today" && !parsed.scheduledFor && parsed.bucket === "inbox" ? "today" : view.type === "someday" ? "someday" : parsed.bucket,
      scheduledFor: view.type === "today" && !parsed.scheduledFor && parsed.bucket === "inbox" ? localDay() : parsed.scheduledFor,
      evening: parsed.evening, reminderAt: parsed.reminderAt, deadline: parsed.deadline,
      projectId: project?.id || null, headingId: null, areaId: area?.id || null,
      tags: view.type === "tag" && view.id ? [...new Set([...parsed.tags, view.id])] : parsed.tags,
      checklist: [], repeat: null, createdAt: new Date().toISOString(), completedAt: null, order: Date.now(),
    }));
    setValue(""); setOpen(false); onCreated(id);
  };
  return open ? <form class="quick-add-form" onSubmit={submit}><span class="check-placeholder" /><input ref={input} value={value} onInput={(event) => setValue(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Escape") { setValue(""); setOpen(false); } }} placeholder="New To-Do" /><button class="button primary" type="submit">Add</button></form> : <button class="inline-add" type="button" onClick={() => setOpen(true)}><Icon name="plus" /> New To-Do</button>;
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const { state } = useWorkspaceContext();
  return <button class="project-card" onClick={onOpen}><span class="project-progress" style={{ "--progress": `${projectProgress(state, project.id) * 3.6}deg` }}><span>{projectProgress(state, project.id)}%</span></span><div><strong>{project.title}</strong><span>{areaById(state, project.areaId)?.title || "Project"}{project.deadline ? ` · ${relativeDate(project.deadline)}` : ""}</span></div><Icon name="chevron" /></button>;
}

function ContentView({ view, setView, selectedTaskId, setSelectedTaskId, onMenu, onSearch, onEditList, onNewHeading, quickAddRequest, onQuickAdd }: {
  view: View; setView: (view: View) => void; selectedTaskId: string | null; setSelectedTaskId: (id: string | null) => void; onMenu: () => void; onSearch: () => void; onEditList: () => void; onNewHeading: () => void; quickAddRequest: number; onQuickAdd: () => void;
}) {
  const { state, update, activeSpaceId, saveStatus } = useWorkspaceContext();
  const data = useMemo(() => getViewData(state, view, activeSpaceId), [state, view.type, view.id, activeSpaceId]);
  const sections = useMemo(() => makeSections(state, data, view), [state, data, view.type, view.id]);
  const today = localDay();
  const events = state.settings.showCalendar && ["today", "upcoming"].includes(view.type) ? state.calendarEvents.filter((event) => inSpace(state, event, activeSpaceId) && (view.type === "today" ? event.start.slice(0, 10) === today : event.start.slice(0, 10) > today)).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 8) : [];
  const addable = !["logbook", "trash", "repeating", "deadlines", "allProjects"].includes(view.type);
  return (
    <main class="main-pane">
      <header class="mobile-header"><button class="icon-button" onClick={onMenu} aria-label="Open sidebar"><Icon name="menu" /></button><strong>Objects</strong><button class="icon-button" onClick={onSearch} aria-label="Quick find"><Icon name="search" /></button></header>
      <div class="content-scroll">
        <div class="content-inner">
          <header class="view-header"><div class="view-eyebrow">{data.eyebrow}<span class={`save-state ${saveStatus}`}>{saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Not saved" : ""}</span></div><div class="view-title"><Icon name={data.icon} /><h1>{data.title}</h1>{data.project || data.area ? <button class="icon-button" onClick={onNewHeading} aria-label="New heading"><Icon name="heading" /></button> : null}{data.project || data.area ? <button class="icon-button" onClick={onEditList} aria-label="List options"><Icon name="more" /></button> : null}{view.type === "trash" && (data.tasks.length || data.projects.length) ? <button class="button" onClick={() => { if (confirm("Permanently delete everything in Trash?")) update((draft) => { draft.tasks = draft.tasks.filter((task) => !isTrashed(task)); draft.projects = draft.projects.filter((project) => !isTrashed(project)); }); }}>Empty Trash</button> : null}{view.type === "logbook" && state.settings.logCompletedItems === "manually" ? <button class="button" onClick={() => update((draft) => { [...draft.tasks, ...draft.projects].forEach((item) => { if (item.status !== "open" && item.status !== "trashed" && item.completedAt) item.loggedAt = item.completedAt; }); })}>Log Completed</button> : null}</div><p>{data.subtitle}</p>{data.project ? <div class="progress-line"><span style={{ width: `${projectProgress(state, data.project.id)}%` }} /></div> : null}</header>
          <CalendarStrip events={events} />
          {data.projects.length ? <section class="project-grid">{data.projects.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => setView({ type: "project", id: project.id })} />)}</section> : null}
          <div class="task-sections">{sections.map((section) => <section key={section.key} class="task-section">{section.title ? <h2>{section.icon ? <Icon name={section.icon} /> : null}{section.title}</h2> : null}<ul>{section.tasks.map((task) => <TaskRow key={task.id} task={task} selected={selectedTaskId === task.id} onSelect={() => setSelectedTaskId(task.id)} />)}</ul></section>)}</div>
          {!data.tasks.length && !data.projects.length ? <div class="empty-state"><Icon name={view.type === "today" ? "sun" : data.icon} /><h2>{view.type === "today" ? "Enjoy the calm" : `No ${data.title.toLowerCase()} here`}</h2><p>{addable ? "Add a to-do whenever something comes to mind." : "Nothing needs your attention in this view."}</p></div> : null}
          {addable ? <QuickAdd view={view} activeSpaceId={activeSpaceId} onCreated={setSelectedTaskId} request={quickAddRequest} /> : null}
        </div>
      </div>
      {addable ? <button class="magic-add" aria-label="New To-Do" onClick={onQuickAdd}><Icon name="plus" /></button> : null}
    </main>
  );
}

function TaskInspector({ taskId, onClose, onMove }: { taskId: string; onClose: () => void; onMove: () => void }) {
  const { state, update } = useWorkspaceContext();
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return null;
  const edit = <K extends keyof Task>(key: K, value: Task[K]) => update((draft) => { const item = draft.tasks.find((candidate) => candidate.id === task.id); if (item) item[key] = value; });
  const trash = () => update((draft) => { const item = draft.tasks.find((candidate) => candidate.id === task.id); if (!item) return; if (item.status === "trashed") draft.tasks = draft.tasks.filter((candidate) => candidate.id !== item.id); else { item.previousStatus = item.status; item.status = "trashed"; item.trashedAt = new Date().toISOString(); } });
  const restore = () => update((draft) => { const item = draft.tasks.find((candidate) => candidate.id === task.id); if (item) { item.status = item.previousStatus === "completed" ? "completed" : "open"; item.trashedAt = null; } });
  return (
    <aside class="inspector" aria-label="To-Do details">
      <header class="inspector-header"><button class="icon-button" onClick={onClose} aria-label="Close details"><Icon name="x" /></button><div><button class="icon-button" onClick={onMove} aria-label="Move"><Icon name="layers" /></button><button class="icon-button danger-hover" onClick={trash} aria-label={isTrashed(task) ? "Delete permanently" : "Move to Trash"}><Icon name="trash" /></button></div></header>
      <div class="inspector-scroll">
        {isTrashed(task) ? <button class="button primary full" onClick={restore}>Restore To-Do</button> : null}
        <input class="inspector-title" value={task.title} onInput={(event) => edit("title", event.currentTarget.value)} placeholder="New To-Do" />
        <div class="inspector-section checklist-section"><span class="section-label">Checklist</span>{task.checklist.map((check) => <div key={check.id} class="checklist-row"><button class="mini-check" onClick={() => edit("checklist", task.checklist.map((item) => item.id === check.id ? { ...item, done: !item.done } : item))}>{check.done ? <Icon name="check" /> : null}</button><input value={check.title} class={check.done ? "done" : ""} onInput={(event) => edit("checklist", task.checklist.map((item) => item.id === check.id ? { ...item, title: event.currentTarget.value } : item))} /><button class="remove-button" onClick={() => edit("checklist", task.checklist.filter((item) => item.id !== check.id))}><Icon name="x" /></button></div>)}<button class="inline-add compact" onClick={() => edit("checklist", [...task.checklist, { id: uid("check"), title: "", done: false }])}><Icon name="plus" /> New checklist item</button></div>
        <textarea class="notes" value={task.notes} onInput={(event) => edit("notes", event.currentTarget.value)} placeholder="Notes" />
        <div class="inspector-section detail-fields">
          <Field label="When"><input type="date" value={task.scheduledFor || ""} onInput={(event) => { const day = event.currentTarget.value || null; edit("scheduledFor", day); edit("bucket", day ? (day <= localDay() ? "today" : "upcoming") : "anytime"); }} /></Field>
          <Field label="Deadline"><input type="date" value={task.deadline || ""} onInput={(event) => edit("deadline", event.currentTarget.value || null)} /></Field>
          <Field label="List"><select value={task.projectId ? `project:${task.projectId}` : task.areaId ? `area:${task.areaId}` : "inbox"} onChange={(event) => { const [kind, id] = event.currentTarget.value.split(":"); update((draft) => { const item = draft.tasks.find((candidate) => candidate.id === task.id); if (!item) return; item.projectId = kind === "project" ? id : null; item.areaId = kind === "area" ? id : kind === "project" ? projectById(draft, id)?.areaId || null : null; item.headingId = null; if (kind === "inbox") item.bucket = "inbox"; }); }}><option value="inbox">Inbox</option>{state.areas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.title}</option>)}{state.projects.filter((project) => project.status === "open").map((project) => <option key={project.id} value={`project:${project.id}`}>{project.title}</option>)}</select></Field>
          <Field label="Tags"><input value={task.tags.join(", ")} onChange={(event) => edit("tags", event.currentTarget.value.split(",").map((tag) => tag.trim()).filter(Boolean))} placeholder="Errand, Focus" /></Field>
          <Field label="Reminder"><input type="datetime-local" value={task.reminderAt || ""} onInput={(event) => edit("reminderAt", event.currentTarget.value || null)} /></Field>
        </div>
        <div class="schedule-buttons"><button class={task.bucket === "today" && !task.evening ? "active" : ""} onClick={() => { edit("bucket", "today"); edit("scheduledFor", localDay()); edit("evening", false); }}><Icon name="star" />Today</button><button class={task.evening ? "active" : ""} onClick={() => { edit("bucket", "today"); edit("scheduledFor", localDay()); edit("evening", true); }}><Icon name="moon" />Evening</button><button class={task.bucket === "someday" ? "active" : ""} onClick={() => { edit("bucket", "someday"); edit("scheduledFor", null); edit("evening", false); }}><Icon name="archive" />Someday</button></div>
        <div class="inspector-section"><span class="section-label">Repeat</span>{task.repeat ? <><div class="repeat-grid"><select value={task.repeat.frequency} onChange={(event) => edit("repeat", { ...task.repeat!, frequency: event.currentTarget.value as "daily" | "weekly" | "monthly" | "yearly" })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select><input type="number" min="1" value={task.repeat.interval} onInput={(event) => edit("repeat", { ...task.repeat!, interval: Math.max(1, Number(event.currentTarget.value)) })} /><input type="date" value={task.repeat.nextDate} onInput={(event) => edit("repeat", { ...task.repeat!, nextDate: event.currentTarget.value })} /></div><button class="quiet-button danger-text" onClick={() => edit("repeat", null)}>Stop repeating</button></> : <button class="quiet-button" onClick={() => edit("repeat", { mode: "fixed", frequency: "weekly", interval: 1, weekdays: [], nextDate: task.scheduledFor || addDays(localDay(), 7), paused: false })}><Icon name="repeat" /> Make repeating</button>}</div>
      </div>
    </aside>
  );
}

function SearchDialog({ onClose, onChoose }: { onClose: () => void; onChoose: (view: View, taskId?: string) => void }) {
  const { state, activeSpaceId } = useWorkspaceContext();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const results = normalized ? [
    ...state.tasks.filter((task) => inSpace(state, task, activeSpaceId) && [task.title, task.notes, ...task.tags, ...task.checklist.map((item) => item.title)].join(" ").toLowerCase().includes(normalized)).slice(0, 12).map((task) => ({ key: task.id, title: task.title, meta: projectById(state, task.projectId)?.title || areaById(state, task.areaId)?.title || task.bucket, icon: "check" as IconName, view: { type: "today" as ViewType }, taskId: task.id })),
    ...state.projects.filter((project) => inSpace(state, project, activeSpaceId) && project.title.toLowerCase().includes(normalized)).slice(0, 6).map((project) => ({ key: project.id, title: project.title, meta: "Project", icon: "list" as IconName, view: { type: "project" as ViewType, id: project.id } })),
    ...state.areas.filter((area) => inSpace(state, area, activeSpaceId) && area.title.toLowerCase().includes(normalized)).slice(0, 6).map((area) => ({ key: area.id, title: area.title, meta: "Area", icon: "area" as IconName, view: { type: "area" as ViewType, id: area.id } })),
  ] : [];
  return <Dialog title="Quick Find" onClose={onClose}><div class="search-box"><Icon name="search" /><input autofocus value={query} onInput={(event) => setQuery(event.currentTarget.value)} placeholder="Jump to a list or find a to-do…" /></div><div class="search-results">{results.map((result) => <button key={result.key} onClick={() => onChoose(result.view, result.taskId)}><Icon name={result.icon} /><span><strong>{result.title}</strong><small>{result.meta}</small></span><Icon name="chevron" /></button>)}{normalized && !results.length ? <p>No matching to-dos or lists.</p> : !normalized ? <p>Type to search titles, notes, tags, and checklists.</p> : null}</div></Dialog>;
}

function MoveDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { state, update } = useWorkspaceContext();
  const [destination, setDestination] = useState("inbox");
  const submit = (event: Event) => { event.preventDefault(); const [kind, id] = destination.split(":"); update((draft) => { const task = draft.tasks.find((item) => item.id === taskId); if (!task) return; task.projectId = kind === "project" ? id : null; task.areaId = kind === "area" ? id : kind === "project" ? projectById(draft, id)?.areaId || null : null; task.headingId = null; if (kind === "inbox") { task.bucket = "inbox"; task.scheduledFor = null; } }); onClose(); };
  return <Dialog title="Move To-Do" onClose={onClose}><form class="dialog-form" onSubmit={submit}><Field label="Destination"><select size={Math.min(9, state.areas.length + state.projects.length + 1)} value={destination} onChange={(event) => setDestination(event.currentTarget.value)}><option value="inbox">Inbox</option>{state.areas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.title}</option>)}{state.projects.filter((project) => project.status === "open").map((project) => <option key={project.id} value={`project:${project.id}`}>{project.title}</option>)}</select></Field><footer><button type="button" class="button" onClick={onClose}>Cancel</button><button class="button primary" type="submit">Move</button></footer></form></Dialog>;
}

function ListDialog({ editing, onClose, onCreated }: { editing?: Project | Area; onClose: () => void; onCreated: (view: View) => void }) {
  const { state, update, activeSpaceId } = useWorkspaceContext();
  const isArea = editing ? "color" in editing : false;
  const [kind, setKind] = useState<"project" | "area">(isArea ? "area" : "project");
  const [title, setTitle] = useState(editing?.title || "");
  const [notes, setNotes] = useState("notes" in (editing || {}) ? (editing as Project).notes : "");
  const [spaceId, setSpaceId] = useState(editing?.spaceId || (activeSpaceId === "all" ? state.settings.defaultSpaceId || state.spaces[0]?.id || "" : activeSpaceId));
  const [areaId, setAreaId] = useState("areaId" in (editing || {}) ? (editing as Project).areaId || "" : "");
  const [deadline, setDeadline] = useState("deadline" in (editing || {}) ? (editing as Project).deadline || "" : "");
  const submit = (event: Event) => { event.preventDefault(); if (!title.trim()) return; if (editing) { update((draft) => { if (isArea) { const area = draft.areas.find((item) => item.id === editing.id); if (area) { area.title = title.trim(); area.spaceId = spaceId || null; } } else { const project = draft.projects.find((item) => item.id === editing.id); if (project) { project.title = title.trim(); project.notes = notes; project.spaceId = spaceId || null; project.areaId = areaId || null; project.deadline = deadline || null; } } }); onClose(); return; } const id = uid(kind); update((draft) => { if (kind === "area") draft.areas.push({ id, title: title.trim(), spaceId: spaceId || null, color: "#5b7cfa", tags: [], order: Date.now() }); else draft.projects.push({ id, title: title.trim(), notes, spaceId: spaceId || null, areaId: areaId || null, bucket: "anytime", scheduledFor: null, deadline: deadline || null, tags: [], status: "open", repeat: null, completedAt: null, order: Date.now() }); }); onCreated({ type: kind, id }); };
  const trash = () => { if (!editing) return; update((draft) => { if (isArea) { draft.tasks.forEach((task) => { if (task.areaId === editing.id) task.areaId = null; }); draft.projects.forEach((project) => { if (project.areaId === editing.id) project.areaId = null; }); draft.areas = draft.areas.filter((item) => item.id !== editing.id); } else { const project = draft.projects.find((item) => item.id === editing.id); if (project) { project.previousStatus = project.status; project.status = "trashed"; project.trashedAt = new Date().toISOString(); draft.tasks.filter((task) => task.projectId === project.id).forEach((task) => { task.previousStatus = task.status; task.status = "trashed"; task.trashedAt = project.trashedAt; }); } } }); onCreated({ type: "today" }); };
  const completeProject = () => { if (!editing || isArea) return; update((draft) => { const project = draft.projects.find((item) => item.id === editing.id); if (!project) return; const completedAt = new Date().toISOString(); project.status = "completed"; project.completedAt = completedAt; if (draft.settings.logCompletedItems === "immediately") project.loggedAt = completedAt; draft.tasks.filter((task) => task.projectId === project.id && task.status === "open").forEach((task) => { task.status = "completed"; task.completedAt = completedAt; if (draft.settings.logCompletedItems === "immediately") task.loggedAt = completedAt; }); }); onCreated({ type: "today" }); };
  const duplicateProject = () => { if (!editing || isArea) return; const source = editing as Project; const id = uid("project"); update((draft) => { draft.projects.push({ ...cloneState(source), id, title: `${source.title} copy`, status: "open", completedAt: null, loggedAt: null, order: Date.now() }); const headingMap = new Map<string, string>(); draft.headings.filter((heading) => heading.projectId === source.id).forEach((heading) => { const headingId = uid("heading"); headingMap.set(heading.id, headingId); draft.headings.push({ ...cloneState(heading), id: headingId, projectId: id }); }); draft.tasks.filter((task) => task.projectId === source.id && task.status === "open" && !task.repeat).forEach((task) => draft.tasks.push({ ...cloneState(task), id: uid("task"), projectId: id, headingId: task.headingId ? headingMap.get(task.headingId) || null : null, checklist: task.checklist.map((item) => ({ ...item, id: uid("check") })), createdAt: new Date().toISOString(), order: Date.now() + Math.random() })); }); onCreated({ type: "project", id }); };
  return <Dialog title={editing ? `${isArea ? "Area" : "Project"} Options` : "New List"} onClose={onClose}><form class="dialog-form" onSubmit={submit}>{!editing ? <Field label="Type"><select value={kind} onChange={(event) => setKind(event.currentTarget.value as "project" | "area")}><option value="project">Project</option><option value="area">Area</option></select></Field> : null}<Field label="Name"><input autofocus required value={title} onInput={(event) => setTitle(event.currentTarget.value)} /></Field><Field label="Space"><select value={spaceId || ""} onChange={(event) => setSpaceId(event.currentTarget.value)}><option value="">Unassigned</option>{state.spaces.map((space) => <option value={space.id}>{space.title}</option>)}</select></Field>{kind === "project" && !isArea ? <><Field label="Area"><select value={areaId} onChange={(event) => setAreaId(event.currentTarget.value)}><option value="">No Area</option>{state.areas.filter((area) => !spaceId || area.spaceId === spaceId).map((area) => <option value={area.id}>{area.title}</option>)}</select></Field><Field label="Notes"><textarea value={notes} onInput={(event) => setNotes(event.currentTarget.value)} /></Field><Field label="Deadline"><input type="date" value={deadline} onInput={(event) => setDeadline(event.currentTarget.value)} /></Field>{editing ? <div class="dialog-actions"><button type="button" class="button" onClick={duplicateProject}>Duplicate Project</button><button type="button" class="button" onClick={completeProject}>Complete Project</button></div> : null}</> : null}<footer>{editing ? <button type="button" class="button danger" onClick={trash}>{isArea ? "Remove Area" : "Move to Trash"}</button> : <span />}<span><button type="button" class="button" onClick={onClose}>Cancel</button><button class="button primary" type="submit">{editing ? "Save" : "Create"}</button></span></footer></form></Dialog>;
}

function HeadingDialog({ view, onClose }: { view: View; onClose: () => void }) {
  const { state, update } = useWorkspaceContext();
  const [title, setTitle] = useState("");
  const submit = (event: Event) => { event.preventDefault(); if (!title.trim()) return; update((draft) => draft.headings.push({ id: uid("heading"), title: title.trim(), projectId: view.type === "project" ? view.id || null : null, areaId: view.type === "area" ? view.id || null : null, archived: false, order: Date.now() })); onClose(); };
  const location = view.type === "project" ? projectById(state, view.id)?.title : areaById(state, view.id)?.title;
  return <Dialog title="New Heading" onClose={onClose}><form class="dialog-form" onSubmit={submit}><p>Divide {location || "this list"} into clear stages or categories.</p><Field label="Name"><input autofocus required value={title} onInput={(event) => setTitle(event.currentTarget.value)} placeholder="e.g. Final polish" /></Field><footer><span /><span><button type="button" class="button" onClick={onClose}>Cancel</button><button class="button primary" type="submit">Create</button></span></footer></form></Dialog>;
}

function SettingsDialog({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  const { state, update, activeSpaceId, setActiveSpaceId } = useWorkspaceContext();
  const [tab, setTab] = useState<"general" | "spaces" | "app" | "data">("general");
  const pwa = getPwaStatus();
  const addSpace = () => update((draft) => draft.spaces.push({ id: uid("space"), title: "New Space", color: "#5b7cfa", pinned: false, order: Date.now() }));
  const exportData = () => { const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" })); anchor.download = `objects-backup-${localDay()}.json`; anchor.click(); URL.revokeObjectURL(anchor.href); };
  const importData = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const next = normalizeState(JSON.parse(String(reader.result)) as ObjectsState); update((draft) => Object.assign(draft, next)); onClose(); } catch { window.alert("This is not a valid Objects backup."); } }; reader.readAsText(file); };
  return <Dialog title="Settings" onClose={onClose} wide><div class="settings-layout"><nav><button class={tab === "general" ? "active" : ""} onClick={() => setTab("general")}><Icon name="settings" />General</button><button class={tab === "spaces" ? "active" : ""} onClick={() => setTab("spaces")}><Icon name="layers" />Spaces</button><button class={tab === "app" ? "active" : ""} onClick={() => setTab("app")}><Icon name="cloud" />App</button><button class={tab === "data" ? "active" : ""} onClick={() => setTab("data")}><Icon name="download" />Data</button></nav><section>{tab === "general" ? <><h3>Appearance</h3><Field label="Theme"><select value={state.settings.theme} onChange={(event) => update((draft) => { draft.settings.theme = event.currentTarget.value as ObjectsState["settings"]["theme"]; })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></Field><Field label="Week starts on"><select value={state.settings.weekStartsOn} onChange={(event) => update((draft) => { draft.settings.weekStartsOn = Number(event.currentTarget.value) as 0 | 1; })}><option value="1">Monday</option><option value="0">Sunday</option></select></Field><label class="setting-toggle"><span><strong>Show calendar events</strong><small>Display events above Today and Upcoming.</small></span><input type="checkbox" checked={state.settings.showCalendar} onChange={(event) => update((draft) => { draft.settings.showCalendar = event.currentTarget.checked; })} /></label><Field label="Log completed items"><select value={state.settings.logCompletedItems} onChange={(event) => update((draft) => { draft.settings.logCompletedItems = event.currentTarget.value as ObjectsState["settings"]["logCompletedItems"]; })}><option value="immediately">Immediately</option><option value="daily">Daily</option><option value="manually">Manually</option></select></Field></> : null}{tab === "spaces" ? <><div class="settings-heading"><div><h3>Spaces</h3><p>Keep work and personal lists separate.</p></div><button class="button" onClick={addSpace}><Icon name="plus" /> Add Space</button></div><div class="space-editors">{state.spaces.map((space) => <div class="space-editor"><input type="color" value={space.color} onInput={(event) => update((draft) => { const item = draft.spaces.find((candidate) => candidate.id === space.id); if (item) item.color = event.currentTarget.value; })} /><input value={space.title} onInput={(event) => update((draft) => { const item = draft.spaces.find((candidate) => candidate.id === space.id); if (item) item.title = event.currentTarget.value; })} /><label><input type="checkbox" checked={space.pinned} onChange={(event) => update((draft) => { const item = draft.spaces.find((candidate) => candidate.id === space.id); if (item) item.pinned = event.currentTarget.checked; })} /> Pin</label><button class="icon-button" onClick={() => update((draft) => { if (activeSpaceId === space.id) setActiveSpaceId("all"); draft.areas.forEach((area) => { if (area.spaceId === space.id) area.spaceId = null; }); draft.projects.forEach((project) => { if (project.spaceId === space.id) project.spaceId = null; }); draft.tasks.forEach((task) => { if (task.spaceId === space.id) task.spaceId = null; }); draft.spaces = draft.spaces.filter((item) => item.id !== space.id); })}><Icon name="trash" /></button></div>)}</div></> : null}{tab === "app" ? <><h3>Objects App</h3><p>Install Objects and enable reminders for a more app-like experience.</p><div class="button-stack"><button class="button" disabled={pwa.installed} onClick={async () => { const result = await requestPwaInstall(); if (result === "instructions") window.alert("Use your browser’s Add to Home Screen or Install App command."); }}>{pwa.installed ? "App installed" : "Install app"}</button><button class="button" onClick={async () => { const permission = await requestNotificationAccess(); update((draft) => { draft.settings.notifications = permission === "granted"; }); }}>{pwa.notificationPermission === "granted" ? "Notifications enabled" : "Enable notifications"}</button>{pwa.updateAvailable ? <button class="button primary" onClick={() => activatePwaUpdate()}>Install update</button> : null}</div></> : null}{tab === "data" ? <><h3>Backup</h3><p>Export a portable copy of all your Objects data.</p><div class="button-stack"><button class="button" onClick={exportData}><Icon name="download" /> Export JSON</button><label class="button file-button"><Icon name="upload" /> Import JSON<input type="file" accept="application/json" onChange={(event) => importData(event.currentTarget.files?.[0])} /></label><button class="button" onClick={onSignOut}>Sign out</button></div></> : null}</section></div></Dialog>;
}

function Workspace({ auth, serialized, online }: { auth: AuthIdentity; serialized: string; online: boolean }) {
  const initialize = useMutation<[serialized: string], string>("initializeNormalized");
  const persist = useMutation<[serialized: string], string>("applyChanges");
  const { state, update, saveStatus } = useWorkspaceModel(serialized, initialize, persist);
  const [activeSpaceId, setActiveSpace] = useState(() => localStorage.getItem("objects-active-space") || "all");
  const setActiveSpaceId = (id: string) => { setActiveSpace(id); localStorage.setItem("objects-active-space", id); };
  const initialView = new URLSearchParams(location.search).get("view") as ViewType | null;
  const [view, setViewState] = useState<View>({ type: initialView || "today" });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => new URLSearchParams(location.search).get("task"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newListOpen, setNewListOpen] = useState(false);
  const [editListOpen, setEditListOpen] = useState(false);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [moveTaskOpen, setMoveTaskOpen] = useState(false);
  const [quickAddRequest, setQuickAddRequest] = useState(0);

  const setView = (next: View) => { setViewState(next); const url = new URL(location.href); url.searchParams.set("view", next.type); if (next.id) url.searchParams.set("id", next.id); else url.searchParams.delete("id"); history.replaceState(null, "", url); };

  useEffect(() => {
    if (!state) return;
    const choice = activeSpaceId !== "all" && !state.spaces.some((space) => space.id === activeSpaceId) ? "all" : activeSpaceId;
    if (choice !== activeSpaceId) setActiveSpaceId(choice);
    document.documentElement.dataset.theme = state.settings.theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : state.settings.theme;
  }, [state?.settings.theme, state?.spaces.length]);

  useEffect(() => {
    if (!state) return;
    const params = new URLSearchParams(location.search);
    const capture = params.get("title") || params.get("text");
    if (!capture) return;
    const parsed = parseNaturalTask([capture, params.get("url")].filter(Boolean).join(" "));
    const id = uid("task");
    update((draft) => draft.tasks.push({ id, spaceId: draft.settings.defaultSpaceId || draft.spaces[0]?.id || null, title: parsed.title, notes: "", status: "open", bucket: parsed.bucket, scheduledFor: parsed.scheduledFor, evening: parsed.evening, reminderAt: parsed.reminderAt, deadline: parsed.deadline, projectId: null, headingId: null, areaId: null, tags: parsed.tags, checklist: [], repeat: null, createdAt: new Date().toISOString(), completedAt: null, order: Date.now() }));
    setSelectedTaskId(id);
    history.replaceState(null, "", "/?view=today");
  }, [Boolean(state)]);

  useEffect(() => {
    if (!state?.settings.notifications) return;
    const check = async () => {
      const now = Date.now();
      for (const task of state.tasks.filter((item) => item.status === "open" && item.reminderAt && !item.reminderSentAt)) {
        const due = new Date(task.reminderAt!).getTime();
        if (due <= now && due > now - 86_400_000 && await showTaskReminder(task)) update((draft) => { const item = draft.tasks.find((candidate) => candidate.id === task.id); if (item) item.reminderSentAt = new Date().toISOString(); });
      }
    };
    void check(); const timer = window.setInterval(() => void check(), 30_000); return () => window.clearInterval(timer);
  }, [state?.settings.notifications, state?.tasks]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") { event.preventDefault(); setQuickAddRequest((value) => value + 1); }
      if (event.key === "Escape" && selectedTaskId) setSelectedTaskId(null);
    };
    document.addEventListener("keydown", handler); return () => document.removeEventListener("keydown", handler);
  }, [selectedTaskId]);

  if (!state) return <AuthScreen mode={online ? "loading" : "offline"} />;
  const editing = editListOpen ? (view.type === "project" ? projectById(state, view.id) : view.type === "area" ? areaById(state, view.id) : undefined) : undefined;
  return <WorkspaceContext.Provider value={{ state, update, saveStatus, activeSpaceId, setActiveSpaceId }}><div class={`app-shell ${selectedTaskId ? "inspector-open" : ""}`}><Sidebar view={view} setView={setView} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onSearch={() => setSearchOpen(true)} onSettings={() => setSettingsOpen(true)} onNewList={() => setNewListOpen(true)} /><ContentView view={view} setView={setView} selectedTaskId={selectedTaskId} setSelectedTaskId={setSelectedTaskId} onMenu={() => setSidebarOpen(true)} onSearch={() => setSearchOpen(true)} onEditList={() => setEditListOpen(true)} onNewHeading={() => setHeadingOpen(true)} quickAddRequest={quickAddRequest} onQuickAdd={() => setQuickAddRequest((value) => value + 1)} />{selectedTaskId ? <TaskInspector taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onMove={() => setMoveTaskOpen(true)} /> : null}</div>{searchOpen ? <SearchDialog onClose={() => setSearchOpen(false)} onChoose={(next, taskId) => { setView(next); if (taskId) setSelectedTaskId(taskId); setSearchOpen(false); }} /> : null}{settingsOpen ? <SettingsDialog onClose={() => setSettingsOpen(false)} onSignOut={async () => { await signOut(); location.reload(); }} /> : null}{newListOpen ? <ListDialog onClose={() => setNewListOpen(false)} onCreated={(next) => { setView(next); setNewListOpen(false); }} /> : null}{editListOpen && editing ? <ListDialog editing={editing} onClose={() => setEditListOpen(false)} onCreated={(next) => { setView(next); setEditListOpen(false); }} /> : null}{headingOpen && (view.type === "project" || view.type === "area") ? <HeadingDialog view={view} onClose={() => setHeadingOpen(false)} /> : null}{moveTaskOpen && selectedTaskId ? <MoveDialog taskId={selectedTaskId} onClose={() => setMoveTaskOpen(false)} /> : null}</WorkspaceContext.Provider>;
}

function ObjectsShell({ auth, online }: { auth: AuthIdentity; online: boolean }) {
  const serialized = useQuery<string>("state");
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => { if (serialized) { setTimedOut(false); return; } const timer = window.setTimeout(() => setTimedOut(true), 5000); return () => window.clearTimeout(timer); }, [serialized]);
  if (!serialized) return !online ? <AuthScreen mode="offline" /> : timedOut ? <AuthScreen mode="recovery" /> : <AuthScreen mode="loading" />;
  return <Workspace auth={auth} serialized={serialized} online={online} />;
}

export function App() {
  const auth = useAuth();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const localGuest = ["localhost", "127.0.0.1"].includes(location.hostname);
  useEffect(() => {
    document.title = "Objects";
    const metadata = [["link", "link[rel='manifest']", { rel: "manifest", href: "/manifest.webmanifest" }], ["meta", "meta[name='theme-color']", { name: "theme-color", content: "#ffffff" }]] as const;
    for (const [tag, selector, attrs] of metadata) { let element = document.head.querySelector(selector); if (!element) { element = document.createElement(tag); document.head.appendChild(element); } for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value); }
    const cleanupPwa = initializePwa();
    const sync = () => setOnline(navigator.onLine); window.addEventListener("online", sync); window.addEventListener("offline", sync);
    return () => { cleanupPwa(); window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  useEffect(() => { if (!auth.isLoading) { setAuthTimedOut(false); return; } const timer = window.setTimeout(() => setAuthTimedOut(true), 5000); return () => window.clearTimeout(timer); }, [auth.isLoading]);
  return <><style>{styles}</style>{auth.isLoading ? <AuthScreen mode={!online ? "offline" : authTimedOut ? "recovery" : "loading"} /> : auth.isGuest && !localGuest ? <AuthScreen mode="signin" /> : <ObjectsShell auth={auth} online={online} />}</>;
}
