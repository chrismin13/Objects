import type {
  Area,
  CalendarEvent,
  ChecklistItem,
  Heading,
  IsoDateTime,
  Outcome,
  Project,
  ProjectLocation,
  RepeatingDeadlineDefault,
  RepeatingProjectToDoBlueprint,
  RepeatingReminderDefault,
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
  DELETE_HEADING_CONFIRMATION,
  DELETE_REPEATING_TEMPLATE_CONFIRMATION,
  DELETE_SPACE_CONFIRMATION,
  DELETE_TAG_CONFIRMATION,
  PERMANENT_DELETE_CONFIRMATION,
  REMOVE_AREA_CONFIRMATION,
  createWorkspace,
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

export type InterfaceRepeatRule = JsonRecord & {
  mode: "fixed" | "afterCompletion";
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays: number[];
  nextDate: string;
  reminderTime: string | null;
  deadlineOffset: number | null;
  paused: boolean;
  stopped?: boolean;
  workspaceTemplateId?: string;
};

export type InterfaceEntity = JsonRecord & {
  id: string;
  title: string;
  order?: number;
  workspaceTemplate?: boolean;
  workspaceTemplateId?: string | null;
  workspaceBlueprintKey?: string;
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
  repeat: InterfaceRepeatRule | null;
  repeatTemplateId?: string | null;
  createdAt: string;
  completedAt: string | null;
  loggedAt: string | null;
  trashedAt?: string | null;
  workspaceTemplate?: boolean;
  workspaceTemplateId?: string | null;
  workspaceBlueprintKey?: string;
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
  replaceWorkspace?: boolean;
  workspaceChanges?: WorkspaceChange[];
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

function daysBetweenDates(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(`${toDate}T00:00:00.000Z`) - Date.parse(`${fromDate}T00:00:00.000Z`)) / 86_400_000);
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

function blueprintScheduleForInterface(
  schedule: RepeatingProjectToDoBlueprint["schedule"],
  templateDate: string,
  today: string,
): Pick<InterfaceToDo, "bucket" | "scheduledFor" | "evening"> {
  if (schedule?.kind === "scheduled") {
    return scheduleToInterface({
      kind: "scheduled",
      date: addDaysToDate(templateDate, schedule.offsetDays),
      evening: schedule.evening,
    }, today);
  }
  return scheduleToInterface(schedule ?? { kind: "anytime" }, today);
}

function blueprintReminderForInterface(
  reminder: RepeatingReminderDefault | null,
  templateDate: string,
  schedule: RepeatingProjectToDoBlueprint["schedule"],
): string | null {
  if (!reminder) return null;
  if (reminder.kind === "fixed") return localDateTime(reminder.at);
  if (reminder.kind === "offset") return `${addDaysToDate(templateDate, reminder.days)}T${reminder.time}`;
  const reminderDate = schedule?.kind === "scheduled"
    ? addDaysToDate(templateDate, schedule.offsetDays)
    : templateDate;
  return `${reminderDate}T${reminder.time}`;
}

function blueprintDeadlineForInterface(deadline: RepeatingDeadlineDefault | null, templateDate: string): string | null {
  if (!deadline) return null;
  return deadline.kind === "fixed" ? deadline.date : addDaysToDate(templateDate, deadline.days);
}

function blueprintScheduleFromInterface(item: InterfaceToDo, templateDate: string): RepeatingProjectToDoBlueprint["schedule"] {
  const originalValue = record(item.workspaceBlueprintScheduleValue);
  if (
    optionalString(originalValue.scheduledFor) === optionalString(item.scheduledFor)
    && stringValue(originalValue.bucket) === stringValue(item.bucket)
    && Boolean(originalValue.evening) === Boolean(item.evening)
    && item.workspaceBlueprintSchedule
  ) {
    return clone(item.workspaceBlueprintSchedule as RepeatingProjectToDoBlueprint["schedule"]);
  }
  const schedule = interfaceSchedule(item);
  return schedule.kind === "scheduled"
    ? { kind: "scheduled", offsetDays: daysBetweenDates(templateDate, schedule.date), evening: schedule.evening }
    : schedule;
}

function blueprintReminderFromInterface(item: InterfaceToDo): RepeatingReminderDefault | null {
  const currentValue = optionalString(item.reminderAt);
  const originalValue = optionalString(item.workspaceBlueprintReminderValue);
  if (currentValue === originalValue && item.workspaceBlueprintReminder !== undefined) {
    return clone(item.workspaceBlueprintReminder as RepeatingReminderDefault | null);
  }
  const at = durableDateTime(currentValue);
  return at ? { kind: "fixed", at } : null;
}

function blueprintDeadlineFromInterface(item: InterfaceToDo): RepeatingDeadlineDefault | null {
  const currentValue = optionalString(item.deadline);
  const originalValue = optionalString(item.workspaceBlueprintDeadlineValue);
  if (currentValue === originalValue && item.workspaceBlueprintDeadline !== undefined) {
    return clone(item.workspaceBlueprintDeadline as RepeatingDeadlineDefault | null);
  }
  return currentValue ? { kind: "fixed", date: currentValue } : null;
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

function repeatRecord(template: RepeatingTemplate): InterfaceRepeatRule {
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
      const schedule = blueprintScheduleForInterface(blueprint.schedule, template.nextDate, today);
      const reminderAt = blueprintReminderForInterface(blueprint.reminder, template.nextDate, blueprint.schedule);
      const deadline = blueprintDeadlineForInterface(blueprint.deadline, template.nextDate);
      tasks.push({
        id: `${template.id}:todo:${blueprint.key}`,
        workspaceTemplateId: template.id,
        workspaceBlueprintKey: blueprint.key,
        title: blueprint.title,
        notes: blueprint.notes,
        status: "open",
        previousStatus: null,
        ...schedule,
        reminderAt,
        reminderSentAt: null,
        deadline,
        projectId: template.id,
        headingId: blueprint.headingKey ? `${template.id}:heading:${blueprint.headingKey}` : null,
        areaId: location.areaId,
        spaceId: location.spaceId,
        tags: tagTitles(blueprint.tags, tagById),
        checklist: blueprint.checklist.map((item, index) => ({ id: `${template.id}:${blueprint.key}:check:${index}`, title: item.title, done: false })),
        repeat: null,
        repeatTemplateId: null,
        workspaceBlueprintSchedule: clone(blueprint.schedule ?? { kind: "anytime" }),
        workspaceBlueprintScheduleValue: clone(schedule),
        workspaceBlueprintReminder: clone(blueprint.reminder),
        workspaceBlueprintReminderValue: reminderAt,
        workspaceBlueprintDeadline: clone(blueprint.deadline),
        workspaceBlueprintDeadlineValue: deadline,
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
      schedule: blueprintScheduleFromInterface(toDo, optionalString(item.scheduledFor) ?? dependencies.now().slice(0, 10)),
      reminder: blueprintReminderFromInterface(toDo),
      deadline: blueprintDeadlineFromInterface(toDo),
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
  const projects: Project[] = state.projects.filter((item) => !item.workspaceTemplate && !item.repeat).flatMap((item, order) => {
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
  const toDos: ToDo[] = state.tasks.filter((item) => !item.workspaceTemplate && !item.workspaceTemplateId && !item.repeat).flatMap((item, order) => {
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

const LIFECYCLE_COMPATIBILITY_FIELDS = new Set([
  "status",
  "previousStatus",
  "completedAt",
  "loggedAt",
  "trashedAt",
  "completedWithProjectId",
]);

function explicitLifecycleTargets(changes: WorkspaceChange[]): { toDoIds: Set<string>; projectIds: Set<string> } {
  const toDoIds = new Set<string>();
  const projectIds = new Set<string>();
  for (const change of changes) {
    if (["completeToDo", "cancelToDo", "reopenToDo", "trashToDo", "restoreToDo", "permanentlyDeleteToDo"].includes(change.type)) {
      toDoIds.add((change as { id: string }).id);
    }
    if (["closeProject", "restoreProject", "trashProject", "restoreProjectFromTrash", "permanentlyDeleteProject"].includes(change.type)) {
      projectIds.add((change as { id: string }).id);
    }
    if (change.type === "skipOccurrence") {
      if (change.itemKind === "toDo") toDoIds.add(change.id);
      else projectIds.add(change.id);
    }
  }
  return { toDoIds, projectIds };
}

function withoutInferredLifecycleChanges(changeSet: InterfaceChangeSet): InterfaceChangeSet {
  const explicit = explicitLifecycleTargets(changeSet.workspaceChanges ?? []);
  if (!explicit.toDoIds.size && !explicit.projectIds.size) return changeSet;
  const next = clone(changeSet);
  const cleanPatches = (name: "tasks" | "projects", ids: Set<string>) => {
    const changes = next.entities?.[name];
    if (!changes) return;
    next.entities![name] = changes.map((change) => {
      if (!ids.has(change.id)) return change;
      const patch = { ...change.patch };
      for (const field of LIFECYCLE_COMPATIBILITY_FIELDS) delete patch[field];
      return { ...change, patch };
    }).filter((change) => Object.keys(change.patch).length > 0);
  };
  cleanPatches("tasks", explicit.toDoIds);
  cleanPatches("projects", explicit.projectIds);
  if (next.deletes?.tasks) next.deletes.tasks = next.deletes.tasks.filter((id) => !explicit.toDoIds.has(id));
  if (next.deletes?.projects) next.deletes.projects = next.deletes.projects.filter((id) => !explicit.projectIds.has(id));
  return next;
}

function queueExplicitInterfaceIds(changeSet: InterfaceChangeSet, queues: IdQueues): void {
  for (const change of changeSet.workspaceChanges ?? []) {
    if (change.type !== "makeToDoRepeating" && change.type !== "makeProjectRepeating") continue;
    const collection = change.type === "makeToDoRepeating" ? changeSet.entities?.tasks : changeSet.entities?.projects;
    const source = collection?.find((item) => item.id === change.id);
    const templateId = optionalString(source?.patch.repeatTemplateId);
    if (templateId) queueCreatedIds(queues, { repeatingTemplate: [templateId] });
  }
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
      if (!project.trashedAt && changes.replaceWorkspace) {
        errors.push(...applyWorkspaceChange(workspace, { type: "trashProject", id: project.id }));
      }
      if (project.trashedAt || changes.replaceWorkspace) errors.push(...applyWorkspaceChange(workspace, {
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
    if (current.occurrence && current.outcome === "open" && desiredOutcome === "canceled" && optionalString(item.loggedAt)) {
      errors.push(...applyWorkspaceChange(workspace, { type: "skipOccurrence", itemKind: "project", id: project.id }));
      continue;
    }
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
  const deletedProjectIds = new Set(changes.deletes?.projects ?? []);
  const headingsInDeletedProjects = new Set(before.headings.flatMap((heading) =>
    heading.location.kind === "project" && deletedProjectIds.has(heading.location.projectId) ? [heading.id] : []
  ));
  for (const original of before.toDos) {
    const removedWithProject = (original.location.kind === "project" && deletedProjectIds.has(original.location.projectId))
      || (original.location.kind === "heading" && headingsInDeletedProjects.has(original.location.headingId));
    if (deletedIds.has(original.id) && removedWithProject && changes.replaceWorkspace) continue;
    if (deletedIds.has(original.id)) {
      if (!original.trashedAt && changes.replaceWorkspace) {
        errors.push(...applyWorkspaceChange(workspace, { type: "trashToDo", id: original.id }));
      }
      if (original.trashedAt || changes.replaceWorkspace) errors.push(...applyWorkspaceChange(workspace, {
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
    if (current.occurrence && current.outcome === "open" && desiredOutcome === "canceled" && optionalString(item.loggedAt)) {
      errors.push(...applyWorkspaceChange(workspace, { type: "skipOccurrence", itemKind: "toDo", id: original.id }));
      continue;
    }
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

type IdQueues = Map<string, string[]>;

function queueCreatedIds(queues: IdQueues, values: Partial<Record<WorkspaceEntityKind | "projectClosure" | "undo", string[]>>): void {
  for (const [kind, ids] of Object.entries(values)) {
    if (!ids?.length) continue;
    queues.set(kind, [...(queues.get(kind) ?? []), ...ids]);
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function orderedIds<T extends { id: string; order: number }>(items: T[]): string[] {
  return [...items].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)).map((item) => item.id);
}

function applyDirectWorkspaceChange(
  workspace: Workspace,
  queues: IdQueues,
  change: WorkspaceChange,
  ids: Partial<Record<WorkspaceEntityKind | "projectClosure" | "undo", string[]>> = {},
): string[] {
  const queueSnapshot = new Map([...queues].map(([kind, queued]) => [kind, [...queued]]));
  queueCreatedIds(queues, ids);
  const errors = applyWorkspaceChange(workspace, change);
  if (errors.length) {
    queues.clear();
    for (const [kind, queued] of queueSnapshot) queues.set(kind, queued);
  }
  return errors;
}

function syncSettings(workspace: Workspace, candidate: WorkspaceDocument, queues: IdQueues): string[] {
  const errors: string[] = [];
  const current = workspace.read().settings;
  const applicationChanges = {
    ...(current.theme !== candidate.settings.theme ? { theme: candidate.settings.theme } : {}),
    ...(current.groupToday !== candidate.settings.groupToday ? { groupToday: candidate.settings.groupToday } : {}),
    ...(current.notifications !== candidate.settings.notifications ? { notifications: candidate.settings.notifications } : {}),
    ...(current.weekStartsOn !== candidate.settings.weekStartsOn ? { weekStartsOn: candidate.settings.weekStartsOn } : {}),
    ...(current.showCalendar !== candidate.settings.showCalendar ? { showCalendar: candidate.settings.showCalendar } : {}),
  };
  if (Object.keys(applicationChanges).length) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "updateSettings", changes: applicationChanges }));
  if (workspace.read().settings.logCompletedItems !== candidate.settings.logCompletedItems) {
    errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "setLogbookPolicy", policy: candidate.settings.logCompletedItems }));
  }
  const quickDraft = workspace.read().settings.quickDraft;
  if (!sameValue(quickDraft, candidate.settings.quickDraft)) {
    if (candidate.settings.quickDraft) {
      const viewType = candidate.settings.quickDraft.viewType;
      const view = viewType === "area" || viewType === "project" || viewType === "heading" || viewType === "space"
        ? { kind: viewType, id: candidate.settings.quickDraft.viewId ?? "" }
        : { kind: (viewType || "inbox") as "inbox" };
      errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "saveQuickDraft", value: candidate.settings.quickDraft.value, view }));
    } else {
      errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "clearQuickDraft" }));
    }
  }
  return errors;
}

function createTagsAndOrganization(workspace: Workspace, candidate: WorkspaceDocument, queues: IdQueues): string[] {
  const errors: string[] = [];
  let current = workspace.read();
  for (const tag of candidate.tags) {
    if (!current.tags.some((item) => item.id === tag.id)) {
      errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "createTag", title: tag.title }, { tag: [tag.id] }));
      current = workspace.read();
    }
  }
  for (const space of candidate.spaces) {
    if (!current.spaces.some((item) => item.id === space.id)) {
      errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "createSpace", title: space.title, color: space.color, pinned: space.pinned }, { space: [space.id] }));
      current = workspace.read();
    }
  }
  for (const area of candidate.areas) {
    if (!current.areas.some((item) => item.id === area.id)) {
      errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "createArea", title: area.title, spaceId: area.spaceId, color: area.color, tags: area.tags }, { area: [area.id] }));
      current = workspace.read();
    }
  }
  return errors;
}

function generatedOccurrenceIds(candidate: WorkspaceDocument, current: WorkspaceDocument): {
  projectIds: Set<string>;
  headingIds: Set<string>;
  toDoIds: Set<string>;
} {
  const currentProjectIds = new Set(current.projects.map((item) => item.id));
  const currentToDoIds = new Set(current.toDos.map((item) => item.id));
  const projectIds = new Set(candidate.projects.filter((item) => item.occurrence && !currentProjectIds.has(item.id)).map((item) => item.id));
  const headingIds = new Set(candidate.headings.filter((heading) => heading.location.kind === "project" && projectIds.has(heading.location.projectId)).map((heading) => heading.id));
  const toDoIds = new Set(candidate.toDos.filter((toDo) => {
    if (toDo.occurrence && !currentToDoIds.has(toDo.id)) return true;
    if (toDo.location.kind === "project") return projectIds.has(toDo.location.projectId);
    return toDo.location.kind === "heading" && headingIds.has(toDo.location.headingId);
  }).map((toDo) => toDo.id));
  return { projectIds, headingIds, toDoIds };
}

function createProjectsHeadingsAndToDos(
  workspace: Workspace,
  candidate: WorkspaceDocument,
  queues: IdQueues,
  generated: ReturnType<typeof generatedOccurrenceIds>,
): string[] {
  const errors: string[] = [];
  let current = workspace.read();
  for (const project of candidate.projects) {
    if (generated.projectIds.has(project.id) || current.projects.some((item) => item.id === project.id)) continue;
    errors.push(...applyDirectWorkspaceChange(workspace, queues, {
      type: "createProject", title: project.title, notes: project.notes, location: project.location,
      schedule: project.schedule, deadline: project.deadline, tags: project.tags,
    }, { project: [project.id] }));
    current = workspace.read();
  }
  for (const heading of candidate.headings) {
    if (generated.headingIds.has(heading.id) || current.headings.some((item) => item.id === heading.id)) continue;
    errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "createHeading", title: heading.title, location: heading.location }, { heading: [heading.id] }));
    if (heading.archivedAt) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "archiveHeading", id: heading.id }));
    current = workspace.read();
  }
  for (const toDo of candidate.toDos) {
    if (generated.toDoIds.has(toDo.id) || current.toDos.some((item) => item.id === toDo.id)) continue;
    errors.push(...applyDirectWorkspaceChange(workspace, queues, {
      type: "createToDo", title: toDo.title, notes: toDo.notes, location: toDo.location,
      schedule: toDo.schedule, reminderAt: toDo.reminder?.at ?? null, deadline: toDo.deadline,
      tags: toDo.tags, checklist: toDo.checklist.map((item) => item.title),
    }, { toDo: [toDo.id], checklistItem: toDo.checklist.map((item) => item.id) }));
    current = workspace.read();
  }
  return errors;
}

function repeatingTemplateChanges(current: RepeatingTemplate, desired: RepeatingTemplate) {
  return {
    ...(current.title !== desired.title ? { title: desired.title } : {}),
    ...(current.notes !== desired.notes ? { notes: desired.notes } : {}),
    ...(!sameValue(current.tags, desired.tags) ? { tags: desired.tags } : {}),
    ...(!sameValue(current.pattern, desired.pattern) ? { pattern: desired.pattern } : {}),
    ...(current.mode !== desired.mode ? { mode: desired.mode } : {}),
    ...(current.nextDate !== desired.nextDate ? { nextDate: desired.nextDate } : {}),
    ...(current.reminderTime !== desired.reminderTime ? { reminderTime: desired.reminderTime } : {}),
    ...(current.deadlineOffsetDays !== desired.deadlineOffsetDays ? { deadlineOffsetDays: desired.deadlineOffsetDays } : {}),
    ...(!sameValue(current.location, desired.location) ? { location: desired.location } : {}),
    ...(!sameValue(current.checklist.map((item) => item.title), desired.checklist.map((item) => item.title)) ? { checklist: desired.checklist.map((item) => item.title) } : {}),
    ...(desired.itemKind === "project" && current.itemKind === "project" && !sameValue(current.projectContents, desired.projectContents)
      ? { projectContents: desired.projectContents } : {}),
  };
}

function createAndUpdateRepeatingTemplates(workspace: Workspace, candidate: WorkspaceDocument, queues: IdQueues): string[] {
  const errors: string[] = [];
  for (const desired of candidate.repeatingTemplates) {
    let currentDocument = workspace.read();
    let current = currentDocument.repeatingTemplates.find((item) => item.id === desired.id);
    if (!current) {
      const linkedToDo = candidate.toDos.find((item) => item.occurrence?.templateId === desired.id && currentDocument.toDos.some((before) => before.id === item.id && !before.occurrence));
      const linkedProject = candidate.projects.find((item) => item.occurrence?.templateId === desired.id && currentDocument.projects.some((before) => before.id === item.id && !before.occurrence));
      if (linkedToDo && desired.itemKind === "toDo") {
        errors.push(...applyDirectWorkspaceChange(workspace, queues, {
          type: "makeToDoRepeating", id: linkedToDo.id, nextDate: desired.firstDate ?? desired.nextDate,
          pattern: desired.pattern, mode: desired.mode,
        }, { repeatingTemplate: [desired.id] }));
      } else if (linkedProject && desired.itemKind === "project") {
        errors.push(...applyDirectWorkspaceChange(workspace, queues, {
          type: "makeProjectRepeating", id: linkedProject.id, firstDate: desired.firstDate ?? desired.nextDate,
          pattern: desired.pattern, mode: desired.mode,
        }, { repeatingTemplate: [desired.id] }));
      } else {
        const template = desired.itemKind === "toDo"
          ? {
              itemKind: "toDo" as const, title: desired.title, notes: desired.notes, tags: desired.tags,
              checklist: desired.checklist.map((item) => item.title), pattern: desired.pattern, mode: desired.mode,
              firstDate: desired.firstDate ?? desired.nextDate, reminderTime: desired.reminderTime,
              deadlineOffsetDays: desired.deadlineOffsetDays, location: desired.location,
            }
          : {
              itemKind: "project" as const, title: desired.title, notes: desired.notes, tags: desired.tags,
              pattern: desired.pattern, mode: desired.mode, firstDate: desired.firstDate ?? desired.nextDate,
              reminderTime: desired.reminderTime, deadlineOffsetDays: desired.deadlineOffsetDays,
              location: desired.location, projectContents: desired.projectContents,
            };
        errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "createRepeatingTemplate", template }, {
          repeatingTemplate: [desired.id], checklistItem: desired.checklist.map((item) => item.id),
        }));
      }
      current = workspace.read().repeatingTemplates.find((item) => item.id === desired.id);
    }
    if (!current) continue;
    if (current.state !== "stopped") {
      const changes = repeatingTemplateChanges(current, desired);
      if (Object.keys(changes).length) {
        const checklistIds = "checklist" in changes ? desired.checklist.map((item) => item.id) : [];
        errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "updateRepeatingTemplate", id: desired.id, changes }, { checklistItem: checklistIds }));
      }
      current = workspace.read().repeatingTemplates.find((item) => item.id === desired.id)!;
      if (desired.state === "paused" && current.state === "active") errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "pauseRepeatingTemplate", id: desired.id }));
      if (desired.state === "active" && current.state === "paused") errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "resumeRepeatingTemplate", id: desired.id }));
      if (desired.state === "stopped" && current.state !== "stopped") errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "stopRepeatingTemplate", id: desired.id }));
    }
  }
  return errors;
}

function generateNewOccurrences(
  workspace: Workspace,
  candidate: WorkspaceDocument,
  queues: IdQueues,
  generated: ReturnType<typeof generatedOccurrenceIds>,
): string[] {
  if (!generated.projectIds.size && !generated.toDoIds.size) return [];
  const projectIds: string[] = [];
  const headingIds: string[] = [];
  const toDoIds: string[] = [];
  const checklistItemIds: string[] = [];
  let throughDate = "";
  for (const template of workspace.read().repeatingTemplates) {
    if (template.itemKind === "toDo") {
      const occurrences = candidate.toDos
        .filter((item) => generated.toDoIds.has(item.id) && item.occurrence?.templateId === template.id)
        .sort((left, right) => left.occurrence!.scheduledDate.localeCompare(right.occurrence!.scheduledDate));
      for (const occurrence of occurrences) {
        toDoIds.push(occurrence.id);
        checklistItemIds.push(...occurrence.checklist.sort((left, right) => left.order - right.order).map((item) => item.id));
        if (occurrence.occurrence!.scheduledDate > throughDate) throughDate = occurrence.occurrence!.scheduledDate;
      }
      continue;
    }
    const occurrences = candidate.projects
      .filter((item) => generated.projectIds.has(item.id) && item.occurrence?.templateId === template.id)
      .sort((left, right) => left.occurrence!.scheduledDate.localeCompare(right.occurrence!.scheduledDate));
    for (const occurrence of occurrences) {
      projectIds.push(occurrence.id);
      const headings = candidate.headings.filter((item) => item.location.kind === "project" && item.location.projectId === occurrence.id).sort((left, right) => left.order - right.order);
      const headingSet = new Set(headings.map((item) => item.id));
      const children = candidate.toDos.filter((item) => item.location.kind === "project" && item.location.projectId === occurrence.id
        || item.location.kind === "heading" && headingSet.has(item.location.headingId)).sort((left, right) => left.order - right.order);
      headingIds.push(...headings.map((item) => item.id));
      toDoIds.push(...children.map((item) => item.id));
      for (const child of children) checklistItemIds.push(...child.checklist.sort((left, right) => left.order - right.order).map((item) => item.id));
      if (occurrence.occurrence!.scheduledDate > throughDate) throughDate = occurrence.occurrence!.scheduledDate;
    }
  }
  if (!throughDate) return ["New Occurrences could not be matched to their Repeating Templates."];
  return applyDirectWorkspaceChange(workspace, queues, { type: "generateRepeatingOccurrences", throughDate }, {
    project: projectIds, heading: headingIds, toDo: toDoIds, checklistItem: checklistItemIds,
  });
}

function updateEntities(workspace: Workspace, candidate: WorkspaceDocument, queues: IdQueues): string[] {
  const errors: string[] = [];
  for (const desired of candidate.spaces) {
    const current = workspace.read().spaces.find((item) => item.id === desired.id);
    if (!current) continue;
    const changes = {
      ...(current.title !== desired.title ? { title: desired.title } : {}),
      ...(current.color !== desired.color ? { color: desired.color } : {}),
      ...(current.pinned !== desired.pinned ? { pinned: desired.pinned } : {}),
    };
    if (Object.keys(changes).length) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "updateSpace", id: desired.id, changes }));
  }
  for (const desired of candidate.areas) {
    const current = workspace.read().areas.find((item) => item.id === desired.id);
    if (!current) continue;
    const changes = {
      ...(current.title !== desired.title ? { title: desired.title } : {}),
      ...(current.spaceId !== desired.spaceId ? { spaceId: desired.spaceId } : {}),
      ...(current.color !== desired.color ? { color: desired.color } : {}),
      ...(!sameValue(current.tags, desired.tags) ? { tags: desired.tags } : {}),
    };
    if (Object.keys(changes).length) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "updateArea", id: desired.id, changes }));
  }
  for (const desired of candidate.projects) {
    const current = workspace.read().projects.find((item) => item.id === desired.id);
    if (!current) continue;
    const changes = {
      ...(current.title !== desired.title ? { title: desired.title } : {}),
      ...(current.notes !== desired.notes ? { notes: desired.notes } : {}),
      ...(!sameValue(current.location, desired.location) ? { location: desired.location } : {}),
      ...(!sameValue(current.schedule, desired.schedule) ? { schedule: desired.schedule } : {}),
      ...(current.deadline !== desired.deadline ? { deadline: desired.deadline } : {}),
      ...(!sameValue(current.tags, desired.tags) ? { tags: desired.tags } : {}),
    };
    if (Object.keys(changes).length) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "updateProject", id: desired.id, changes }));
  }
  for (const desired of candidate.headings) {
    const current = workspace.read().headings.find((item) => item.id === desired.id);
    if (!current) continue;
    const changes = {
      ...(current.title !== desired.title ? { title: desired.title } : {}),
      ...(!sameValue(current.location, desired.location) ? { location: desired.location } : {}),
    };
    if (Object.keys(changes).length) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "updateHeading", id: desired.id, changes }));
    const latest = workspace.read().headings.find((item) => item.id === desired.id);
    if (desired.archivedAt && !latest?.archivedAt) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "archiveHeading", id: desired.id }));
    if (!desired.archivedAt && latest?.archivedAt) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "restoreHeading", id: desired.id }));
  }
  for (const desired of candidate.toDos) {
    const current = workspace.read().toDos.find((item) => item.id === desired.id);
    if (!current) continue;
    const changes = {
      ...(current.title !== desired.title ? { title: desired.title } : {}),
      ...(current.notes !== desired.notes ? { notes: desired.notes } : {}),
      ...(!sameValue(current.location, desired.location) ? { location: desired.location } : {}),
      ...(!sameValue(current.schedule, desired.schedule) ? { schedule: desired.schedule } : {}),
      ...(!sameValue(current.reminder, desired.reminder) ? { reminder: desired.reminder } : {}),
      ...(current.deadline !== desired.deadline ? { deadline: desired.deadline } : {}),
      ...(!sameValue(current.tags, desired.tags) ? { tags: desired.tags } : {}),
    };
    if (Object.keys(changes).length) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "updateToDo", id: desired.id, changes }));
    let latest = workspace.read().toDos.find((item) => item.id === desired.id)!;
    const desiredIds = new Set(desired.checklist.map((item) => item.id));
    for (const item of latest.checklist) if (!desiredIds.has(item.id)) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "removeChecklistItem", toDoId: desired.id, itemId: item.id }));
    latest = workspace.read().toDos.find((item) => item.id === desired.id)!;
    for (const item of desired.checklist) {
      if (!latest.checklist.some((candidateItem) => candidateItem.id === item.id)) {
        errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "addChecklistItem", toDoId: desired.id, title: item.title }, { checklistItem: [item.id] }));
        latest = workspace.read().toDos.find((candidateItem) => candidateItem.id === desired.id)!;
      }
      const actual = latest.checklist.find((candidateItem) => candidateItem.id === item.id);
      if (actual && (actual.title !== item.title || actual.completed !== item.completed)) {
        errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "updateChecklistItem", toDoId: desired.id, itemId: item.id, changes: { title: item.title, completed: item.completed } }));
      }
    }
    latest = workspace.read().toDos.find((item) => item.id === desired.id)!;
    const desiredChecklistOrder = orderedIds(desired.checklist);
    if (!sameValue(orderedIds(latest.checklist), desiredChecklistOrder) && desiredChecklistOrder.length) {
      errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "reorderChecklistItems", toDoId: desired.id, orderedIds: desiredChecklistOrder }));
    }
  }
  for (const desired of candidate.calendarEvents) {
    const current = workspace.read().calendarEvents.find((item) => item.id === desired.id);
    if (!current) {
      errors.push(...applyDirectWorkspaceChange(workspace, queues, {
        type: "createCalendarEvent", title: desired.title, spaceId: desired.spaceId, start: desired.start,
        end: desired.end, calendar: desired.calendar, allDay: desired.allDay,
      }, { calendarEvent: [desired.id] }));
      continue;
    }
    const changes = {
      ...(current.title !== desired.title ? { title: desired.title } : {}),
      ...(current.spaceId !== desired.spaceId ? { spaceId: desired.spaceId } : {}),
      ...(current.start !== desired.start ? { start: desired.start } : {}),
      ...(current.end !== desired.end ? { end: desired.end } : {}),
      ...(current.calendar !== desired.calendar ? { calendar: desired.calendar } : {}),
      ...(current.allDay !== desired.allDay ? { allDay: desired.allDay } : {}),
    };
    if (Object.keys(changes).length) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "updateCalendarEvent", id: desired.id, changes }));
  }
  return errors;
}

function applyOrders(workspace: Workspace, candidate: WorkspaceDocument, queues: IdQueues): string[] {
  const errors: string[] = [];
  const desiredSpaces = orderedIds(candidate.spaces);
  for (let index = 0; index < desiredSpaces.length; index += 1) {
    if (workspace.read().spaces[index]?.id !== desiredSpaces[index]) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "reorderSpace", id: desiredSpaces[index], toIndex: index }));
  }
  const collections = [
    ["areas", "reorderAreas", orderedIds(candidate.areas)],
    ["projects", "reorderProjects", orderedIds(candidate.projects)],
    ["headings", "reorderHeadings", orderedIds(candidate.headings)],
    ["tags", "reorderTags", orderedIds(candidate.tags)],
  ] as const;
  for (const [name, type, ids] of collections) {
    if (ids.length && !sameValue(orderedIds(workspace.read()[name]), ids)) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type, orderedIds: ids }));
  }
  const toDoOrder = orderedIds(candidate.toDos);
  if (toDoOrder.length && !sameValue(orderedIds(workspace.read().toDos), toDoOrder)) {
    errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "reorderToDos", movedIds: toDoOrder, orderedIds: toDoOrder }));
  }
  return errors;
}

function removeMissingEntities(workspace: Workspace, candidate: WorkspaceDocument, queues: IdQueues): string[] {
  const errors: string[] = [];
  const desiredCalendar = new Set(candidate.calendarEvents.map((item) => item.id));
  for (const item of workspace.read().calendarEvents) if (!desiredCalendar.has(item.id)) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "deleteCalendarEvent", id: item.id }));
  const desiredTemplates = new Set(candidate.repeatingTemplates.map((item) => item.id));
  for (const item of workspace.read().repeatingTemplates) {
    if (desiredTemplates.has(item.id)) continue;
    if (item.state !== "stopped") errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "stopRepeatingTemplate", id: item.id }));
    errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "deleteRepeatingTemplate", id: item.id, confirmation: DELETE_REPEATING_TEMPLATE_CONFIRMATION }));
  }
  const desiredToDos = new Set(candidate.toDos.map((item) => item.id));
  for (const item of workspace.read().toDos) {
    if (desiredToDos.has(item.id) || !item.trashedAt) continue;
    errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "permanentlyDeleteToDo", id: item.id, confirmation: PERMANENT_DELETE_CONFIRMATION }));
  }
  const desiredProjects = new Set(candidate.projects.map((item) => item.id));
  for (const item of workspace.read().projects) {
    if (desiredProjects.has(item.id) || !item.trashedAt) continue;
    errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "permanentlyDeleteProject", id: item.id, confirmation: PERMANENT_DELETE_CONFIRMATION }));
  }
  const desiredHeadings = new Set(candidate.headings.map((item) => item.id));
  for (const item of workspace.read().headings) if (!desiredHeadings.has(item.id)) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "deleteHeading", id: item.id, confirmation: DELETE_HEADING_CONFIRMATION }));
  const desiredAreas = new Set(candidate.areas.map((item) => item.id));
  for (const item of workspace.read().areas) if (!desiredAreas.has(item.id)) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "removeArea", id: item.id, confirmation: REMOVE_AREA_CONFIRMATION }));
  const desiredSpaces = new Set(candidate.spaces.map((item) => item.id));
  for (const item of workspace.read().spaces) {
    if (desiredSpaces.has(item.id)) continue;
    errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "deleteSpace", id: item.id, moveToSpaceId: candidate.spaces[0].id, confirmation: DELETE_SPACE_CONFIRMATION }));
  }
  const desiredTags = new Set(candidate.tags.map((item) => item.id));
  for (const item of workspace.read().tags) if (!desiredTags.has(item.id)) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "deleteTag", id: item.id, confirmation: DELETE_TAG_CONFIRMATION }));
  return errors;
}

function finishSettingsAndLogbook(workspace: Workspace, candidate: WorkspaceDocument, queues: IdQueues): string[] {
  const errors: string[] = [];
  if (candidate.settings.defaultSpaceId && workspace.read().settings.defaultSpaceId !== candidate.settings.defaultSpaceId) {
    errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "setDefaultSpace", spaceId: candidate.settings.defaultSpaceId }));
  }
  if (!sameValue(workspace.read().settings.launchRules, candidate.settings.launchRules)) {
    errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "replaceLaunchRules", rules: candidate.settings.launchRules }));
  }
  for (const desired of candidate.toDos) {
    const current = workspace.read().toDos.find((item) => item.id === desired.id);
    if (desired.logbookAt && current && current.outcome !== "open" && !current.logbookAt) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "logToDo", id: desired.id }));
  }
  for (const desired of candidate.projects) {
    const current = workspace.read().projects.find((item) => item.id === desired.id);
    if (desired.logbookAt && current && current.outcome !== "open" && !current.logbookAt) errors.push(...applyDirectWorkspaceChange(workspace, queues, { type: "logProject", id: desired.id }));
  }
  return errors;
}

function syncCandidateThroughWorkspace(
  workspace: Workspace,
  before: WorkspaceDocument,
  candidate: WorkspaceDocument,
  queues: IdQueues,
): string[] {
  const generated = generatedOccurrenceIds(candidate, before);
  const errors = [
    ...syncSettings(workspace, candidate, queues),
    ...createTagsAndOrganization(workspace, candidate, queues),
    ...createProjectsHeadingsAndToDos(workspace, candidate, queues, generated),
    ...createAndUpdateRepeatingTemplates(workspace, candidate, queues),
    ...generateNewOccurrences(workspace, candidate, queues, generated),
    ...updateEntities(workspace, candidate, queues),
    ...removeMissingEntities(workspace, candidate, queues),
    ...applyOrders(workspace, candidate, queues),
    ...finishSettingsAndLogbook(workspace, candidate, queues),
  ];
  const unusedIds = [...queues.entries()].filter(([, ids]) => ids.length).flatMap(([kind, ids]) => ids.map((id) => `${kind}:${id}`));
  if (unusedIds.length) errors.push(`Workspace identity assignment was incomplete for ${unusedIds.join(", ")}.`);
  return errors;
}

export function applyInterfaceChangeSetToWorkspace(
  document: WorkspaceDocument,
  changeSet: InterfaceChangeSet,
  dependencies: WorkspaceDependencies,
): InterfaceBridgeResult {
  if (!changeSet.mutationId || changeSet.mutationId.length > 200) return { ok: false, errors: ["A valid interface mutation identity is required."] };
  const today = dependencies.now().slice(0, 10);
  const idQueues: IdQueues = new Map();
  const workspace = createWorkspace(document, {
    now: dependencies.now,
    createId: (kind) => idQueues.get(kind)?.shift() ?? dependencies.createId(kind),
  });
  queueExplicitInterfaceIds(changeSet, idQueues);
  const explicitChanges = changeSet.workspaceChanges ?? [];
  if (explicitChanges.length) {
    const result = workspace.changeMany(explicitChanges);
    if (result.status === "rejected") return { ok: false, errors: result.errors };
  }
  const compatibilityChangeSet = withoutInferredLifecycleChanges(changeSet);
  const lifecycleStart = workspace.read();
  const desiredState = applyChangeSet(workspaceDocumentToInterfaceState(lifecycleStart, today), compatibilityChangeSet);
  const behaviorErrors = [
    ...applyProjectLifecycleChanges(workspace, lifecycleStart, desiredState, compatibilityChangeSet),
    ...applyToDoLifecycleChanges(workspace, lifecycleStart, desiredState, compatibilityChangeSet),
  ];
  if (behaviorErrors.length) return { ok: false, errors: behaviorErrors };
  const behaviorDocument = workspace.read();
  const state = applyChangeSet(workspaceDocumentToInterfaceState(behaviorDocument, today), compatibilityChangeSet);
  const candidate = documentFromInterfaceState(state, behaviorDocument, dependencies);
  if (!candidate) return { ok: false, errors: ["The interface change would leave the Workspace without a Space."] };
  const synchronizationErrors = syncCandidateThroughWorkspace(workspace, behaviorDocument, candidate, idQueues);
  if (synchronizationErrors.length) return { ok: false, errors: synchronizationErrors };
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
