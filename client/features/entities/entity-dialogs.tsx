import { useMemo, useRef, useState } from "preact/hooks";
import type { Area, Heading, LaunchRule, Project, RepeatRule, Space } from "../../../shared/state";
import { eventChecked, eventValue, hideWebAwesomeOverlay, OverlayElement, useWebAwesomeChecked, useWebAwesomeOverlay, ValueElement, WaButton, WaCheckbox, WaDetails, WaDialog, WaOption, WaSelect, WaSwitch, WaTag } from "../../ui/webawesome";

export type ListDraft = { type: "project" | "area"; spaceId: string; areaId: string | null; title: string };
export type MoveDestinationOption = { value: string; label: string };
export type ParentOption = { value: string; label: string };
export type BulkTagState = { tag: string; state: "all" | "mixed" | "none" };
export type SpaceSettingsDraft = { spaces: Space[]; rules: LaunchRule[]; enabled: boolean; defaultId: string | null };

function TagsEditor({ value, onChange, label = "Tags" }: { value: string[]; onChange(value: string[]): void; label?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const additions = draft.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (!additions.length) return;
    onChange([...new Set([...value, ...additions])]);
    setDraft("");
  };
  return <div class="entity-tags-field"><span>{label}</span><div class="entity-tags-list">{value.map((tag) => <WaTag key={tag} size="s" removable title={`Remove ${tag}`} onClick={() => onChange(value.filter((candidate) => candidate !== tag))}>{tag}</WaTag>)}<input value={draft} placeholder={value.length ? "Add another tag" : "Add tags"} onInput={(event) => setDraft(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); } }} onBlur={add} /></div></div>;
}

function WeekdayPicker({ value, onChange }: { value: number[]; onChange(value: number[]): void }) {
  const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return <div class="entity-weekdays" aria-label="Repeat days">{days.map((label, day) => <button type="button" class={value.includes(day) ? "active" : ""} aria-label={`Repeat on ${names[day]}`} aria-pressed={value.includes(day)} onClick={() => onChange(value.includes(day) ? value.filter((candidate) => candidate !== day) : [...value, day].sort())}>{label}</button>)}</div>;
}

function SpacePinCheckbox({ space, disabled, onChange }: { space: Space; disabled: boolean; onChange(checked: boolean): void }) {
  const checkbox = useRef<ValueElement | null>(null);
  useWebAwesomeChecked(checkbox, space.pinned);
  return <WaCheckbox ref={checkbox} disabled={disabled} onInput={(event: Event) => onChange(eventChecked(event))}>Sidebar</WaCheckbox>;
}

function RepeatEditor({ value, fallbackDate, onChange, showStop = true }: { value: RepeatRule | null; fallbackDate: string; onChange(value: RepeatRule | null): void; showStop?: boolean }) {
  const fallbackWeekday = new Date(`${fallbackDate}T12:00:00`).getDay();
  const defaultWeekdays = [Number.isNaN(fallbackWeekday) ? 1 : fallbackWeekday];
  if (!value) return <WaButton size="s" appearance="outlined" onClick={() => onChange({ mode: "fixed", frequency: "weekly", interval: 1, weekdays: defaultWeekdays, nextDate: fallbackDate, paused: false })}>Make repeating…</WaButton>;
  const update = <K extends keyof RepeatRule>(key: K, next: RepeatRule[K]) => onChange({ ...value, [key]: next });
  const setFrequency = (frequency: RepeatRule["frequency"]) => onChange({ ...value, frequency, weekdays: frequency === "weekly" && !value.weekdays?.length ? defaultWeekdays : value.weekdays });
  return <div class="entity-repeat-editor">
    <div class="entity-form-grid">
      <WaSelect label="Schedule" value={value.mode} onChange={(event: Event) => update("mode", eventValue(event) as RepeatRule["mode"])}><WaOption value="fixed">On schedule</WaOption><WaOption value="afterCompletion">After completion</WaOption></WaSelect>
      <WaSelect label="Frequency" value={value.frequency} onChange={(event: Event) => setFrequency(eventValue(event) as RepeatRule["frequency"])}><WaOption value="daily">Day</WaOption><WaOption value="weekly">Week</WaOption><WaOption value="monthly">Month</WaOption><WaOption value="yearly">Year</WaOption></WaSelect>
      <label class="entity-native-field">Every<input type="number" min="1" value={value.interval || 1} onInput={(event) => update("interval", Math.max(1, Number(event.currentTarget.value) || 1))} /></label>
      <label class="entity-native-field">Next occurrence<input type="date" value={value.nextDate || fallbackDate} onInput={(event) => update("nextDate", event.currentTarget.value)} /></label>
    </div>
    {value.frequency === "weekly" && <WeekdayPicker value={value.weekdays || []} onChange={(weekdays) => update("weekdays", weekdays)} />}
    {showStop && <WaButton size="s" appearance="plain" variant="danger" onClick={() => onChange(null)}>Stop repeating</WaButton>}
  </div>;
}

export function RepeatingTemplateDialog({ title, value, fallbackDate, stopped = false, onClose, onSave, onStop, onOpenContents, onDelete }: {
  title: string;
  value: RepeatRule;
  fallbackDate: string;
  stopped?: boolean;
  onClose(): void;
  onSave(value: RepeatRule): void;
  onStop(): void;
  onOpenContents?(): void;
  onDelete?(): void;
}) {
  const dialog = useRef<OverlayElement | null>(null);
  const [draft, setDraft] = useState<RepeatRule>({ ...value, weekdays: [...(value.weekdays || [])] });
  useWebAwesomeOverlay(dialog, onClose);
  return <WaDialog ref={dialog} class="objects-dialog dialog-repeat" label="Repeating schedule" light-dismiss>
    <div class="entity-dialog">
      <p>{stopped ? `“${title}” is stopped and kept as read-only history. Its existing Occurrences are unchanged.` : `Changes to “${title}” affect future Occurrences only. Existing Occurrences keep their own dates and edits.`}</p>
      {stopped ? <div class="entity-repeat-stopped"><strong>Stopped schedule</strong><span>No new Occurrences will be created.</span></div> : <><RepeatEditor value={draft} fallbackDate={fallbackDate} showStop={false} onChange={(next) => next && setDraft(next)} /><label class="entity-pause-row"><span><strong>Pause schedule</strong><small>Keep the Template without creating new Occurrences.</small></span><input type="checkbox" checked={draft.paused} onChange={(event) => setDraft((current) => ({ ...current, paused: event.currentTarget.checked }))} /></label><div class="entity-danger-zone"><div><strong>Stop repeating</strong><p>This keeps the schedule as read-only history. It cannot be resumed.</p></div><WaButton size="s" appearance="plain" variant="danger" onClick={onStop}>Stop</WaButton></div></>}
      {stopped && onDelete && <div class="entity-danger-zone"><div><strong>Delete Repeating Template</strong><p>Existing Occurrences remain. The stopped schedule itself will be removed forever.</p></div><WaButton size="s" appearance="plain" variant="danger" onClick={onDelete}>Delete</WaButton></div>}
    </div>
    <div slot="footer" class="entity-dialog-actions">{onOpenContents && <WaButton size="s" appearance="plain" onClick={onOpenContents}>Open Template Contents</WaButton>}<WaButton size="s" appearance="plain" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>{stopped ? "Done" : "Cancel"}</WaButton>{!stopped && <WaButton size="s" variant="brand" onClick={() => onSave(draft)}>Save schedule</WaButton>}</div>
  </WaDialog>;
}

export function NewListDialog({ spaces, areas, defaults, onClose, onSubmit }: {
  spaces: Space[];
  areas: Area[];
  defaults: Partial<ListDraft>;
  onClose(): void;
  onSubmit(draft: ListDraft): void;
}) {
  const dialog = useRef<OverlayElement | null>(null);
  const [type, setType] = useState<"project" | "area">(defaults.type || "project");
  const [spaceId, setSpaceId] = useState(defaults.spaceId || spaces[0]?.id || "");
  const [areaId, setAreaId] = useState(defaults.areaId || "");
  const [title, setTitle] = useState(defaults.title || "");
  const visibleAreas = useMemo(() => areas.filter((area) => area.spaceId === spaceId), [areas, spaceId]);
  useWebAwesomeOverlay(dialog, onClose);

  const submit = (event: Event) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    onSubmit({ type, spaceId, areaId: type === "project" ? areaId || null : null, title: cleanTitle });
  };

  return <WaDialog ref={dialog} class="objects-dialog" label="Create a list" light-dismiss>
    <form class="entity-dialog" onSubmit={submit}>
      <p>Use projects for outcomes, areas for ongoing responsibilities, and Spaces for the part of life they belong to.</p>
      <div class="entity-form-grid">
        <WaSelect label="Type" value={type} onChange={(event: Event) => setType((event.currentTarget as HTMLElement & { value: "project" | "area" }).value)}><WaOption value="project">Project</WaOption><WaOption value="area">Area</WaOption></WaSelect>
        <WaSelect label="Space" value={spaceId} onChange={(event: Event) => { setSpaceId((event.currentTarget as HTMLElement & { value: string }).value); setAreaId(""); }}>{spaces.map((space) => <WaOption key={space.id} value={space.id}>{space.title}</WaOption>)}</WaSelect>
        <label class="entity-native-field full">Name<input autoFocus required autoComplete="off" value={title} placeholder="e.g. Plan summer trip" onInput={(event) => setTitle(event.currentTarget.value)} /></label>
        {type === "project" && <WaSelect class="full" label="Area" value={areaId} onChange={(event: Event) => setAreaId((event.currentTarget as HTMLElement & { value: string }).value)}><WaOption value="">No area</WaOption>{visibleAreas.map((area) => <WaOption key={area.id} value={area.id}>{area.title}</WaOption>)}</WaSelect>}
      </div>
    </form>
    <div slot="footer" class="entity-dialog-actions"><WaButton size="s" appearance="plain" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>Cancel</WaButton><WaButton size="s" variant="brand" onClick={() => onSubmit({ type, spaceId, areaId: type === "project" ? areaId || null : null, title: title.trim() })} disabled={!title.trim()}>Create</WaButton></div>
  </WaDialog>;
}

export function HeadingDialog({ heading, parents, initialParent, isTemplate = false, onClose, onSave, onAction }: {
  heading: Heading | null;
  parents: ParentOption[];
  initialParent: string;
  isTemplate?: boolean;
  onClose(): void;
  onSave(title: string, parent: string): void;
  onAction(action: "duplicate" | "convert" | "archive" | "delete"): void;
}) {
  const dialog = useRef<OverlayElement | null>(null);
  const [title, setTitle] = useState(heading?.title || "");
  const [parent, setParent] = useState(initialParent);
  useWebAwesomeOverlay(dialog, onClose);
  return <WaDialog ref={dialog} class="objects-dialog" label={heading ? "Edit heading" : "New heading"} light-dismiss>
    <div class="entity-dialog">
      <p>Headings divide an area or project into clear stages or categories.</p>
      <label class="entity-native-field">Name<input autoFocus required value={title} placeholder="e.g. Preparation" onInput={(event) => setTitle(event.currentTarget.value)} /></label>
      <WaSelect label="Location" value={parent} onChange={(event: Event) => setParent(eventValue(event))}>{parents.map((option) => <WaOption key={option.value} value={option.value}>{option.label}</WaOption>)}</WaSelect>
      {heading && <div class="entity-secondary-actions"><WaButton size="s" appearance="plain" onClick={() => onAction("duplicate")}>Duplicate with to-dos</WaButton>{!isTemplate && <WaButton size="s" appearance="plain" onClick={() => onAction("convert")}>Convert to project</WaButton>}<WaButton size="s" appearance="plain" onClick={() => onAction("archive")}>Archive</WaButton><WaButton size="s" appearance="plain" variant="danger" onClick={() => onAction("delete")}>Delete heading</WaButton></div>}
    </div>
    <div slot="footer" class="entity-dialog-actions"><WaButton size="s" appearance="plain" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>Cancel</WaButton><WaButton size="s" variant="brand" disabled={!title.trim() || !parent} onClick={() => onSave(title.trim(), parent)}>{heading ? "Save" : "Create"}</WaButton></div>
  </WaDialog>;
}

export function ProjectDialog({ project, spaces, areas, archivedHeadings, fallbackRepeatDate, onClose, onSave, onAction, onRestoreHeading }: {
  project: Project;
  spaces: Space[];
  areas: Area[];
  archivedHeadings: Heading[];
  fallbackRepeatDate: string;
  onClose(): void;
  onSave(draft: Project): void;
  onAction(action: "duplicate" | "complete" | "cancel" | "skip" | "restore" | "trash" | "restore-trash" | "delete-forever"): void;
  onRestoreHeading(id: string): void;
}) {
  const dialog = useRef<OverlayElement | null>(null);
  const [draft, setDraft] = useState<Project>({ ...project, tags: [...(project.tags || [])], repeat: project.repeat ? { ...project.repeat, weekdays: [...(project.repeat.weekdays || [])] } : null });
  const update = <K extends keyof Project>(key: K, value: Project[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const trashed = project.status === "trashed";
  useWebAwesomeOverlay(dialog, onClose);
  return <WaDialog ref={dialog} class="objects-dialog dialog-project" label="Project options" light-dismiss>
    <div class="entity-dialog">
      <p>Edit the outcome, move it, duplicate it, or send it to the Logbook.</p>
      <label class="entity-native-field">Name<input autoFocus required value={draft.title} onInput={(event) => update("title", event.currentTarget.value)} /></label>
      <label class="entity-native-field">Notes<textarea rows={4} value={draft.notes || ""} onInput={(event) => update("notes", event.currentTarget.value)} /></label>
      <div class="entity-form-grid">
        <WaSelect label="Space" value={draft.spaceId || ""} onChange={(event: Event) => { const spaceId = eventValue(event); update("spaceId", spaceId); if (draft.areaId && areas.find((area) => area.id === draft.areaId)?.spaceId !== spaceId) update("areaId", null); }}>{spaces.map((space) => <WaOption key={space.id} value={space.id}>{space.title}</WaOption>)}</WaSelect>
        <WaSelect label="Area" value={draft.areaId || ""} onChange={(event: Event) => update("areaId", eventValue(event) || null)}><WaOption value="">No area</WaOption>{areas.filter((area) => !draft.spaceId || area.spaceId === draft.spaceId).map((area) => <WaOption key={area.id} value={area.id}>{area.title}</WaOption>)}</WaSelect>
        <WaSelect label="When" value={draft.bucket} onChange={(event: Event) => update("bucket", eventValue(event) as Project["bucket"])}><WaOption value="anytime">Anytime</WaOption><WaOption value="today">Today</WaOption><WaOption value="upcoming">Upcoming</WaOption><WaOption value="someday">Someday</WaOption></WaSelect>
        <label class="entity-native-field">Start date<input type="date" value={draft.scheduledFor || ""} onInput={(event) => update("scheduledFor", event.currentTarget.value || null)} /></label>
        <label class="entity-native-field">Deadline<input type="date" value={draft.deadline || ""} onInput={(event) => update("deadline", event.currentTarget.value || null)} /></label>
      </div>
      <TagsEditor value={draft.tags || []} onChange={(tags) => update("tags", tags)} />
      {archivedHeadings.length > 0 && <WaDetails summary={`Archived headings (${archivedHeadings.length})`}><div class="entity-secondary-actions">{archivedHeadings.map((heading) => <WaButton size="s" appearance="plain" onClick={() => onRestoreHeading(heading.id)}>Restore {heading.title}</WaButton>)}</div></WaDetails>}
      {!trashed && project.status === "open" && project.repeatTemplateId && <div class="entity-occurrence-note">This is one Project Occurrence. Changes here do not alter its Repeating Template.</div>}
      {!trashed && project.status === "open" && !project.repeatTemplateId && <WaDetails summary={draft.repeat ? "Repeat · On" : "Repeat"}><RepeatEditor value={draft.repeat} fallbackDate={fallbackRepeatDate} onChange={(repeat) => update("repeat", repeat)} /></WaDetails>}
      <div class="entity-secondary-actions">{trashed ? <><WaButton size="s" appearance="plain" onClick={() => onAction("restore-trash")}>Restore project</WaButton><WaButton size="s" appearance="plain" variant="danger" onClick={() => onAction("delete-forever")}>Delete forever</WaButton></> : <><WaButton size="s" appearance="plain" onClick={() => onAction("duplicate")}>Duplicate project</WaButton><WaButton size="s" appearance="plain" onClick={() => onAction(project.status === "open" ? "complete" : "restore")}>{project.status === "open" ? "Complete project" : "Restore project"}</WaButton>{project.status === "open" && project.repeatTemplateId && <WaButton size="s" appearance="plain" onClick={() => onAction("skip")}>Skip Occurrence</WaButton>}{project.status === "open" && <WaButton size="s" appearance="plain" onClick={() => onAction("cancel")}>Cancel project</WaButton>}<WaButton size="s" appearance="plain" variant="danger" onClick={() => onAction("trash")}>Move to Trash</WaButton></>}</div>
    </div>
    <div slot="footer" class="entity-dialog-actions"><WaButton size="s" appearance="plain" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>Cancel</WaButton><WaButton size="s" variant="brand" disabled={!draft.title.trim()} onClick={() => onSave({ ...draft, title: draft.title.trim(), notes: (draft.notes || "").trim() })}>Save</WaButton></div>
  </WaDialog>;
}

export function AreaDialog({ area, spaces, archivedHeadings, onClose, onSave, onAction, onRestoreHeading }: {
  area: Area;
  spaces: Space[];
  archivedHeadings: Heading[];
  onClose(): void;
  onSave(draft: Area): void;
  onAction(action: "new-heading" | "remove"): void;
  onRestoreHeading(id: string): void;
}) {
  const dialog = useRef<OverlayElement | null>(null);
  const [draft, setDraft] = useState<Area>({ ...area, tags: [...(area.tags || [])] });
  const update = <K extends keyof Area>(key: K, value: Area[K]) => setDraft((current) => ({ ...current, [key]: value }));
  useWebAwesomeOverlay(dialog, onClose);
  return <WaDialog ref={dialog} class="objects-dialog" label="Area options" light-dismiss>
    <div class="entity-dialog">
      <p>Areas represent ongoing responsibilities that do not finish.</p>
      <label class="entity-native-field">Name<input autoFocus required value={draft.title} onInput={(event) => update("title", event.currentTarget.value)} /></label>
      <div class="entity-form-grid"><WaSelect label="Space" value={draft.spaceId || ""} onChange={(event: Event) => update("spaceId", eventValue(event))}>{spaces.map((space) => <WaOption key={space.id} value={space.id}>{space.title}</WaOption>)}</WaSelect><label class="entity-native-field">Color<input class="entity-color-input" type="color" value={draft.color || "#5b7cfa"} onInput={(event) => update("color", event.currentTarget.value)} /></label></div>
      <TagsEditor label="Tags inherited by its to-dos" value={draft.tags || []} onChange={(tags) => update("tags", tags)} />
      {archivedHeadings.length > 0 && <WaDetails summary={`Archived headings (${archivedHeadings.length})`}><div class="entity-secondary-actions">{archivedHeadings.map((heading) => <WaButton size="s" appearance="plain" onClick={() => onRestoreHeading(heading.id)}>Restore {heading.title}</WaButton>)}</div></WaDetails>}
      <div class="entity-secondary-actions"><WaButton size="s" appearance="plain" onClick={() => onAction("new-heading")}>New heading</WaButton><WaButton size="s" appearance="plain" variant="danger" onClick={() => onAction("remove")}>Remove area</WaButton></div>
    </div>
    <div slot="footer" class="entity-dialog-actions"><WaButton size="s" appearance="plain" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>Cancel</WaButton><WaButton size="s" variant="brand" disabled={!draft.title.trim()} onClick={() => onSave({ ...draft, title: draft.title.trim() })}>Save</WaButton></div>
  </WaDialog>;
}

export function FinishProjectDialog({ count, onClose, onFinish }: { count: number; onClose(): void; onFinish(status: "completed" | "canceled"): void }) {
  const dialog = useRef<OverlayElement | null>(null);
  useWebAwesomeOverlay(dialog, onClose);
  return <WaDialog ref={dialog} class="objects-dialog" label={`${count} unfinished to-do${count === 1 ? "" : "s"}`}>
    <div class="entity-dialog"><div class="entity-confirm-copy">Things keeps an accurate history by recording whether the remaining work was finished or canceled.</div><div class="entity-completion-actions"><WaButton variant="brand" onClick={() => onFinish("completed")}>Mark all completed</WaButton><WaButton appearance="plain" onClick={() => onFinish("canceled")}>Mark unfinished as canceled</WaButton></div></div>
    <div slot="footer" class="entity-dialog-actions"><WaButton size="s" appearance="plain" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>Keep project open</WaButton></div>
  </WaDialog>;
}

export function BulkTagsDialog({ count, tags, onClose, onSubmit }: { count: number; tags: BulkTagState[]; onClose(): void; onSubmit(states: BulkTagState[], additions: string[]): void }) {
  const dialog = useRef<OverlayElement | null>(null);
  const [states, setStates] = useState(tags);
  const [additions, setAdditions] = useState("");
  useWebAwesomeOverlay(dialog, onClose);
  const toggle = (tag: string) => setStates((current) => current.map((item) => item.tag === tag ? { ...item, state: item.state === "all" ? "none" : "all" } : item));
  return <WaDialog ref={dialog} class="objects-dialog" label={`Tag ${count} to-do${count === 1 ? "" : "s"}`} light-dismiss>
    <div class="entity-dialog">
      <p>A filled tag will be applied to every selected to-do. A mixed tag stays unchanged until you click it.</p>
      <div class="entity-bulk-tags">{states.length ? states.map((item) => <WaButton key={item.tag} size="s" appearance={item.state === "all" ? "filled" : "outlined"} variant={item.state === "mixed" ? "neutral" : item.state === "all" ? "brand" : "neutral"} aria-pressed={item.state === "all"} onClick={() => toggle(item.tag)}>{item.state === "mixed" ? "— " : item.state === "all" ? "✓ " : ""}{item.tag}</WaButton>) : <span class="entity-empty-note">No tags yet.</span>}</div>
      <label class="entity-native-field">Add new tags<input value={additions} placeholder="Errand, Focused" onInput={(event) => setAdditions(event.currentTarget.value)} /></label>
    </div>
    <div slot="footer" class="entity-dialog-actions"><WaButton size="s" appearance="plain" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>Cancel</WaButton><WaButton size="s" variant="brand" onClick={() => onSubmit(states, additions.split(",").map((tag) => tag.trim()).filter(Boolean))}>Apply tags</WaButton></div>
  </WaDialog>;
}

export function SpaceSwitcherDialog({ spaces, activeId, onClose, onChoose, onManage }: { spaces: Space[]; activeId: string; onClose(): void; onChoose(id: string): void; onManage(): void }) {
  const dialog = useRef<OverlayElement | null>(null);
  useWebAwesomeOverlay(dialog, onClose);
  const options = [{ id: "all", title: "All", color: "#85878b" }, ...spaces];
  return <WaDialog ref={dialog} class="objects-dialog" label="Choose a Space" light-dismiss>
    <div class="entity-dialog"><p>Quick Find remains available across every Space.</p><div class="entity-space-list">{options.map((space) => <button key={space.id} type="button" class={activeId === space.id ? "active" : ""} aria-pressed={activeId === space.id} onClick={() => onChoose(space.id)}><i style={{ "--entity-space-color": space.color }} /><span>{space.title}</span>{activeId === space.id && <b aria-hidden="true">✓</b>}</button>)}</div></div>
    <div slot="footer" class="entity-space-footer"><WaButton size="s" appearance="plain" onClick={onManage}>Spaces & launch rules</WaButton><WaButton size="s" variant="brand" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>Done</WaButton></div>
  </WaDialog>;
}

export function SpacesSettingsDialog({ initial, onClose, onSave, onDeleteSpace, makeSpace, makeRule }: {
  initial: SpaceSettingsDraft;
  onClose(): void;
  onSave(draft: SpaceSettingsDraft): void;
  onDeleteSpace(id: string, draft: SpaceSettingsDraft): void;
  makeSpace(index: number, pinned: boolean): Space;
  makeRule(index: number, spaceId: string): LaunchRule;
}) {
  const dialog = useRef<OverlayElement | null>(null);
  const [spaces, setSpaces] = useState(initial.spaces.map((space) => ({ ...space })));
  const [rules, setRules] = useState(initial.rules.map((rule) => ({ ...rule, weekdays: [...rule.weekdays] })));
  const enabled = useRef(initial.enabled);
  const launchSwitch = useRef<ValueElement | null>(null);
  const [defaultId, setDefaultId] = useState(initial.defaultId || initial.spaces[0]?.id || null);
  useWebAwesomeOverlay(dialog, onClose);
  useWebAwesomeChecked(launchSwitch, initial.enabled);
  const draft = (): SpaceSettingsDraft => ({ spaces, rules, enabled: enabled.current, defaultId });
  const updateSpace = (id: string, patch: Partial<Space>) => setSpaces((current) => current.map((space) => space.id === id ? { ...space, ...patch } : space));
  const updateRule = (id: string, patch: Partial<LaunchRule>) => setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  const pinnedCount = spaces.filter((space) => space.pinned).length;
  return <WaDialog ref={dialog} class="objects-dialog dialog-spaces" label="Spaces & launch rules" light-dismiss>
    <div class="entity-dialog spaces-editor">
      <p>Set up your Spaces, then tell Objects which one to use when it opens.</p>
      <section class="spaces-editor-section"><header><h3>Spaces</h3><span>{pinnedCount} of 2 sidebar pins used</span></header><div class="spaces-editor-grid">{spaces.map((space) => <div key={space.id} class="spaces-editor-card">
        <input class="spaces-editor-color" type="color" value={space.color} aria-label={`${space.title} color`} onInput={(event) => updateSpace(space.id, { color: event.currentTarget.value })} />
        <input class="spaces-editor-name" value={space.title} maxLength={40} aria-label="Space name" onInput={(event) => updateSpace(space.id, { title: event.currentTarget.value })} />
        <SpacePinCheckbox space={space} disabled={!space.pinned && pinnedCount >= 2} onChange={(checked) => updateSpace(space.id, { pinned: checked })} />
        <WaButton size="s" appearance="plain" variant="danger" disabled={spaces.length < 2} aria-label={`Delete ${space.title}`} onClick={() => onDeleteSpace(space.id, draft())}>Delete</WaButton>
      </div>)}<button class="spaces-editor-add" type="button" onClick={() => setSpaces((current) => [...current, makeSpace(current.length, current.filter((space) => space.pinned).length < 2)])}>＋ Add Space</button></div></section>
      <section class="spaces-editor-section"><header><h3>Default behavior</h3></header><div class="spaces-default-row"><WaSwitch ref={launchSwitch} onInput={(event: Event) => { enabled.current = eventChecked(event); }}>Use launch rules on this device</WaSwitch><WaSelect label="If no rule matches, use" value={defaultId || ""} onChange={(event: Event) => setDefaultId(eventValue(event))}>{spaces.map((space) => <WaOption key={space.id} value={space.id}>{space.title}</WaOption>)}</WaSelect></div><p class="spaces-editor-help">This preference is saved only on this device. Rules run when Objects opens or reloads; manual choices last until then.</p></section>
      <section class="spaces-editor-section"><header><h3>Launch rules</h3></header><div class="spaces-rules">{rules.map((rule) => <div key={rule.id} class="spaces-rule-card">
        <WaSelect label="At launch, use" value={rule.spaceId} onChange={(event: Event) => updateRule(rule.id, { spaceId: eventValue(event) })}>{spaces.map((space) => <WaOption key={space.id} value={space.id}>{space.title}</WaOption>)}</WaSelect>
        <div class="spaces-rule-days"><span>On</span><WeekdayPicker value={rule.weekdays} onChange={(weekdays) => updateRule(rule.id, { weekdays })} /></div>
        <label class="entity-native-field">From<input type="time" value={rule.start} onInput={(event) => updateRule(rule.id, { start: event.currentTarget.value })} /></label>
        <label class="entity-native-field">To<input type="time" value={rule.end} onInput={(event) => updateRule(rule.id, { end: event.currentTarget.value })} /></label>
        <WaButton size="s" appearance="plain" variant="danger" aria-label="Delete launch rule" onClick={() => setRules((current) => current.filter((candidate) => candidate.id !== rule.id))}>Delete rule</WaButton>
      </div>)}</div><WaButton size="s" appearance="outlined" onClick={() => setRules((current) => [...current, makeRule(current.length, spaces.find((space) => space.id !== defaultId)?.id || spaces[0]?.id || "")])}>Add launch rule</WaButton></section>
    </div>
    <div slot="footer" class="entity-dialog-actions"><WaButton size="s" appearance="plain" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>Cancel</WaButton><WaButton size="s" variant="brand" onClick={() => onSave(draft())}>Save changes</WaButton></div>
  </WaDialog>;
}

export function MoveTasksDialog({ count, options, initialValue, onClose, onSubmit }: {
  count: number;
  options: MoveDestinationOption[];
  initialValue: string;
  onClose(): void;
  onSubmit(destination: string, newProjectTitle: string): void;
}) {
  const dialog = useRef<OverlayElement | null>(null);
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState(initialValue || options[0]?.value || "inbox");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const filtered = useMemo(() => {
    const tokens = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return tokens.length ? options.filter((option) => tokens.every((token) => option.label.toLocaleLowerCase().includes(token))) : options;
  }, [options, query]);
  useWebAwesomeOverlay(dialog, onClose);

  return <WaDialog ref={dialog} class="objects-dialog" label={`Move ${count === 1 ? "to-do" : `${count} to-dos`}`} light-dismiss>
    <div class="entity-dialog">
      <p>Move {count === 1 ? "it" : "them"} to the Inbox, an area, a project, or directly under a heading.</p>
      <label class="entity-native-field">Find a destination<input type="search" autoComplete="off" value={query} placeholder="Area, project, or heading" onInput={(event) => setQuery(event.currentTarget.value)} /></label>
      <label class="entity-native-field">Destination<select size={Math.min(7, Math.max(3, filtered.length))} value={destination} onChange={(event) => setDestination(event.currentTarget.value)}>{filtered.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label class="entity-native-field">Or create a new project<input value={newProjectTitle} placeholder="New project name" onInput={(event) => setNewProjectTitle(event.currentTarget.value)} /></label>
    </div>
    <div slot="footer" class="entity-dialog-actions"><WaButton size="s" appearance="plain" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>Cancel</WaButton><WaButton size="s" variant="brand" onClick={() => onSubmit(destination, newProjectTitle.trim())}>Move</WaButton></div>
  </WaDialog>;
}

export function ConfirmDialog({ title, message, label, danger = false, onClose, onConfirm }: {
  title: string;
  message: string;
  label: string;
  danger?: boolean;
  onClose(): void;
  onConfirm(): void;
}) {
  const dialog = useRef<OverlayElement | null>(null);
  useWebAwesomeOverlay(dialog, onClose);
  return <WaDialog ref={dialog} class="objects-dialog" label={title}>
    <div class="entity-dialog"><div class={danger ? "entity-danger-copy" : "entity-confirm-copy"}>{message}</div></div>
    <div slot="footer" class="entity-dialog-actions entity-confirm-actions"><WaButton size="s" appearance="plain" onClick={(event: Event) => hideWebAwesomeOverlay(event, onClose)}>Cancel</WaButton><WaButton size="s" variant={danger ? "danger" : "brand"} onClick={() => { onClose(); onConfirm(); }}>{label}</WaButton></div>
  </WaDialog>;
}
