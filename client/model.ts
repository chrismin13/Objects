import type {
  Area,
  Bucket,
  ObjectsState,
  Project,
  RepeatRule,
  Task,
} from "../shared/state";

export type ViewType =
  | "inbox" | "today" | "upcoming" | "anytime" | "someday"
  | "logbook" | "trash" | "deadlines" | "repeating"
  | "allProjects" | "project" | "area" | "tag";

export type View = { type: ViewType; id?: string | null };
export type EntityKind = "spaces" | "areas" | "projects" | "headings" | "calendarEvents" | "tasks";
export type ChangeSet = {
  mutationId: string;
  settings: Record<string, unknown>;
  entities: Partial<Record<EntityKind, Array<{ id: string; patch: Record<string, unknown> }>>>;
  deletes: Partial<Record<EntityKind, string[]>>;
};

export type ParsedTask = {
  title: string;
  bucket: Bucket;
  scheduledFor: string | null;
  deadline: string | null;
  evening: boolean;
  reminderAt: string | null;
  tags: string[];
};

const ENTITY_KINDS: EntityKind[] = ["spaces", "areas", "projects", "headings", "calendarEvents", "tasks"];

export function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function localDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDay(date);
}

export function formatDate(day: string | null, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  if (!day) return "";
  const date = new Date(`${day.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? day : new Intl.DateTimeFormat(undefined, options).format(date);
}

export function relativeDate(day: string | null): string {
  if (!day) return "";
  const today = localDay();
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  if (day === addDays(today, -1)) return "Yesterday";
  return formatDate(day, { weekday: "short", month: "short", day: "numeric" });
}

export function normalizeState(input: ObjectsState): ObjectsState {
  const state = cloneState(input);
  state.version = 7;
  state.settings = {
    theme: "system",
    groupToday: true,
    notifications: false,
    weekStartsOn: 1,
    showCalendar: true,
    logCompletedItems: "daily",
    tags: [],
    defaultSpaceId: null,
    ...(state.settings || {}),
  };
  state.spaces ||= [];
  state.areas ||= [];
  state.projects ||= [];
  state.headings ||= [];
  state.calendarEvents ||= [];
  state.tasks ||= [];
  state.spaces.forEach((space, index) => {
    space.color ||= "#f0a33b";
    space.pinned ??= index < 2;
    space.order ??= index;
  });
  state.areas.forEach((area, index) => {
    area.spaceId ??= null;
    area.color ||= "#5b7cfa";
    area.tags ||= [];
    area.order ??= index;
  });
  state.projects.forEach((project, index) => {
    project.spaceId ??= null;
    project.areaId ??= null;
    project.notes ||= "";
    project.bucket ||= "anytime";
    project.scheduledFor ??= null;
    project.deadline ??= null;
    project.tags ||= [];
    project.status ||= "open";
    project.repeat ??= null;
    project.completedAt ??= null;
    project.order ??= index;
  });
  state.headings.forEach((heading, index) => {
    heading.archived ??= false;
    heading.order ??= index;
  });
  state.calendarEvents.forEach((event, index) => {
    event.spaceId ??= null;
    event.calendar ||= "Objects";
    event.end ||= event.start;
    event.order ??= index;
  });
  state.tasks.forEach((task, index) => {
    task.spaceId ??= null;
    task.notes ||= "";
    task.status ||= "open";
    task.bucket ||= "inbox";
    task.scheduledFor ??= null;
    task.evening ??= false;
    task.reminderAt ??= null;
    task.deadline ??= null;
    task.projectId ??= null;
    task.headingId ??= null;
    task.areaId ??= null;
    task.tags ||= [];
    task.checklist ||= [];
    task.repeat ??= null;
    task.createdAt ||= new Date().toISOString();
    task.completedAt ??= null;
    task.order ??= index;
  });
  return state;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function patchRecord(previous: Record<string, unknown> = {}, current: Record<string, unknown> = {}): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    if (key === "id" || current[key] === undefined || same(previous[key], current[key])) continue;
    patch[key] = current[key];
  }
  return patch;
}

export function buildChangeSet(previous: ObjectsState, current: ObjectsState): ChangeSet | null {
  const changes: ChangeSet = { mutationId: uid("mutation"), settings: {}, entities: {}, deletes: {} };
  changes.settings = patchRecord(previous.settings, current.settings);
  let changed = Object.keys(changes.settings).length > 0;
  for (const kind of ENTITY_KINDS) {
    const before = new Map((previous[kind] as Array<{ id: string }>).map((item) => [item.id, item]));
    const after = new Map((current[kind] as Array<{ id: string }>).map((item) => [item.id, item]));
    const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
    for (const [id, item] of after) {
      const old = before.get(id);
      const patch = old
        ? patchRecord(old as unknown as Record<string, unknown>, item as unknown as Record<string, unknown>)
        : patchRecord({}, item as unknown as Record<string, unknown>);
      if (Object.keys(patch).length) patches.push({ id, patch });
    }
    const deleted = [...before.keys()].filter((id) => !after.has(id));
    if (patches.length) { changes.entities[kind] = patches; changed = true; }
    if (deleted.length) { changes.deletes[kind] = deleted; changed = true; }
  }
  return changed ? changes : null;
}

function mergeRecord<T extends { id?: string }>(previous: T | undefined, local: T | undefined, remote: T | undefined): T | undefined {
  if (!remote) return previous ? undefined : local ? cloneState(local) : undefined;
  if (!local) return previous ? undefined : cloneState(remote);
  const merged: Record<string, unknown> = { id: remote.id || local.id };
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(local), ...Object.keys(remote)]);
  for (const key of keys) {
    if (key === "id") continue;
    const localValue = (local as Record<string, unknown>)[key];
    const previousValue = (previous as Record<string, unknown> | undefined)?.[key];
    const remoteValue = (remote as Record<string, unknown>)[key];
    const value = !same(localValue, previousValue) ? localValue : remoteValue;
    if (value !== undefined) merged[key] = cloneState(value);
  }
  return merged as T;
}

function mergeCollection<T extends { id: string }>(previous: T[], local: T[], remote: T[]): T[] {
  const before = new Map(previous.map((item) => [item.id, item]));
  const ours = new Map(local.map((item) => [item.id, item]));
  const theirs = new Map(remote.map((item) => [item.id, item]));
  const result: T[] = [];
  for (const id of new Set([...before.keys(), ...ours.keys(), ...theirs.keys()])) {
    const item = mergeRecord(before.get(id), ours.get(id), theirs.get(id));
    if (item) result.push(item);
  }
  return result;
}

export function mergeRemoteState(previous: ObjectsState, local: ObjectsState, remoteInput: ObjectsState): ObjectsState {
  const remote = normalizeState(remoteInput);
  const settings = mergeRecord(
    { id: "settings", ...previous.settings },
    { id: "settings", ...local.settings },
    { id: "settings", ...remote.settings },
  ) as Record<string, unknown>;
  delete settings.id;
  return normalizeState({
    ...remote,
    settings: settings as ObjectsState["settings"],
    spaces: mergeCollection(previous.spaces, local.spaces, remote.spaces),
    areas: mergeCollection(previous.areas, local.areas, remote.areas),
    projects: mergeCollection(previous.projects, local.projects, remote.projects),
    headings: mergeCollection(previous.headings, local.headings, remote.headings),
    calendarEvents: mergeCollection(previous.calendarEvents, local.calendarEvents, remote.calendarEvents),
    tasks: mergeCollection(previous.tasks, local.tasks, remote.tasks),
  });
}

export function isLogged(item: Task | Project): boolean {
  return (item.status === "completed" || item.status === "canceled") && Boolean(item.loggedAt);
}

export function isTrashed(item: Task | Project): boolean {
  return item.status === "trashed";
}

export function projectById(state: ObjectsState, id: string | null | undefined): Project | undefined {
  return state.projects.find((project) => project.id === id);
}

export function areaById(state: ObjectsState, id: string | null | undefined): Area | undefined {
  return state.areas.find((area) => area.id === id);
}

export function itemSpaceId(state: ObjectsState, item: { spaceId?: string | null; projectId?: string | null; areaId?: string | null }): string | null {
  const project = projectById(state, item.projectId);
  if (project) return areaById(state, project.areaId)?.spaceId ?? project.spaceId ?? null;
  const area = areaById(state, item.areaId);
  return area?.spaceId ?? item.spaceId ?? null;
}

export function inSpace(state: ObjectsState, item: { spaceId?: string | null; projectId?: string | null; areaId?: string | null }, spaceId: string): boolean {
  return spaceId === "all" || itemSpaceId(state, item) === spaceId;
}

export function effectiveTags(state: ObjectsState, task: Task): string[] {
  const area = areaById(state, task.areaId);
  const project = projectById(state, task.projectId);
  return [...new Set([...(area?.tags || []), ...(project?.tags || []), ...(task.tags || [])])];
}

export function projectProgress(state: ObjectsState, projectId: string): number {
  const tasks = state.tasks.filter((task) => task.projectId === projectId && !isTrashed(task));
  if (!tasks.length) return 0;
  return Math.round(tasks.filter((task) => task.status === "completed").length / tasks.length * 100);
}

export function nextRepeatDate(fromDay: string, repeat: RepeatRule): string {
  const interval = Math.max(1, Number(repeat.interval) || 1);
  if (repeat.frequency === "daily") return addDays(fromDay, interval);
  if (repeat.frequency === "weekly") {
    const weekdays = [...new Set(repeat.weekdays || [])].sort();
    if (weekdays.length) {
      const from = new Date(`${fromDay}T12:00:00`);
      for (let offset = 1; offset <= 7 * interval; offset += 1) {
        const candidate = addDays(fromDay, offset);
        const day = new Date(`${candidate}T12:00:00`).getDay();
        if (weekdays.includes(day) && (offset <= 7 || Math.ceil(offset / 7) === interval)) return candidate;
      }
    }
    return addDays(fromDay, 7 * interval);
  }
  const date = new Date(`${fromDay}T12:00:00`);
  if (repeat.frequency === "monthly") date.setMonth(date.getMonth() + interval);
  else date.setFullYear(date.getFullYear() + interval);
  return localDay(date);
}

export function materializeRepeats(input: ObjectsState, today = localDay()): ObjectsState {
  const state = cloneState(input);
  let changed = false;
  for (const template of state.tasks.filter((task) => task.status === "open" && task.repeat && !task.repeat.paused)) {
    let next = template.repeat!.nextDate || template.scheduledFor || today;
    let guard = 0;
    while (next <= today && guard < 50) {
      const existing = state.tasks.some((task) => task.id !== template.id && task.repeatTemplateId === template.id && task.scheduledFor === next);
      if (!existing) {
        state.tasks.push({
          ...cloneState(template),
          id: uid("task"),
          repeat: null,
          repeatTemplateId: template.id,
          scheduledFor: next,
          bucket: next <= today ? "today" : "upcoming",
          reminderAt: template.repeat!.reminderTime ? `${next}T${template.repeat!.reminderTime}` : null,
          createdAt: new Date().toISOString(),
          order: Date.now() + guard,
        } as Task);
        changed = true;
      }
      next = nextRepeatDate(next, template.repeat!);
      guard += 1;
    }
    if (template.repeat!.nextDate !== next) { template.repeat!.nextDate = next; changed = true; }
  }
  if (changed) state.updatedAt = new Date().toISOString();
  return state;
}

export function applyLogbookPolicy(input: ObjectsState, now = new Date()): ObjectsState {
  const state = cloneState(input);
  const policy = state.settings.logCompletedItems;
  const today = localDay(now);
  for (const item of [...state.tasks, ...state.projects]) {
    if (!item.completedAt || item.status === "open" || item.status === "trashed" || item.loggedAt) continue;
    const completedLocalDay = localDay(new Date(item.completedAt));
    if (policy === "immediately" || (policy === "daily" && completedLocalDay < today)) item.loggedAt = item.completedAt;
  }
  return state;
}

export function parseNaturalTask(raw: string): ParsedTask {
  const today = localDay();
  let title = raw.trim();
  const tags = [...title.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1]);
  title = title.replace(/(?:^|\s)#[\p{L}\p{N}_-]+/gu, " ").replace(/\s+/g, " ").trim();
  let bucket: Bucket = "inbox";
  let scheduledFor: string | null = null;
  let deadline: string | null = null;
  let evening = false;
  let reminderAt: string | null = null;

  const dateForPhrase = (phrase: string): string | null => {
    const value = phrase.toLowerCase().trim();
    if (value === "today") return today;
    if (value === "tomorrow") return addDays(today, 1);
    const offset = value.match(/^in (\d+) (day|days|week|weeks)$/);
    if (offset) return addDays(today, Number(offset[1]) * (offset[2].startsWith("week") ? 7 : 1));
    const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(value.replace(/^next /, ""));
    if (weekday >= 0) {
      const current = new Date(`${today}T12:00:00`).getDay();
      let distance = (weekday - current + 7) % 7 || 7;
      if (value.startsWith("next ")) distance += 7;
      return addDays(today, distance);
    }
    return null;
  };

  const dueMatch = title.match(/\bdue (today|tomorrow|in \d+ (?:days?|weeks?)|(?:next )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i);
  if (dueMatch) {
    deadline = dateForPhrase(dueMatch[1]);
    title = title.replace(dueMatch[0], "").replace(/\s+/g, " ").trim();
  }
  const whenMatch = title.match(/\b(today|tomorrow|this evening|someday|in \d+ (?:days?|weeks?)|(?:next )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i);
  if (whenMatch) {
    const phrase = whenMatch[1].toLowerCase();
    if (phrase === "someday") bucket = "someday";
    else {
      evening = phrase === "this evening";
      scheduledFor = evening ? today : dateForPhrase(phrase);
      bucket = scheduledFor === today ? "today" : "upcoming";
    }
    title = title.replace(whenMatch[0], "").replace(/\s+/g, " ").trim();
  }
  const timeMatch = title.match(/\b(?:at )?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch && scheduledFor) {
    let hour = Number(timeMatch[1]);
    if (timeMatch[3].toLowerCase() === "pm" && hour < 12) hour += 12;
    if (timeMatch[3].toLowerCase() === "am" && hour === 12) hour = 0;
    reminderAt = `${scheduledFor}T${String(hour).padStart(2, "0")}:${timeMatch[2] || "00"}`;
    title = title.replace(timeMatch[0], "").replace(/\s+/g, " ").trim();
  }
  return { title: title || raw.trim(), bucket, scheduledFor, deadline, evening, reminderAt, tags };
}
