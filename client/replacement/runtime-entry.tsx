import { Component, render, type ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { ImportReport } from "../../shared/replacement/importer";
import type { CalendarEvent, EntityId, HeadingLocation, Project, ProjectLocation, RepeatingPattern, RepeatingProjectContents, RepeatingProjectToDoBlueprint, RepeatingTemplate, Schedule, ToDo, ToDoLocation, WorkspaceDocument, WorkspaceUndo } from "../../shared/replacement/model";
import { agendaForView } from "../../shared/replacement/calendar";
import { addDaysToDate as datePlus, dateInTimeZone } from "../../shared/replacement/dates";
import { effectiveTagIdsForRepeatingTemplate, spaceIdForRepeatingTemplate } from "../../shared/replacement/location";
import {
  directTargetUrl,
  moveQuickFindSelection,
  parseDirectTarget,
  recoverDirectTargetAfterLoad,
  resolveDirectTarget,
  searchWorkspace,
  type DirectTarget,
  type ResolvedDirectTarget,
  type SearchResult,
} from "../../shared/replacement/discovery";
import {
  DELETE_HEADING_CONFIRMATION,
  DELETE_SPACE_CONFIRMATION,
  DELETE_TAG_CONFIRMATION,
  EMPTY_TRASH_CONFIRMATION,
  FULL_IMPORT_CONFIRMATION,
  PERMANENT_DELETE_CONFIRMATION,
  REMOVE_AREA_CONFIRMATION,
  DELETE_REPEATING_TEMPLATE_CONFIRMATION,
  createEmptyWorkspace,
  createWorkspace,
  repeatingRuleSummary,
  type WorkspaceChange,
  type WorkspaceView,
} from "../../shared/replacement/workspace";
import type { WorkspaceSyncCommand } from "../../shared/replacement/sync";
import type { WorkspaceSyncAdapter } from "../../shared/replacement/sync";
import { changesForIntent, toDoActionForShortcut, touchActionForDistance, updateSelection, type InteractionSource, type SelectionState, type ToDoAction } from "./interactions";
import { replacementStyles } from "./styles";
import { destroyWorkspaceToDoSortable, mountWorkspaceToDoSortable } from "../ui/sortable";
import { type OverlayElement, useWebAwesomeOverlay, WaDialog } from "../ui/webawesome";

type BoundaryState = { failed: boolean };
type Feedback = { text: string; error: boolean; undo?: WorkspaceUndo; undoDocument?: WorkspaceDocument };

const QUICK_DRAFT_KEY = "objects-replacement-quick-draft";

class ReplacementLoadBoundary extends Component<{ children: ComponentChildren }, BoundaryState> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }
  render() {
    if (this.state.failed) return <ReplacementState title="Your Workspace could not load" copy="Your saved work is safe. Retry when the connection is ready."><button className="replacement-button" type="button" onClick={() => window.location.reload()}>Retry loading</button></ReplacementState>;
    return this.props.children;
  }
}

function ReplacementState({ title, copy, children }: { title: string; copy: string; children?: ComponentChildren }) {
  return <main className="replacement-state"><section className="replacement-state-card" aria-labelledby="replacement-state-title"><p className="replacement-kicker">Objects</p><h1 id="replacement-state-title">{title}</h1><p>{copy}</p>{children}</section></main>;
}

function newWorkspaceDocument(): WorkspaceDocument {
  const document = createEmptyWorkspace(new Date().toISOString());
  const id = `space-${crypto.randomUUID()}`;
  document.spaces.push({ id, title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = id;
  return document;
}

function workspaceFor(document: WorkspaceDocument) {
  return createWorkspace(document, { now: () => new Date().toISOString(), createId: (kind) => `${kind}-${crypto.randomUUID()}` });
}

function reportText(report: ImportReport): string {
  const imported = report.imported;
  const total = imported.spaces + imported.areas + imported.projects + imported.headings + imported.tags + imported.toDos + imported.repeatingTemplates + imported.calendarEvents;
  return `Imported ${total} items. Corrected ${report.corrected}, skipped ${report.skipped}, rejected ${report.rejected}.`;
}

function viewTitle(view: WorkspaceView, document: WorkspaceDocument): string {
  const standard: Record<string, string> = { today: "Today", thisEvening: "This Evening", tomorrow: "Tomorrow", upcoming: "Upcoming", inbox: "Inbox", anytime: "Anytime", someday: "Someday", deadlines: "Deadlines", logbook: "Logbook", trash: "Trash", repeating: "Repeating" };
  if (standard[view.kind]) return standard[view.kind];
  if (!("id" in view)) return "Objects";
  const collection = view.kind === "space" ? document.spaces : view.kind === "area" ? document.areas : view.kind === "project" ? document.projects : document.headings;
  return collection.find((item) => item.id === view.id)?.title ?? "Missing list";
}

function createDefaults(view: WorkspaceView): { schedule: Schedule; location?: ToDo["location"] } {
  const action = moveActionForView(view);
  if (action?.type === "schedule") return { schedule: action.schedule };
  if (action?.type === "move") return { schedule: { kind: "inbox" }, location: action.location };
  return { schedule: { kind: "inbox" } };
}

function moveActionForView(view: WorkspaceView): ToDoAction | null {
  if (view.kind === "today") return { type: "schedule", schedule: { kind: "scheduled", date: view.date, evening: false } };
  if (view.kind === "thisEvening") return { type: "schedule", schedule: { kind: "scheduled", date: view.date, evening: true } };
  if (view.kind === "tomorrow") return { type: "schedule", schedule: { kind: "scheduled", date: view.date, evening: false } };
  if (view.kind === "inbox" || view.kind === "anytime" || view.kind === "someday") return { type: "schedule", schedule: { kind: view.kind } };
  if (view.kind === "space") return { type: "move", location: { kind: "unfiled", spaceId: view.id } };
  if (view.kind === "area") return { type: "move", location: { kind: "area", areaId: view.id } };
  if (view.kind === "project") return { type: "move", location: { kind: "project", projectId: view.id } };
  if (view.kind === "heading") return { type: "move", location: { kind: "heading", headingId: view.id } };
  return null;
}

function directTargetForView(view: WorkspaceView): DirectTarget {
  if (view.kind === "space" || view.kind === "area" || view.kind === "project" || view.kind === "heading") return { kind: view.kind, id: view.id };
  return { kind: "view", viewKind: view.kind };
}

function dateTimeInputValue(iso: string): string {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function dateTimeInputIso(value: string, allDay: boolean): string {
  return allDay ? `${value}T00:00:00.000Z` : new Date(value).toISOString();
}

function destinationForSection(sectionKey: string, view: WorkspaceView): Extract<WorkspaceChange, { type: "reorderToDos" }>["destination"] {
  const [kind, id] = sectionKey.split(":");
  if (kind === "heading" && id) return { location: { kind: "heading", headingId: id } };
  if (kind === "project" && id) return { location: { kind: "project", projectId: id } };
  if (kind === "area" && id) return { location: { kind: "area", areaId: id } };
  if (kind === "space" && id) return { location: { kind: "unfiled", spaceId: id } };
  const action = moveActionForView(view);
  return action?.type === "move" ? { location: action.location } : action?.type === "schedule" ? { schedule: action.schedule } : undefined;
}

function directLocationFromEffective(location: ReturnType<ReturnType<typeof workspaceFor>["locationOfToDo"]>): ToDoLocation | undefined {
  if (!location) return undefined;
  if (location.headingId) return { kind: "heading", headingId: location.headingId };
  if (location.projectId) return { kind: "project", projectId: location.projectId };
  if (location.areaId) return { kind: "area", areaId: location.areaId };
  return { kind: "unfiled", spaceId: location.spaceId };
}

function visibleToDoIdsFor(
  workspace: ReturnType<typeof workspaceFor>,
  view: WorkspaceView,
  search: string,
): string[] {
  const query = search.trim().toLowerCase();
  return workspace.view(view)
    .filter((item): item is ToDo => "checklist" in item)
    .filter((item) => !query || item.title.toLowerCase().includes(query) || item.notes.toLowerCase().includes(query))
    .map((item) => item.id);
}

function groupWorkspaceItems(
  items: Array<ToDo | Project>,
  view: WorkspaceView,
  document: WorkspaceDocument,
  workspace: ReturnType<typeof workspaceFor>,
): Map<string, { title: string | null; items: Array<ToDo | Project> }> {
  const sections = new Map<string, { title: string | null; items: Array<ToDo | Project> }>();
  const usesOrganizationSections = ["space", "area", "project"].includes(view.kind);
  for (const item of items) {
    let key = "view";
    let title: string | null = null;
    if (usesOrganizationSections && "checklist" in item) {
      const location = workspace.locationOfToDo(item.id);
      if (location?.headingId) { key = `heading:${location.headingId}`; title = document.headings.find((heading) => heading.id === location.headingId)?.title ?? "Heading"; }
      else if (location?.projectId) { key = `project:${location.projectId}`; title = document.projects.find((project) => project.id === location.projectId)?.title ?? "Project"; }
      else if (location?.areaId) { key = `area:${location.areaId}`; title = document.areas.find((area) => area.id === location.areaId)?.title ?? "Area"; }
      else if (location?.spaceId) { key = `space:${location.spaceId}`; title = document.spaces.find((space) => space.id === location.spaceId)?.title ?? "Space"; }
    }
    const section = sections.get(key) ?? { title, items: [] };
    section.items.push(item);
    sections.set(key, section);
  }
  return sections;
}

function containTabKey(event: KeyboardEvent, container: Element | null): void {
  if (event.key !== "Tab" || !container) return;
  const controls = [...container.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")]
    .filter((item) => item.offsetParent !== null);
  if (!controls.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function MarkdownPreview({ value }: { value: string }) {
  if (!value.trim()) return <p className="replacement-muted">Nothing to preview yet.</p>;
  return <div className="replacement-markdown">{value.split("\n").map((line, index) => line.startsWith("## ") ? <h3 key={index}>{line.slice(3)}</h3> : line.startsWith("# ") ? <h2 key={index}>{line.slice(2)}</h2> : line.startsWith("- ") ? <li key={index}>{line.slice(2)}</li> : <p key={index}>{line || " "}</p>)}</div>;
}

type RepeatEditorTarget =
  | { kind: "direct" }
  | { kind: "template"; template: RepeatingTemplate }
  | { kind: "toDo"; toDo: ToDo }
  | { kind: "project"; project: Project };

type RepeatLocation = ToDoLocation | ProjectLocation;
type RepeatLocationChoice = { key: string; label: string; location: RepeatLocation };

function defaultRepeatLocation(document: WorkspaceDocument, itemKind: "toDo" | "project"): RepeatLocation {
  const spaceId = document.settings.defaultSpaceId ?? document.spaces[0]?.id ?? "";
  return itemKind === "toDo" ? { kind: "unfiled", spaceId } : { kind: "space", spaceId };
}

function repeatLocationChoices(document: WorkspaceDocument, itemKind: "toDo" | "project"): RepeatLocationChoice[] {
  const choices: RepeatLocationChoice[] = document.spaces.map((space) => ({
    key: `${itemKind}-space-${space.id}`,
    label: `${space.title} · ${itemKind === "toDo" ? "Unfiled" : "Space"}`,
    location: itemKind === "toDo" ? { kind: "unfiled", spaceId: space.id } : { kind: "space", spaceId: space.id },
  }));
  for (const area of document.areas) choices.push({ key: `area-${area.id}`, label: `${area.title} · Area`, location: { kind: "area", areaId: area.id } });
  if (itemKind === "toDo") {
    for (const project of document.projects) choices.push({ key: `project-${project.id}`, label: `${project.title} · Project`, location: { kind: "project", projectId: project.id } });
    for (const heading of document.headings) choices.push({ key: `heading-${heading.id}`, label: `${heading.title} · Heading`, location: { kind: "heading", headingId: heading.id } });
  }
  return choices;
}

function repeatLocationKey(location: RepeatLocation, choices: RepeatLocationChoice[]): string {
  return choices.find((choice) => JSON.stringify(choice.location) === JSON.stringify(location))?.key ?? choices[0]?.key ?? "";
}

function RepeatLocationSelector({ document, itemKind, location, change }: {
  document: WorkspaceDocument;
  itemKind: "toDo" | "project";
  location: RepeatLocation;
  change: (location: RepeatLocation) => void;
}) {
  const choices = repeatLocationChoices(document, itemKind);
  return <label>Location<select value={repeatLocationKey(location, choices)} onChange={(event) => {
    const selected = choices.find((choice) => choice.key === event.currentTarget.value);
    if (selected) change(selected.location);
  }}>{choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}</select></label>;
}

function updateProjectToDo(contents: RepeatingProjectContents, key: string, changes: Partial<RepeatingProjectToDoBlueprint>): RepeatingProjectContents {
  return { ...contents, toDos: contents.toDos.map((item) => item.key === key ? { ...item, ...changes } : item) };
}

function ProjectToDoDefaultsEditor({ toDo, headings, document, change, remove }: {
  toDo: RepeatingProjectToDoBlueprint;
  headings: RepeatingProjectContents["headings"];
  document: WorkspaceDocument;
  change: (changes: Partial<RepeatingProjectToDoBlueprint>) => void;
  remove: () => void;
}) {
  const [tagNames, setTagNames] = useState(toDo.tags.map((id) => document.tags.find((tag) => tag.id === id)?.title).filter(Boolean).join(", "));
  const schedule = toDo.schedule ?? { kind: "anytime" as const };
  const reminder = toDo.reminder;
  const deadline = toDo.deadline;
  const updateTags = (value: string) => {
    setTagNames(value);
    const names = value.split(",").map((name) => name.trim().toLowerCase()).filter(Boolean);
    change({ tags: document.tags.filter((tag) => names.includes(tag.title.toLowerCase())).map((tag) => tag.id) });
  };
  return <div className="replacement-blueprint-card">
    <label>Title<input value={toDo.title} onInput={(event) => change({ title: event.currentTarget.value })} /></label>
    <label>Notes<textarea rows={2} value={toDo.notes} onInput={(event) => change({ notes: event.currentTarget.value })} /></label>
    <label>Heading<select value={toDo.headingKey ?? ""} onChange={(event) => change({ headingKey: event.currentTarget.value || null })}><option value="">Project root</option>{headings.map((heading) => <option key={heading.key} value={heading.key}>{heading.title}</option>)}</select></label>
    <label>Tags<input value={tagNames} onInput={(event) => updateTags(event.currentTarget.value)} placeholder="Existing Tags, separated by commas" /></label>
    <label>Schedule<select value={schedule.kind} onChange={(event) => {
      const kind = event.currentTarget.value as Schedule["kind"];
      change({ schedule: kind === "scheduled" ? { kind, offsetDays: 0, evening: false } : { kind } });
    }}><option value="inbox">Inbox</option><option value="anytime">Anytime</option><option value="someday">Someday</option><option value="scheduled">Relative to Occurrence</option></select></label>
    {schedule.kind === "scheduled" ? <div className="replacement-repeat-grid"><label>Schedule offset (days)<input type="number" value={schedule.offsetDays} onInput={(event) => change({ schedule: { ...schedule, offsetDays: Number(event.currentTarget.value) } })} /></label><label><input type="checkbox" checked={schedule.evening} onChange={(event) => change({ schedule: { ...schedule, evening: event.currentTarget.checked } })} /> Evening</label></div> : null}
    <label>Reminder<select value={reminder?.kind ?? "none"} onChange={(event) => change({ reminder: event.currentTarget.value === "none" ? null : { kind: "offset", days: 0, time: "09:00" } })}><option value="none">None</option><option value="offset">Relative to Occurrence</option></select></label>
    {reminder?.kind === "offset" ? <div className="replacement-repeat-grid"><label>Reminder offset (days)<input type="number" value={reminder.days} onInput={(event) => change({ reminder: { ...reminder, days: Number(event.currentTarget.value) } })} /></label><label>Reminder time<input type="time" value={reminder.time} onInput={(event) => change({ reminder: { ...reminder, time: event.currentTarget.value } })} /></label></div> : null}
    <label>Deadline<select value={deadline?.kind ?? "none"} onChange={(event) => change({ deadline: event.currentTarget.value === "none" ? null : { kind: "offset", days: 0 } })}><option value="none">None</option><option value="offset">Relative to Occurrence</option></select></label>
    {deadline?.kind === "offset" ? <label>Deadline offset (days)<input type="number" value={deadline.days} onInput={(event) => change({ deadline: { kind: "offset", days: Number(event.currentTarget.value) } })} /></label> : null}
    <label>Checklist<textarea rows={2} value={toDo.checklist.map((item) => item.title).join("\n")} onInput={(event) => change({ checklist: event.currentTarget.value.split("\n").map((value, order) => ({ title: value.trim(), completed: false, order })).filter((item) => item.title) })} placeholder="One item per line" /></label>
    <button type="button" onClick={remove}>Remove to-do</button>
  </div>;
}

function ProjectContentsEditor({ contents, document, change }: { contents: RepeatingProjectContents; document: WorkspaceDocument; change: (contents: RepeatingProjectContents) => void }) {
  return <fieldset className="replacement-project-defaults"><legend>Project contents</legend><p>Each Occurrence gets fresh Projects, Headings, to-dos, and checklist identities.</p>
    {contents.headings.map((heading) => <div className="replacement-blueprint-row" key={heading.key}><input aria-label="Heading title" value={heading.title} onInput={(event) => change({ ...contents, headings: contents.headings.map((item) => item.key === heading.key ? { ...item, title: event.currentTarget.value } : item) })} /><button type="button" onClick={() => change({ headings: contents.headings.filter((item) => item.key !== heading.key), toDos: contents.toDos.map((item) => item.headingKey === heading.key ? { ...item, headingKey: null } : item) })}>Remove Heading</button></div>)}
    <button type="button" onClick={() => change({ ...contents, headings: [...contents.headings, { key: `heading-${crypto.randomUUID()}`, title: "New Heading", archived: false, order: contents.headings.length }] })}>Add Heading</button>
    {contents.toDos.map((toDo) => <ProjectToDoDefaultsEditor key={toDo.key} toDo={toDo} headings={contents.headings} document={document} change={(changes) => change(updateProjectToDo(contents, toDo.key, changes))} remove={() => change({ ...contents, toDos: contents.toDos.filter((item) => item.key !== toDo.key) })} />)}
    <button type="button" onClick={() => change({ ...contents, toDos: [...contents.toDos, { key: `todo-${crypto.randomUUID()}`, title: "New to-do", notes: "", headingKey: null, tags: [], checklist: [], schedule: { kind: "anytime" }, reminder: null, deadline: null, order: contents.toDos.length }] })}>Add to-do</button>
  </fieldset>;
}

function RepeatEditor({ target, document, today, runChange, close }: {
  target: RepeatEditorTarget;
  document: WorkspaceDocument;
  today: string;
  runChange: (change: WorkspaceChange) => Promise<boolean>;
  close: () => void;
}) {
  const template = target.kind === "template" ? target.template : null;
  const source = target.kind === "toDo" ? target.toDo : target.kind === "project" ? target.project : null;
  const conversion = target.kind === "toDo" || target.kind === "project";
  const [itemKind, setItemKind] = useState<"toDo" | "project">(template?.itemKind ?? (target.kind === "project" ? "project" : "toDo"));
  const [title, setTitle] = useState(template?.title ?? source?.title ?? "");
  const [notes, setNotes] = useState(template?.notes ?? source?.notes ?? "");
  const [mode, setMode] = useState<RepeatingTemplate["mode"]>(template?.mode ?? "on-schedule");
  const [frequency, setFrequency] = useState<RepeatingPattern["frequency"]>(template?.pattern.frequency ?? "weekly");
  const [interval, setInterval] = useState(template?.pattern.interval ?? 1);
  const [weekdays, setWeekdays] = useState<number[]>(template?.pattern.weekdays ?? []);
  const [firstDate, setFirstDate] = useState(template?.nextDate ?? (source?.schedule.kind === "scheduled" ? source.schedule.date : today));
  const [reminderTime, setReminderTime] = useState(template?.reminderTime ?? (target.kind === "toDo" ? target.toDo.reminder?.at.slice(11, 16) ?? "" : ""));
  const [deadlineOffset, setDeadlineOffset] = useState(template?.deadlineOffsetDays?.toString() ?? "");
  const [checklist, setChecklist] = useState(template?.checklist.map((item) => item.title).join("\n") ?? (target.kind === "toDo" ? target.toDo.checklist.map((item) => item.title).join("\n") : ""));
  const [tagNames, setTagNames] = useState((template?.tags ?? source?.tags ?? []).map((id) => document.tags.find((tag) => tag.id === id)?.title).filter(Boolean).join(", "));
  const [location, setLocation] = useState<RepeatLocation>(template?.location ?? defaultRepeatLocation(document, itemKind));
  const [projectContents, setProjectContents] = useState<RepeatingProjectContents>(() => template?.itemKind === "project"
    ? JSON.parse(JSON.stringify(template.projectContents)) as RepeatingProjectContents
    : { headings: [], toDos: [] });
  const dialog = useRef<OverlayElement>(null);
  useWebAwesomeOverlay(dialog, close);
  const pattern: RepeatingPattern = { frequency, interval: Math.max(1, interval), weekdays: frequency === "weekly" ? weekdays : [] };
  const summary = repeatingRuleSummary(pattern, mode);

  const save = async (event: Event) => {
    event.preventDefault();
    if (!title.trim() || !firstDate) return;
    const tags = tagIdsFromNames(tagNames, document);
    if (!tags) return;
    const toDoLocation: ToDoLocation = location.kind === "space" ? { kind: "unfiled", spaceId: location.spaceId } : location;
    const projectLocation: ProjectLocation = location.kind === "area" || location.kind === "space" ? location
      : { kind: "space", spaceId: location.kind === "unfiled" ? location.spaceId : document.settings.defaultSpaceId ?? document.spaces[0]?.id ?? "" };
    let change: WorkspaceChange | null = null;
    if (target.kind === "template") {
      change = {
        type: "updateRepeatingTemplate",
        id: target.template.id,
        changes: {
          title, notes, tags, pattern, mode,
          ...(firstDate !== target.template.nextDate ? { nextDate: firstDate } : {}),
          location: target.template.itemKind === "toDo" ? toDoLocation : projectLocation,
          reminderTime: reminderTime || null,
          deadlineOffsetDays: deadlineOffset === "" ? null : Number(deadlineOffset),
          checklist: checklist.split("\n").map((value) => value.trim()).filter(Boolean),
          ...(target.template.itemKind === "project" ? { projectContents } : {}),
        },
      };
    } else if (target.kind === "toDo") {
      change = { type: "makeToDoRepeating", id: target.toDo.id, nextDate: firstDate, pattern, mode };
    } else if (target.kind === "project") {
      change = { type: "makeProjectRepeating", id: target.project.id, firstDate, pattern, mode };
    } else if (document.spaces.length) {
      change = {
        type: "createRepeatingTemplate",
        template: itemKind === "toDo" ? {
          itemKind, title, notes, tags, location: toDoLocation, pattern, mode,
          firstDate, reminderTime: reminderTime || null,
          deadlineOffsetDays: deadlineOffset === "" ? null : Number(deadlineOffset),
          checklist: checklist.split("\n").map((value) => value.trim()).filter(Boolean),
        } : {
          itemKind, title, notes, tags, location: projectLocation, pattern, mode, projectContents,
          firstDate, deadlineOffsetDays: deadlineOffset === "" ? null : Number(deadlineOffset),
        },
      };
    }
    if (change && await runChange(change)) close();
  };

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return <WaDialog ref={dialog} class="replacement-wa-dialog replacement-repeat-dialog" label="Repeat editor" without-header light-dismiss>
    <form className="replacement-dialog replacement-repeat-editor" onSubmit={(event) => void save(event)}>
      <header><div><p className="replacement-kicker">Repeating Template</p><h2>{template ? "Edit future Occurrences" : source ? `Repeat this ${target.kind === "toDo" ? "to-do" : "Project"}` : "New repeating item"}</h2></div><button type="button" aria-label="Close repeat editor" onClick={close}>×</button></header>
      {target.kind === "direct" ? <label>Item type<select value={itemKind} onChange={(event) => { const kind = event.currentTarget.value as "toDo" | "project"; setItemKind(kind); setLocation(defaultRepeatLocation(document, kind)); }}><option value="toDo">To-do</option><option value="project">Project</option></select></label> : null}
      {conversion ? <section className="replacement-repeat-source"><strong>{source?.title}</strong><p>Objects will copy this item’s current content and defaults into the Template. Edit the original first if those details need to change.</p></section> : <><label>Title<input autoFocus value={title} onInput={(event) => setTitle(event.currentTarget.value)} required /></label><label>Notes<textarea rows={3} value={notes} onInput={(event) => setNotes(event.currentTarget.value)} /></label></>}
      {target.kind === "direct" || target.kind === "template" ? <label>Tags<input value={tagNames} onInput={(event) => setTagNames(event.currentTarget.value)} placeholder="Existing Tags, separated by commas" /></label> : null}
      {target.kind === "direct" || target.kind === "template" ? <RepeatLocationSelector document={document} itemKind={itemKind} location={location} change={setLocation} /> : null}
      <div className="replacement-repeat-grid"><label>Mode<select value={mode} onChange={(event) => setMode(event.currentTarget.value as RepeatingTemplate["mode"])}><option value="on-schedule">On schedule</option><option value="after-completion">After completion</option></select></label><label>Repeats<select value={frequency} onChange={(event) => setFrequency(event.currentTarget.value as RepeatingPattern["frequency"])}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label>Every<input type="number" min="1" max="999" value={interval} onInput={(event) => setInterval(Number(event.currentTarget.value))} /></label><label>{template ? "Next date" : "First date"}<input type="date" value={firstDate} onInput={(event) => setFirstDate(event.currentTarget.value)} required /></label></div>
      {frequency === "weekly" ? <fieldset><legend>Weekdays</legend><div className="replacement-weekdays">{weekdayNames.map((name, day) => <label key={name}><input type="checkbox" checked={weekdays.includes(day)} onChange={(event) => setWeekdays((current) => event.currentTarget.checked ? [...current, day].sort() : current.filter((value) => value !== day))} />{name}</label>)}</div></fieldset> : null}
      <p className="replacement-repeat-explanation">{mode === "on-schedule" ? "On schedule creates each dated Occurrence even if earlier work is still open." : "After completion keeps one open Occurrence and counts from the day you complete or Skip it."}</p>
      <output className="replacement-repeat-summary" aria-live="polite">{summary}. First shown on {firstDate || "the chosen date"}.</output>
      {itemKind === "toDo" && !conversion ? <><label>Checklist defaults<textarea rows={3} value={checklist} onInput={(event) => setChecklist(event.currentTarget.value)} placeholder="One item per line" /></label><label>Reminder time<input type="time" value={reminderTime} onInput={(event) => setReminderTime(event.currentTarget.value)} /></label></> : null}
      {itemKind === "project" && !conversion ? <ProjectContentsEditor contents={projectContents} document={document} change={setProjectContents} /> : null}
      {!conversion ? <label>Deadline offset in days<input type="number" value={deadlineOffset} onInput={(event) => setDeadlineOffset(event.currentTarget.value)} placeholder="No default" /></label> : null}
      <p className="replacement-muted">Changes here apply only to future Occurrences. Existing Occurrences keep their own content.</p>
      <button className="replacement-button" type="submit">{template ? "Save future defaults" : "Start repeating"}</button>
    </form>
  </WaDialog>;
}

function templateLocation(template: RepeatingTemplate, document: WorkspaceDocument): { space: string; parent: string } {
  const location = template.location;
  if (location.kind === "unfiled" || location.kind === "space") return { space: document.spaces.find((space) => space.id === location.spaceId)?.title ?? "Missing Space", parent: "None" };
  if (location.kind === "area") {
    const area = document.areas.find((item) => item.id === location.areaId);
    return { space: document.spaces.find((space) => space.id === area?.spaceId)?.title ?? "Missing Space", parent: area?.title ?? "Missing Area" };
  }
  const toDo = template as Extract<RepeatingTemplate, { itemKind: "toDo" }>;
  if (toDo.location.kind === "project") {
    const projectId = toDo.location.projectId;
    const project = document.projects.find((item) => item.id === projectId);
    const projectLocation = project?.location;
    const areaId = projectLocation?.kind === "area" ? projectLocation.areaId : null;
    const area = areaId ? document.areas.find((item) => item.id === areaId) : null;
    const spaceId = projectLocation?.kind === "space" ? projectLocation.spaceId : area?.spaceId;
    return { space: document.spaces.find((space) => space.id === spaceId)?.title ?? "Missing Space", parent: project?.title ?? "Missing Project" };
  }
  const headingId = toDo.location.kind === "heading" ? toDo.location.headingId : "";
  const heading = document.headings.find((item) => item.id === headingId);
  if (!heading) return { space: "Missing Space", parent: "Missing Heading" };
  if (heading.location.kind === "area") {
    const areaId = heading.location.areaId;
    const area = document.areas.find((item) => item.id === areaId);
    return { space: document.spaces.find((space) => space.id === area?.spaceId)?.title ?? "Missing Space", parent: heading.title };
  }
  const projectId = heading.location.projectId;
  const project = document.projects.find((item) => item.id === projectId);
  const projectLocation = project?.location;
  const areaId = projectLocation?.kind === "area" ? projectLocation.areaId : null;
  const area = areaId ? document.areas.find((item) => item.id === areaId) : null;
  const spaceId = projectLocation?.kind === "space" ? projectLocation.spaceId : area?.spaceId;
  return { space: document.spaces.find((space) => space.id === spaceId)?.title ?? "Missing Space", parent: heading.title };
}

function RepeatingView({ document, search, edit, create, runChange }: {
  document: WorkspaceDocument;
  search: string;
  edit: (template: RepeatingTemplate) => void;
  create: () => void;
  runChange: (change: WorkspaceChange) => Promise<boolean>;
}) {
  const query = search.trim().toLowerCase();
  const templates = document.repeatingTemplates.filter((template) => !query || `${template.title} ${repeatingRuleSummary(template.pattern, template.mode)}`.toLowerCase().includes(query));
  const row = (template: RepeatingTemplate) => {
    const location = templateLocation(template, document);
    return <article className="replacement-repeat-row" key={template.id}><button type="button" disabled={template.state === "stopped"} title={template.state === "stopped" ? "Stopped Templates are read-only" : "Edit future Occurrences"} onClick={() => edit(template)}><strong><span aria-hidden="true">↻</span> {template.title}</strong><span>{template.itemKind === "toDo" ? "To-do" : "Project"} · {repeatingRuleSummary(template.pattern, template.mode)}</span><small>Next {template.nextDate} · {location.space} · {location.parent}</small></button><div>{template.state !== "stopped" ? <button type="button" onClick={() => void runChange({ type: template.state === "active" ? "pauseRepeatingTemplate" : "resumeRepeatingTemplate", id: template.id })}>{template.state === "active" ? "Pause" : "Resume"}</button> : null}{template.state !== "stopped" ? <button className="danger" type="button" onClick={() => { if (window.confirm("Stop this schedule permanently? Existing Occurrences will not change.")) void runChange({ type: "stopRepeatingTemplate", id: template.id }); }}>Stop</button> : <button className="danger" type="button" onClick={() => { if (window.confirm("Permanently delete this stopped Template? Existing work will stay, without its repeat link.")) void runChange({ type: "deleteRepeatingTemplate", id: template.id, confirmation: DELETE_REPEATING_TEMPLATE_CONFIRMATION }); }}>Delete</button>}</div></article>;
  };
  const active = templates.filter((template) => template.state === "active");
  const paused = templates.filter((template) => template.state === "paused");
  const stopped = templates.filter((template) => template.state === "stopped");
  return <div className="replacement-repeating-view"><button className="replacement-button" type="button" onClick={create}>New Repeating Template</button>{active.length ? <section><h2>Active</h2>{active.map(row)}</section> : null}{paused.length ? <section><h2>Paused</h2>{paused.map(row)}</section> : null}{stopped.length ? <details><summary>Stopped ({stopped.length})</summary>{stopped.map(row)}</details> : null}{!templates.length ? <section className="replacement-empty"><div aria-hidden="true">↻</div><h2>No repeating schedules</h2><p>Create one directly, or open a to-do or Project and make it repeat.</p></section> : null}</div>;
}

function Inspector({ item, document, saving, modal, runChange, runIntent, openRepeatEditor, openTemplate, close }: {
  item: ToDo;
  document: WorkspaceDocument;
  saving: boolean;
  modal: boolean;
  runChange: (change: WorkspaceChange) => Promise<boolean>;
  runIntent?: (source: InteractionSource, action: ToDoAction, ids: string[]) => Promise<boolean>;
  openRepeatEditor: (item: ToDo) => void;
  openTemplate: (id: string) => void;
  close: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const tags = item.tags.map((id) => document.tags.find((tag) => tag.id === id)?.title).filter(Boolean).join(", ");
  const noteMatches = noteSearch ? item.notes.split("\n").filter((line) => line.toLowerCase().includes(noteSearch.toLowerCase())) : [];
  const scheduleKind = item.schedule.kind;
  const repeatingTemplate = item.occurrence ? document.repeatingTemplates.find((template) => template.id === item.occurrence!.templateId) ?? null : null;

  const update = (changes: Extract<WorkspaceChange, { type: "updateToDo" }>["changes"]) => runChange({ type: "updateToDo", id: item.id, changes });
  return <aside className="replacement-inspector" role={modal ? "dialog" : undefined} aria-modal={modal ? "true" : undefined} aria-label="To-do inspector" aria-busy={saving}>
    <div className="replacement-inspector-head"><span>To-do details</span><button className="replacement-icon-button" type="button" autoFocus={modal} onClick={close} aria-label="Close inspector">×</button></div>
    <label>Title<input defaultValue={item.title} onBlur={(event) => { if (event.currentTarget.value !== item.title) void update({ title: event.currentTarget.value }); }} /></label>
    <div className="replacement-tabs"><button type="button" className={!preview ? "active" : ""} onClick={() => setPreview(false)}>Markdown notes</button><button type="button" className={preview ? "active" : ""} onClick={() => setPreview(true)}>Preview</button></div>
    {preview ? <MarkdownPreview value={item.notes} /> : <textarea rows={7} defaultValue={item.notes} onBlur={(event) => { if (event.currentTarget.value !== item.notes) void update({ notes: event.currentTarget.value }); }} placeholder="Add notes with Markdown…" />}
    <label>Search notes<input data-note-search type="search" value={noteSearch} onInput={(event) => setNoteSearch(event.currentTarget.value)} placeholder="Find text in notes" /></label>
    {noteSearch ? <p className="replacement-search-result">{noteMatches.length ? `${noteMatches.length} matching line${noteMatches.length === 1 ? "" : "s"}` : "No matches"}</p> : null}

    <fieldset><legend>Checklist</legend>{item.checklist.map((checklistItem) => <div className="replacement-checklist" key={checklistItem.id}><input aria-label={`Complete ${checklistItem.title}`} type="checkbox" checked={checklistItem.completed} onChange={(event) => void runChange({ type: "updateChecklistItem", toDoId: item.id, itemId: checklistItem.id, changes: { completed: event.currentTarget.checked } })} /><input defaultValue={checklistItem.title} onBlur={(event) => { if (event.currentTarget.value !== checklistItem.title) void runChange({ type: "updateChecklistItem", toDoId: item.id, itemId: checklistItem.id, changes: { title: event.currentTarget.value } }); }} /><button type="button" aria-label={`Remove ${checklistItem.title}`} onClick={() => void runChange({ type: "removeChecklistItem", toDoId: item.id, itemId: checklistItem.id })}>×</button></div>)}<form onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("checklist-title") as HTMLInputElement; void runChange({ type: "addChecklistItem", toDoId: item.id, title: input.value }).then((saved) => { if (saved) input.value = ""; }); }}><input name="checklist-title" placeholder="New checklist item" /><button type="submit">Add</button></form></fieldset>

    <label>Schedule<select data-inspector-schedule value={scheduleKind} onChange={(event) => { const kind = event.currentTarget.value; void update({ schedule: kind === "scheduled" ? { kind, date: item.schedule.kind === "scheduled" ? item.schedule.date : new Date().toISOString().slice(0, 10), evening: false } : { kind } as Schedule }); }}><option value="inbox">Inbox</option><option value="anytime">Anytime</option><option value="someday">Someday</option><option value="scheduled">Date</option></select></label>
    {item.schedule.kind === "scheduled" ? <><label>Schedule date<input type="date" value={item.schedule.date} onChange={(event) => void update({ schedule: { ...item.schedule as Extract<Schedule, { kind: "scheduled" }>, date: event.currentTarget.value } })} /></label><label className="replacement-inline-check"><input type="checkbox" checked={item.schedule.evening} onChange={(event) => void update({ schedule: { ...item.schedule as Extract<Schedule, { kind: "scheduled" }>, evening: event.currentTarget.checked } })} />This Evening</label></> : null}
    <label>Reminder<input type="datetime-local" value={item.reminder?.at.slice(0, 16) ?? ""} onChange={(event) => void update({ reminder: event.currentTarget.value ? { at: `${event.currentTarget.value}:00.000Z`, sentAt: null } : null })} /></label>
    {item.reminder ? <button className="replacement-snooze" type="button" onClick={() => void runChange({ type: "snoozeReminder", id: item.id, until: new Date(Date.now() + 15 * 60 * 1000).toISOString() })}>Snooze Reminder 15 minutes</button> : null}
    <label>Deadline<input data-inspector-deadline type="date" value={item.deadline ?? ""} onChange={(event) => void update({ deadline: event.currentTarget.value || null })} /></label>
    <label>Tags<input defaultValue={tags} onBlur={(event) => void runChange({ type: "setToDoTags", id: item.id, titles: event.currentTarget.value.split(",") })} placeholder="work, urgent" /></label>

    {item.occurrence ? <section className="replacement-occurrence-card"><strong><span aria-hidden="true">↻</span> Repeating Occurrence</strong><p>{repeatingTemplate ? repeatingRuleSummary(repeatingTemplate.pattern, repeatingTemplate.mode) : "Its Repeating Template was deleted."}</p><dl><div><dt>Current date</dt><dd>{item.occurrence.scheduledDate}</dd></div>{repeatingTemplate ? <div><dt>Next date</dt><dd>{repeatingTemplate.nextDate}</dd></div> : null}</dl>{repeatingTemplate ? <button type="button" onClick={() => openTemplate(repeatingTemplate.id)}>Open Template</button> : null}</section> : null}

    <div className="replacement-actions">
      {item.trashedAt ? <><button type="button" onClick={() => void (runIntent ? runIntent("inspector", { type: "restore" }, [item.id]) : runChange({ type: "restoreToDo", id: item.id }))}>Restore</button><button className="danger" type="button" onClick={() => { if (window.confirm("Permanently delete this to-do? This cannot be undone.")) void runChange({ type: "permanentlyDeleteToDo", id: item.id, confirmation: PERMANENT_DELETE_CONFIRMATION }).then(close); }}>Delete forever</button></> : <>
        {item.outcome === "open" ? <><button className="replacement-button" type="button" onClick={() => void (runIntent ? runIntent("inspector", { type: "complete" }, [item.id]) : runChange({ type: "completeToDo", id: item.id }))}>Complete</button><button type="button" onClick={() => void (runIntent ? runIntent("inspector", { type: "cancel" }, [item.id]) : runChange({ type: "cancelToDo", id: item.id }))}>Cancel</button>{item.occurrence ? <button type="button" onClick={() => void runChange({ type: "skipOccurrence", itemKind: "toDo", id: item.id })}>Skip</button> : null}</> : <><button type="button" onClick={() => void (runIntent ? runIntent("inspector", { type: "reopen" }, [item.id]) : runChange({ type: "reopenToDo", id: item.id }))}>Reopen</button>{!item.logbookAt ? <button type="button" onClick={() => void runChange({ type: "logToDo", id: item.id })}>Move to Logbook</button> : null}</>}
        {!item.occurrence && item.outcome === "open" ? <button type="button" onClick={() => openRepeatEditor(item)}>Make repeating…</button> : null}
        <button type="button" onClick={() => void (runIntent ? runIntent("inspector", { type: "duplicate" }, [item.id]) : runChange({ type: "duplicateToDo", id: item.id }))}>Duplicate</button>
        <button type="button" onClick={() => void navigator.clipboard.writeText(directTargetUrl({ kind: "toDo", id: item.id }, `${location.origin}${location.pathname}`))}>Copy link</button>
        {navigator.share ? <button type="button" onClick={() => void navigator.share({ title: item.title, text: item.notes, url: directTargetUrl({ kind: "toDo", id: item.id }, `${location.origin}${location.pathname}`) })}>Share</button> : null}
        <button className="danger" type="button" onClick={() => void (runIntent ? runIntent("inspector", { type: "trash" }, [item.id]) : runChange({ type: "trashToDo", id: item.id }))}>Move to Trash</button>
      </>}
    </div>
  </aside>;
}

function tagIdsFromNames(value: string, document: WorkspaceDocument): EntityId[] | null {
  const names = value.split(",").map((name) => name.trim()).filter(Boolean);
  const tags = names.map((name) => document.tags.find((tag) => tag.title.toLowerCase() === name.toLowerCase()));
  if (tags.some((tag) => !tag)) {
    window.alert("Create new Tags first, then choose them by name.");
    return null;
  }
  return [...new Set(tags.map((tag) => tag!.id))];
}

type LocationChoice<T> = { label: string; location: T };

function chooseLocation<T>(label: string, choices: Array<LocationChoice<T>>, currentLabel: string | undefined): T | null {
  const answer = window.prompt(`${label}\n${choices.map((choice) => choice.label).join("\n")}`, currentLabel);
  const choice = choices.find((item) => item.label.toLowerCase() === answer?.trim().toLowerCase());
  return choice?.location ?? null;
}

function EntityTools({ view, document, workspace, runChange, selectView, openProjectRepeatEditor, openTemplate }: {
  view: WorkspaceView;
  document: WorkspaceDocument;
  workspace: ReturnType<typeof workspaceFor>;
  runChange: (change: WorkspaceChange) => Promise<boolean>;
  selectView: (view: WorkspaceView) => void;
  openProjectRepeatEditor: (project: Project) => void;
  openTemplate: (id: string) => void;
}) {
  const askTitle = (label: string, current = "") => window.prompt(`${label} title`, current)?.trim() ?? "";
  const createSpace = () => {
    const title = askTitle("New Space");
    if (!title) return;
    const color = window.prompt("Space color", "#5577dd")?.trim() || "#5577dd";
    void runChange({ type: "createSpace", title, color });
  };
  const createArea = () => {
    const title = askTitle("New Area");
    if (!title) return;
    const spaceId = view.kind === "space" ? view.id : workspace.spaceIdForView(view) ?? document.settings.defaultSpaceId;
    if (!spaceId) { window.alert("Create or select a Space first."); return; }
    void runChange({ type: "createArea", title, spaceId });
  };
  const createProject = () => {
    const title = askTitle("New Project");
    if (!title) return;
    const location: ProjectLocation | null = view.kind === "area"
      ? { kind: "area", areaId: view.id }
      : view.kind === "space"
        ? { kind: "space", spaceId: view.id }
        : document.settings.defaultSpaceId
          ? { kind: "space", spaceId: document.settings.defaultSpaceId }
          : null;
    if (!location) { window.alert("Create or select a Space first."); return; }
    void runChange({ type: "createProject", title, location });
  };
  const createHeading = () => {
    if (view.kind !== "area" && view.kind !== "project") { window.alert("Open an Area or Project first."); return; }
    const title = askTitle("New Heading");
    if (!title) return;
    const location = view.kind === "area" ? { kind: "area" as const, areaId: view.id } : { kind: "project" as const, projectId: view.id };
    void runChange({ type: "createHeading", title, location });
  };
  const createTag = () => {
    const title = askTitle("New Tag");
    if (title) void runChange({ type: "createTag", title });
  };

  const space = view.kind === "space" ? document.spaces.find((item) => item.id === view.id) : null;
  const area = view.kind === "area" ? document.areas.find((item) => item.id === view.id) : null;
  const project = view.kind === "project" ? document.projects.find((item) => item.id === view.id) : null;
  const projectRepeatingTemplate = project?.occurrence ? document.repeatingTemplates.find((item) => item.id === project.occurrence!.templateId) ?? null : null;
  const heading = view.kind === "heading" ? document.headings.find((item) => item.id === view.id) : null;

  const editSpace = () => {
    if (!space) return;
    const title = askTitle("Space", space.title);
    if (!title) return;
    const color = window.prompt("Space color", space.color)?.trim() || space.color;
    void runChange({ type: "updateSpace", id: space.id, changes: { title, color } });
  };
  const deleteSpace = () => {
    if (!space) return;
    const remaining = document.spaces.filter((item) => item.id !== space.id);
    if (!remaining.length) { window.alert("Create another Space before deleting this one."); return; }
    const answer = window.prompt(`Move everything to which Space?\n${remaining.map((item) => item.title).join("\n")}`, remaining[0].title);
    const destination = remaining.find((item) => item.title.toLowerCase() === answer?.trim().toLowerCase());
    if (!destination) { if (answer !== null) window.alert("Choose one of the listed Spaces."); return; }
    if (window.confirm(`Delete ${space.title} and move all of its content to ${destination.title}?`)) {
      void runChange({ type: "deleteSpace", id: space.id, moveToSpaceId: destination.id, confirmation: DELETE_SPACE_CONFIRMATION })
        .then((saved) => { if (saved) selectView({ kind: "space", id: destination.id, date: view.date }); });
    }
  };
  const editArea = () => {
    if (!area) return;
    const title = askTitle("Area", area.title);
    if (!title) return;
    const color = window.prompt("Area color", area.color)?.trim() || area.color;
    const spaceName = window.prompt(`Move to which Space?\n${document.spaces.map((item) => item.title).join("\n")}`, document.spaces.find((item) => item.id === area.spaceId)?.title);
    const destination = document.spaces.find((item) => item.title.toLowerCase() === spaceName?.trim().toLowerCase());
    if (!destination) return;
    const tags = tagIdsFromNames(window.prompt("Inherited Tags, separated by commas", area.tags.map((id) => document.tags.find((tag) => tag.id === id)?.title).filter(Boolean).join(", ")) ?? "", document);
    if (!tags) return;
    void runChange({ type: "updateArea", id: area.id, changes: { title, color, spaceId: destination.id, tags } });
  };
  const removeArea = () => {
    if (area && window.confirm(`Remove ${area.title}? Its Projects and to-dos will stay in ${document.spaces.find((item) => item.id === area.spaceId)?.title}.`)) {
      void runChange({ type: "removeArea", id: area.id, confirmation: REMOVE_AREA_CONFIRMATION })
        .then((saved) => { if (saved) selectView({ kind: "space", id: area.spaceId, date: view.date }); });
    }
  };
  const editProject = () => {
    if (!project) return;
    const title = askTitle("Project", project.title);
    if (!title) return;
    const notes = window.prompt("Project notes", project.notes) ?? project.notes;
    const deadline = window.prompt("Deadline (YYYY-MM-DD or blank)", project.deadline ?? "") ?? project.deadline;
    const scheduleName = window.prompt("Schedule: inbox, anytime, someday, or scheduled", project.schedule.kind)?.trim().toLowerCase();
    if (!scheduleName || !["inbox", "anytime", "someday", "scheduled"].includes(scheduleName)) return;
    const schedule: Schedule = scheduleName === "scheduled"
      ? { kind: "scheduled", date: window.prompt("Scheduled date (YYYY-MM-DD)", project.schedule.kind === "scheduled" ? project.schedule.date : view.date)?.trim() || view.date, evening: false }
      : { kind: scheduleName as "inbox" | "anytime" | "someday" };
    const targets = [
      ...document.spaces.map((item) => ({ label: `Space: ${item.title}`, location: { kind: "space" as const, spaceId: item.id } })),
      ...document.areas.map((item) => ({ label: `Area: ${item.title}`, location: { kind: "area" as const, areaId: item.id } })),
    ];
    const projectLocation = project.location;
    const currentLabel = projectLocation.kind === "space"
      ? targets.find((target) => target.location.kind === "space" && target.location.spaceId === projectLocation.spaceId)?.label
      : targets.find((target) => target.location.kind === "area" && target.location.areaId === projectLocation.areaId)?.label;
    const location = chooseLocation<ProjectLocation>("Project Location", targets, currentLabel);
    if (!location) return;
    const tags = tagIdsFromNames(window.prompt("Inherited Tags, separated by commas", project.tags.map((id) => document.tags.find((tag) => tag.id === id)?.title).filter(Boolean).join(", ")) ?? "", document);
    if (!tags) return;
    void runChange({ type: "updateProject", id: project.id, changes: { title, notes, deadline: deadline || null, schedule, location, tags } });
  };
  const closeProject = (outcome: "completed" | "canceled") => {
    if (!project) return;
    const openToDos = document.toDos.filter((toDo) => workspace.locationOfToDo(toDo.id)?.projectId === project.id && toDo.outcome === "open" && !toDo.trashedAt);
    const toDoOutcomes: Array<{ id: EntityId; outcome: "completed" | "canceled" }> = [];
    for (const toDo of openToDos) {
      const answer = window.prompt(`Outcome for “${toDo.title}”: type completed or canceled`, outcome);
      if (answer === null) return;
      const choice = answer.trim().toLowerCase();
      if (choice !== "completed" && choice !== "canceled") { window.alert("Each remaining open to-do needs completed or canceled."); return; }
      toDoOutcomes.push({ id: toDo.id, outcome: choice });
    }
    void runChange({ type: "closeProject", id: project.id, outcome, toDoOutcomes });
  };
  const editHeading = () => {
    if (!heading) return;
    const title = askTitle("Heading", heading.title);
    if (!title) return;
    const targets = [
      ...document.areas.map((item) => ({ label: `Area: ${item.title}`, location: { kind: "area" as const, areaId: item.id } })),
      ...document.projects.map((item) => ({ label: `Project: ${item.title}`, location: { kind: "project" as const, projectId: item.id } })),
    ];
    const headingLocation = heading.location;
    const currentLabel = headingLocation.kind === "area"
      ? targets.find((target) => target.location.kind === "area" && target.location.areaId === headingLocation.areaId)?.label
      : targets.find((target) => target.location.kind === "project" && target.location.projectId === headingLocation.projectId)?.label;
    const location = chooseLocation<HeadingLocation>("Heading Location", targets, currentLabel);
    if (location) void runChange({ type: "updateHeading", id: heading.id, changes: { title, location } });
  };

  return <section className="replacement-entity-tools" aria-label="Organization actions">
    <div className="replacement-tool-row"><button data-new-list type="button" onClick={createSpace}>New Space</button><button type="button" onClick={createArea}>New Area</button><button type="button" onClick={createProject}>New Project</button><button data-new-heading type="button" onClick={createHeading}>New Heading</button><button type="button" onClick={createTag}>New Tag</button></div>
    {space ? <div className="replacement-tool-row"><strong>{space.title}</strong><button type="button" onClick={editSpace}>Edit</button><button type="button" onClick={() => void runChange({ type: "updateSpace", id: space.id, changes: { pinned: !space.pinned } })}>{space.pinned ? "Unpin" : "Pin"}</button><button type="button" disabled={space.order === 0} onClick={() => void runChange({ type: "reorderSpace", id: space.id, toIndex: space.order - 1 })}>Move up</button><button type="button" disabled={space.order === document.spaces.length - 1} onClick={() => void runChange({ type: "reorderSpace", id: space.id, toIndex: space.order + 1 })}>Move down</button><button className="danger" type="button" onClick={deleteSpace}>Delete</button></div> : null}
    {area ? <div className="replacement-tool-row"><strong>{area.title}</strong><button type="button" onClick={editArea}>Edit or move</button><button className="danger" type="button" onClick={removeArea}>Remove</button></div> : null}
    {project ? <div className="replacement-tool-row"><strong>{workspace.projectProgress(project.id)?.percent ?? 0}% complete{project.occurrence ? " · ↻ Occurrence" : ""}</strong><button type="button" onClick={editProject}>Edit or move</button><button type="button" onClick={() => void runChange({ type: "duplicateProject", id: project.id })}>Duplicate</button>{project.occurrence ? <><button type="button" onClick={() => openTemplate(project.occurrence!.templateId)}>Open Template</button>{project.outcome === "open" ? <button type="button" onClick={() => void runChange({ type: "skipOccurrence", itemKind: "project", id: project.id })}>Skip</button> : null}</> : project.outcome === "open" ? <button type="button" onClick={() => openProjectRepeatEditor(project)}>Make repeating…</button> : null}{project.outcome === "open" ? <><button type="button" onClick={() => closeProject("completed")}>Complete</button><button type="button" onClick={() => closeProject("canceled")}>Cancel</button></> : <button type="button" onClick={() => void runChange({ type: "restoreProject", id: project.id })}>Restore Outcome</button>}{project.trashedAt ? <><button type="button" onClick={() => void runChange({ type: "restoreProjectFromTrash", id: project.id })}>Restore from Trash</button><button className="danger" type="button" onClick={() => { if (window.confirm("Permanently delete this Project and all of its contents?")) void runChange({ type: "permanentlyDeleteProject", id: project.id, confirmation: PERMANENT_DELETE_CONFIRMATION }); }}>Delete forever</button></> : <button className="danger" type="button" onClick={() => void runChange({ type: "trashProject", id: project.id })}>Move to Trash</button>}</div> : null}
    {project?.occurrence ? <section className="replacement-project-occurrence"><strong>↻ Repeating Project Occurrence</strong><span>{projectRepeatingTemplate ? repeatingRuleSummary(projectRepeatingTemplate.pattern, projectRepeatingTemplate.mode) : "Its Repeating Template was deleted."}</span><span>Current date {project.occurrence.scheduledDate}{projectRepeatingTemplate ? ` · Next date ${projectRepeatingTemplate.nextDate}` : ""}</span>{projectRepeatingTemplate ? <button type="button" onClick={() => openTemplate(projectRepeatingTemplate.id)}>Open Template</button> : null}</section> : null}
    {heading ? <div className="replacement-tool-row"><strong>{heading.title}</strong><button type="button" onClick={editHeading}>Edit or move</button><button type="button" onClick={() => void runChange({ type: "duplicateHeading", id: heading.id })}>Duplicate</button><button type="button" onClick={() => void runChange(heading.archivedAt ? { type: "restoreHeading", id: heading.id } : { type: "archiveHeading", id: heading.id })}>{heading.archivedAt ? "Restore" : "Archive"}</button><button type="button" onClick={() => void runChange({ type: "convertHeadingToProject", id: heading.id })}>Convert to Project</button><button className="danger" type="button" onClick={() => { if (window.confirm("Delete this Heading and keep its to-dos in the parent?")) void runChange({ type: "deleteHeading", id: heading.id, confirmation: DELETE_HEADING_CONFIRMATION }); }}>Delete</button></div> : null}
    {document.tags.length ? <details><summary>Manage Tags</summary><div className="replacement-tool-list">{document.tags.map((tag) => <div key={tag.id}><span>{tag.title}</span><button type="button" onClick={() => { const title = askTitle("Tag", tag.title); if (title) void runChange({ type: "updateTag", id: tag.id, title }); }}>Rename</button><button className="danger" type="button" onClick={() => { if (window.confirm(`Delete ${tag.title} from every item?`)) void runChange({ type: "deleteTag", id: tag.id, confirmation: DELETE_TAG_CONFIRMATION }); }}>Delete</button></div>)}</div></details> : null}
  </section>;
}

function WorkspaceItemRow({
  item,
  selected,
  bulkSelected,
  idsForAction,
  runIntent,
  selectRow,
  selectProject,
  toggleSelection,
  openContextMenu,
  beginTouch,
  endTouch,
  cancelTouch,
}: {
  item: ToDo | Project;
  selected: boolean;
  bulkSelected: boolean;
  idsForAction: (id: string) => string[];
  runIntent: (source: InteractionSource, action: ToDoAction, ids: string[]) => Promise<boolean>;
  selectRow: (event: MouseEvent, id: string) => void;
  selectProject: (id: string) => void;
  toggleSelection: (id: string, trigger: HTMLElement) => void;
  openContextMenu: (id: string, x: number, y: number, trigger: HTMLElement) => void;
  beginTouch: (event: PointerEvent, id: string) => void;
  endTouch: (event: PointerEvent) => void;
  cancelTouch: () => void;
}) {
  const isToDo = "checklist" in item;
  const toDo = item as ToDo;
  return <article
    className={`replacement-row${selected ? " selected" : ""}${bulkSelected ? " bulk-selected" : ""}`}
    data-todo-id={isToDo ? item.id : undefined}
    draggable={isToDo}
    onDragStart={(event) => {
      if (!isToDo || !event.dataTransfer) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-objects-todos", idsForAction(item.id).join(","));
    }}
    onContextMenu={(event) => {
      if (!isToDo) return;
      event.preventDefault();
      openContextMenu(item.id, event.clientX, event.clientY, event.currentTarget);
    }}
    onPointerDown={(event) => { if (isToDo) beginTouch(event, item.id); }}
    onPointerUp={endTouch}
    onPointerCancel={cancelTouch}
  >
    {isToDo && item.outcome === "open" && !item.trashedAt
      ? <button className="replacement-complete" type="button" aria-label={`Complete ${item.title}`} onClick={() => void runIntent("row", { type: "complete" }, [item.id])} />
      : <span className={`replacement-outcome ${item.outcome}`} aria-label={item.outcome} />}
    <button className="replacement-row-body" type="button" onClick={(event) => isToDo ? selectRow(event, item.id) : selectProject(item.id)}>
      <strong>{item.title}{item.occurrence ? <span className="replacement-repeat-marker" title="Repeating Occurrence" aria-label="Repeating Occurrence"> ↻</span> : null}</strong>
      <span>{isToDo ? toDo.schedule.kind === "scheduled" ? `${toDo.schedule.date}${toDo.schedule.evening ? " · This Evening" : ""}` : toDo.schedule.kind : "Project"}{item.deadline ? ` · Deadline ${item.deadline}` : ""}</span>
    </button>
    {isToDo ? <button
      className="replacement-select"
      type="button"
      aria-label={`${bulkSelected ? "Remove" : "Add"} ${item.title} ${bulkSelected ? "from" : "to"} selection`}
      aria-pressed={bulkSelected}
      onClick={(event) => toggleSelection(item.id, event.currentTarget)}
    >{bulkSelected ? "✓" : "○"}</button> : null}
    {isToDo && item.trashedAt
      ? <button type="button" onClick={() => void runIntent("row", { type: "restore" }, [item.id])}>Restore</button>
      : isToDo ? <button className="replacement-more" type="button" aria-label={`More actions for ${item.title}`} onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        openContextMenu(item.id, bounds.left, bounds.bottom, event.currentTarget);
      }}>•••</button> : null}
  </article>;
}

function SelectionToolbar({ ids, today, inTrash, runIntent, openDialog, clear }: {
  ids: string[];
  today: string;
  inTrash: boolean;
  runIntent: (source: InteractionSource, action: ToDoAction, ids: string[]) => Promise<boolean>;
  openDialog: (dialog: "move" | "schedule" | "tags") => void;
  clear: () => void;
}) {
  return <div className="replacement-selection-toolbar" role="toolbar" aria-label={`Actions for ${ids.length} selected to-dos`}>
    <strong>{ids.length} selected</strong>
    {inTrash ? <button type="button" onClick={() => void runIntent("bulk", { type: "restore" }, ids)}>Restore</button> : <>
      <button type="button" onClick={() => void runIntent("bulk", { type: "schedule", schedule: { kind: "scheduled", date: today, evening: false } }, ids)}>Today</button>
      <button type="button" onClick={() => openDialog("schedule")}>Schedule</button>
      <button type="button" onClick={() => openDialog("move")}>Move</button>
      <button type="button" onClick={() => openDialog("tags")}>Tags</button>
      <button type="button" onClick={() => void runIntent("bulk", { type: "complete" }, ids)}>Complete</button>
      <button type="button" onClick={() => void runIntent("bulk", { type: "cancel" }, ids)}>Cancel</button>
      <button className="danger" type="button" onClick={() => void runIntent("bulk", { type: "trash" }, ids)}>Trash</button>
    </>}
    <button type="button" aria-label="Clear selection" onClick={clear}>×</button>
  </div>;
}

type ActionDialogKind = "move" | "schedule" | "tags";
type ContextMenuState = { id: string; x: number; y: number };

function ToDoContextMenu({ menu, items, today, run, openDialog }: {
  menu: ContextMenuState;
  items: ToDo[];
  today: string;
  run: (action: ToDoAction) => void;
  openDialog: (dialog: ActionDialogKind) => void;
}) {
  const allTrashed = items.length > 0 && items.every((item) => Boolean(item.trashedAt));
  const allOpen = items.length > 0 && items.every((item) => item.outcome === "open" && !item.trashedAt);
  const allClosed = items.length > 0 && items.every((item) => item.outcome !== "open" && !item.trashedAt);

  return <div
    className="replacement-context-menu"
    role="menu"
    aria-label="To-do actions"
    style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 360) }}
  >
    {allTrashed ? <button role="menuitem" type="button" autoFocus onClick={() => run({ type: "restore" })}>Restore</button> : null}
    {allOpen ? <button role="menuitem" type="button" autoFocus onClick={() => run({ type: "complete" })}>Complete</button> : null}
    {allOpen ? <button role="menuitem" type="button" onClick={() => run({ type: "cancel" })}>Cancel</button> : null}
    {allClosed ? <button role="menuitem" type="button" autoFocus onClick={() => run({ type: "reopen" })}>Reopen</button> : null}
    {!allTrashed ? <>
      <button role="menuitem" type="button" autoFocus={!allOpen && !allClosed} onClick={() => run({ type: "schedule", schedule: { kind: "scheduled", date: today, evening: false } })}>Schedule for Today</button>
      <button role="menuitem" type="button" onClick={() => openDialog("schedule")}>Choose Schedule…</button>
      <button role="menuitem" type="button" onClick={() => openDialog("move")}>Move…</button>
      <button role="menuitem" type="button" onClick={() => openDialog("tags")}>Tags…</button>
      <button role="menuitem" type="button" onClick={() => run({ type: "duplicate" })}>Duplicate</button>
      <button className="danger" role="menuitem" type="button" onClick={() => run({ type: "trash" })}>Move to Trash</button>
    </> : null}
  </div>;
}

function ToDoActionDialog({ kind, count, ids, today, moveChoices, runIntent, close }: {
  kind: ActionDialogKind;
  count: number;
  ids: string[];
  today: string;
  moveChoices: Array<{ label: string; action: ToDoAction }>;
  runIntent: (source: InteractionSource, action: ToDoAction, ids: string[]) => Promise<boolean>;
  close: () => void;
}) {
  const dialog = useRef<OverlayElement>(null);
  useWebAwesomeOverlay(dialog, close);
  const run = (action: ToDoAction) => void runIntent("bulk", action, ids).then((saved) => { if (saved) close(); });

  return <WaDialog ref={dialog} class="replacement-wa-dialog" label={kind === "move" ? "Move to" : kind === "schedule" ? "Schedule" : "Set Tags"} without-header light-dismiss>
    <section className="replacement-dialog" aria-labelledby="replacement-action-title">
      <header>
        <div><p className="replacement-kicker">{count} to-do{count === 1 ? "" : "s"}</p><h2 id="replacement-action-title">{kind === "move" ? "Move to" : kind === "schedule" ? "Schedule" : "Set Tags"}</h2></div>
        <button type="button" aria-label="Close dialog" onClick={close}>×</button>
      </header>
      {kind === "move" ? <div className="replacement-choice-list">
        {moveChoices.map((choice, index) => <button key={`${choice.label}-${index}`} type="button" autoFocus={index === 0} onClick={() => run(choice.action)}>{choice.label}</button>)}
      </div> : kind === "schedule" ? <div className="replacement-choice-list">
        <button type="button" autoFocus onClick={() => run({ type: "schedule", schedule: { kind: "inbox" } })}>Inbox</button>
        <button type="button" onClick={() => run({ type: "schedule", schedule: { kind: "scheduled", date: today, evening: false } })}>Today</button>
        <button type="button" onClick={() => run({ type: "schedule", schedule: { kind: "scheduled", date: today, evening: true } })}>This Evening</button>
        <button type="button" onClick={() => run({ type: "schedule", schedule: { kind: "anytime" } })}>Anytime</button>
        <button type="button" onClick={() => run({ type: "schedule", schedule: { kind: "someday" } })}>Someday</button>
        <form onSubmit={(event) => { event.preventDefault(); const date = new FormData(event.currentTarget).get("date")?.toString(); if (date) run({ type: "schedule", schedule: { kind: "scheduled", date, evening: false } }); }}>
          <label>Choose a date<input name="date" type="date" required /></label><button className="replacement-button" type="submit">Schedule</button>
        </form>
      </div> : <form className="replacement-tag-form" onSubmit={(event) => { event.preventDefault(); const titles = new FormData(event.currentTarget).get("tags")?.toString().split(",") ?? []; run({ type: "tag", titles }); }}>
        <label>Tag names, separated by commas<input name="tags" autoFocus placeholder="Home, Important" /></label><button className="replacement-button" type="submit">Apply Tags</button>
      </form>}
    </section>
  </WaDialog>;
}

function QuickFindDialog({ document, today, query, setQuery, choose, close }: {
  document: WorkspaceDocument;
  today: string;
  query: string;
  setQuery: (value: string) => void;
  choose: (result: SearchResult) => void;
  close: () => void;
}) {
  const dialog = useRef<OverlayElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const results = useMemo(() => searchWorkspace(document, query, today), [document, query, today]);
  const activeIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));
  useWebAwesomeOverlay(dialog, close, () => input.current?.focus());
  const grouped = new Map<string, Array<{ result: SearchResult; index: number }>>();
  results.forEach((result, index) => {
    const group = grouped.get(result.group) ?? [];
    group.push({ result, index });
    grouped.set(result.group, group);
  });
  return <WaDialog ref={dialog} class="replacement-wa-dialog replacement-quick-find-dialog" label="Quick Find" without-header light-dismiss>
    <section className="replacement-dialog replacement-quick-find" aria-labelledby="replacement-quick-find-title">
      <header><div><p className="replacement-kicker">Jump anywhere</p><h2 id="replacement-quick-find-title">Quick Find</h2></div><button type="button" aria-label="Close Quick Find" onClick={close}>×</button></header>
      <label className="replacement-quick-find-input">Search your whole Workspace
        <input
          ref={input}
          type="search"
          value={query}
          aria-controls="replacement-quick-find-results"
          aria-activedescendant={results.length ? `replacement-quick-find-${activeIndex}` : undefined}
          placeholder="Lists, to-dos, notes, Tags, Templates…"
          onInput={(event) => { setQuery(event.currentTarget.value); setSelectedIndex(0); }}
          onKeyDown={(event) => {
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              setSelectedIndex(moveQuickFindSelection(activeIndex, results.length, event.key as "ArrowDown" | "ArrowUp" | "Home" | "End"));
            }
            if (event.key === "Enter" && results[activeIndex]) { event.preventDefault(); choose(results[activeIndex]); }
          }}
        />
      </label>
      <div id="replacement-quick-find-results" className="replacement-quick-find-results" role="listbox" aria-label="Quick Find results">
        {[...grouped].map(([groupName, group]) => <section key={groupName} role="group" aria-labelledby={`quick-find-group-${group[0].index}`}>
          <h3 id={`quick-find-group-${group[0].index}`}>{groupName}</h3>
          {group.map(({ result, index }) => <button
            id={`replacement-quick-find-${index}`}
            key={result.id}
            className={index === activeIndex ? "active" : ""}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => choose(result)}
          ><span><strong>{result.title}</strong><small>{result.detail}</small></span><span aria-hidden="true">›</span></button>)}
        </section>)}
        {!results.length ? <div className="replacement-quick-find-empty"><strong>No results</strong><span>Try a title, note, checklist item, Tag, or list name.</span></div> : null}
      </div>
    </section>
  </WaDialog>;
}

type CalendarDraft = { title: string; spaceId: string; allDay: boolean; start: string; end: string };

function toggleCalendarDraftAllDay(draft: CalendarDraft, allDay: boolean): CalendarDraft {
  const startDate = draft.start.slice(0, 10);
  const endDate = draft.end.slice(0, 10);
  return {
    ...draft,
    allDay,
    start: allDay ? startDate : `${startDate}T09:00`,
    end: allDay ? endDate <= startDate ? datePlus(startDate, 1) : endDate : `${endDate}T10:00`,
  };
}

function CalendarEventFields({ draft, spaces, setDraft, titlePlaceholder }: {
  draft: CalendarDraft;
  spaces: WorkspaceDocument["spaces"];
  setDraft: (draft: CalendarDraft) => void;
  titlePlaceholder?: string;
}) {
  const update = (changes: Partial<CalendarDraft>) => setDraft({ ...draft, ...changes });
  return <>
    <label>Title<input value={draft.title} onInput={(input) => update({ title: input.currentTarget.value })} placeholder={titlePlaceholder} required /></label>
    <label>Space<select value={draft.spaceId} onChange={(input) => update({ spaceId: input.currentTarget.value })}>{spaces.map((space) => <option key={space.id} value={space.id}>{space.title}</option>)}</select></label>
    <label>Starts<input type={draft.allDay ? "date" : "datetime-local"} value={draft.start} onInput={(input) => update({ start: input.currentTarget.value })} required /></label>
    <label>Ends<input type={draft.allDay ? "date" : "datetime-local"} value={draft.end} onInput={(input) => update({ end: input.currentTarget.value })} required /></label>
    <label className="replacement-inline-check"><input type="checkbox" checked={draft.allDay} onChange={(input) => setDraft(toggleCalendarDraftAllDay(draft, input.currentTarget.checked))} />All day</label>
  </>;
}

function CalendarEventEditor({ event, spaces, runChange }: {
  event: CalendarEvent;
  spaces: WorkspaceDocument["spaces"];
  runChange: (change: WorkspaceChange) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<CalendarDraft>({
    title: event.title,
    spaceId: event.spaceId,
    allDay: event.allDay,
    start: event.allDay ? event.start.slice(0, 10) : dateTimeInputValue(event.start),
    end: event.allDay ? event.end.slice(0, 10) : dateTimeInputValue(event.end),
  });
  return <article className="replacement-calendar-editor">
    <CalendarEventFields draft={draft} spaces={spaces} setDraft={setDraft} />
    <div className="replacement-calendar-actions"><button type="button" onClick={() => void runChange({ type: "updateCalendarEvent", id: event.id, changes: { title: draft.title, spaceId: draft.spaceId, allDay: draft.allDay, start: dateTimeInputIso(draft.start, draft.allDay), end: dateTimeInputIso(draft.end, draft.allDay) } })}>Save</button><button className="danger" type="button" onClick={() => { if (window.confirm(`Delete ${event.title}?`)) void runChange({ type: "deleteCalendarEvent", id: event.id }); }}>Delete</button></div>
  </article>;
}

function WorkspaceSettingsDialog({ document, today, runChange, close }: {
  document: WorkspaceDocument;
  today: string;
  runChange: (change: WorkspaceChange) => Promise<boolean>;
  close: () => void;
}) {
  const dialog = useRef<OverlayElement>(null);
  const [draft, setDraft] = useState<CalendarDraft>({
    title: "",
    spaceId: document.settings.defaultSpaceId ?? document.spaces[0]?.id ?? "",
    allDay: false,
    start: `${today}T09:00`,
    end: `${today}T10:00`,
  });
  useWebAwesomeOverlay(dialog, close);
  return <WaDialog ref={dialog} class="replacement-wa-dialog" label="Settings" without-header light-dismiss>
    <section className="replacement-dialog" aria-labelledby="replacement-settings-title">
      <header><div><p className="replacement-kicker">Objects</p><h2 id="replacement-settings-title">Settings</h2></div><button type="button" aria-label="Close settings" onClick={close}>×</button></header>
      <label className="replacement-setting-row">Appearance
        <select autoFocus value={document.settings.theme} onChange={(event) => void runChange({ type: "setTheme", theme: event.currentTarget.value as WorkspaceDocument["settings"]["theme"] })}>
          <option value="system">Follow this device</option><option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </label>
      <label className="replacement-setting-row">Log completed items
        <select value={document.settings.logCompletedItems} onChange={(event) => void runChange({ type: "setLogbookPolicy", policy: event.currentTarget.value as WorkspaceDocument["settings"]["logCompletedItems"] })}>
          <option value="immediately">Immediately</option><option value="daily">Daily</option><option value="manually">Manually</option>
        </select>
      </label>
      <label className="replacement-setting-check"><input type="checkbox" checked={document.settings.showCalendar} onChange={(event) => void runChange({ type: "setShowCalendar", show: event.currentTarget.checked })} />Show calendar events in agenda views</label>
      <section className="replacement-calendar-settings" aria-labelledby="replacement-calendar-title">
        <h3 id="replacement-calendar-title">Calendar</h3><p>Events appear beside scheduled work, but they cannot be completed like to-dos.</p>
        <form className="replacement-calendar-form" onSubmit={(event) => {
          event.preventDefault();
          void runChange({ type: "createCalendarEvent", title: draft.title, spaceId: draft.spaceId, start: dateTimeInputIso(draft.start, draft.allDay), end: dateTimeInputIso(draft.end, draft.allDay), calendar: "Objects", allDay: draft.allDay }).then((saved) => { if (saved) setDraft({ ...draft, title: "" }); });
        }}>
          <CalendarEventFields draft={draft} spaces={document.spaces} setDraft={setDraft} titlePlaceholder="New event" />
          <button className="replacement-button" type="submit">Add event</button>
        </form>
        <label className="replacement-ics-import">Import an ICS file<input type="file" accept=".ics,text/calendar" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void file.text().then((source) => runChange({ type: "importIcsCalendar", source, spaceId: draft.spaceId }));
          event.currentTarget.value = "";
        }} /></label>
        {document.calendarEvents.length ? <div className="replacement-calendar-editors"><h3>Saved events</h3>{document.calendarEvents.map((event) => <CalendarEventEditor key={event.id} event={event} spaces={document.spaces} runChange={runChange} />)}</div> : null}
      </section>
    </section>
  </WaDialog>;
}

type WorkspaceKeyboardOptions = {
  workspace: ReturnType<typeof workspaceFor>;
  document: WorkspaceDocument;
  view: WorkspaceView;
  search: string;
  selection: SelectionState;
  selectedId: string | null;
  contextMenu: ContextMenuState | null;
  actionDialog: ActionDialogKind | null;
  settingsOpen: boolean;
  quickFindOpen: boolean;
  backupOpen: boolean;
  sidebarOpen: boolean;
  mobile: boolean;
  today: string;
  activeSpaceId: string | null;
  shell: HTMLDivElement | null;
  quickInput: HTMLInputElement | null;
  returnFocus: { current: HTMLElement | null };
  setSelection: (value: SelectionState | ((current: SelectionState) => SelectionState)) => void;
  setSelectedId: (value: string | null) => void;
  setSelectedView: (value: WorkspaceView) => void;
  setContextMenu: (value: ContextMenuState | null) => void;
  setSettingsOpen: (value: boolean) => void;
  setQuickFindOpen: (value: boolean) => void;
  setBackupOpen: (value: boolean) => void;
  setSidebarOpen: (value: boolean) => void;
  restoreFocus: () => void;
  closeActionDialog: () => void;
  openActionDialog: (dialog: ActionDialogKind) => void;
  runChange: (change: WorkspaceChange) => Promise<boolean>;
  runIntent: (source: InteractionSource, action: ToDoAction, ids: string[]) => Promise<boolean>;
};

function mountWorkspaceKeyboard(options: WorkspaceKeyboardOptions): () => void {
  const keydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const typing = Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
    const visibleIds = visibleToDoIdsFor(options.workspace, options.view, options.search);
    const ids = options.selection.ids.length ? options.selection.ids : options.selectedId ? [options.selectedId] : [];
    const command = event.metaKey || event.ctrlKey;
    if ((options.actionDialog || options.settingsOpen || options.quickFindOpen) && event.key === "Tab") containTabKey(event, options.shell?.querySelector(".replacement-dialog") ?? null);
    else if (options.mobile && options.selectedId && event.key === "Tab") containTabKey(event, options.shell?.querySelector(".replacement-inspector") ?? null);
    if (event.key === "Escape") {
      if (options.contextMenu) { options.setContextMenu(null); options.restoreFocus(); }
      else if (options.actionDialog) options.closeActionDialog();
      else if (options.quickFindOpen) { options.setQuickFindOpen(false); options.restoreFocus(); }
      else if (options.settingsOpen) { options.setSettingsOpen(false); options.restoreFocus(); }
      else if (options.backupOpen) { options.setBackupOpen(false); options.restoreFocus(); }
      else if (options.selection.ids.length) { options.setSelection({ ids: [], anchorId: null }); options.restoreFocus(); }
      else if (options.selectedId) { options.setSelectedId(null); options.restoreFocus(); }
      else if (options.sidebarOpen) { options.setSidebarOpen(false); options.restoreFocus(); }
      return;
    }
    if (options.quickFindOpen) return;
    if (options.contextMenu && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      const controls = [...(options.shell?.querySelectorAll<HTMLElement>(".replacement-context-menu [role='menuitem']") ?? [])];
      if (!controls.length) return;
      event.preventDefault();
      const current = controls.indexOf(globalThis.document.activeElement as HTMLElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1 : event.key === "ArrowDown" ? (current + 1) % controls.length : (current - 1 + controls.length) % controls.length;
      controls[next].focus();
      return;
    }
    if (options.mobile && options.sidebarOpen && event.key === "Tab") containTabKey(event, options.shell?.querySelector(".replacement-sidebar") ?? null);
    if (command && event.key.toLowerCase() === "a" && !typing) {
      event.preventDefault();
      options.returnFocus.current = globalThis.document.activeElement instanceof HTMLElement ? globalThis.document.activeElement : null;
      options.setSelectedId(null);
      options.setSelection((current) => updateSelection(current, visibleIds, null, "all"));
      return;
    }
    if (command && event.key.toLowerCase() === "f" && options.selectedId && target?.closest(".replacement-inspector textarea, .replacement-checklist")) {
      event.preventDefault();
      (options.shell?.querySelector("[data-note-search]") as HTMLInputElement | null)?.focus();
      return;
    }
    if (command && ["k", "f"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      options.returnFocus.current = globalThis.document.activeElement instanceof HTMLElement ? globalThis.document.activeElement : null;
      options.setQuickFindOpen(true);
      return;
    }
    if (command && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "n") { event.preventDefault(); options.quickInput?.focus(); return; }
    if (command && event.altKey && event.key.toLowerCase() === "n") { event.preventDefault(); (options.shell?.querySelector("[data-new-list]") as HTMLElement | null)?.click(); return; }
    if (command && event.shiftKey && event.key.toLowerCase() === "n") { event.preventDefault(); (options.shell?.querySelector("[data-new-heading]") as HTMLElement | null)?.click(); return; }
    if (command && /^[1-6]$/.test(event.key)) {
      const views: WorkspaceView[] = [
        { kind: "inbox", date: options.today }, { kind: "today", date: options.today }, { kind: "upcoming", date: options.today },
        { kind: "anytime", date: options.today }, { kind: "someday", date: options.today }, { kind: "logbook", date: options.today },
      ];
      event.preventDefault(); options.setSelectedView(views[Number(event.key) - 1]); options.setSelectedId(null); options.setSelection({ ids: [], anchorId: null }); return;
    }
    if (command && event.key.toLowerCase() === "l") {
      event.preventDefault();
      void options.runChange({ type: "runDailyLogbook", ...(options.activeSpaceId ? { spaceId: options.activeSpaceId } : {}) });
      return;
    }
    if (!typing && !command && !event.altKey && event.key === "/") {
      event.preventDefault();
      options.returnFocus.current = globalThis.document.activeElement instanceof HTMLElement ? globalThis.document.activeElement : null;
      options.setQuickFindOpen(true);
      return;
    }
    if (!ids.length) return;
    const shortcutAction = toDoActionForShortcut({ key: event.key, command, alt: event.altKey, shift: event.shiftKey, today: options.today });
    if (shortcutAction) { event.preventDefault(); void options.runIntent("keyboard", shortcutAction, ids); return; }
    if (command && !event.shiftKey && event.key.toLowerCase() === "s") { event.preventDefault(); options.openActionDialog("schedule"); return; }
    if (command && event.shiftKey && event.key.toLowerCase() === "d" && options.selectedId) { event.preventDefault(); (options.shell?.querySelector("[data-inspector-deadline]") as HTMLInputElement | null)?.focus(); return; }
    if (command && !event.shiftKey && event.key.toLowerCase() === "r" && options.selectedId) { event.preventDefault(); (options.shell?.querySelector("[data-inspector-schedule]") as HTMLSelectElement | null)?.focus(); return; }
    if (command && event.shiftKey && event.key.toLowerCase() === "r" && options.selectedId) {
      event.preventDefault();
      const item = options.document.toDos.find((toDo) => toDo.id === options.selectedId);
      const nextDate = item?.schedule.kind === "scheduled" ? item.schedule.date : datePlus(options.today, 7);
      void options.runChange({ type: "makeToDoRepeating", id: options.selectedId, nextDate });
      return;
    }
    if (command && event.shiftKey && ["f", "m"].includes(event.key.toLowerCase())) { event.preventDefault(); options.openActionDialog("move"); return; }
    if (!typing && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      const selectedSet = new Set(ids);
      const movedIds = visibleIds.filter((id) => selectedSet.has(id));
      const remaining = visibleIds.filter((id) => !selectedSet.has(id));
      const firstIndex = Math.min(...movedIds.map((id) => visibleIds.indexOf(id)));
      const lastIndex = Math.max(...movedIds.map((id) => visibleIds.indexOf(id)));
      const insertAt = event.key === "ArrowUp" ? firstIndex - 1 : firstIndex + 1;
      if (movedIds.length && insertAt >= 0 && insertAt <= remaining.length) {
        event.preventDefault();
        const neighborId = visibleIds[event.key === "ArrowUp" ? firstIndex - 1 : lastIndex + 1];
        const changesSection = ["space", "area", "project"].includes(options.view.kind) && neighborId;
        const destination = changesSection ? { location: directLocationFromEffective(options.workspace.locationOfToDo(neighborId)) } : undefined;
        remaining.splice(insertAt, 0, ...movedIds);
        void options.runChange({ type: "reorderToDos", movedIds, orderedIds: remaining, ...(destination?.location ? { destination } : {}) });
      }
    }
  };
  globalThis.document.addEventListener("keydown", keydown);
  return () => globalThis.document.removeEventListener("keydown", keydown);
}

function useWorkspaceDocument(adapter: WorkspaceSyncAdapter, onLoad: (document: WorkspaceDocument) => void) {
  const [snapshot, setSnapshot] = useState<{ revision: number; document: WorkspaceDocument } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef<{ command: WorkspaceSyncCommand; document: WorkspaceDocument } | null>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    let active = true;
    adapter.load().then((next) => {
      if (!active) return;
      const loadedSnapshot = next ?? { revision: 0, document: newWorkspaceDocument() };
      setSnapshot(loadedSnapshot);
      onLoadRef.current(loadedSnapshot.document);
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

  const runChanges = async (changes: WorkspaceChange[]): Promise<boolean> => {
    if (!snapshot || saving || !changes.length) return false;
    const staged = workspaceFor(snapshot.document);
    const result = changes.length === 1 ? staged.change(changes[0]) : staged.changeMany(changes);
    if (result.status === "rejected") { setFeedback({ text: result.errors.join(" "), error: true }); return false; }
    const document = staged.read();
    setSnapshot({ revision: snapshot.revision, document });
    setFeedback({ text: result.outcome.replaceAll("-", " "), error: false, ...(result.undo ? { undo: result.undo, undoDocument: snapshot.document } : {}) });
    return saveDocument({ expectedRevision: snapshot.revision, mutationId: `workspace-${crypto.randomUUID()}`, document }, document);
  };

  const runChange = (change: WorkspaceChange): Promise<boolean> => runChanges([change]);
  const undo = async (undoInfo: WorkspaceUndo, undoDocument: WorkspaceDocument | undefined) => {
    if (!snapshot || saving || !undoDocument) return;
    const document = JSON.parse(JSON.stringify(undoDocument)) as WorkspaceDocument;
    setSnapshot({ revision: snapshot.revision, document });
    const saved = await saveDocument({ expectedRevision: snapshot.revision, mutationId: `undo-${undoInfo.token}-${crypto.randomUUID()}`, document }, document);
    setFeedback({ text: saved ? "The change was undone." : "The undo could not be saved yet.", error: !saved });
  };

  return { snapshot, setSnapshot, loaded, loadError, feedback, setFeedback, saving, pending, saveDocument, retrySave, runChanges, runChange, undo };
}

function ReplacementWorkspace({ adapter, showReminder }: { adapter: WorkspaceSyncAdapter; showReminder: (toDo: { id: string; title: string; notes?: string }) => Promise<boolean> }) {
  const localToday = () => dateInTimeZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [selectedView, setSelectedView] = useState<WorkspaceView>(() => ({ kind: "today", date: localToday() }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [activeTagIds, setActiveTagIds] = useState<EntityId[]>([]);
  const [draft, setDraft] = useState(() => localStorage.getItem(QUICK_DRAFT_KEY) ?? "");
  const { snapshot, setSnapshot, loaded, loadError, feedback, setFeedback, saving, pending, saveDocument, retrySave, runChanges, runChange, undo } = useWorkspaceDocument(adapter, (document) => {
    setActiveSpaceId((current) => current ?? document.settings.defaultSpaceId);
    if (!localStorage.getItem(QUICK_DRAFT_KEY) && document.settings.quickDraft?.value) setDraft(document.settings.quickDraft.value);
  });
  const [backupOpen, setBackupOpen] = useState(false);
  const [backup, setBackup] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [selection, setSelection] = useState<SelectionState>({ ids: [], anchorId: null });
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [actionDialog, setActionDialog] = useState<"move" | "schedule" | "tags" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [missingTarget, setMissingTarget] = useState<string | null>(null);
  const [repeatTarget, setRepeatTarget] = useState<RepeatEditorTarget | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 720px)").matches);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [search, setSearch] = useState("");
  const quickInput = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const touchGesture = useRef<{ id: string; x: number; y: number; timer: number } | null>(null);
  const drawerGesture = useRef<{ x: number; y: number } | null>(null);
  const dailyLogbookDate = useRef<string | null>(null);
  const repeatingGenerationDate = useRef<string | null>(null);
  const notificationSnoozeHandled = useRef(false);
  const initialRouteHandled = useRef(false);

  const restoreFocus = () => {
    const target = returnFocus.current;
    returnFocus.current = null;
    window.setTimeout(() => target?.focus(), 0);
  };

  const applyResolvedTarget = (resolved: ResolvedDirectTarget) => {
    setSelectedView(resolved.view);
    setSelectedId(resolved.selectedToDoId);
    setActiveTagIds(resolved.tagIds);
    setSelection({ ids: [], anchorId: null });
    setContextMenu(null);
    setSidebarOpen(false);
    setMissingTarget(null);
    if (resolved.activeSpaceId) setActiveSpaceId(resolved.activeSpaceId);
    if (resolved.repeatingTemplateId && snapshot) {
      const template = snapshot.document.repeatingTemplates.find((item) => item.id === resolved.repeatingTemplateId);
      if (template) setRepeatTarget({ kind: "template", template });
    } else setRepeatTarget(null);
  };

  const openDirectTarget = (target: DirectTarget, pushHistory: boolean) => {
    if (!snapshot) return;
    const resolved = resolveDirectTarget(snapshot.document, target, localToday());
    if (resolved.status === "missing") {
      setMissingTarget(resolved.message);
      setSelectedId(null);
      setRepeatTarget(null);
    } else applyResolvedTarget(resolved);
    if (pushHistory) history.pushState(null, "", directTargetUrl(target, `${location.origin}${location.pathname}`));
  };

  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!loaded || !snapshot || initialRouteHandled.current) return;
    initialRouteHandled.current = true;
    const recovered = recoverDirectTargetAfterLoad(snapshot.document, location.search, localToday());
    if (recovered) {
      if (recovered.resolved.status === "missing") setMissingTarget(recovered.resolved.message);
      else applyResolvedTarget(recovered.resolved);
    }
  }, [loaded, snapshot?.revision]);

  useEffect(() => {
    if (!loaded || !snapshot) return;
    const handleHistory = () => {
      const target = parseDirectTarget(location.search) ?? { kind: "view" as const, viewKind: "today" as const };
      openDirectTarget(target, false);
    };
    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, [loaded, snapshot?.revision]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const runIntent = async (source: InteractionSource, action: ToDoAction, ids: string[]): Promise<boolean> => {
    const saved = await runChanges(changesForIntent({ source, action, ids }));
    if (saved && source === "bulk") {
      setSelection({ ids: [], anchorId: null });
      if (!actionDialog) restoreFocus();
    }
    return saved;
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

  const today = localToday();
  const datedView: WorkspaceView = selectedView.kind === "tomorrow" ? { ...selectedView, date: datePlus(today, 1) } : { ...selectedView, date: today } as WorkspaceView;
  const normalizedView: WorkspaceView = { ...datedView, tagIds: activeTagIds } as WorkspaceView;
  const workspace = useMemo(() => snapshot ? workspaceFor(snapshot.document) : null, [snapshot]);

  useEffect(() => {
    if (!workspace || !snapshot || saving || repeatingGenerationDate.current === today) return;
    const staged = workspaceFor(snapshot.document);
    const result = staged.change({ type: "generateRepeatingOccurrences", throughDate: today });
    const hasMoreDue = staged.repeatingPreviews("1970-01-01", today, 1).length > 0;
    repeatingGenerationDate.current = hasMoreDue ? null : today;
    if (result.status === "changed" && result.affected.length) void runChange({ type: "generateRepeatingOccurrences", throughDate: today });
    else repeatingGenerationDate.current = today;
  }, [workspace, snapshot?.revision, saving, today]);

  const openActionDialog = (dialog: "move" | "schedule" | "tags") => {
    if (!contextMenu) returnFocus.current = globalThis.document.activeElement instanceof HTMLElement ? globalThis.document.activeElement : null;
    setContextMenu(null);
    setActionDialog(dialog);
  };

  const closeActionDialog = () => {
    setActionDialog(null);
    restoreFocus();
  };

  useEffect(() => {
    if (!workspace || !shellRef.current) return;
    mountWorkspaceToDoSortable(shellRef.current, selection.ids, ({ movedIds, orderedIds, sectionKey }) => {
      const selectedMovedIds = movedIds.flatMap((id) => selection.ids.includes(id) ? selection.ids : [id]);
      void runChange({ type: "reorderToDos", movedIds: [...new Set(selectedMovedIds)], orderedIds, destination: destinationForSection(sectionKey, normalizedView) });
    });
    return destroyWorkspaceToDoSortable;
  }, [snapshot?.revision, selectedView, activeTagIds.join(","), selection.ids.join(",")]);

  useEffect(() => {
    if (!workspace || !snapshot) return;
    return mountWorkspaceKeyboard({
      workspace, document: snapshot.document, view: normalizedView, search, selection, selectedId,
      contextMenu, actionDialog, settingsOpen, quickFindOpen, backupOpen, sidebarOpen, mobile, today, activeSpaceId,
      shell: shellRef.current, quickInput: quickInput.current, returnFocus,
      setSelection, setSelectedId, setSelectedView, setContextMenu, setSettingsOpen, setQuickFindOpen, setBackupOpen, setSidebarOpen,
      restoreFocus, closeActionDialog, openActionDialog, runChange, runIntent,
    });
  }, [workspace, snapshot?.revision, selectedId, selection.ids.join(","), contextMenu, actionDialog, settingsOpen, quickFindOpen, backupOpen, sidebarOpen, mobile, search, normalizedView.kind, "id" in normalizedView ? normalizedView.id : ""]);

  if (loadError) return <ReplacementState title="Your Workspace is unavailable" copy="Your saved Workspace has not been changed."><button className="replacement-button" type="button" onClick={() => window.location.reload()}>Retry loading</button></ReplacementState>;
  if (!loaded || !workspace || !snapshot) return <ReplacementState title="Loading your Workspace" copy="Checking the private Lakebed copy for this account." />;

  const document = snapshot.document;
  const allItems = workspace.view(normalizedView);
  const agendaItems = normalizedView.kind === "today" || normalizedView.kind === "tomorrow" || normalizedView.kind === "upcoming"
    ? agendaForView(
      document,
      { kind: normalizedView.kind, date: normalizedView.date },
      activeSpaceId,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      activeTagIds,
    )
    : [];
  const usesAgenda = normalizedView.kind === "today" || normalizedView.kind === "tomorrow" || normalizedView.kind === "upcoming";
  const items = usesAgenda ? agendaItems.filter((item) => item.actionable).map((item) => item.item as ToDo | Project) : allItems;
  const upcomingPreviews = normalizedView.kind === "upcoming"
    ? workspace.nextRepeatingPreviews(datePlus(today, 1)).filter((preview) => {
      const template = document.repeatingTemplates.find((item) => item.id === preview.templateId);
      if (!template) return false;
      if (activeSpaceId && spaceIdForRepeatingTemplate(document, template) !== activeSpaceId) return false;
      const effectiveTags = effectiveTagIdsForRepeatingTemplate(document, template);
      return activeTagIds.every((tagId) => effectiveTags.includes(tagId));
    })
    : [];
  const itemSections = groupWorkspaceItems(items, normalizedView, document, workspace);
  const visibleToDoIds = items.filter((item): item is ToDo => "checklist" in item).map((item) => item.id);
  const selected = selectedId ? document.toDos.find((item) => item.id === selectedId) ?? null : null;
  const activeSpace = document.spaces.find((space) => space.id === activeSpaceId) ?? document.spaces.find((space) => space.id === document.settings.defaultSpaceId) ?? null;
  const darkAppearance = document.settings.theme === "dark" || (document.settings.theme === "system" && systemDark);
  const nav = (view: WorkspaceView, label: string) => <button type="button" className={`replacement-nav-row${selectedView.kind === view.kind && (!("id" in view) || ("id" in selectedView && selectedView.id === view.id)) ? " active" : ""}`} onClick={() => openDirectTarget(directTargetForView(view), true)} onDragOver={(event) => { if (moveActionForView(view)) event.preventDefault(); }} onDrop={(event) => { const ids = event.dataTransfer?.getData("application/x-objects-todos").split(",").filter(Boolean) ?? []; const action = moveActionForView(view); if (ids.length && action) { event.preventDefault(); void runIntent("drag", action, ids); } }}><span>{label}</span><span>{view.kind === "repeating" ? document.repeatingTemplates.length : workspace.view(view).length}</span></button>;

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

  const idsForAction = (id?: string): string[] => id && !selection.ids.includes(id) ? [id] : selection.ids.length ? selection.ids : id ? [id] : selectedId ? [selectedId] : [];
  const selectRow = (event: MouseEvent, id: string) => {
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      returnFocus.current = event.currentTarget as HTMLElement;
      setSelectedId(null);
      setSelection((current) => updateSelection(current, visibleToDoIds, id, event.shiftKey ? "range" : "toggle"));
      return;
    }
    returnFocus.current = event.currentTarget as HTMLElement;
    setSelection({ ids: [], anchorId: null });
    openDirectTarget({ kind: "toDo", id }, true);
  };
  const openContextMenu = (id: string, x: number, y: number, trigger: HTMLElement | null) => {
    returnFocus.current = trigger;
    if (!selection.ids.includes(id)) setSelection({ ids: [id], anchorId: id });
    setContextMenu({ id, x, y });
  };
  const beginTouch = (event: PointerEvent, id: string) => {
    if (event.pointerType !== "touch") return;
    const timer = window.setTimeout(() => openContextMenu(id, event.clientX, event.clientY, event.currentTarget as HTMLElement), 550);
    touchGesture.current = { id, x: event.clientX, y: event.clientY, timer };
  };
  const endTouch = (event: PointerEvent) => {
    const gesture = touchGesture.current;
    if (!gesture) return;
    window.clearTimeout(gesture.timer);
    const distance = event.clientX - gesture.x;
    const action = touchActionForDistance(distance);
    if (action === "select") {
        returnFocus.current = event.currentTarget as HTMLElement;
        setSelection((current) => updateSelection(current, visibleToDoIds, gesture.id, "toggle"));
    } else if (action === "menu") openContextMenu(gesture.id, event.clientX, event.clientY, event.currentTarget as HTMLElement);
    touchGesture.current = null;
  };
  const moveChoices: Array<{ label: string; action: ToDoAction }> = [
    ...document.spaces.map((space) => ({ label: space.title, action: { type: "move" as const, location: { kind: "unfiled" as const, spaceId: space.id } } })),
    ...document.areas.map((area) => ({ label: area.title, action: { type: "move" as const, location: { kind: "area" as const, areaId: area.id } } })),
    ...document.projects.filter((project) => !project.trashedAt && project.outcome === "open").map((project) => ({ label: project.title, action: { type: "move" as const, location: { kind: "project" as const, projectId: project.id } } })),
    ...document.headings.filter((heading) => !heading.archivedAt).map((heading) => ({ label: heading.title, action: { type: "move" as const, location: { kind: "heading" as const, headingId: heading.id } } })),
  ];
  const workspaceRow = (item: ToDo | Project) => <WorkspaceItemRow
    key={item.id}
    item={item}
    selected={selectedId === item.id}
    bulkSelected={selection.ids.includes(item.id)}
    idsForAction={idsForAction}
    runIntent={runIntent}
    selectRow={selectRow}
    selectProject={(id) => openDirectTarget({ kind: "project", id }, true)}
    toggleSelection={(id, trigger) => {
      returnFocus.current = trigger;
      setSelectedId(null);
      setSelection((current) => updateSelection(current, visibleToDoIds, id, "toggle"));
    }}
    openContextMenu={openContextMenu}
    beginTouch={beginTouch}
    endTouch={endTouch}
    cancelTouch={() => {
      if (touchGesture.current) window.clearTimeout(touchGesture.current.timer);
      touchGesture.current = null;
    }}
  />;

  return <div
    ref={shellRef}
    data-theme={document.settings.theme}
    className={`replacement-shell${darkAppearance ? " replacement-dark" : ""}${selected ? " inspector-open" : ""}${sidebarOpen ? " sidebar-open" : ""}`}
    aria-busy={saving}
    onPointerDown={(event) => { if (mobile && !sidebarOpen && event.pointerType === "touch" && event.clientX <= 24) drawerGesture.current = { x: event.clientX, y: event.clientY }; }}
    onPointerUp={(event) => {
      const gesture = drawerGesture.current;
      drawerGesture.current = null;
      if (gesture && event.clientX - gesture.x >= 70 && Math.abs(event.clientY - gesture.y) < 80) {
        returnFocus.current = shellRef.current?.querySelector<HTMLElement>("[aria-label='Open sidebar']") ?? null;
        setSidebarOpen(true);
        window.setTimeout(() => shellRef.current?.querySelector<HTMLElement>(".replacement-mobile-close")?.focus(), 0);
      }
    }}
    onPointerCancel={() => { drawerGesture.current = null; }}
  >
    <aside className="replacement-sidebar" aria-label="Lists" aria-hidden={mobile && !sidebarOpen} inert={(mobile && (!sidebarOpen || Boolean(selected))) || actionDialog !== null || settingsOpen || quickFindOpen || repeatTarget !== null ? true : undefined}>
      <div className="replacement-brand"><span className="replacement-brand-mark" aria-hidden="true">O</span>Objects <button className="replacement-mobile-close" type="button" aria-label="Close sidebar" onClick={() => { setSidebarOpen(false); restoreFocus(); }}>×</button></div>
      {activeSpace ? <button className="replacement-spaces-pill" type="button" aria-label={`Open ${activeSpace.title} Space`} onClick={() => openDirectTarget({ kind: "space", id: activeSpace.id }, true)}><span style={{ background: activeSpace.color }} aria-hidden="true" /><strong>{activeSpace.title}</strong><small>Space</small></button> : null}
      <nav className="replacement-nav">
        {nav({ kind: "inbox", date: today }, "Inbox")}{nav({ kind: "today", date: today }, "Today")}{nav({ kind: "thisEvening", date: today }, "This Evening")}{nav({ kind: "tomorrow", date: datePlus(today, 1) }, "Tomorrow")}{nav({ kind: "upcoming", date: today }, "Upcoming")}{nav({ kind: "anytime", date: today }, "Anytime")}{nav({ kind: "someday", date: today }, "Someday")}{nav({ kind: "deadlines", date: today }, "Deadlines")}{nav({ kind: "logbook", date: today }, "Logbook")}{nav({ kind: "trash", date: today }, "Trash")}
      </nav>
      {document.spaces.some((space) => space.pinned) ? <div className="replacement-nav-group"><h2>Pinned Spaces</h2>{document.spaces.filter((space) => space.pinned).map((space) => nav({ kind: "space", id: space.id, date: today }, space.title))}</div> : null}
      {document.spaces.some((space) => !space.pinned) ? <div className="replacement-nav-group"><h2>Other Spaces</h2>{document.spaces.filter((space) => !space.pinned).map((space) => nav({ kind: "space", id: space.id, date: today }, space.title))}</div> : null}
      {document.areas.length ? <div className="replacement-nav-group"><h2>Areas</h2>{document.areas.map((area) => nav({ kind: "area", id: area.id, date: today }, area.title))}</div> : null}
      {document.projects.length ? <div className="replacement-nav-group"><h2>Projects</h2>{document.projects.map((project) => nav({ kind: "project", id: project.id, date: today }, project.title))}</div> : null}
      {document.headings.some((heading) => !heading.archivedAt) ? <div className="replacement-nav-group"><h2>Headings</h2>{document.headings.filter((heading) => !heading.archivedAt).map((heading) => nav({ kind: "heading", id: heading.id, date: today }, heading.title))}</div> : null}
      {document.headings.some((heading) => heading.archivedAt) ? <div className="replacement-nav-group"><h2>Archived Headings</h2>{document.headings.filter((heading) => heading.archivedAt).map((heading) => nav({ kind: "heading", id: heading.id, date: today }, heading.title))}</div> : null}
      <label className="replacement-policy">Logbook policy<select value={document.settings.logCompletedItems} onChange={(event) => void runChange({ type: "setLogbookPolicy", policy: event.currentTarget.value as WorkspaceDocument["settings"]["logCompletedItems"] })}><option value="immediately">Immediately</option><option value="daily">Daily</option><option value="manually">Manually</option></select></label>
      <button className="replacement-sidebar-action" type="button" onClick={(event) => {
        returnFocus.current = mobile ? shellRef.current?.querySelector<HTMLElement>("[aria-label='Open sidebar']") ?? null : event.currentTarget;
        setBackupOpen((open) => !open);
        if (mobile) {
          setSidebarOpen(false);
          window.setTimeout(() => shellRef.current?.querySelector<HTMLInputElement>(".replacement-file")?.focus(), 0);
        }
      }}>Import backup</button>
      <div className="replacement-sidebar-footer"><button className="replacement-sidebar-action" type="button" onClick={(event) => { returnFocus.current = event.currentTarget; setSettingsOpen(true); if (mobile) setSidebarOpen(false); }}>Settings</button><button className="replacement-sidebar-action replacement-repeating-icon" type="button" aria-label="Open Repeating" title="Repeating" onClick={() => openDirectTarget({ kind: "view", viewKind: "repeating" }, true)}>↻</button></div>
    </aside>

    <main className="replacement-main" inert={(mobile && (sidebarOpen || Boolean(selected))) || actionDialog !== null || settingsOpen || quickFindOpen || repeatTarget !== null ? true : undefined}>
      <div className="replacement-mobile-header"><button type="button" aria-label="Open sidebar" onClick={(event) => { returnFocus.current = event.currentTarget; setSidebarOpen(true); window.setTimeout(() => (shellRef.current?.querySelector(".replacement-mobile-close") as HTMLElement | null)?.focus(), 0); }}>☰</button><strong>Objects</strong><button type="button" aria-label="Open Quick Find" onClick={(event) => { returnFocus.current = event.currentTarget; setQuickFindOpen(true); }}>⌕</button></div>
      <div className="replacement-main-inner">
        <header><p className="replacement-kicker">{saving ? "Saving…" : "Workspace"}</p><div className="replacement-title-row"><div><h1>{missingTarget ? "Link unavailable" : viewTitle(normalizedView, document)}</h1><p className="replacement-subtitle">{missingTarget ?? (normalizedView.kind === "repeating" ? `${document.repeatingTemplates.length} Template${document.repeatingTemplates.length === 1 ? "" : "s"}` : (usesAgenda ? agendaItems.length : items.length) + upcomingPreviews.length ? `${(usesAgenda ? agendaItems.length : items.length) + upcomingPreviews.length} item${(usesAgenda ? agendaItems.length : items.length) + upcomingPreviews.length === 1 ? "" : "s"}` : "Nothing here yet")}</p></div><button className="replacement-search" type="button" onClick={(event) => { returnFocus.current = event.currentTarget; setQuickFindOpen(true); }}><span>⌕</span><span>{search || "Quick Find"}</span><kbd>⌘K</kbd></button></div>{document.tags.length && normalizedView.kind !== "repeating" && !missingTarget ? <div className="replacement-tag-filters" aria-label="Filter by effective Tags"><button type="button" className={!activeTagIds.length ? "active" : ""} onClick={() => setActiveTagIds([])}>All Tags</button>{document.tags.map((tag) => <button key={tag.id} type="button" className={activeTagIds.includes(tag.id) ? "active" : ""} aria-pressed={activeTagIds.includes(tag.id)} onClick={(event) => setActiveTagIds((current) => event.metaKey || event.ctrlKey ? current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id] : current.length === 1 && current[0] === tag.id ? [] : [tag.id])}>{tag.title}</button>)}</div> : null}</header>
        {!missingTarget && normalizedView.kind !== "repeating" ? <EntityTools view={normalizedView} document={document} workspace={workspace} runChange={runChange} selectView={(view) => openDirectTarget(directTargetForView(view), true)} openProjectRepeatEditor={(project) => setRepeatTarget({ kind: "project", project })} openTemplate={(id) => openDirectTarget({ kind: "repeatingTemplate", id }, true)} /> : null}
        {backupOpen ? <section className="replacement-import" aria-labelledby="replacement-import-title"><h2 id="replacement-import-title">Import the current portable backup</h2><p>Type <strong>{FULL_IMPORT_CONFIRMATION}</strong> before replacing this Workspace.</p><div className="replacement-import-controls"><input className="replacement-file" type="file" accept="application/json,.json" aria-label="Choose Objects JSON backup" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void file.text().then(setBackup); }} /><input className="replacement-confirmation" value={confirmation} onInput={(event) => setConfirmation(event.currentTarget.value)} placeholder={FULL_IMPORT_CONFIRMATION} aria-label="Full import confirmation" /><button className="replacement-button" type="button" disabled={!backup || saving} onClick={() => void importBackup()}>Import backup</button></div></section> : null}

        {!missingTarget && normalizedView.kind !== "trash" && normalizedView.kind !== "logbook" && normalizedView.kind !== "deadlines" && normalizedView.kind !== "repeating" ? <form className="replacement-quick-entry" onSubmit={(event) => { event.preventDefault(); void submitQuickEntry(); }}><input ref={quickInput} value={draft} onInput={(event) => { const value = event.currentTarget.value; setDraft(value); localStorage.setItem(QUICK_DRAFT_KEY, value); }} onBlur={(event) => { const next = event.relatedTarget; if (draft && (!(next instanceof Node) || !event.currentTarget.form?.contains(next))) void runChange({ type: "saveQuickDraft", value: draft, view: normalizedView }); }} placeholder={`New to-do in ${viewTitle(normalizedView, document)}`} aria-label="New to-do" /><button className="replacement-button" type="submit" disabled={!draft.trim() || saving}>Add</button><p>Try “Call Sam tomorrow at 2pm due Friday #people”.</p></form> : null}

        {missingTarget ? <section className="replacement-missing"><div aria-hidden="true">?</div><h2>We could not open this link</h2><p>{missingTarget}</p><button className="replacement-button" type="button" onClick={() => openDirectTarget({ kind: "view", viewKind: "today" }, true)}>Open Today</button></section> : normalizedView.kind === "repeating" ? <RepeatingView document={document} search="" edit={(template) => setRepeatTarget({ kind: "template", template })} create={() => setRepeatTarget({ kind: "direct" })} runChange={runChange} /> : usesAgenda && agendaItems.length ? <section className="replacement-agenda" aria-label={`${viewTitle(normalizedView, document)} agenda`}>
          {agendaItems.map((agendaItem) => agendaItem.kind === "calendarEvent" ? <article className="replacement-calendar-row" key={agendaItem.id}><span className="replacement-calendar-time">{agendaItem.item.allDay ? "All day" : new Date(agendaItem.item.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><span className="replacement-calendar-line" aria-hidden="true" /><span><strong>{agendaItem.title}</strong><small>{agendaItem.item.calendar} · Calendar event</small></span><button type="button" onClick={(event) => { returnFocus.current = event.currentTarget; setSettingsOpen(true); }}>Edit</button></article> : workspaceRow(agendaItem.item))}
          {upcomingPreviews.length ? <section className="replacement-section" aria-label="Future repeating previews"><h2>Repeating previews</h2><div className="replacement-list">{upcomingPreviews.map((preview) => <article className="replacement-row replacement-preview-row" key={preview.id}><span className="replacement-preview-icon" aria-hidden="true">↻</span><div className="replacement-row-body" aria-disabled="true"><strong>{preview.title}</strong><span>{preview.scheduledDate} · {preview.itemKind === "toDo" ? "To-do" : "Project"} preview · Becomes actionable when due</span></div><button className="replacement-preview-label" type="button" onClick={() => openDirectTarget({ kind: "repeatingTemplate", id: preview.templateId }, true)}>Template</button></article>)}</div></section> : null}
        </section> : items.length || upcomingPreviews.length ? <div className="replacement-sections">
          {[...itemSections].map(([sectionKey, section]) => <section className="replacement-section" key={sectionKey} aria-label={section.title ?? `${viewTitle(normalizedView, document)} items`}>
          {section.title ? <h2>{section.title}</h2> : null}
          <div className="replacement-list" data-section={sectionKey}>
          {section.items.map(workspaceRow)}
          </div>
          </section>)}
          {upcomingPreviews.length ? <section className="replacement-section" aria-label="Future repeating previews"><h2>Repeating previews</h2><div className="replacement-list">{upcomingPreviews.map((preview) => <article className="replacement-row replacement-preview-row" key={preview.id}><span className="replacement-preview-icon" aria-hidden="true">↻</span><div className="replacement-row-body" aria-disabled="true"><strong>{preview.title}</strong><span>{preview.scheduledDate} · {preview.itemKind === "toDo" ? "To-do" : "Project"} preview · Becomes actionable when due</span></div><button className="replacement-preview-label" type="button" onClick={() => { const template = document.repeatingTemplates.find((item) => item.id === preview.templateId); setSelectedView({ kind: "repeating", date: today }); if (template) setRepeatTarget({ kind: "template", template }); }}>Template</button></article>)}</div></section> : null}
        </div> : <section className="replacement-empty"><div aria-hidden="true">✓</div><h2>{normalizedView.kind === "trash" ? "Trash is empty" : normalizedView.kind === "logbook" ? "No history yet" : "All clear"}</h2><p>{normalizedView.kind === "trash" ? "Removed to-dos will wait here until you restore or permanently delete them." : "Use inline entry or Magic Plus to add a to-do."}</p></section>}

        {normalizedView.kind === "trash" && items.length && activeSpaceId ? <button className="replacement-danger-button" type="button" onClick={() => { if (window.confirm("Permanently delete every to-do in the active Space's Trash?")) void runChange({ type: "emptyTrash", spaceId: activeSpaceId, confirmation: EMPTY_TRASH_CONFIRMATION }); }}>Empty active Space’s Trash</button> : null}
      </div>
    </main>

    {sidebarOpen ? <button className="replacement-sidebar-scrim" type="button" aria-label="Dismiss sidebar drawer" onClick={() => { setSidebarOpen(false); restoreFocus(); }} /> : null}
    {selection.ids.length ? <SelectionToolbar
      ids={selection.ids}
      today={today}
      inTrash={normalizedView.kind === "trash"}
      runIntent={runIntent}
      openDialog={openActionDialog}
      clear={() => { setSelection({ ids: [], anchorId: null }); restoreFocus(); }}
    /> : null}
    {contextMenu ? <ToDoContextMenu
      menu={contextMenu}
      items={idsForAction(contextMenu.id).map((id) => document.toDos.find((item) => item.id === id)).filter((item): item is ToDo => Boolean(item))}
      today={today}
      run={(action) => {
        const ids = idsForAction(contextMenu.id);
        setContextMenu(null);
        void runIntent("menu", action, ids).then(restoreFocus);
      }}
      openDialog={openActionDialog}
    /> : null}
    {actionDialog ? <ToDoActionDialog
      kind={actionDialog}
      count={idsForAction().length}
      ids={idsForAction()}
      today={today}
      moveChoices={moveChoices}
      runIntent={runIntent}
      close={closeActionDialog}
    /> : null}
    {settingsOpen ? <WorkspaceSettingsDialog document={document} today={today} runChange={runChange} close={() => { setSettingsOpen(false); restoreFocus(); }} /> : null}
    {quickFindOpen ? <QuickFindDialog document={document} today={today} query={search} setQuery={setSearch} choose={(result) => { setQuickFindOpen(false); openDirectTarget(result.target, true); }} close={() => { setQuickFindOpen(false); restoreFocus(); }} /> : null}
    {repeatTarget ? <RepeatEditor target={repeatTarget} document={document} today={today} runChange={runChange} close={() => setRepeatTarget(null)} /> : null}
    {!missingTarget ? <button className="replacement-magic-plus" type="button" inert={actionDialog !== null || settingsOpen || quickFindOpen || repeatTarget !== null ? true : undefined} aria-label={normalizedView.kind === "repeating" ? "Add Repeating Template" : "Magic Plus: add to-do"} onClick={() => { if (normalizedView.kind === "repeating") setRepeatTarget({ kind: "direct" }); else { quickInput.current?.focus(); quickInput.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } }}>+</button> : null}
    {selected ? <div inert={actionDialog !== null || settingsOpen || quickFindOpen || repeatTarget !== null ? true : undefined}><Inspector key={`${selected.id}-${snapshot.revision}`} item={selected} document={document} saving={saving} modal={mobile} runChange={runChange} runIntent={runIntent} openRepeatEditor={(item) => setRepeatTarget({ kind: "toDo", toDo: item })} openTemplate={(id) => openDirectTarget({ kind: "repeatingTemplate", id }, true)} close={() => { setSelectedId(null); history.pushState(null, "", directTargetUrl(directTargetForView(normalizedView), `${location.origin}${location.pathname}`)); restoreFocus(); }} /></div> : null}
    {feedback ? <div className={`replacement-toast${feedback.error ? " error" : ""}`} role="status"><span>{feedback.text}</span>{feedback.error && pending.current ? <button type="button" onClick={() => void retrySave()}>Retry</button> : null}{feedback.undo ? <button type="button" onClick={() => void undo(feedback.undo!, feedback.undoDocument)}>Undo</button> : null}<button type="button" aria-label="Dismiss message" onClick={() => setFeedback(null)}>×</button></div> : null}
  </div>;
}

export function mountReplacement(root: Element, adapter: WorkspaceSyncAdapter, showReminder: (toDo: { id: string; title: string; notes?: string }) => Promise<boolean>): () => void {
  document.title = "Objects";
  render(<ReplacementLoadBoundary><style>{replacementStyles}</style><ReplacementWorkspace adapter={adapter} showReminder={showReminder} /></ReplacementLoadBoundary>, root);
  return () => render(null, root);
}
