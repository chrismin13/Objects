import type {
  Area,
  CalendarEvent,
  ChecklistItem,
  Heading,
  IsoDateTime,
  Outcome,
  Project,
  ProjectLocation,
  RepeatingTemplate,
  Schedule,
  Space,
  Tag,
  ToDo,
  ToDoLocation,
  WorkspaceDocument,
  WorkspaceEntityKind,
} from "./model.ts";
import {
  FULL_IMPORT_CONFIRMATION,
  PERMANENT_DELETE_CONFIRMATION,
  createWorkspace,
  exportPortableBackup,
  type Workspace,
  type WorkspaceChange,
  type WorkspaceDependencies,
} from "./workspace.ts";
import { parseDirectTarget } from "./discovery.ts";
import { addDaysToDate } from "./dates.ts";

type JsonRecord = Record<string, unknown>;

export type InterfaceChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

export type InterfaceEntity = JsonRecord & {
  id: string;
  title: string;
  order?: number;
};

export type InterfaceToDo = InterfaceEntity & {
  notes: string;
  status: string;
  previousStatus?: string | null;
  bucket: string;
  scheduledFor: string | null;
  evening: boolean;
  reminderAt: string | null;
  reminderSentAt: string | null;
  deadline: string | null;
  projectId: string | null;
  headingId: string | null;
  areaId: string | null;
  spaceId: string | null;
  tags: string[];
  checklist: InterfaceChecklistItem[];
  repeat: JsonRecord | null;
  repeatTemplateId?: string | null;
  createdAt: string;
  completedAt: string | null;
  loggedAt: string | null;
  trashedAt?: string | null;
  workspaceTemplate?: boolean;
};

export type InterfaceState = {
  version: number;
  updatedAt: string;
  syncMutationId: string | null;
  settings: JsonRecord & { tags: string[]; spaceSchedule: { rules: JsonRecord[] } };
  spaces: InterfaceEntity[];
  areas: InterfaceEntity[];
  projects: InterfaceEntity[];
  headings: InterfaceEntity[];
  calendarEvents: InterfaceEntity[];
  tasks: InterfaceToDo[];
};

export type InterfaceChangeSet = {
  mutationId: string;
  settings?: JsonRecord;
  entities?: Partial<Record<"spaces" | "areas" | "projects" | "headings" | "calendarEvents" | "tasks", Array<{ id: string; patch: JsonRecord }>>>;
  deletes?: Partial<Record<"spaces" | "areas" | "projects" | "headings" | "calendarEvents" | "tasks", string[]>>;
};

export type InterfaceBridgeResult =
  | { ok: true; document: WorkspaceDocument }
  | { ok: false; errors: string[] };

const COLLECTIONS = ["spaces", "areas", "projects", "headings", "calendarEvents", "tasks"] as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function localDateTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function durableDateTime(value: unknown): string | null {
  const text = optionalString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function scheduleToInterface(schedule: Schedule, today: string): Pick<InterfaceToDo, "bucket" | "scheduledFor" | "evening"> {
  if (schedule.kind === "scheduled") {
    return {
      bucket: schedule.date <= today ? "today" : "upcoming",
      scheduledFor: schedule.date,
      evening: schedule.evening,
    };
  }
  return { bucket: schedule.kind, scheduledFor: null, evening: false };
}

function interfaceSchedule(item: JsonRecord): Schedule {
  const date = optionalString(item.scheduledFor);
  if (date) return { kind: "scheduled", date, evening: Boolean(item.evening) };
  const bucket = stringValue(item.bucket, "inbox");
  if (bucket === "anytime" || bucket === "someday") return { kind: bucket };
  return { kind: "inbox" };
}

function statusFor(outcome: Outcome, trashedAt: string | null): { status: string; previousStatus: string | null } {
  if (trashedAt) return { status: "trashed", previousStatus: outcome };
  return { status: outcome, previousStatus: null };
}

function outcomeFor(item: JsonRecord): Outcome {
  const value = item.status === "trashed" ? item.previousStatus : item.status;
  return value === "completed" || value === "canceled" ? value : "open";
}

function tagTitles(ids: string[], tagById: Map<string, Tag>): string[] {
  return ids.map((id) => tagById.get(id)?.title).filter((title): title is string => Boolean(title));
}

function directLocationParts(
  location: ToDoLocation,
  document: WorkspaceDocument,
): { headingId: string | null; projectId: string | null; areaId: string | null; spaceId: string | null } {
  if (location.kind === "unfiled") return { headingId: null, projectId: null, areaId: null, spaceId: location.spaceId };
  if (location.kind === "area") {
    const area = document.areas.find((item) => item.id === location.areaId);
    return { headingId: null, projectId: null, areaId: location.areaId, spaceId: area?.spaceId ?? null };
  }
  if (location.kind === "project") {
    const project = document.projects.find((item) => item.id === location.projectId);
    const areaId = project?.location.kind === "area" ? project.location.areaId : null;
    const area = areaId ? document.areas.find((item) => item.id === areaId) : null;
    const spaceId = project?.location.kind === "space" ? project.location.spaceId : area?.spaceId ?? null;
    return { headingId: null, projectId: location.projectId, areaId, spaceId };
  }
  const heading = document.headings.find((item) => item.id === location.headingId);
  if (!heading) return { headingId: location.headingId, projectId: null, areaId: null, spaceId: null };
  if (heading.location.kind === "area") {
    const area = document.areas.find((item) => item.id === heading.location.areaId);
    return { headingId: heading.id, projectId: null, areaId: heading.location.areaId, spaceId: area?.spaceId ?? null };
  }
  const project = document.projects.find((item) => item.id === heading.location.projectId);
  const areaId = project?.location.kind === "area" ? project.location.areaId : null;
  const area = areaId ? document.areas.find((item) => item.id === areaId) : null;
  const spaceId = project?.location.kind === "space" ? project.location.spaceId : area?.spaceId ?? null;
  return { headingId: heading.id, projectId: heading.location.projectId, areaId, spaceId };
}

function interfaceToDo(
  toDo: ToDo,
  document: WorkspaceDocument,
  tagById: Map<string, Tag>,
  today: string,
): InterfaceToDo {
  const status = statusFor(toDo.outcome, toDo.trashedAt);
  return {
    id: toDo.id,
    title: toDo.title,
    notes: toDo.notes,
    ...status,
    ...scheduleToInterface(toDo.schedule, today),
    reminderAt: localDateTime(toDo.reminder?.at ?? null),
    reminderSentAt: toDo.reminder?.sentAt ?? null,
    deadline: toDo.deadline,
    ...directLocationParts(toDo.location, document),
    tags: tagTitles(toDo.tags, tagById),
    checklist: [...toDo.checklist].sort((left, right) => left.order - right.order).map((item) => ({
      id: item.id,
      title: item.title,
      done: item.completed,
    })),
    repeat: null,
    repeatTemplateId: toDo.occurrence?.templateId ?? null,
    createdAt: toDo.createdAt,
    completedAt: toDo.completedAt,
    loggedAt: toDo.logbookAt,
    trashedAt: toDo.trashedAt,
    order: toDo.order,
  };
}

function repeatRecord(template: RepeatingTemplate): JsonRecord {
  return {
    workspaceTemplateId: template.id,
    mode: template.mode === "after-completion" ? "afterCompletion" : "fixed",
    frequency: template.pattern.frequency,
    interval: template.pattern.interval,
    weekdays: [...template.pattern.weekdays],
    nextDate: template.nextDate,
    reminderTime: template.reminderTime,
    deadlineOffset: template.deadlineOffsetDays,
    paused: template.state !== "active",
    stopped: template.state === "stopped",
  };
}

function templateLocationParts(template: RepeatingTemplate, document: WorkspaceDocument) {
  if (template.itemKind === "toDo") return directLocationParts(template.location, document);
  if (template.location.kind === "space") return { areaId: null, spaceId: template.location.spaceId };
  return {
    areaId: template.location.areaId,
    spaceId: document.areas.find((item) => item.id === template.location.areaId)?.spaceId ?? null,
  };
}

function templateSources(document: WorkspaceDocument, tagById: Map<string, Tag>, today: string): {
  tasks: InterfaceToDo[];
  projects: InterfaceEntity[];
  headings: InterfaceEntity[];
} {
  const tasks: InterfaceToDo[] = [];
  const projects: InterfaceEntity[] = [];
  const headings: InterfaceEntity[] = [];
  for (const template of document.repeatingTemplates) {
    const base = {
      id: template.id,
      title: template.title,
      notes: template.notes,
      status: "open",
      bucket: "upcoming",
      scheduledFor: template.nextDate,
      evening: false,
      deadline: template.deadlineOffsetDays === null ? null : addDaysToDate(template.nextDate, template.deadlineOffsetDays),
      tags: tagTitles(template.tags, tagById),
      repeat: repeatRecord(template),
      repeatTemplateId: null,
      createdAt: template.createdAt,
      completedAt: null,
      loggedAt: null,
      trashedAt: null,
      workspaceTemplate: true,
      order: Number.MAX_SAFE_INTEGER,
    };
    const location = templateLocationParts(template, document);
    if (template.itemKind === "toDo") {
      tasks.push({
        ...base,
        reminderAt: template.reminderTime ? `${template.nextDate}T${template.reminderTime}` : null,
        reminderSentAt: null,
        headingId: "headingId" in location ? location.headingId : null,
        projectId: "projectId" in location ? location.projectId : null,
        areaId: location.areaId,
        spaceId: location.spaceId,
        checklist: template.checklist.map((item) => ({ id: item.id, title: item.title, done: false })),
      });
      continue;
    }
    projects.push({
      ...base,
      areaId: location.areaId,
      spaceId: location.spaceId,
      previousStatus: null,
    });
    for (const heading of template.projectContents.headings) {
      headings.push({
        id: `${template.id}:heading:${heading.key}`,
        workspaceTemplateId: template.id,
        workspaceBlueprintKey: heading.key,
        projectId: template.id,
        areaId: null,
        title: heading.title,
        archived: heading.archived,
        order: heading.order,
      });
    }
    for (const blueprint of template.projectContents.toDos) {
      const schedule = blueprint.schedule?.kind === "scheduled"
        ? { bucket: "upcoming", scheduledFor: template.nextDate, evening: blueprint.schedule.evening }
        : scheduleToInterface(blueprint.schedule ?? { kind: "anytime" }, today);
      tasks.push({
        id: `${template.id}:todo:${blueprint.key}`,
        workspaceTemplateId: template.id,
        workspaceBlueprintKey: blueprint.key,
        title: blueprint.title,
        notes: blueprint.notes,
        status: "open",
        previousStatus: null,
        ...schedule,
        reminderAt: null,
        reminderSentAt: null,
        deadline: null,
        projectId: template.id,
        headingId: blueprint.headingKey ? `${template.id}:heading:${blueprint.headingKey}` : null,
        areaId: location.areaId,
        spaceId: location.spaceId,
        tags: tagTitles(blueprint.tags, tagById),
        checklist: blueprint.checklist.map((item, index) => ({ id: `${template.id}:${blueprint.key}:check:${index}`, title: item.title, done: false })),
        repeat: null,
        repeatTemplateId: null,
        createdAt: template.createdAt,
        completedAt: null,
        loggedAt: null,
        order: blueprint.order,
      });
    }
  }
  return { tasks, projects, headings };
}

export function workspaceDocumentToInterfaceState(
  document: WorkspaceDocument,
  today = document.sync.updatedAt.slice(0, 10),
): InterfaceState {
  const tagById = new Map(document.tags.map((tag) => [tag.id, tag]));
  const templates = templateSources(document, tagById, today);
  const projects = document.projects.map((project) => {
    const status = statusFor(project.outcome, project.trashedAt);
    const location = project.location.kind === "space"
      ? { areaId: null, spaceId: project.location.spaceId }
      : { areaId: project.location.areaId, spaceId: document.areas.find((area) => area.id === project.location.areaId)?.spaceId ?? null };
    return {
      ...clone(project),
      ...status,
      ...scheduleToInterface(project.schedule, today),
      ...location,
      loggedAt: project.logbookAt,
      tags: tagTitles(project.tags, tagById),
      repeat: null,
      repeatTemplateId: project.occurrence?.templateId ?? null,
    } as InterfaceEntity;
  });
  const headings = document.headings.map((heading) => ({
    id: heading.id,
    title: heading.title,
    projectId: heading.location.kind === "project" ? heading.location.projectId : null,
    areaId: heading.location.kind === "area" ? heading.location.areaId : null,
    archived: Boolean(heading.archivedAt),
    order: heading.order,
  }));
  return {
    version: 7,
    updatedAt: document.sync.updatedAt,
    syncMutationId: document.sync.lastMutationId,
    settings: {
      theme: document.settings.theme,
      groupToday: document.settings.groupToday,
      notifications: document.settings.notifications,
      weekStartsOn: document.settings.weekStartsOn,
      showCalendar: document.settings.showCalendar,
      logCompletedItems: document.settings.logCompletedItems,
      defaultSpaceId: document.settings.defaultSpaceId,
      quickDraft: clone(document.settings.quickDraft),
      tags: document.tags.map((tag) => tag.title),
      spaceSchedule: { rules: clone(document.settings.launchRules) },
    },
    spaces: clone(document.spaces) as InterfaceEntity[],
    areas: document.areas.map((area) => ({ ...clone(area), tags: tagTitles(area.tags, tagById) })) as InterfaceEntity[],
    projects: [...projects, ...templates.projects],
    headings: [...headings, ...templates.headings],
    calendarEvents: clone(document.calendarEvents) as InterfaceEntity[],
    tasks: [...document.toDos.map((toDo) => interfaceToDo(toDo, document, tagById, today)), ...templates.tasks],
  };
}

function applyChangeSet(state: InterfaceState, changes: InterfaceChangeSet): InterfaceState {
  const next = clone(state);
  next.settings = { ...next.settings, ...clone(changes.settings ?? {}) };
  for (const name of COLLECTIONS) {
    const deleted = new Set(changes.deletes?.[name] ?? []);
    const items = new Map(next[name].filter((item) => !deleted.has(item.id)).map((item) => [item.id, item]));
    for (const change of changes.entities?.[name] ?? []) {
      const current = items.get(change.id) ?? { id: change.id, title: "" };
      items.set(change.id, { ...current, ...clone(change.patch), id: change.id } as never);
    }
    (next[name] as InterfaceEntity[]) = [...items.values()] as InterfaceEntity[];
  }
  next.updatedAt = new Date().toISOString();
  next.syncMutationId = changes.mutationId;
  return next;
}

function tagsFromState(state: InterfaceState, document: WorkspaceDocument, dependencies: WorkspaceDependencies): {
  tags: Tag[];
  idsFor(value: unknown): string[];
} {
  const titles = new Set<string>();
  for (const title of state.settings.tags) if (typeof title === "string" && title.trim()) titles.add(title.trim());
  for (const collection of [state.areas, state.projects, state.tasks]) {
    for (const item of collection) for (const title of Array.isArray(item.tags) ? item.tags : []) if (typeof title === "string" && title.trim()) titles.add(title.trim());
  }
  const existing = new Map(document.tags.map((tag) => [tag.title.toLocaleLowerCase(), tag]));
  const tags = [...titles].map((title, order) => {
    const current = existing.get(title.toLocaleLowerCase());
    return current ? { ...current, title, order } : { id: dependencies.createId("tag"), title, order };
  });
  const idByTitle = new Map(tags.map((tag) => [tag.title.toLocaleLowerCase(), tag.id]));
  return {
    tags,
    idsFor(value) {
      return Array.isArray(value)
        ? value.map((title) => typeof title === "string" ? idByTitle.get(title.toLocaleLowerCase()) : undefined).filter((id): id is string => Boolean(id))
        : [];
    },
  };
}

function toDoLocation(item: JsonRecord, state: InterfaceState): ToDoLocation | null {
  const headingId = optionalString(item.headingId);
  if (headingId && state.headings.some((heading) => heading.id === headingId && !heading.workspaceTemplateId)) return { kind: "heading", headingId };
  const projectId = optionalString(item.projectId);
  if (projectId && state.projects.some((project) => project.id === projectId && !project.workspaceTemplate)) return { kind: "project", projectId };
  const areaId = optionalString(item.areaId);
  if (areaId && state.areas.some((area) => area.id === areaId)) return { kind: "area", areaId };
  const spaceId = optionalString(item.spaceId);
  if (spaceId && state.spaces.some((space) => space.id === spaceId)) return { kind: "unfiled", spaceId };
  return null;
}

function projectLocation(item: JsonRecord, state: InterfaceState): ProjectLocation | null {
  const areaId = optionalString(item.areaId);
  if (areaId && state.areas.some((area) => area.id === areaId)) return { kind: "area", areaId };
  const spaceId = optionalString(item.spaceId);
  if (spaceId && state.spaces.some((space) => space.id === spaceId)) return { kind: "space", spaceId };
  return null;
}

function checklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawItem, order) => {
    const item = record(rawItem);
    const id = optionalString(item.id);
    const title = stringValue(item.title).trim();
    return id && title ? [{ id, title, completed: Boolean(item.done), order }] : [];
  });
}

function templateFromSource(
  item: InterfaceEntity,
  itemKind: "toDo" | "project",
  state: InterfaceState,
  previous: WorkspaceDocument,
  dependencies: WorkspaceDependencies,
  idsForTags: (value: unknown) => string[],
): RepeatingTemplate | null {
  const repeat = record(item.repeat);
  if (!Object.keys(repeat).length && !item.workspaceTemplate) return null;
  const existing = previous.repeatingTemplates.find((template) => template.id === item.id);
  if (!Object.keys(repeat).length && existing) return { ...clone(existing), state: "stopped" };
  if (!Object.keys(repeat).length) return null;
  const location = itemKind === "toDo" ? toDoLocation(item, state) : projectLocation(item, state);
  if (!location) return null;
  const frequency = ["daily", "weekly", "monthly", "yearly"].includes(stringValue(repeat.frequency))
    ? stringValue(repeat.frequency) as RepeatingTemplate["pattern"]["frequency"]
    : "daily";
  const stateValue = repeat.stopped ? "stopped" : repeat.paused ? "paused" : "active";
  const base = {
    id: item.id,
    title: item.title.trim() || "Untitled",
    notes: stringValue(item.notes),
    tags: idsForTags(item.tags),
    checklist: checklist(item.checklist),
    pattern: {
      frequency,
      interval: Math.max(1, Math.floor(numberValue(repeat.interval, 1))),
      weekdays: Array.isArray(repeat.weekdays) ? repeat.weekdays.filter((day): day is number => typeof day === "number" && day >= 0 && day <= 6) : [],
    },
    mode: repeat.mode === "afterCompletion" ? "after-completion" as const : "on-schedule" as const,
    state: stateValue as RepeatingTemplate["state"],
    firstDate: existing?.firstDate ?? optionalString(item.scheduledFor) ?? dependencies.now().slice(0, 10),
    nextDate: optionalString(repeat.nextDate) ?? optionalString(item.scheduledFor) ?? dependencies.now().slice(0, 10),
    reminderTime: optionalString(repeat.reminderTime),
    deadlineOffsetDays: typeof repeat.deadlineOffset === "number" ? repeat.deadlineOffset : null,
    createdAt: existing?.createdAt ?? optionalString(item.createdAt) ?? dependencies.now(),
  };
  if (itemKind === "toDo") return { ...base, itemKind, location: location as ToDoLocation, projectContents: null };
  const headings = state.headings.filter((heading) => heading.projectId === item.id && heading.workspaceTemplateId === item.id);
  const headingKeyById = new Map(headings.map((heading) => [heading.id, stringValue(heading.workspaceBlueprintKey, heading.id)]));
  const contents = {
    headings: headings.map((heading, order) => ({
      key: headingKeyById.get(heading.id)!,
      title: heading.title,
      archived: Boolean(heading.archived),
      order: numberValue(heading.order, order),
    })),
    toDos: state.tasks.filter((toDo) => toDo.projectId === item.id && toDo.workspaceTemplateId === item.id).map((toDo, order) => ({
      key: stringValue(toDo.workspaceBlueprintKey, toDo.id),
      title: toDo.title,
      notes: toDo.notes,
      headingKey: toDo.headingId ? headingKeyById.get(toDo.headingId) ?? null : null,
      tags: idsForTags(toDo.tags),
      checklist: checklist(toDo.checklist).map(({ id: _id, ...entry }) => entry),
      schedule: interfaceSchedule(toDo),
      reminder: null,
      deadline: null,
      order: numberValue(toDo.order, order),
    })),
  };
  return { ...base, itemKind, location: location as ProjectLocation, projectContents: contents };
}

function documentFromInterfaceState(
  state: InterfaceState,
  previous: WorkspaceDocument,
  dependencies: WorkspaceDependencies,
): WorkspaceDocument | null {
  const spaces: Space[] = state.spaces.flatMap((item, order) => item.title.trim() ? [{
    id: item.id,
    title: item.title.trim(),
    color: stringValue(item.color, "#5b7cfa"),
    pinned: item.pinned !== false,
    order: numberValue(item.order, order),
  }] : []);
  if (!spaces.length) return null;
  const spaceIds = new Set(spaces.map((space) => space.id));
  const tagData = tagsFromState(state, previous, dependencies);
  const areas: Area[] = state.areas.flatMap((item, order) => {
    const spaceId = optionalString(item.spaceId);
    return item.title.trim() && spaceId && spaceIds.has(spaceId) ? [{
      id: item.id,
      title: item.title.trim(),
      spaceId,
      color: stringValue(item.color, "#5b7cfa"),
      tags: tagData.idsFor(item.tags),
      order: numberValue(item.order, order),
    }] : [];
  });
  const areaIds = new Set(areas.map((area) => area.id));
  const projects: Project[] = state.projects.filter((item) => !item.workspaceTemplate).flatMap((item, order) => {
    const location = projectLocation(item, state);
    if (!item.title.trim() || !location) return [];
    const outcome = outcomeFor(item);
    return [{
      id: item.id,
      title: item.title.trim(),
      notes: stringValue(item.notes),
      location,
      schedule: interfaceSchedule(item),
      deadline: optionalString(item.deadline),
      outcome,
      trashedAt: item.status === "trashed" ? durableDateTime(item.trashedAt) ?? dependencies.now() : null,
      logbookAt: durableDateTime(item.loggedAt),
      tags: tagData.idsFor(item.tags),
      occurrence: optionalString(item.repeatTemplateId) ? { templateId: String(item.repeatTemplateId), scheduledDate: optionalString(item.scheduledFor) ?? dependencies.now().slice(0, 10) } : null,
      completedAt: outcome === "completed" ? durableDateTime(item.completedAt) ?? dependencies.now() : null,
      order: numberValue(item.order, order),
    }];
  });
  const projectIds = new Set(projects.map((project) => project.id));
  const headings: Heading[] = state.headings.filter((item) => !item.workspaceTemplateId).flatMap((item, order) => {
    const projectId = optionalString(item.projectId);
    const areaId = optionalString(item.areaId);
    const location = projectId && projectIds.has(projectId)
      ? { kind: "project" as const, projectId }
      : areaId && areaIds.has(areaId) ? { kind: "area" as const, areaId } : null;
    return item.title.trim() && location ? [{
      id: item.id,
      title: item.title.trim(),
      location,
      archivedAt: item.archived ? dependencies.now() : null,
      order: numberValue(item.order, order),
    }] : [];
  });
  const headingIds = new Set(headings.map((heading) => heading.id));
  const toDos: ToDo[] = state.tasks.filter((item) => !item.workspaceTemplate && !item.workspaceTemplateId).flatMap((item, order) => {
    const location = toDoLocation(item, state);
    if (!item.title.trim() || !location) return [];
    const outcome = outcomeFor(item);
    const reminderAt = durableDateTime(item.reminderAt);
    return [{
      id: item.id,
      title: item.title.trim(),
      notes: stringValue(item.notes),
      checklist: checklist(item.checklist),
      location,
      schedule: interfaceSchedule(item),
      reminder: reminderAt ? { at: reminderAt, sentAt: durableDateTime(item.reminderSentAt) } : null,
      deadline: optionalString(item.deadline),
      outcome,
      trashedAt: item.status === "trashed" ? durableDateTime(item.trashedAt) ?? dependencies.now() : null,
      logbookAt: durableDateTime(item.loggedAt),
      tags: tagData.idsFor(item.tags),
      occurrence: optionalString(item.repeatTemplateId) ? { templateId: String(item.repeatTemplateId), scheduledDate: optionalString(item.scheduledFor) ?? dependencies.now().slice(0, 10) } : null,
      createdAt: durableDateTime(item.createdAt) ?? dependencies.now(),
      completedAt: outcome === "completed" ? durableDateTime(item.completedAt) ?? dependencies.now() : null,
      order: numberValue(item.order, order),
    }];
  });
  const templateSources = [
    ...state.tasks.filter((item) => item.workspaceTemplate || item.repeat).map((item) => ({ item, kind: "toDo" as const })),
    ...state.projects.filter((item) => item.workspaceTemplate || item.repeat).map((item) => ({ item, kind: "project" as const })),
  ];
  const repeatingTemplates = templateSources.flatMap(({ item, kind }) => {
    const template = templateFromSource(item, kind, state, previous, dependencies, tagData.idsFor);
    return template ? [template] : [];
  });
  const templateIds = new Set(repeatingTemplates.map((template) => template.id));
  for (const toDo of toDos) if (toDo.occurrence && !templateIds.has(toDo.occurrence.templateId)) toDo.occurrence = null;
  for (const project of projects) if (project.occurrence && !templateIds.has(project.occurrence.templateId)) project.occurrence = null;
  const calendarEvents: CalendarEvent[] = state.calendarEvents.flatMap((item) => {
    const spaceId = optionalString(item.spaceId);
    const start = durableDateTime(item.start);
    const end = durableDateTime(item.end);
    return item.title.trim() && spaceId && spaceIds.has(spaceId) && start && end ? [{
      id: item.id,
      title: item.title.trim(),
      spaceId,
      start,
      end,
      calendar: stringValue(item.calendar, "Objects"),
      allDay: Boolean(item.allDay),
      sourceUid: optionalString(item.sourceUid),
    }] : [];
  });
  const toDoIds = new Set(toDos.map((toDo) => toDo.id));
  const liveHeadingIds = new Set(headings.map((heading) => heading.id));
  const deletedAt = dependencies.now();
  const permanentDeletions = clone(previous.permanentDeletions);
  for (const [kind, before, after] of [
    ["toDo", previous.toDos, toDos],
    ["project", previous.projects, projects],
    ["repeatingTemplate", previous.repeatingTemplates, repeatingTemplates],
  ] as const) {
    const afterIds = new Set(after.map((item) => item.id));
    for (const item of before) {
      const wasPermanentlyRemoved = !afterIds.has(item.id) && (kind === "repeatingTemplate" || "trashedAt" in item && Boolean(item.trashedAt));
      if (wasPermanentlyRemoved && !permanentDeletions.some((marker) => marker.entityKind === kind && marker.entityId === item.id)) {
        permanentDeletions.push({ entityKind: kind, entityId: item.id, deletedAt });
      }
    }
  }
  const defaultSpaceId = optionalString(state.settings.defaultSpaceId);
  const launchRulesSource = record(state.settings.spaceSchedule).rules;
  return {
    format: "objects-workspace",
    version: 1,
    settings: {
      theme: ["system", "light", "dark"].includes(stringValue(state.settings.theme)) ? state.settings.theme as "system" | "light" | "dark" : "system",
      groupToday: state.settings.groupToday !== false,
      notifications: Boolean(state.settings.notifications),
      weekStartsOn: state.settings.weekStartsOn === 0 ? 0 : 1,
      showCalendar: state.settings.showCalendar !== false,
      logCompletedItems: ["immediately", "daily", "manually"].includes(stringValue(state.settings.logCompletedItems)) ? state.settings.logCompletedItems as "immediately" | "daily" | "manually" : "daily",
      defaultSpaceId: defaultSpaceId && spaceIds.has(defaultSpaceId) ? defaultSpaceId : spaces[0].id,
      launchRules: Array.isArray(launchRulesSource) ? launchRulesSource.flatMap((rawRule, order) => {
        const rule = record(rawRule);
        const id = optionalString(rule.id);
        const spaceId = optionalString(rule.spaceId);
        return id && spaceId && spaceIds.has(spaceId) ? [{
          id,
          spaceId,
          weekdays: Array.isArray(rule.weekdays) ? rule.weekdays.filter((day): day is number => typeof day === "number" && day >= 0 && day <= 6) : [],
          start: stringValue(rule.start, "09:00"),
          end: stringValue(rule.end, "17:00"),
          order: numberValue(rule.order, order),
        }] : [];
      }) : [],
      quickDraft: record(state.settings.quickDraft).value !== undefined ? clone(state.settings.quickDraft) as WorkspaceDocument["settings"]["quickDraft"] : null,
    },
    spaces,
    areas,
    projects,
    headings,
    tags: tagData.tags,
    toDos,
    repeatingTemplates,
    projectClosures: previous.projectClosures.filter((closure) => projectIds.has(closure.projectId) && closure.changedToDoIds.every((id) => toDoIds.has(id))),
    calendarEvents,
    permanentDeletions,
    captureReceipts: previous.captureReceipts.filter((receipt) => toDoIds.has(receipt.toDoId)),
    sync: clone(previous.sync),
  };
}

function applyWorkspaceChange(workspace: Workspace, change: WorkspaceChange): string[] {
  const result = workspace.change(change);
  return result.status === "rejected" ? result.errors : [];
}

function desiredToDoOutcome(item: InterfaceToDo): Outcome {
  return outcomeFor(item);
}

function applyProjectLifecycleChanges(
  workspace: Workspace,
  before: WorkspaceDocument,
  desired: InterfaceState,
  changes: InterfaceChangeSet,
): string[] {
  const errors: string[] = [];
  const deletedIds = new Set(changes.deletes?.projects ?? []);
  for (const project of before.projects) {
    if (deletedIds.has(project.id)) {
      if (project.trashedAt) errors.push(...applyWorkspaceChange(workspace, {
        type: "permanentlyDeleteProject",
        id: project.id,
        confirmation: PERMANENT_DELETE_CONFIRMATION,
      }));
      continue;
    }
    const item = desired.projects.find((candidate) => candidate.id === project.id && !candidate.workspaceTemplate);
    if (!item) continue;
    if (item.status === "trashed" && !project.trashedAt) {
      errors.push(...applyWorkspaceChange(workspace, { type: "trashProject", id: project.id }));
      continue;
    }
    if (project.trashedAt && item.status !== "trashed") {
      errors.push(...applyWorkspaceChange(workspace, { type: "restoreProjectFromTrash", id: project.id }));
    }
    const current = workspace.read().projects.find((candidate) => candidate.id === project.id);
    if (!current || item.status === "trashed") continue;
    const desiredOutcome = outcomeFor(item);
    if (current.outcome !== "open" && desiredOutcome === "open") {
      errors.push(...applyWorkspaceChange(workspace, { type: "restoreProject", id: project.id }));
      continue;
    }
    if (current.outcome === "open" && desiredOutcome !== "open") {
      const toDoOutcomes = workspace.read().toDos.flatMap((toDo) => {
        if (toDo.outcome !== "open" || workspace.locationOfToDo(toDo.id)?.projectId !== project.id) return [];
        const desiredToDo = desired.tasks.find((candidate) => candidate.id === toDo.id);
        const outcome = desiredToDo ? desiredToDoOutcome(desiredToDo) : "open";
        return outcome === "open" ? [] : [{ id: toDo.id, outcome }];
      });
      errors.push(...applyWorkspaceChange(workspace, {
        type: "closeProject",
        id: project.id,
        outcome: desiredOutcome,
        toDoOutcomes,
      }));
    }
  }
  return errors;
}

function applyToDoLifecycleChanges(
  workspace: Workspace,
  before: WorkspaceDocument,
  desired: InterfaceState,
  changes: InterfaceChangeSet,
): string[] {
  const errors: string[] = [];
  const deletedIds = new Set(changes.deletes?.tasks ?? []);
  for (const original of before.toDos) {
    if (deletedIds.has(original.id)) {
      if (original.trashedAt) errors.push(...applyWorkspaceChange(workspace, {
        type: "permanentlyDeleteToDo",
        id: original.id,
        confirmation: PERMANENT_DELETE_CONFIRMATION,
      }));
      continue;
    }
    const item = desired.tasks.find((candidate) => candidate.id === original.id && !candidate.workspaceTemplate);
    if (!item) continue;
    let current = workspace.read().toDos.find((candidate) => candidate.id === original.id);
    if (!current) continue;
    if (item.status === "trashed" && !current.trashedAt) {
      errors.push(...applyWorkspaceChange(workspace, { type: "trashToDo", id: original.id }));
      continue;
    }
    if (current.trashedAt && item.status !== "trashed") {
      errors.push(...applyWorkspaceChange(workspace, { type: "restoreToDo", id: original.id }));
      current = workspace.read().toDos.find((candidate) => candidate.id === original.id);
    }
    if (!current || item.status === "trashed") continue;
    const desiredOutcome = desiredToDoOutcome(item);
    if (current.outcome !== "open" && desiredOutcome !== current.outcome) {
      errors.push(...applyWorkspaceChange(workspace, { type: "reopenToDo", id: original.id }));
      current = workspace.read().toDos.find((candidate) => candidate.id === original.id);
    }
    if (current?.outcome === "open" && desiredOutcome === "completed") {
      errors.push(...applyWorkspaceChange(workspace, { type: "completeToDo", id: original.id }));
    } else if (current?.outcome === "open" && desiredOutcome === "canceled") {
      errors.push(...applyWorkspaceChange(workspace, { type: "cancelToDo", id: original.id }));
    }
    const afterLifecycle = workspace.read().toDos.find((candidate) => candidate.id === original.id);
    if (!afterLifecycle) continue;
    const desiredIds = item.checklist.map((entry) => entry.id);
    const currentIds = afterLifecycle.checklist.map((entry) => entry.id);
    if (desiredIds.length === currentIds.length && desiredIds.every((id) => currentIds.includes(id))) {
      for (const desiredItem of item.checklist) {
        const currentItem = afterLifecycle.checklist.find((entry) => entry.id === desiredItem.id)!;
        if (currentItem.title !== desiredItem.title || currentItem.completed !== desiredItem.done) {
          errors.push(...applyWorkspaceChange(workspace, {
            type: "updateChecklistItem",
            toDoId: original.id,
            itemId: desiredItem.id,
            changes: { title: desiredItem.title, completed: desiredItem.done },
          }));
        }
      }
      if (desiredIds.some((id, index) => id !== currentIds[index])) {
        errors.push(...applyWorkspaceChange(workspace, { type: "reorderChecklistItems", toDoId: original.id, orderedIds: desiredIds }));
      }
    }
  }
  return errors;
}

export function applyInterfaceChangeSetToWorkspace(
  document: WorkspaceDocument,
  changeSet: InterfaceChangeSet,
  dependencies: WorkspaceDependencies,
): InterfaceBridgeResult {
  if (!changeSet.mutationId || changeSet.mutationId.length > 200) return { ok: false, errors: ["A valid interface mutation identity is required."] };
  const today = dependencies.now().slice(0, 10);
  const desiredState = applyChangeSet(workspaceDocumentToInterfaceState(document, today), changeSet);
  const workspace = createWorkspace(document, dependencies);
  const behaviorErrors = [
    ...applyProjectLifecycleChanges(workspace, document, desiredState, changeSet),
    ...applyToDoLifecycleChanges(workspace, document, desiredState, changeSet),
  ];
  if (behaviorErrors.length) return { ok: false, errors: behaviorErrors };
  const behaviorDocument = workspace.read();
  const state = applyChangeSet(workspaceDocumentToInterfaceState(behaviorDocument, today), changeSet);
  const candidate = documentFromInterfaceState(state, behaviorDocument, dependencies);
  if (!candidate) return { ok: false, errors: ["The interface change would leave the Workspace without a Space."] };
  const imported = workspace.importPortableBackup(exportPortableBackup(candidate), FULL_IMPORT_CONFIRMATION);
  if (imported.status === "rejected") return { ok: false, errors: imported.errors };
  const next = workspace.read();
  next.sync = clone(document.sync);
  return { ok: true, document: next };
}

export function interfaceLocationForWorkspaceUrl(
  document: WorkspaceDocument,
  search: string,
): { search: string; activeSpaceId: string | null } | null {
  const target = parseDirectTarget(search);
  if (!target) return null;
  const params = new URLSearchParams(search);
  params.delete("open");
  params.delete("view");
  params.delete("id");
  let activeSpaceId: string | null = null;
  if (target.kind === "view") {
    params.set("view", target.viewKind);
  } else if (target.kind === "toDo") {
    const toDo = document.toDos.find((item) => item.id === target.id);
    if (!toDo) return null;
    params.set("task", toDo.id);
    activeSpaceId = directLocationParts(toDo.location, document).spaceId;
  } else if (target.kind === "heading") {
    const heading = document.headings.find((item) => item.id === target.id);
    if (!heading) return null;
    params.set("view", heading.location.kind);
    params.set("id", heading.location.kind === "project" ? heading.location.projectId : heading.location.areaId);
    if (heading.location.kind === "project") {
      const project = document.projects.find((item) => item.id === heading.location.projectId);
      activeSpaceId = project?.location.kind === "space"
        ? project.location.spaceId
        : document.areas.find((item) => item.id === project?.location.areaId)?.spaceId ?? null;
    } else {
      activeSpaceId = document.areas.find((item) => item.id === heading.location.areaId)?.spaceId ?? null;
    }
  } else if (target.kind === "area") {
    const area = document.areas.find((item) => item.id === target.id);
    if (!area) return null;
    params.set("view", "area");
    params.set("id", area.id);
    activeSpaceId = area.spaceId;
  } else if (target.kind === "project") {
    const project = document.projects.find((item) => item.id === target.id);
    if (!project) return null;
    params.set("view", "project");
    params.set("id", project.id);
    activeSpaceId = project.location.kind === "space"
      ? project.location.spaceId
      : document.areas.find((item) => item.id === project.location.areaId)?.spaceId ?? null;
  } else if (target.kind === "tag") {
    const tag = document.tags.find((item) => item.id === target.id);
    if (!tag) return null;
    params.set("view", "tag");
    params.set("id", tag.title);
  } else if (target.kind === "space") {
    if (!document.spaces.some((item) => item.id === target.id)) return null;
    params.set("view", "today");
    activeSpaceId = target.id;
  } else {
    const template = document.repeatingTemplates.find((item) => item.id === target.id);
    if (!template) return null;
    params.set("view", "repeating");
    params.set("task", template.id);
    activeSpaceId = templateLocationParts(template, document).spaceId;
  }
  const serialized = params.toString();
  return { search: serialized ? `?${serialized}` : "", activeSpaceId };
}
