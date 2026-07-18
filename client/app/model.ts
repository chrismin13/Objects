import type {
  Area,
  Bucket,
  ObjectsState,
  Project,
  RepeatRule,
  Task,
} from "../../shared/state";

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
  bucket: Bucket | null;
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

const NATURAL_DATE_SOURCE = [
  "tod(?:ay)?", "tom(?:orrow)?", "tonight", "this\\s+eve(?:ning)?", "eve(?:ning)?", "next\\s+week", "someday",
  "\\d+\\s*(?:d|days?|w|weeks?|mo|months?|y|years?)\\s+from\\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s*\\d{1,2}",
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s*\\d{1,2}\\s*\\+\\s*\\d+\\s*(?:d|days?|w|weeks?|mo|months?|y|years?)",
  "(?:\\d+(?:st|nd|rd|th)|last)\\s+(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)\\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\\s+\\d{4})?",
  "(?:in\\s+)?\\d+\\s*(?:d|days?|w|weeks?|mo|months?|y|years?)",
  "(?:next\\s+)?(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)",
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s*\\d{1,2}(?:,?\\s*\\d{4})?",
  "\\d{4}-\\d{2}-\\d{2}", "\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?",
].join("|");

function naturalTime(hourValue: string, minuteValue = "0", meridiemValue = ""): string | null {
  let hour = Number(hourValue);
  const minute = Number(minuteValue || 0);
  const meridiem = meridiemValue.toLowerCase();
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return null;
  if (meridiem.startsWith("p") && hour < 12) hour += 12;
  if (meridiem.startsWith("a") && hour === 12) hour = 0;
  if (hour > 23 || (meridiem && Number(hourValue) > 12)) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function offsetNaturalDate(day: string, amountValue: string, unitValue: string): string | null {
  const amount = Number(amountValue);
  const unit = unitValue.toLowerCase();
  const date = new Date(`${day}T12:00:00`);
  if (!Number.isFinite(amount) || Number.isNaN(date.getTime())) return null;
  if (/^d/.test(unit)) date.setDate(date.getDate() + amount);
  else if (/^w/.test(unit)) date.setDate(date.getDate() + amount * 7);
  else if (/^mo/.test(unit)) {
    const targetDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(Math.min(targetDay, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  } else {
    const month = date.getMonth();
    const targetDay = date.getDate();
    date.setDate(1);
    date.setFullYear(date.getFullYear() + amount);
    date.setMonth(month);
    date.setDate(Math.min(targetDay, new Date(date.getFullYear(), month + 1, 0).getDate()));
  }
  return localDay(date);
}

function nextWeekday(name: string, today: string): string | null {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const normalized = days.find((day) => day.startsWith(name.slice(0, 3))) || name;
  const target = days.indexOf(normalized);
  if (target < 0) return null;
  const date = new Date(`${today}T12:00:00`);
  let distance = (target - date.getDay() + 7) % 7;
  if (distance === 0) distance = 7;
  return addDays(today, distance);
}

export function parseNaturalDate(phrase: string | null | undefined, today = localDay(), weekStartsOn: 0 | 1 = 1): string | null {
  const value = String(phrase || "").trim().toLowerCase().replace(/,/g, "").replace(/\s+/g, " ");
  const relativeFrom = value.match(/^(\d+)\s*(d|days?|w|weeks?|mo|months?|y|years?)\s+from\s+(.+)$/);
  if (relativeFrom) {
    const base = parseNaturalDate(relativeFrom[3], today, weekStartsOn);
    return base ? offsetNaturalDate(base, relativeFrom[1], relativeFrom[2]) : null;
  }
  const relativePlus = value.match(/^(.+?)\s*\+\s*(\d+)\s*(d|days?|w|weeks?|mo|months?|y|years?)$/);
  if (relativePlus) {
    const base = parseNaturalDate(relativePlus[1], today, weekStartsOn);
    return base ? offsetNaturalDate(base, relativePlus[2], relativePlus[3]) : null;
  }
  if (["today", "tod", "tonight", "evening", "eve", "this evening", "this eve"].includes(value)) return today;
  if (["tomorrow", "tom"].includes(value)) return addDays(today, 1);
  if (value === "next week") {
    const date = new Date(`${today}T12:00:00`);
    let distance = (weekStartsOn - date.getDay() + 7) % 7;
    if (distance === 0) distance = 7;
    return addDays(today, distance);
  }
  const weekday = value.match(/^(?:next\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)$/);
  if (weekday) return nextWeekday(weekday[1], today);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const candidate = new Date(`${value}T12:00:00`);
    return Number.isNaN(candidate.getTime()) || localDay(candidate) !== value ? null : value;
  }
  const ordinalWeekday = value.match(/^(?:(\d+)(?:st|nd|rd|th)|(last))\s+(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?$/);
  if (ordinalWeekday) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const month = months.indexOf(ordinalWeekday[4].slice(0, 3));
    const targetDay = days.findIndex((day) => day.startsWith(ordinalWeekday[3].slice(0, 3)));
    const explicitYear = Number(ordinalWeekday[5]) || null;
    let year = explicitYear || new Date(`${today}T12:00:00`).getFullYear();
    const calculate = (): Date | null => {
      if (ordinalWeekday[2]) {
        const candidate = new Date(year, month + 1, 0, 12);
        candidate.setDate(candidate.getDate() - ((candidate.getDay() - targetDay + 7) % 7));
        return candidate;
      }
      const candidate = new Date(year, month, 1, 12);
      candidate.setDate(1 + ((targetDay - candidate.getDay() + 7) % 7) + (Number(ordinalWeekday[1]) - 1) * 7);
      return candidate.getMonth() === month ? candidate : null;
    };
    let candidate = calculate();
    if (!explicitYear && candidate && localDay(candidate) < today) {
      year += 1;
      candidate = calculate();
    }
    return candidate ? localDay(candidate) : null;
  }
  const namedDate = value.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:\s*(\d{4}))?$/);
  if (namedDate) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = months.indexOf(namedDate[1].slice(0, 3));
    const explicitYear = Number(namedDate[3]) || null;
    const candidate = new Date(explicitYear || new Date(`${today}T12:00:00`).getFullYear(), month, Number(namedDate[2]), 12);
    if (!explicitYear && localDay(candidate) < today) candidate.setFullYear(candidate.getFullYear() + 1);
    return localDay(candidate);
  }
  const numericDate = value.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (numericDate) {
    const currentYear = new Date(`${today}T12:00:00`).getFullYear();
    let year = Number(numericDate[3]) || currentYear;
    if (year < 100) year += 2000;
    const candidate = new Date(year, Number(numericDate[1]) - 1, Number(numericDate[2]), 12);
    if (!numericDate[3] && localDay(candidate) < today) candidate.setFullYear(candidate.getFullYear() + 1);
    return localDay(candidate);
  }
  const relative = value.match(/^(?:in\s+)?(\d+)\s*(d|days?|w|weeks?|mo|months?|y|years?)$/);
  return relative ? offsetNaturalDate(today, relative[1], relative[2]) : null;
}

export function parseNaturalTask(raw: string, today = localDay(), weekStartsOn: 0 | 1 = 1): ParsedTask {
  let title = raw.trim();
  const result: ParsedTask = { title, bucket: null, scheduledFor: null, evening: false, reminderAt: null, deadline: null, tags: [] };
  result.tags = [...title.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1]);
  title = title.replace(/(?:^|\s)#[\p{L}\p{N}_-]+/gu, " ").replace(/\s+/g, " ").trim();

  const deadlineMatch = title.match(new RegExp(`\\s(?:deadline|due)\\s+(${NATURAL_DATE_SOURCE})(?=\\s|$)`, "i"));
  if (deadlineMatch) {
    result.deadline = parseNaturalDate(deadlineMatch[1], today, weekStartsOn) || deadlineMatch[1];
    title = title.replace(deadlineMatch[0], "").trim();
  }
  const dateMatch = title.match(new RegExp(`\\s(${NATURAL_DATE_SOURCE})(?:\\s+(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(a|am|p|pm)?)?\\s*$`, "i"));
  if (dateMatch) {
    const phrase = dateMatch[1].toLowerCase();
    if (phrase === "someday") result.bucket = "someday";
    else {
      result.scheduledFor = parseNaturalDate(phrase, today, weekStartsOn);
      result.bucket = result.scheduledFor === today ? "today" : "upcoming";
      result.evening = ["tonight", "evening", "eve", "this evening", "this eve"].includes(phrase);
    }
    if (dateMatch[2] && result.scheduledFor) {
      const time = naturalTime(dateMatch[2], dateMatch[3], dateMatch[4]);
      if (time) result.reminderAt = `${result.scheduledFor}T${time}`;
    }
    title = title.replace(dateMatch[0], "").trim();
  }
  if (!result.reminderAt) {
    const timeOnly = title.match(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a|am|p|pm)\s*$/i);
    if (timeOnly) {
      const time = naturalTime(timeOnly[1], timeOnly[2], timeOnly[3]);
      if (time) {
        result.scheduledFor = today;
        result.bucket = "today";
        result.reminderAt = `${today}T${time}`;
        title = title.replace(timeOnly[0], "").trim();
      }
    }
  }
  result.title = title || raw.trim();
  return result;
}
