import type {
  AffectedEntity,
  Area,
  ChecklistItem,
  EntityId,
  Heading,
  HeadingLocation,
  IsoDateTime,
  LogbookPolicy,
  Outcome,
  Project,
  ProjectLocation,
  RepeatingProjectContents,
  Schedule,
  Space,
  Tag,
  ToDo,
  ToDoLocation,
  WorkspaceChangeResult,
  WorkspaceDocument,
  WorkspaceEntityKind,
} from "./model.ts";
import { createEmptyImportReport, parsePortableBackup, type ImportReport } from "./importer.ts";

export const FULL_IMPORT_CONFIRMATION = "REPLACE WORKSPACE";
export const PERMANENT_DELETE_CONFIRMATION = "DELETE FOREVER";
export const EMPTY_TRASH_CONFIRMATION = "EMPTY TRASH";
export const DELETE_SPACE_CONFIRMATION = "DELETE SPACE";
export const REMOVE_AREA_CONFIRMATION = "REMOVE AREA";
export const DELETE_HEADING_CONFIRMATION = "DELETE HEADING";
export const DELETE_TAG_CONFIRMATION = "DELETE TAG";

export type WorkspaceDependencies = {
  now: () => IsoDateTime;
  createId: (kind: WorkspaceEntityKind | "projectClosure" | "undo") => string;
};

export type ToDoChanges = Partial<Pick<ToDo, "title" | "notes" | "location" | "schedule" | "reminder" | "deadline" | "tags">>;
export type ProjectChanges = Partial<Pick<Project, "title" | "notes" | "location" | "schedule" | "deadline" | "tags">>;
export type AreaChanges = Partial<Pick<Area, "title" | "spaceId" | "color" | "tags">>;
export type HeadingChanges = Partial<Pick<Heading, "title" | "location">>;
export type SpaceChanges = Partial<Pick<Space, "title" | "color" | "pinned">>;

export type WorkspaceChange =
  | { type: "createSpace"; title: string; color: string; pinned?: boolean }
  | { type: "updateSpace"; id: EntityId; changes: SpaceChanges }
  | { type: "reorderSpace"; id: EntityId; toIndex: number }
  | { type: "deleteSpace"; id: EntityId; moveToSpaceId: EntityId; confirmation: string }
  | { type: "createArea"; title: string; spaceId: EntityId; color?: string; tags?: EntityId[] }
  | { type: "updateArea"; id: EntityId; changes: AreaChanges }
  | { type: "removeArea"; id: EntityId; confirmation: string }
  | { type: "createProject"; title: string; location: ProjectLocation; notes?: string; schedule?: Schedule; deadline?: string | null; tags?: EntityId[] }
  | { type: "updateProject"; id: EntityId; changes: ProjectChanges }
  | { type: "duplicateProject"; id: EntityId }
  | { type: "closeProject"; id: EntityId; outcome: Exclude<Outcome, "open">; toDoOutcomes: Array<{ id: EntityId; outcome: Exclude<Outcome, "open"> }> }
  | { type: "restoreProject"; id: EntityId }
  | { type: "trashProject"; id: EntityId }
  | { type: "restoreProjectFromTrash"; id: EntityId }
  | { type: "permanentlyDeleteProject"; id: EntityId; confirmation: string }
  | { type: "createHeading"; title: string; location: HeadingLocation }
  | { type: "updateHeading"; id: EntityId; changes: HeadingChanges }
  | { type: "duplicateHeading"; id: EntityId }
  | { type: "archiveHeading"; id: EntityId }
  | { type: "restoreHeading"; id: EntityId }
  | { type: "deleteHeading"; id: EntityId; confirmation: string }
  | { type: "convertHeadingToProject"; id: EntityId }
  | { type: "createTag"; title: string }
  | { type: "updateTag"; id: EntityId; title: string }
  | { type: "deleteTag"; id: EntityId; confirmation: string }
  | { type: "createToDo"; title: string; notes?: string; location?: ToDoLocation; schedule?: Schedule; reminderAt?: string | null; deadline?: string | null; tags?: EntityId[]; checklist?: string[]; quickEntry?: { referenceDate: string } }
  | { type: "updateToDo"; id: EntityId; changes: ToDoChanges }
  | { type: "setToDoTags"; id: EntityId; titles: string[] }
  | { type: "saveQuickDraft"; value: string; view: WorkspaceView }
  | { type: "clearQuickDraft" }
  | { type: "addChecklistItem"; toDoId: EntityId; title: string }
  | { type: "updateChecklistItem"; toDoId: EntityId; itemId: EntityId; changes: Partial<Pick<ChecklistItem, "title" | "completed">> }
  | { type: "removeChecklistItem"; toDoId: EntityId; itemId: EntityId }
  | { type: "reorderToDos"; movedIds: EntityId[]; orderedIds: EntityId[]; destination?: { location?: ToDoLocation; schedule?: Schedule } }
  | { type: "makeToDoRepeating"; id: EntityId; nextDate: string }
  | { type: "completeToDo"; id: EntityId }
  | { type: "cancelToDo"; id: EntityId }
  | { type: "reopenToDo"; id: EntityId }
  | { type: "duplicateToDo"; id: EntityId }
  | { type: "logToDo"; id: EntityId }
  | { type: "runDailyLogbook"; spaceId?: EntityId }
  | { type: "setLogbookPolicy"; policy: LogbookPolicy }
  | { type: "setTheme"; theme: WorkspaceDocument["settings"]["theme"] }
  | { type: "trashToDo"; id: EntityId }
  | { type: "restoreToDo"; id: EntityId }
  | { type: "permanentlyDeleteToDo"; id: EntityId; confirmation: string }
  | { type: "emptyTrash"; spaceId: EntityId; confirmation: string }
  | { type: "snoozeReminder"; id: EntityId; until: string };

export type Workspace = {
  read(): WorkspaceDocument;
  change(change: WorkspaceChange): WorkspaceChangeResult;
  changeMany(changes: WorkspaceChange[]): WorkspaceChangeResult;
  undo(token: string): WorkspaceChangeResult;
  view(view: WorkspaceView): Array<ToDo | Project>;
  spaceIdForView(view: WorkspaceView): EntityId | null;
  locationOfToDo(id: EntityId): EffectiveToDoLocation | null;
  effectiveTagIdsForToDo(id: EntityId): EntityId[];
  effectiveTagIdsForProject(id: EntityId): EntityId[];
  projectProgress(id: EntityId): ProjectProgress | null;
  validate(): string[];
  importPortableBackup(serialized: string, confirmation: string): WorkspaceImportResult;
};

export type WorkspaceImportResult =
  | {
      status: "changed";
      outcome: "backup-imported";
      affected: AffectedEntity[];
      undo: null;
      report: ImportReport;
    }
  | {
      status: "rejected";
      outcome: "confirmation-required" | "import-rejected";
      affected: [];
      undo: null;
      errors: string[];
      report: ImportReport;
    };

export type WorkspaceView = (
  | { kind: "today" | "thisEvening" | "tomorrow" | "upcoming" | "inbox" | "anytime" | "someday" | "deadlines" | "trash" | "logbook"; date: string }
  | { kind: "space" | "area" | "project" | "heading"; id: EntityId; date: string }
) & { tagIds?: EntityId[] };

export type EffectiveToDoLocation = {
  headingId?: EntityId;
  projectId?: EntityId;
  areaId?: EntityId;
  spaceId: EntityId;
};

export type ProjectProgress = {
  total: number;
  open: number;
  completed: number;
  canceled: number;
  percent: number;
};

type UndoEntry = {
  affected: AffectedEntity[];
  run: () => void;
};

function copyDocument<T>(document: T): T {
  return JSON.parse(JSON.stringify(document)) as T;
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function isTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function nextWeekday(referenceDate: string, weekday: string): string {
  const current = new Date(`${referenceDate}T00:00:00.000Z`).getUTCDay();
  const target = WEEKDAYS.indexOf(weekday.toLowerCase());
  const distance = (target - current + 7) % 7 || 7;
  return addDays(referenceDate, distance);
}

type ParsedQuickEntry = {
  title: string;
  schedule?: Schedule;
  reminderAt?: string;
  deadline?: string;
  tagTitles: string[];
};

function parseClock(hourText: string, minuteText: string | undefined, meridiem: string | undefined): string | null {
  let hour = Number(hourText);
  const minute = Number(minuteText ?? "0");
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem.toLowerCase() === "pm" && hour !== 12) hour += 12;
    if (meridiem.toLowerCase() === "am" && hour === 12) hour = 0;
  } else if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseQuickEntry(value: string, referenceDate: string): ParsedQuickEntry {
  let title = value;
  let schedule: Schedule | undefined;
  let deadline: string | undefined;
  let reminderAt: string | undefined;

  const deadlineMatch = /\bdue\s+(today|tomorrow|(?:next\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|\d{4}-\d{2}-\d{2})\b/i.exec(title);
  if (deadlineMatch) {
    const phrase = deadlineMatch[1].toLowerCase();
    deadline = phrase === "today" ? referenceDate
      : phrase === "tomorrow" ? addDays(referenceDate, 1)
      : /^\d{4}/.test(phrase) ? phrase
      : nextWeekday(referenceDate, phrase.replace(/^next\s+/, ""));
    title = title.replace(deadlineMatch[0], " ");
  }

  const relativeMatch = /\bin\s+(\d+)\s+(day|week)s?\b/i.exec(title);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]) * (relativeMatch[2].toLowerCase() === "week" ? 7 : 1);
    schedule = { kind: "scheduled", date: addDays(referenceDate, amount), evening: false };
    title = title.replace(relativeMatch[0], " ");
  }

  const scheduleMatch = /\b(this evening|today|tomorrow|someday|anytime|inbox|(?:next\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|\d{4}-\d{2}-\d{2})\b/i.exec(title);
  if (scheduleMatch) {
    const phrase = scheduleMatch[1].toLowerCase();
    if (phrase === "someday" || phrase === "anytime" || phrase === "inbox") schedule = { kind: phrase } as Schedule;
    else {
      const date = phrase === "today" || phrase === "this evening" ? referenceDate
        : phrase === "tomorrow" ? addDays(referenceDate, 1)
        : /^\d{4}/.test(phrase) ? phrase
        : nextWeekday(referenceDate, phrase.replace(/^next\s+/, ""));
      schedule = { kind: "scheduled", date, evening: phrase === "this evening" };
    }
    title = title.replace(scheduleMatch[0], " ");
  }

  const timeMatch = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(title);
  if (timeMatch && schedule?.kind === "scheduled") {
    const time = parseClock(timeMatch[1], timeMatch[2], timeMatch[3]);
    if (time) reminderAt = `${schedule.date}T${time}:00.000Z`;
    title = title.replace(timeMatch[0], " ");
  }

  const tagTitles: string[] = [];
  title = title.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_match, spacing: string, tag: string) => {
    if (!tagTitles.some((item) => item.toLowerCase() === tag.toLowerCase())) tagTitles.push(tag);
    return spacing;
  });

  return { title: title.replace(/\s+/g, " ").trim(), schedule, reminderAt, deadline, tagTitles };
}

export function createEmptyWorkspace(now: IsoDateTime): WorkspaceDocument {
  return {
    format: "objects-workspace",
    version: 1,
    settings: {
      theme: "system",
      groupToday: true,
      notifications: false,
      weekStartsOn: 1,
      showCalendar: true,
      logCompletedItems: "daily",
      defaultSpaceId: null,
      launchRules: [],
      quickDraft: null,
    },
    spaces: [],
    areas: [],
    projects: [],
    headings: [],
    tags: [],
    toDos: [],
    repeatingTemplates: [],
    projectClosures: [],
    calendarEvents: [],
    permanentDeletions: [],
    sync: { revision: 0, lastMutationId: null, updatedAt: now },
  };
}

export function createWorkspace(initial: WorkspaceDocument, dependencies: WorkspaceDependencies): Workspace {
  let document = copyDocument(initial);
  const undoEntries = new Map<string, UndoEntry>();

  function reject(errors: string[]): WorkspaceChangeResult {
    return {
      status: "rejected",
      outcome: "validation-failed",
      affected: [],
      undo: null,
      errors,
    };
  }

  function rejectAs(outcome: "validation-failed" | "not-found" | "confirmation-required", errors: string[]): WorkspaceChangeResult {
    return { status: "rejected", outcome, affected: [], undo: null, errors };
  }

  function finishChange(
    previous: WorkspaceDocument,
    outcome: string,
    affected: AffectedEntity[],
    undoLabel: string | null = null,
  ): WorkspaceChangeResult {
    document.sync.updatedAt = dependencies.now();
    if (!undoLabel) return { status: "changed", outcome, affected, undo: null };
    const token = dependencies.createId("undo");
    undoEntries.set(token, {
      affected,
      run: () => {
        document = copyDocument(previous);
        document.sync.updatedAt = dependencies.now();
      },
    });
    return { status: "changed", outcome, affected, undo: { token, label: undoLabel } };
  }

  function findToDo(id: EntityId): ToDo | null {
    return document.toDos.find((item) => item.id === id) ?? null;
  }

  function assignToDoSchedule(toDo: ToDo, schedule: Schedule): void {
    if (
      toDo.schedule.kind === "scheduled"
      && schedule.kind === "scheduled"
      && toDo.reminder?.at.slice(0, 10) === toDo.schedule.date
    ) {
      toDo.reminder.at = `${schedule.date}${toDo.reminder.at.slice(10)}`;
      toDo.reminder.sentAt = null;
    }
    toDo.schedule = schedule;
  }

  function duplicateToDoRecord(toDo: ToDo, location: ToDoLocation, order: number, title = toDo.title): ToDo {
    return {
      ...copyDocument(toDo),
      id: dependencies.createId("toDo"),
      title,
      location,
      checklist: toDo.checklist.map((item, itemOrder) => ({
        ...item,
        id: dependencies.createId("checklistItem"),
        order: itemOrder,
      })),
      outcome: "open",
      trashedAt: null,
      logbookAt: null,
      occurrence: null,
      createdAt: dependencies.now(),
      completedAt: null,
      order,
    };
  }

  function projectLocationExists(location: ProjectLocation): boolean {
    return location.kind === "space"
      ? document.spaces.some((space) => space.id === location.spaceId)
      : document.areas.some((area) => area.id === location.areaId);
  }

  function headingLocationExists(location: HeadingLocation): boolean {
    return location.kind === "project"
      ? document.projects.some((project) => project.id === location.projectId)
      : document.areas.some((area) => area.id === location.areaId);
  }

  function locationExists(location: ToDoLocation): boolean {
    if (location.kind === "unfiled") return document.spaces.some((space) => space.id === location.spaceId);
    if (location.kind === "area") return document.areas.some((area) => area.id === location.areaId);
    if (location.kind === "project") return document.projects.some((project) => project.id === location.projectId);
    return document.headings.some((heading) => heading.id === location.headingId);
  }

  function locationOfToDo(id: EntityId): EffectiveToDoLocation | null {
    const toDo = document.toDos.find((item) => item.id === id);
    if (!toDo) return null;
    if (toDo.location.kind === "unfiled") return { spaceId: toDo.location.spaceId };

    let headingId: EntityId | undefined;
    let projectId: EntityId | undefined;
    let areaId: EntityId | undefined;
    if (toDo.location.kind === "heading") {
      headingId = toDo.location.headingId;
      const heading = document.headings.find((item) => item.id === headingId);
      if (!heading) return null;
      if (heading.location.kind === "project") projectId = heading.location.projectId;
      else areaId = heading.location.areaId;
    } else if (toDo.location.kind === "project") {
      projectId = toDo.location.projectId;
    } else {
      areaId = toDo.location.areaId;
    }

    if (projectId) {
      const project = document.projects.find((item) => item.id === projectId);
      if (!project) return null;
      if (project.location.kind === "area") areaId = project.location.areaId;
      else return { ...(headingId ? { headingId } : {}), projectId, spaceId: project.location.spaceId };
    }

    if (!areaId) return null;
    const area = document.areas.find((item) => item.id === areaId);
    if (!area) return null;
    return {
      ...(headingId ? { headingId } : {}),
      ...(projectId ? { projectId } : {}),
      areaId,
      spaceId: area.spaceId,
    };
  }

  function spaceIdForView(view: WorkspaceView): EntityId | null {
    if (view.kind === "space") return view.id;
    if (view.kind === "area") return document.areas.find((area) => area.id === view.id)?.spaceId ?? null;
    if (view.kind === "project") {
      const project = document.projects.find((item) => item.id === view.id);
      if (!project) return null;
      const location = project.location;
      return location.kind === "space"
        ? location.spaceId
        : document.areas.find((area) => area.id === location.areaId)?.spaceId ?? null;
    }
    if (view.kind === "heading") {
      const heading = document.headings.find((item) => item.id === view.id);
      if (!heading) return null;
      const location = heading.location;
      return location.kind === "area"
        ? document.areas.find((area) => area.id === location.areaId)?.spaceId ?? null
        : spaceIdForView({ kind: "project", id: location.projectId, date: view.date });
    }
    return null;
  }

  function projectToDos(projectId: EntityId): ToDo[] {
    return document.toDos.filter((toDo) => locationOfToDo(toDo.id)?.projectId === projectId);
  }

  function effectiveTagIdsForProject(id: EntityId): EntityId[] {
    const project = document.projects.find((item) => item.id === id);
    if (!project) return [];
    const location = project.location;
    const areaTags = location.kind === "area"
      ? document.areas.find((area) => area.id === location.areaId)?.tags ?? []
      : [];
    return [...new Set([...areaTags, ...project.tags])];
  }

  function effectiveTagIdsForToDo(id: EntityId): EntityId[] {
    const toDo = document.toDos.find((item) => item.id === id);
    const location = locationOfToDo(id);
    if (!toDo || !location) return [];
    const areaTags = location.areaId ? document.areas.find((area) => area.id === location.areaId)?.tags ?? [] : [];
    const projectTags = location.projectId ? document.projects.find((project) => project.id === location.projectId)?.tags ?? [] : [];
    return [...new Set([...areaTags, ...projectTags, ...toDo.tags])];
  }

  function projectProgress(id: EntityId): ProjectProgress | null {
    if (!document.projects.some((project) => project.id === id)) return null;
    const children = projectToDos(id).filter((toDo) => !toDo.trashedAt);
    const open = children.filter((toDo) => toDo.outcome === "open").length;
    const completed = children.filter((toDo) => toDo.outcome === "completed").length;
    const canceled = children.filter((toDo) => toDo.outcome === "canceled").length;
    const total = open + completed;
    return { total, open, completed, canceled, percent: total ? Math.round((completed / total) * 100) : 0 };
  }

  function validate(): string[] {
    const errors: string[] = [];
    const ids = new Set<string>();
    const collections: Array<[string, Array<{ id: string }>]> = [
      ["Space", document.spaces], ["Area", document.areas], ["Project", document.projects],
      ["Heading", document.headings], ["Tag", document.tags], ["To-do", document.toDos],
      ["Repeating Template", document.repeatingTemplates], ["Calendar Event", document.calendarEvents],
    ];
    for (const [kind, items] of collections) {
      for (const item of items) {
        if (!item.id) errors.push(`${kind} has no identity.`);
        if (ids.has(item.id)) errors.push(`${kind} identity “${item.id}” is duplicated.`);
        ids.add(item.id);
      }
    }
    for (const area of document.areas) {
      if (!document.spaces.some((space) => space.id === area.spaceId)) errors.push(`Area “${area.id}” has no valid Space.`);
      for (const tagId of area.tags) if (!document.tags.some((tag) => tag.id === tagId)) errors.push(`Area “${area.id}” has an unknown Tag.`);
    }
    if (document.settings.defaultSpaceId && !document.spaces.some((space) => space.id === document.settings.defaultSpaceId)) {
      errors.push("The default Space does not exist.");
    }
    for (const rule of document.settings.launchRules) {
      if (!document.spaces.some((space) => space.id === rule.spaceId)) errors.push(`Launch rule “${rule.id}” has no valid Space.`);
      if (!isTime(rule.start) || !isTime(rule.end)) errors.push(`Launch rule “${rule.id}” has an invalid time.`);
      if (rule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) errors.push(`Launch rule “${rule.id}” has an invalid weekday.`);
    }
    if (document.settings.quickDraft?.updatedAt && !isIsoDateTime(document.settings.quickDraft.updatedAt)) {
      errors.push("The unfinished quick entry has an invalid update date.");
    }
    const validateSchedule = (schedule: ToDo["schedule"], label: string) => {
      if (schedule.kind === "scheduled" && !isIsoDate(schedule.date)) errors.push(`${label} has an invalid scheduled date.`);
    };
    for (const project of document.projects) {
      const location = project.location;
      if (location.kind === "space" && !document.spaces.some((space) => space.id === location.spaceId)) {
        errors.push(`Project “${project.id}” has no valid Space.`);
      }
      if (location.kind === "area" && !document.areas.some((area) => area.id === location.areaId)) {
        errors.push(`Project “${project.id}” has no valid Area.`);
      }
      validateSchedule(project.schedule, `Project “${project.id}”`);
      if (project.deadline && !isIsoDate(project.deadline)) errors.push(`Project “${project.id}” has an invalid Deadline.`);
      if (project.completedAt && !isIsoDateTime(project.completedAt)) errors.push(`Project “${project.id}” has an invalid completion date.`);
      if (project.trashedAt && !isIsoDateTime(project.trashedAt)) errors.push(`Project “${project.id}” has an invalid Trash date.`);
      if (project.logbookAt && !isIsoDateTime(project.logbookAt)) errors.push(`Project “${project.id}” has an invalid Logbook date.`);
      for (const tagId of project.tags) if (!document.tags.some((tag) => tag.id === tagId)) errors.push(`Project “${project.id}” has an unknown Tag.`);
    }
    for (const heading of document.headings) {
      const location = heading.location;
      if (location.kind === "project" && !document.projects.some((project) => project.id === location.projectId)) {
        errors.push(`Heading “${heading.id}” has no valid Project.`);
      }
      if (location.kind === "area" && !document.areas.some((area) => area.id === location.areaId)) {
        errors.push(`Heading “${heading.id}” has no valid Area.`);
      }
      if (heading.archivedAt && !isIsoDateTime(heading.archivedAt)) errors.push(`Heading “${heading.id}” has an invalid archive date.`);
    }
    for (const toDo of document.toDos) {
      if (!locationOfToDo(toDo.id)) errors.push(`To-do “${toDo.id}” has no valid Location.`);
      validateSchedule(toDo.schedule, `To-do “${toDo.id}”`);
      if (!isIsoDateTime(toDo.createdAt)) errors.push(`To-do “${toDo.id}” has an invalid creation date.`);
      if (toDo.deadline && !isIsoDate(toDo.deadline)) errors.push(`To-do “${toDo.id}” has an invalid Deadline.`);
      if (toDo.reminder && (!isIsoDateTime(toDo.reminder.at) || (toDo.reminder.sentAt && !isIsoDateTime(toDo.reminder.sentAt)))) {
        errors.push(`To-do “${toDo.id}” has an invalid Reminder.`);
      }
      if (toDo.completedAt && !isIsoDateTime(toDo.completedAt)) errors.push(`To-do “${toDo.id}” has an invalid completion date.`);
      if (toDo.trashedAt && !isIsoDateTime(toDo.trashedAt)) errors.push(`To-do “${toDo.id}” has an invalid Trash date.`);
      if (toDo.logbookAt && !isIsoDateTime(toDo.logbookAt)) errors.push(`To-do “${toDo.id}” has an invalid Logbook date.`);
      for (const tagId of toDo.tags) if (!document.tags.some((tag) => tag.id === tagId)) errors.push(`To-do “${toDo.id}” has an unknown Tag.`);
    }
    for (const template of document.repeatingTemplates) {
      let hasValidLocation = false;
      if (template.itemKind === "toDo") hasValidLocation = locationExists(template.location);
      else {
        const location = template.location;
        hasValidLocation = location.kind === "space"
          ? document.spaces.some((space) => space.id === location.spaceId)
          : document.areas.some((area) => area.id === location.areaId);
      }
      if (!hasValidLocation) errors.push(`Repeating Template “${template.id}” has no valid Location.`);
      if (!isIsoDate(template.nextDate)) errors.push(`Repeating Template “${template.id}” has an invalid next date.`);
      if (!isIsoDateTime(template.createdAt)) errors.push(`Repeating Template “${template.id}” has an invalid creation date.`);
      if (!Number.isInteger(template.pattern.interval) || template.pattern.interval < 1) errors.push(`Repeating Template “${template.id}” has an invalid interval.`);
      if (template.pattern.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) errors.push(`Repeating Template “${template.id}” has an invalid weekday.`);
      if (template.reminderTime && !isTime(template.reminderTime)) errors.push(`Repeating Template “${template.id}” has an invalid reminder time.`);
      for (const tagId of template.tags) if (!document.tags.some((tag) => tag.id === tagId)) errors.push(`Repeating Template “${template.id}” has an unknown Tag.`);
      const projectContents = template.projectContents as RepeatingProjectContents | null;
      if (template.itemKind === "project" && !projectContents) errors.push(`Repeating Project Template “${template.id}” has no Project contents.`);
      if (template.itemKind === "toDo" && projectContents) errors.push(`Repeating to-do Template “${template.id}” cannot contain Project contents.`);
      if (projectContents) {
        const headingKeys = new Set(projectContents.headings.map((heading) => heading.key));
        for (const toDo of projectContents.toDos) {
          if (toDo.headingKey && !headingKeys.has(toDo.headingKey)) errors.push(`Repeating Project Template “${template.id}” has a to-do with an unknown Heading.`);
          if (toDo.reminder?.kind === "at-time" && !isTime(toDo.reminder.time)) errors.push(`Repeating Project Template “${template.id}” has an invalid child Reminder.`);
          if (toDo.reminder?.kind === "fixed" && !isIsoDateTime(toDo.reminder.at)) errors.push(`Repeating Project Template “${template.id}” has an invalid child Reminder.`);
          if (toDo.deadline?.kind === "offset" && !Number.isInteger(toDo.deadline.days)) errors.push(`Repeating Project Template “${template.id}” has an invalid child Deadline.`);
          if (toDo.deadline?.kind === "fixed" && !isIsoDate(toDo.deadline.date)) errors.push(`Repeating Project Template “${template.id}” has an invalid child Deadline.`);
        }
      }
    }
    for (const toDo of document.toDos) {
      if (!toDo.occurrence) continue;
      const template = document.repeatingTemplates.find((item) => item.id === toDo.occurrence!.templateId);
      if (!template || template.itemKind !== "toDo") errors.push(`To-do “${toDo.id}” has no valid Repeating Template.`);
      if (!isIsoDate(toDo.occurrence.scheduledDate)) errors.push(`To-do “${toDo.id}” has an invalid Occurrence date.`);
    }
    for (const project of document.projects) {
      if (!project.occurrence) continue;
      const template = document.repeatingTemplates.find((item) => item.id === project.occurrence!.templateId);
      if (!template || template.itemKind !== "project") errors.push(`Project “${project.id}” has no valid Repeating Template.`);
      if (!isIsoDate(project.occurrence.scheduledDate)) errors.push(`Project “${project.id}” has an invalid Occurrence date.`);
    }
    for (const event of document.calendarEvents) {
      if (!document.spaces.some((space) => space.id === event.spaceId)) errors.push(`Calendar event “${event.id}” has no valid Space.`);
      if (!isIsoDateTime(event.start) || !isIsoDateTime(event.end) || Date.parse(event.end) < Date.parse(event.start)) {
        errors.push(`Calendar event “${event.id}” has an invalid date range.`);
      }
    }
    for (const closure of document.projectClosures) {
      if (!document.projects.some((project) => project.id === closure.projectId)) errors.push(`Project Closure “${closure.id}” has no valid Project.`);
      if (!isIsoDateTime(closure.closedAt)) errors.push(`Project Closure “${closure.id}” has an invalid date.`);
      for (const toDoId of closure.changedToDoIds) if (!document.toDos.some((toDo) => toDo.id === toDoId)) errors.push(`Project Closure “${closure.id}” has an unknown to-do.`);
    }
    for (const marker of document.permanentDeletions) {
      if (!isIsoDateTime(marker.deletedAt)) errors.push(`Permanent-deletion marker for “${marker.entityId}” has an invalid date.`);
    }
    if (!isIsoDateTime(document.sync.updatedAt)) errors.push("Workspace sync metadata has an invalid update date.");
    return errors;
  }

  return {
    read() {
      return copyDocument(document);
    },

    view(view) {
      const matchesTagFilter = (item: ToDo | Project): boolean => {
        if (!view.tagIds?.length) return true;
        const effectiveTags = "checklist" in item ? effectiveTagIdsForToDo(item.id) : effectiveTagIdsForProject(item.id);
        return view.tagIds.every((tagId) => effectiveTags.includes(tagId));
      };
      if (view.kind === "deadlines") {
        return [...document.toDos, ...document.projects]
          .filter((item) => item.outcome === "open" && !item.trashedAt && !item.logbookAt && item.deadline && matchesTagFilter(item))
          .sort((left, right) => left.deadline!.localeCompare(right.deadline!) || left.order - right.order)
          .map((item) => JSON.parse(JSON.stringify(item)) as ToDo | Project);
      }
      if (view.kind === "trash") {
        const projects = document.projects.filter((project) => project.trashedAt !== null);
        const toDos = document.toDos.filter((toDo) => {
          if (!toDo.trashedAt) return false;
          const projectId = locationOfToDo(toDo.id)?.projectId;
          return !projectId || !projects.some((project) => project.id === projectId);
        });
        return [...projects, ...toDos].filter(matchesTagFilter).sort((left, right) => left.order - right.order).map((item) => copyDocument(item));
      }
      if (view.kind === "logbook") {
        return [...document.projects, ...document.toDos]
          .filter((item) => item.logbookAt !== null && item.trashedAt === null && matchesTagFilter(item))
          .sort((left, right) => left.logbookAt!.localeCompare(right.logbookAt!) || left.order - right.order)
          .map((item) => copyDocument(item));
      }
      return document.toDos.filter((toDo) => {
        if (!matchesTagFilter(toDo)) return false;
        const parentProjectId = locationOfToDo(toDo.id)?.projectId;
        const parentProject = parentProjectId ? document.projects.find((project) => project.id === parentProjectId) : null;
        if (parentProject?.trashedAt || parentProject?.logbookAt) return false;
        if (toDo.trashedAt || toDo.logbookAt) return false;
        if (view.kind === "today") return toDo.schedule.kind === "scheduled" && toDo.schedule.date <= view.date;
        if (view.kind === "thisEvening") return toDo.schedule.kind === "scheduled" && toDo.schedule.date === view.date && toDo.schedule.evening;
        if (view.kind === "tomorrow") return toDo.schedule.kind === "scheduled" && toDo.schedule.date === view.date;
        if (view.kind === "upcoming") return toDo.schedule.kind === "scheduled" && toDo.schedule.date > view.date;
        if (view.kind === "space" || view.kind === "area" || view.kind === "project" || view.kind === "heading") {
          const location = locationOfToDo(toDo.id);
          if (!location) return false;
          if (view.kind === "space") return location.spaceId === view.id;
          if (view.kind === "area") return location.areaId === view.id;
          if (view.kind === "project") return location.projectId === view.id;
          return location.headingId === view.id;
        }
        return toDo.schedule.kind === view.kind;
      }).map((toDo) => JSON.parse(JSON.stringify(toDo)) as ToDo);
    },

    locationOfToDo,

    effectiveTagIdsForToDo,

    effectiveTagIdsForProject,

    projectProgress,

    spaceIdForView,

    validate,

    importPortableBackup(serialized, confirmation) {
      if (confirmation !== FULL_IMPORT_CONFIRMATION) {
        return {
          status: "rejected",
          outcome: "confirmation-required",
          affected: [],
          undo: null,
          errors: [`Type ${FULL_IMPORT_CONFIRMATION} to replace the full Workspace.`],
          report: createEmptyImportReport(),
        };
      }
      const parsed = parsePortableBackup(serialized, dependencies);
      if (!parsed.ok) {
        return {
          status: "rejected",
          outcome: "import-rejected",
          affected: [],
          undo: null,
          errors: parsed.report.messages.filter((message) => message.kind === "rejected").map((message) => message.message),
          report: parsed.report,
        };
      }
      const previous = document;
      document = parsed.document;
      const errors = validate();
      if (errors.length) {
        document = previous;
        parsed.report.rejected += errors.length;
        parsed.report.messages.push(...errors.map((message) => ({ kind: "rejected" as const, message })));
        return { status: "rejected", outcome: "import-rejected", affected: [], undo: null, errors, report: parsed.report };
      }
      const affected: AffectedEntity[] = [
        ...document.spaces.map((item) => ({ kind: "space" as const, id: item.id })),
        ...document.areas.map((item) => ({ kind: "area" as const, id: item.id })),
        ...document.projects.map((item) => ({ kind: "project" as const, id: item.id })),
        ...document.headings.map((item) => ({ kind: "heading" as const, id: item.id })),
        ...document.tags.map((item) => ({ kind: "tag" as const, id: item.id })),
        ...document.toDos.map((item) => ({ kind: "toDo" as const, id: item.id })),
        ...document.repeatingTemplates.map((item) => ({ kind: "repeatingTemplate" as const, id: item.id })),
        ...document.calendarEvents.map((item) => ({ kind: "calendarEvent" as const, id: item.id })),
      ];
      return { status: "changed", outcome: "backup-imported", affected, undo: null, report: parsed.report };
    },

    change(change) {
      const previous = copyDocument(document);
      const fail = (errors: string[]): WorkspaceChangeResult => {
        document = previous;
        return reject(errors);
      };
      const failAs = (outcome: "validation-failed" | "not-found" | "confirmation-required", errors: string[]): WorkspaceChangeResult => {
        document = previous;
        return rejectAs(outcome, errors);
      };

      if (change.type === "saveQuickDraft") {
        if (change.value.length > 10_000) return fail(["The unfinished quick entry is too long."]);
        document.settings.quickDraft = {
          value: change.value,
          updatedAt: dependencies.now(),
          viewType: change.view.kind,
          viewId: "id" in change.view ? change.view.id : null,
        };
        return finishChange(previous, "quick-draft-saved", []);
      }
      if (change.type === "clearQuickDraft") {
        document.settings.quickDraft = null;
        return finishChange(previous, "quick-draft-cleared", []);
      }
      if (change.type === "setLogbookPolicy") {
        document.settings.logCompletedItems = change.policy;
        return finishChange(previous, "logbook-policy-updated", []);
      }
      if (change.type === "setTheme") {
        document.settings.theme = change.theme;
        return finishChange(previous, "theme-updated", []);
      }
      if (change.type === "runDailyLogbook") {
        const affected: AffectedEntity[] = [];
        for (const item of [...document.toDos, ...document.projects]) {
          if (item.outcome === "open" || item.logbookAt || item.trashedAt) continue;
          let itemSpaceId: EntityId | undefined;
          if ("checklist" in item) itemSpaceId = locationOfToDo(item.id)?.spaceId;
          else {
            const projectLocation = item.location;
            itemSpaceId = projectLocation.kind === "space"
              ? projectLocation.spaceId
              : document.areas.find((area) => area.id === projectLocation.areaId)?.spaceId;
          }
          if (change.spaceId && itemSpaceId !== change.spaceId) continue;
          item.logbookAt = dependencies.now();
          affected.push({ kind: "checklist" in item ? "toDo" : "project", id: item.id });
        }
        return finishChange(previous, "daily-logbook-updated", affected);
      }
      if (change.type === "emptyTrash") {
        if (change.confirmation !== EMPTY_TRASH_CONFIRMATION) return failAs("confirmation-required", [`Type ${EMPTY_TRASH_CONFIRMATION} to permanently delete this Space's Trash.`]);
        if (!document.spaces.some((space) => space.id === change.spaceId)) return failAs("not-found", ["The active Space no longer exists."]);
        const removed = document.toDos.filter((item) => item.trashedAt && locationOfToDo(item.id)?.spaceId === change.spaceId);
        if (!removed.length) return fail(["This Space's Trash is already empty."]);
        const removedIds = new Set(removed.map((item) => item.id));
        document.toDos = document.toDos.filter((item) => !removedIds.has(item.id));
        const deletedAt = dependencies.now();
        for (const item of removed) document.permanentDeletions.push({ entityKind: "toDo", entityId: item.id, deletedAt });
        return finishChange(previous, "trash-emptied", removed.map((item) => ({ kind: "toDo", id: item.id })));
      }

      if (change.type === "createSpace") {
        const title = change.title.trim();
        if (!title || title.length > 500) return fail(["Enter a Space title between 1 and 500 characters."]);
        const space: Space = {
          id: dependencies.createId("space"), title, color: change.color,
          pinned: change.pinned ?? true, order: document.spaces.length,
        };
        document.spaces.push(space);
        if (!document.settings.defaultSpaceId) document.settings.defaultSpaceId = space.id;
        return finishChange(previous, "space-created", [{ kind: "space", id: space.id }], `Delete “${space.title}”`);
      }
      if (change.type === "updateSpace") {
        const space = document.spaces.find((item) => item.id === change.id);
        if (!space) return failAs("not-found", ["The Space no longer exists."]);
        if (change.changes.title !== undefined) {
          const title = change.changes.title.trim();
          if (!title || title.length > 500) return fail(["Enter a Space title between 1 and 500 characters."]);
          space.title = title;
        }
        if (change.changes.color !== undefined) space.color = change.changes.color;
        if (change.changes.pinned !== undefined) space.pinned = change.changes.pinned;
        return finishChange(previous, "space-updated", [{ kind: "space", id: space.id }], `Undo changes to “${space.title}”`);
      }
      if (change.type === "reorderSpace") {
        const currentIndex = document.spaces.findIndex((item) => item.id === change.id);
        if (currentIndex < 0) return failAs("not-found", ["The Space no longer exists."]);
        if (!Number.isInteger(change.toIndex) || change.toIndex < 0 || change.toIndex >= document.spaces.length) return fail(["Choose a valid Space position."]);
        const [space] = document.spaces.splice(currentIndex, 1);
        document.spaces.splice(change.toIndex, 0, space);
        document.spaces.forEach((item, order) => { item.order = order; });
        return finishChange(previous, "space-reordered", [{ kind: "space", id: space.id }], `Undo moving “${space.title}”`);
      }
      if (change.type === "deleteSpace") {
        if (change.confirmation !== DELETE_SPACE_CONFIRMATION) return failAs("confirmation-required", [`Type ${DELETE_SPACE_CONFIRMATION} to delete this Space.`]);
        const space = document.spaces.find((item) => item.id === change.id);
        if (!space) return failAs("not-found", ["The Space no longer exists."]);
        if (change.moveToSpaceId === space.id) return fail(["Choose a different Space for the content."]);
        if (!document.spaces.some((item) => item.id === change.moveToSpaceId)) return fail(["The destination Space no longer exists."]);
        const affected: AffectedEntity[] = [{ kind: "space", id: space.id }];
        for (const area of document.areas) {
          if (area.spaceId !== space.id) continue;
          area.spaceId = change.moveToSpaceId;
          affected.push({ kind: "area", id: area.id });
        }
        for (const project of document.projects) {
          if (project.location.kind !== "space" || project.location.spaceId !== space.id) continue;
          project.location = { kind: "space", spaceId: change.moveToSpaceId };
          affected.push({ kind: "project", id: project.id });
        }
        for (const toDo of document.toDos) {
          if (toDo.location.kind !== "unfiled" || toDo.location.spaceId !== space.id) continue;
          toDo.location = { kind: "unfiled", spaceId: change.moveToSpaceId };
          affected.push({ kind: "toDo", id: toDo.id });
        }
        for (const template of document.repeatingTemplates) {
          if (template.location.kind === "unfiled" && template.location.spaceId === space.id) template.location = { kind: "unfiled", spaceId: change.moveToSpaceId };
          if (template.location.kind === "space" && template.location.spaceId === space.id) template.location = { kind: "space", spaceId: change.moveToSpaceId };
        }
        for (const event of document.calendarEvents) if (event.spaceId === space.id) event.spaceId = change.moveToSpaceId;
        for (const rule of document.settings.launchRules) if (rule.spaceId === space.id) rule.spaceId = change.moveToSpaceId;
        if (document.settings.defaultSpaceId === space.id) document.settings.defaultSpaceId = change.moveToSpaceId;
        document.spaces = document.spaces.filter((item) => item.id !== space.id);
        document.spaces.forEach((item, order) => { item.order = order; });
        document.permanentDeletions.push({ entityKind: "space", entityId: space.id, deletedAt: dependencies.now() });
        return finishChange(previous, "space-deleted", affected);
      }

      if (change.type === "createArea") {
        const title = change.title.trim();
        if (!title || title.length > 500) return fail(["Enter an Area title between 1 and 500 characters."]);
        if (!document.spaces.some((space) => space.id === change.spaceId)) return fail(["The selected Space no longer exists."]);
        const tags = [...new Set(change.tags ?? [])];
        if (tags.some((tagId) => !document.tags.some((tag) => tag.id === tagId))) return fail(["A selected Tag no longer exists."]);
        const area: Area = {
          id: dependencies.createId("area"), title, spaceId: change.spaceId,
          color: change.color ?? "#808080", tags, order: document.areas.length,
        };
        document.areas.push(area);
        return finishChange(previous, "area-created", [{ kind: "area", id: area.id }], `Delete “${area.title}”`);
      }
      if (change.type === "updateArea") {
        const area = document.areas.find((item) => item.id === change.id);
        if (!area) return failAs("not-found", ["The Area no longer exists."]);
        if (change.changes.title !== undefined) {
          const title = change.changes.title.trim();
          if (!title || title.length > 500) return fail(["Enter an Area title between 1 and 500 characters."]);
          area.title = title;
        }
        if (change.changes.spaceId !== undefined) {
          if (!document.spaces.some((space) => space.id === change.changes.spaceId)) return fail(["The selected Space no longer exists."]);
          area.spaceId = change.changes.spaceId;
        }
        if (change.changes.color !== undefined) area.color = change.changes.color;
        if (change.changes.tags !== undefined) {
          if (change.changes.tags.some((tagId) => !document.tags.some((tag) => tag.id === tagId))) return fail(["A selected Tag no longer exists."]);
          area.tags = [...new Set(change.changes.tags)];
        }
        return finishChange(previous, "area-updated", [{ kind: "area", id: area.id }], `Undo changes to “${area.title}”`);
      }
      if (change.type === "removeArea") {
        if (change.confirmation !== REMOVE_AREA_CONFIRMATION) return failAs("confirmation-required", [`Type ${REMOVE_AREA_CONFIRMATION} to remove this Area.`]);
        const area = document.areas.find((item) => item.id === change.id);
        if (!area) return failAs("not-found", ["The Area no longer exists."]);
        const directHeadingIds = new Set(document.headings
          .filter((heading) => heading.location.kind === "area" && heading.location.areaId === area.id)
          .map((heading) => heading.id));
        const affected: AffectedEntity[] = [{ kind: "area", id: area.id }];
        for (const project of document.projects) {
          if (project.location.kind !== "area" || project.location.areaId !== area.id) continue;
          project.location = { kind: "space", spaceId: area.spaceId };
          affected.push({ kind: "project", id: project.id });
        }
        for (const toDo of document.toDos) {
          const directlyInArea = toDo.location.kind === "area" && toDo.location.areaId === area.id;
          const inRemovedHeading = toDo.location.kind === "heading" && directHeadingIds.has(toDo.location.headingId);
          if (!directlyInArea && !inRemovedHeading) continue;
          toDo.location = { kind: "unfiled", spaceId: area.spaceId };
          affected.push({ kind: "toDo", id: toDo.id });
        }
        for (const template of document.repeatingTemplates) {
          if (template.location.kind === "area" && template.location.areaId === area.id) {
            template.location = template.itemKind === "project"
              ? { kind: "space", spaceId: area.spaceId }
              : { kind: "unfiled", spaceId: area.spaceId };
          }
          if (template.itemKind === "toDo" && template.location.kind === "heading" && directHeadingIds.has(template.location.headingId)) {
            template.location = { kind: "unfiled", spaceId: area.spaceId };
          }
        }
        for (const headingId of directHeadingIds) affected.push({ kind: "heading", id: headingId });
        document.headings = document.headings.filter((heading) => !directHeadingIds.has(heading.id));
        document.areas = document.areas.filter((item) => item.id !== area.id);
        document.permanentDeletions.push({ entityKind: "area", entityId: area.id, deletedAt: dependencies.now() });
        return finishChange(previous, "area-removed", affected);
      }
      if (change.type === "createProject") {
        const title = change.title.trim();
        if (!title || title.length > 500) return fail(["Enter a Project title between 1 and 500 characters."]);
        if (!projectLocationExists(change.location)) return fail(["The selected Project Location no longer exists."]);
        const schedule = change.schedule ?? { kind: "anytime" as const };
        if (schedule.kind === "scheduled" && !isIsoDate(schedule.date)) return fail(["Choose a valid Schedule date."]);
        if (change.deadline && !isIsoDate(change.deadline)) return fail(["Choose a valid Deadline."]);
        const tags = [...new Set(change.tags ?? [])];
        if (tags.some((tagId) => !document.tags.some((tag) => tag.id === tagId))) return fail(["A selected Tag no longer exists."]);
        const project: Project = {
          id: dependencies.createId("project"), title, notes: change.notes?.trim() ?? "", location: change.location,
          schedule, deadline: change.deadline ?? null, outcome: "open", trashedAt: null, logbookAt: null,
          tags, occurrence: null, completedAt: null, order: document.projects.length,
        };
        document.projects.push(project);
        return finishChange(previous, "project-created", [{ kind: "project", id: project.id }], `Delete “${project.title}”`);
      }
      if (change.type === "updateProject") {
        const project = document.projects.find((item) => item.id === change.id);
        if (!project) return failAs("not-found", ["The Project no longer exists."]);
        if (change.changes.title !== undefined) {
          const title = change.changes.title.trim();
          if (!title || title.length > 500) return fail(["Enter a Project title between 1 and 500 characters."]);
          project.title = title;
        }
        if (change.changes.notes !== undefined) project.notes = change.changes.notes;
        if (change.changes.location !== undefined) {
          if (!projectLocationExists(change.changes.location)) return fail(["The selected Project Location no longer exists."]);
          project.location = change.changes.location;
        }
        if (change.changes.schedule !== undefined) {
          if (change.changes.schedule.kind === "scheduled" && !isIsoDate(change.changes.schedule.date)) return fail(["Choose a valid Schedule date."]);
          project.schedule = change.changes.schedule;
        }
        if (change.changes.deadline !== undefined) {
          if (change.changes.deadline && !isIsoDate(change.changes.deadline)) return fail(["Choose a valid Deadline."]);
          project.deadline = change.changes.deadline;
        }
        if (change.changes.tags !== undefined) {
          if (change.changes.tags.some((tagId) => !document.tags.some((tag) => tag.id === tagId))) return fail(["A selected Tag no longer exists."]);
          project.tags = [...new Set(change.changes.tags)];
        }
        return finishChange(previous, "project-updated", [{ kind: "project", id: project.id }], `Undo changes to “${project.title}”`);
      }
      if (change.type === "duplicateProject") {
        const project = document.projects.find((item) => item.id === change.id);
        if (!project) return failAs("not-found", ["The Project no longer exists."]);
        const copy: Project = {
          ...copyDocument(project), id: dependencies.createId("project"), title: `${project.title} copy`,
          outcome: "open", trashedAt: null, logbookAt: null, completedAt: null, occurrence: null,
          order: document.projects.length,
        };
        document.projects.push(copy);
        const headingIds = new Map<EntityId, EntityId>();
        const copiedHeadings = document.headings
          .filter((heading) => heading.location.kind === "project" && heading.location.projectId === project.id)
          .map((heading): Heading => {
            const id = dependencies.createId("heading");
            headingIds.set(heading.id, id);
            return { ...copyDocument(heading), id, location: { kind: "project", projectId: copy.id }, archivedAt: null, order: document.headings.length + headingIds.size - 1 };
          });
        document.headings.push(...copiedHeadings);
        const copiedToDos = projectToDos(project.id).map((toDo, index): ToDo => {
          const location: ToDoLocation = toDo.location.kind === "heading"
            ? { kind: "heading", headingId: headingIds.get(toDo.location.headingId)! }
            : { kind: "project", projectId: copy.id };
          return duplicateToDoRecord(toDo, location, document.toDos.length + index);
        });
        document.toDos.push(...copiedToDos);
        return finishChange(previous, "project-duplicated", [
          { kind: "project", id: copy.id },
          ...copiedHeadings.map((heading) => ({ kind: "heading" as const, id: heading.id })),
          ...copiedToDos.map((toDo) => ({ kind: "toDo" as const, id: toDo.id })),
        ], `Delete “${copy.title}”`);
      }
      if (change.type === "closeProject") {
        const project = document.projects.find((item) => item.id === change.id);
        if (!project) return failAs("not-found", ["The Project no longer exists."]);
        if (project.trashedAt) return fail(["Restore this Project before closing it."]);
        if (project.outcome !== "open") return fail(["Only an open Project can be closed."]);
        const openToDos = projectToDos(project.id).filter((toDo) => toDo.outcome === "open" && !toDo.trashedAt);
        const supplied = new Map(change.toDoOutcomes.map((choice) => [choice.id, choice.outcome]));
        if (supplied.size !== change.toDoOutcomes.length) return fail(["Choose one Outcome for each remaining open to-do."]);
        if (openToDos.length !== supplied.size || openToDos.some((toDo) => !supplied.has(toDo.id))) {
          return fail(["Choose an explicit Outcome for every remaining open to-do."]);
        }
        const now = dependencies.now();
        for (const toDo of openToDos) {
          toDo.outcome = supplied.get(toDo.id)!;
          toDo.completedAt = now;
          if (document.settings.logCompletedItems === "immediately") toDo.logbookAt = now;
        }
        project.outcome = change.outcome;
        project.completedAt = now;
        if (document.settings.logCompletedItems === "immediately") project.logbookAt = now;
        document.projectClosures.push({
          id: dependencies.createId("projectClosure"), projectId: project.id,
          projectOutcome: change.outcome, changedToDoIds: openToDos.map((toDo) => toDo.id), closedAt: now,
        });
        return finishChange(previous, change.outcome === "completed" ? "project-completed" : "project-canceled", [
          { kind: "project", id: project.id },
          ...openToDos.map((toDo) => ({ kind: "toDo" as const, id: toDo.id })),
        ], `Restore “${project.title}”`);
      }
      if (change.type === "restoreProject") {
        const project = document.projects.find((item) => item.id === change.id);
        if (!project) return failAs("not-found", ["The Project no longer exists."]);
        if (project.trashedAt) return fail(["Restore this Project from Trash first."]);
        if (project.outcome === "open") return fail(["This Project is already open."]);
        const closure = [...document.projectClosures].reverse().find((item) => item.projectId === project.id);
        if (!closure) return fail(["This Project has no Closure record to restore."]);
        const changedIds = new Set(closure.changedToDoIds);
        const changedToDos = document.toDos.filter((toDo) => changedIds.has(toDo.id));
        for (const toDo of changedToDos) {
          toDo.outcome = "open";
          toDo.completedAt = null;
          toDo.logbookAt = null;
        }
        project.outcome = "open";
        project.completedAt = null;
        project.logbookAt = null;
        return finishChange(previous, "project-restored", [
          { kind: "project", id: project.id },
          ...changedToDos.map((toDo) => ({ kind: "toDo" as const, id: toDo.id })),
        ], `Close “${project.title}” again`);
      }
      if (change.type === "trashProject") {
        const project = document.projects.find((item) => item.id === change.id);
        if (!project) return failAs("not-found", ["The Project no longer exists."]);
        if (project.trashedAt) return fail(["This Project is already in Trash."]);
        project.trashedAt = dependencies.now();
        return finishChange(previous, "project-trashed", [{ kind: "project", id: project.id }], `Restore “${project.title}”`);
      }
      if (change.type === "restoreProjectFromTrash") {
        const project = document.projects.find((item) => item.id === change.id);
        if (!project) return failAs("not-found", ["The Project no longer exists."]);
        if (!project.trashedAt) return fail(["This Project is not in Trash."]);
        project.trashedAt = null;
        return finishChange(previous, "project-restored-from-trash", [{ kind: "project", id: project.id }], `Move “${project.title}” back to Trash`);
      }
      if (change.type === "permanentlyDeleteProject") {
        if (change.confirmation !== PERMANENT_DELETE_CONFIRMATION) return failAs("confirmation-required", [`Type ${PERMANENT_DELETE_CONFIRMATION} to delete this Project.`]);
        const project = document.projects.find((item) => item.id === change.id);
        if (!project) return failAs("not-found", ["The Project no longer exists."]);
        if (!project.trashedAt) return fail(["Only a Project in Trash can be permanently deleted."]);
        const headings = document.headings.filter((heading) => heading.location.kind === "project" && heading.location.projectId === project.id);
        const headingIds = new Set(headings.map((heading) => heading.id));
        const toDos = document.toDos.filter((toDo) => toDo.location.kind === "project" && toDo.location.projectId === project.id
          || toDo.location.kind === "heading" && headingIds.has(toDo.location.headingId));
        const deletedAt = dependencies.now();
        document.projects = document.projects.filter((item) => item.id !== project.id);
        document.headings = document.headings.filter((heading) => !headingIds.has(heading.id));
        const toDoIds = new Set(toDos.map((toDo) => toDo.id));
        document.toDos = document.toDos.filter((toDo) => !toDoIds.has(toDo.id));
        document.projectClosures = document.projectClosures.filter((closure) => closure.projectId !== project.id);
        document.permanentDeletions.push(
          { entityKind: "project", entityId: project.id, deletedAt },
          ...headings.map((heading) => ({ entityKind: "heading" as const, entityId: heading.id, deletedAt })),
          ...toDos.map((toDo) => ({ entityKind: "toDo" as const, entityId: toDo.id, deletedAt })),
        );
        return finishChange(previous, "project-permanently-deleted", [
          { kind: "project", id: project.id },
          ...headings.map((heading) => ({ kind: "heading" as const, id: heading.id })),
          ...toDos.map((toDo) => ({ kind: "toDo" as const, id: toDo.id })),
        ]);
      }
      if (change.type === "createHeading") {
        const title = change.title.trim();
        if (!title || title.length > 500) return fail(["Enter a Heading title between 1 and 500 characters."]);
        if (!headingLocationExists(change.location)) return fail(["The selected Heading Location no longer exists."]);
        const heading: Heading = {
          id: dependencies.createId("heading"), title, location: change.location,
          archivedAt: null, order: document.headings.length,
        };
        document.headings.push(heading);
        return finishChange(previous, "heading-created", [{ kind: "heading", id: heading.id }], `Delete “${heading.title}”`);
      }
      if (change.type === "updateHeading") {
        const heading = document.headings.find((item) => item.id === change.id);
        if (!heading) return failAs("not-found", ["The Heading no longer exists."]);
        if (change.changes.title !== undefined) {
          const title = change.changes.title.trim();
          if (!title || title.length > 500) return fail(["Enter a Heading title between 1 and 500 characters."]);
          heading.title = title;
        }
        if (change.changes.location !== undefined) {
          if (!headingLocationExists(change.changes.location)) return fail(["The selected Heading Location no longer exists."]);
          heading.location = change.changes.location;
        }
        return finishChange(previous, "heading-updated", [{ kind: "heading", id: heading.id }], `Undo changes to “${heading.title}”`);
      }
      if (change.type === "duplicateHeading") {
        const heading = document.headings.find((item) => item.id === change.id);
        if (!heading) return failAs("not-found", ["The Heading no longer exists."]);
        const copy: Heading = {
          ...copyDocument(heading), id: dependencies.createId("heading"), title: `${heading.title} copy`,
          archivedAt: null, order: document.headings.length,
        };
        document.headings.push(copy);
        const copiedToDos = document.toDos
          .filter((toDo) => toDo.location.kind === "heading" && toDo.location.headingId === heading.id)
          .map((toDo, index) => duplicateToDoRecord(
            toDo,
            { kind: "heading", headingId: copy.id },
            document.toDos.length + index,
          ));
        document.toDos.push(...copiedToDos);
        return finishChange(previous, "heading-duplicated", [
          { kind: "heading", id: copy.id },
          ...copiedToDos.map((toDo) => ({ kind: "toDo" as const, id: toDo.id })),
        ], `Delete “${copy.title}”`);
      }
      if (change.type === "archiveHeading") {
        const heading = document.headings.find((item) => item.id === change.id);
        if (!heading) return failAs("not-found", ["The Heading no longer exists."]);
        if (heading.archivedAt) return fail(["This Heading is already archived."]);
        heading.archivedAt = dependencies.now();
        return finishChange(previous, "heading-archived", [{ kind: "heading", id: heading.id }], `Restore “${heading.title}”`);
      }
      if (change.type === "restoreHeading") {
        const heading = document.headings.find((item) => item.id === change.id);
        if (!heading) return failAs("not-found", ["The Heading no longer exists."]);
        if (!heading.archivedAt) return fail(["This Heading is not archived."]);
        heading.archivedAt = null;
        return finishChange(previous, "heading-restored", [{ kind: "heading", id: heading.id }], `Archive “${heading.title}”`);
      }
      if (change.type === "deleteHeading") {
        if (change.confirmation !== DELETE_HEADING_CONFIRMATION) return failAs("confirmation-required", [`Type ${DELETE_HEADING_CONFIRMATION} to delete this Heading.`]);
        const heading = document.headings.find((item) => item.id === change.id);
        if (!heading) return failAs("not-found", ["The Heading no longer exists."]);
        const parentLocation: ToDoLocation = heading.location.kind === "project"
          ? { kind: "project", projectId: heading.location.projectId }
          : { kind: "area", areaId: heading.location.areaId };
        const children = document.toDos.filter((toDo) => toDo.location.kind === "heading" && toDo.location.headingId === heading.id);
        for (const toDo of children) toDo.location = parentLocation;
        for (const template of document.repeatingTemplates) {
          if (template.itemKind === "toDo" && template.location.kind === "heading" && template.location.headingId === heading.id) template.location = parentLocation;
        }
        document.headings = document.headings.filter((item) => item.id !== heading.id);
        document.permanentDeletions.push({ entityKind: "heading", entityId: heading.id, deletedAt: dependencies.now() });
        return finishChange(previous, "heading-deleted", [
          { kind: "heading", id: heading.id },
          ...children.map((toDo) => ({ kind: "toDo" as const, id: toDo.id })),
        ]);
      }
      if (change.type === "convertHeadingToProject") {
        const heading = document.headings.find((item) => item.id === change.id);
        if (!heading) return failAs("not-found", ["The Heading no longer exists."]);
        let location: ProjectLocation;
        if (heading.location.kind === "area") location = { kind: "area", areaId: heading.location.areaId };
        else {
          const parentProjectId = heading.location.projectId;
          const parent = document.projects.find((project) => project.id === parentProjectId);
          if (!parent) return fail(["The Heading's parent Project no longer exists."]);
          location = copyDocument(parent.location);
        }
        const project: Project = {
          id: dependencies.createId("project"), title: heading.title, notes: "", location,
          schedule: { kind: "anytime" }, deadline: null, outcome: "open", trashedAt: null,
          logbookAt: null, tags: [], occurrence: null, completedAt: null, order: document.projects.length,
        };
        document.projects.push(project);
        const children = document.toDos.filter((toDo) => toDo.location.kind === "heading" && toDo.location.headingId === heading.id);
        for (const toDo of children) toDo.location = { kind: "project", projectId: project.id };
        for (const template of document.repeatingTemplates) {
          if (template.itemKind === "toDo" && template.location.kind === "heading" && template.location.headingId === heading.id) {
            template.location = { kind: "project", projectId: project.id };
          }
        }
        document.headings = document.headings.filter((item) => item.id !== heading.id);
        document.permanentDeletions.push({ entityKind: "heading", entityId: heading.id, deletedAt: dependencies.now() });
        return finishChange(previous, "heading-converted-to-project", [
          { kind: "project", id: project.id },
          { kind: "heading", id: heading.id },
          ...children.map((toDo) => ({ kind: "toDo" as const, id: toDo.id })),
        ], `Undo converting “${heading.title}”`);
      }
      if (change.type === "createTag") {
        const title = change.title.trim();
        if (!title || title.length > 100) return fail(["Enter a Tag name between 1 and 100 characters."]);
        if (document.tags.some((tag) => tag.title.toLowerCase() === title.toLowerCase())) return fail(["A Tag with this name already exists."]);
        const tag: Tag = { id: dependencies.createId("tag"), title, order: document.tags.length };
        document.tags.push(tag);
        return finishChange(previous, "tag-created", [{ kind: "tag", id: tag.id }], `Delete “${tag.title}”`);
      }
      if (change.type === "updateTag") {
        const tag = document.tags.find((item) => item.id === change.id);
        if (!tag) return failAs("not-found", ["The Tag no longer exists."]);
        const title = change.title.trim();
        if (!title || title.length > 100) return fail(["Enter a Tag name between 1 and 100 characters."]);
        if (document.tags.some((item) => item.id !== tag.id && item.title.toLowerCase() === title.toLowerCase())) return fail(["A Tag with this name already exists."]);
        tag.title = title;
        return finishChange(previous, "tag-updated", [{ kind: "tag", id: tag.id }], `Undo renaming “${tag.title}”`);
      }
      if (change.type === "deleteTag") {
        if (change.confirmation !== DELETE_TAG_CONFIRMATION) return failAs("confirmation-required", [`Type ${DELETE_TAG_CONFIRMATION} to delete this Tag.`]);
        const tag = document.tags.find((item) => item.id === change.id);
        if (!tag) return failAs("not-found", ["The Tag no longer exists."]);
        for (const area of document.areas) area.tags = area.tags.filter((id) => id !== tag.id);
        for (const project of document.projects) project.tags = project.tags.filter((id) => id !== tag.id);
        for (const toDo of document.toDos) toDo.tags = toDo.tags.filter((id) => id !== tag.id);
        for (const template of document.repeatingTemplates) {
          template.tags = template.tags.filter((id) => id !== tag.id);
          if (template.projectContents) {
            for (const toDo of template.projectContents.toDos) toDo.tags = toDo.tags.filter((id) => id !== tag.id);
          }
        }
        document.tags = document.tags.filter((item) => item.id !== tag.id);
        document.tags.forEach((item, order) => { item.order = order; });
        document.permanentDeletions.push({ entityKind: "tag", entityId: tag.id, deletedAt: dependencies.now() });
        return finishChange(previous, "tag-deleted", [{ kind: "tag", id: tag.id }]);
      }

      if (change.type === "createToDo") {
        const parsed = change.quickEntry ? parseQuickEntry(change.title, change.quickEntry.referenceDate) : null;
        const title = (parsed?.title ?? change.title).trim();
        if (!title) return fail(["A to-do title is required."]);
        if (title.length > 500) return fail(["A to-do title must be 500 characters or fewer."]);
        if (change.quickEntry && !isIsoDate(change.quickEntry.referenceDate)) return fail(["Quick entry needs a valid reference date."]);

        const location = change.location ?? (document.settings.defaultSpaceId ? { kind: "unfiled" as const, spaceId: document.settings.defaultSpaceId } : null);
        if (!location) return fail(["Create a Space before adding an unfiled to-do."]);
        if (!locationExists(location)) return fail(["The selected to-do Location no longer exists."]);
        const schedule = parsed?.schedule ?? change.schedule ?? { kind: "inbox" as const };
        if (schedule.kind === "scheduled" && !isIsoDate(schedule.date)) return fail(["Choose a valid Schedule date."]);
        const deadline = parsed?.deadline ?? change.deadline ?? null;
        if (deadline && !isIsoDate(deadline)) return fail(["Choose a valid Deadline."]);
        const reminderAt = parsed?.reminderAt ?? change.reminderAt ?? null;
        if (reminderAt && !isIsoDateTime(reminderAt)) return fail(["Choose a valid Reminder."]);

        const tagIds = [...(change.tags ?? [])];
        for (const tagTitle of parsed?.tagTitles ?? []) {
          let tag = document.tags.find((item) => item.title.toLowerCase() === tagTitle.toLowerCase());
          if (!tag) {
            tag = { id: dependencies.createId("tag"), title: tagTitle, order: document.tags.length };
            document.tags.push(tag);
          }
          if (!tagIds.includes(tag.id)) tagIds.push(tag.id);
        }
        if (tagIds.some((tagId) => !document.tags.some((tag) => tag.id === tagId))) return fail(["A selected Tag no longer exists."]);

        const createdAt = dependencies.now();
        const toDoId = dependencies.createId("toDo");
        const checklist = (change.checklist ?? []).map((itemTitle, order): ChecklistItem => ({
          id: dependencies.createId("checklistItem"), title: itemTitle.trim(), completed: false, order,
        }));
        if (checklist.some((item) => !item.title)) return fail(["Checklist item titles cannot be empty."]);
        const toDo: ToDo = {
          id: toDoId, title, notes: change.notes?.trim() ?? "", checklist, location, schedule,
          reminder: reminderAt ? { at: reminderAt, sentAt: null } : null, deadline, outcome: "open",
          trashedAt: null, logbookAt: null, tags: tagIds, occurrence: null, createdAt, completedAt: null,
          order: document.toDos.length,
        };
        document.toDos.push(toDo);
        if (change.quickEntry) document.settings.quickDraft = null;
        return finishChange(previous, "to-do-created", [{ kind: "toDo", id: toDo.id }], `Delete “${toDo.title}”`);
      }

      if (change.type === "reorderToDos") {
        const movedIds = [...new Set(change.movedIds)];
        const orderedIds = [...new Set(change.orderedIds)];
        if (!movedIds.length || orderedIds.length !== change.orderedIds.length) return fail(["Choose valid to-dos to move and order."]);
        if (movedIds.some((id) => !document.toDos.some((item) => item.id === id)) || orderedIds.some((id) => !document.toDos.some((item) => item.id === id))) return failAs("not-found", ["A to-do being moved no longer exists."]);
        if (change.destination?.location && !locationExists(change.destination.location)) return fail(["The selected to-do Location no longer exists."]);
        if (change.destination?.schedule?.kind === "scheduled" && !isIsoDate(change.destination.schedule.date)) return fail(["Choose a valid Schedule date."]);
        for (const toDo of document.toDos) {
          if (!movedIds.includes(toDo.id)) continue;
          if (change.destination?.location) toDo.location = change.destination.location;
          if (change.destination?.schedule) assignToDoSchedule(toDo, change.destination.schedule);
        }
        const orderedSet = new Set(orderedIds);
        const ordered = orderedIds.map((id) => document.toDos.find((item) => item.id === id)!);
        let orderedIndex = 0;
        document.toDos = document.toDos.slice().sort((left, right) => left.order - right.order).map((item) => {
          if (!orderedSet.has(item.id)) return item;
          const replacement = ordered[orderedIndex];
          orderedIndex += 1;
          return replacement;
        });
        document.toDos.forEach((item, order) => { item.order = order; });
        return finishChange(previous, "to-dos-reordered", movedIds.map((id) => ({ kind: "toDo", id })), "Undo moving selected to-dos");
      }

      if (change.type === "makeToDoRepeating") {
        const toDo = findToDo(change.id);
        if (!toDo) return failAs("not-found", ["The to-do no longer exists."]);
        if (toDo.trashedAt || toDo.outcome !== "open") return fail(["Restore or reopen this to-do before making it repeat."]);
        if (toDo.occurrence) return fail(["This to-do already belongs to a repeating schedule."]);
        if (!isIsoDate(change.nextDate)) return fail(["Choose a valid next repetition date."]);
        const templateId = dependencies.createId("repeatingTemplate");
        document.repeatingTemplates.push({
          id: templateId,
          itemKind: "toDo",
          title: toDo.title,
          notes: toDo.notes,
          location: toDo.location,
          tags: [...toDo.tags],
          checklist: copyDocument(toDo.checklist),
          pattern: { frequency: "weekly", interval: 1, weekdays: [] },
          mode: "on-schedule",
          state: "active",
          nextDate: change.nextDate,
          reminderTime: toDo.reminder?.at.slice(11, 16) ?? null,
          deadlineOffsetDays: null,
          projectContents: null,
          createdAt: dependencies.now(),
        });
        toDo.occurrence = { templateId, scheduledDate: change.nextDate };
        assignToDoSchedule(toDo, { kind: "scheduled", date: change.nextDate, evening: false });
        return finishChange(previous, "to-do-repetition-created", [{ kind: "toDo", id: toDo.id }, { kind: "repeatingTemplate", id: templateId }]);
      }

      const id = "id" in change ? change.id : "toDoId" in change ? change.toDoId : null;
      const toDo = id ? findToDo(id) : null;
      if (!toDo) return failAs("not-found", ["The to-do no longer exists."]);
      if (toDo.trashedAt && ["completeToDo", "cancelToDo", "reopenToDo", "logToDo"].includes(change.type)) {
        return fail(["Restore this to-do before changing its Outcome or Logbook placement."]);
      }

      if (change.type === "updateToDo") {
        const changes = change.changes;
        if (changes.title !== undefined) {
          const title = changes.title.trim();
          if (!title || title.length > 500) return fail(["Enter a to-do title between 1 and 500 characters."]);
          toDo.title = title;
        }
        if (changes.notes !== undefined) toDo.notes = changes.notes;
        if (changes.location !== undefined) {
          if (!locationExists(changes.location)) return fail(["The selected to-do Location no longer exists."]);
          toDo.location = changes.location;
        }
        if (changes.schedule !== undefined) {
          if (changes.schedule.kind === "scheduled" && !isIsoDate(changes.schedule.date)) return fail(["Choose a valid Schedule date."]);
          assignToDoSchedule(toDo, changes.schedule);
        }
        if (changes.reminder !== undefined) {
          if (changes.reminder && (!isIsoDateTime(changes.reminder.at) || (changes.reminder.sentAt && !isIsoDateTime(changes.reminder.sentAt)))) return fail(["Choose a valid Reminder."]);
          toDo.reminder = changes.reminder;
        }
        if (changes.deadline !== undefined) {
          if (changes.deadline && !isIsoDate(changes.deadline)) return fail(["Choose a valid Deadline."]);
          toDo.deadline = changes.deadline;
        }
        if (changes.tags !== undefined) {
          if (changes.tags.some((tagId) => !document.tags.some((tag) => tag.id === tagId))) return fail(["A selected Tag no longer exists."]);
          toDo.tags = [...new Set(changes.tags)];
        }
        return finishChange(previous, "to-do-updated", [{ kind: "toDo", id: toDo.id }], `Undo changes to “${toDo.title}”`);
      }

      if (change.type === "setToDoTags") {
        const titles = [...new Set(change.titles.map((title) => title.trim()).filter(Boolean))];
        if (titles.some((title) => title.length > 100)) return fail(["Tag names must be 100 characters or fewer."]);
        toDo.tags = titles.map((title) => {
          const existing = document.tags.find((tag) => tag.title.toLowerCase() === title.toLowerCase());
          if (existing) return existing.id;
          const tag = { id: dependencies.createId("tag"), title, order: document.tags.length };
          document.tags.push(tag);
          return tag.id;
        });
        return finishChange(previous, "to-do-tags-updated", [{ kind: "toDo", id: toDo.id }], `Undo Tag changes to “${toDo.title}”`);
      }

      if (change.type === "addChecklistItem") {
        const title = change.title.trim();
        if (!title) return fail(["A checklist item title is required."]);
        const item: ChecklistItem = { id: dependencies.createId("checklistItem"), title, completed: false, order: toDo.checklist.length };
        toDo.checklist.push(item);
        return finishChange(previous, "checklist-item-added", [{ kind: "checklistItem", id: item.id }], `Remove “${item.title}”`);
      }
      if (change.type === "updateChecklistItem") {
        const item = toDo.checklist.find((candidate) => candidate.id === change.itemId);
        if (!item) return failAs("not-found", ["The checklist item no longer exists."]);
        if (change.changes.title !== undefined) {
          const title = change.changes.title.trim();
          if (!title) return fail(["A checklist item title is required."]);
          item.title = title;
        }
        if (change.changes.completed !== undefined) item.completed = change.changes.completed;
        return finishChange(previous, "checklist-item-updated", [{ kind: "checklistItem", id: item.id }]);
      }
      if (change.type === "removeChecklistItem") {
        const item = toDo.checklist.find((candidate) => candidate.id === change.itemId);
        if (!item) return failAs("not-found", ["The checklist item no longer exists."]);
        toDo.checklist = toDo.checklist.filter((candidate) => candidate.id !== item.id).map((candidate, order) => ({ ...candidate, order }));
        return finishChange(previous, "checklist-item-removed", [{ kind: "checklistItem", id: item.id }], `Restore “${item.title}”`);
      }
      if (change.type === "snoozeReminder") {
        if (!isIsoDateTime(change.until)) return fail(["Choose a valid time to snooze until."]);
        if (!toDo.reminder) return fail(["This to-do has no Reminder to snooze."]);
        toDo.reminder = { at: change.until, sentAt: null };
        return finishChange(previous, "reminder-snoozed", [{ kind: "toDo", id: toDo.id }], "Undo Reminder snooze");
      }
      if (change.type === "completeToDo" || change.type === "cancelToDo") {
        if (toDo.outcome !== "open") return fail(["Only an open to-do can be closed."]);
        toDo.outcome = change.type === "completeToDo" ? "completed" : "canceled";
        toDo.completedAt = dependencies.now();
        if (document.settings.logCompletedItems === "immediately") toDo.logbookAt = dependencies.now();
        const outcome = change.type === "completeToDo" ? "to-do-completed" : "to-do-canceled";
        return finishChange(previous, outcome, [{ kind: "toDo", id: toDo.id }], `Reopen “${toDo.title}”`);
      }
      if (change.type === "reopenToDo") {
        if (toDo.outcome === "open") return fail(["This to-do is already open."]);
        toDo.outcome = "open";
        toDo.completedAt = null;
        toDo.logbookAt = null;
        return finishChange(previous, "to-do-reopened", [{ kind: "toDo", id: toDo.id }], `Close “${toDo.title}” again`);
      }
      if (change.type === "logToDo") {
        if (toDo.outcome === "open") return fail(["Complete or cancel this to-do before logging it."]);
        if (toDo.trashedAt) return fail(["Restore this to-do before logging it."]);
        toDo.logbookAt = dependencies.now();
        return finishChange(previous, "to-do-logged", [{ kind: "toDo", id: toDo.id }], `Remove “${toDo.title}” from Logbook`);
      }
      if (change.type === "trashToDo") {
        if (toDo.trashedAt) return fail(["This to-do is already in Trash."]);
        toDo.trashedAt = dependencies.now();
        return finishChange(previous, "to-do-trashed", [{ kind: "toDo", id: toDo.id }], `Restore “${toDo.title}”`);
      }
      if (change.type === "restoreToDo") {
        if (!toDo.trashedAt) return fail(["This to-do is not in Trash."]);
        toDo.trashedAt = null;
        return finishChange(previous, "to-do-restored", [{ kind: "toDo", id: toDo.id }], `Move “${toDo.title}” back to Trash`);
      }
      if (change.type === "permanentlyDeleteToDo") {
        if (change.confirmation !== PERMANENT_DELETE_CONFIRMATION) return failAs("confirmation-required", [`Type ${PERMANENT_DELETE_CONFIRMATION} to delete this to-do.`]);
        if (!toDo.trashedAt) return fail(["Only a to-do in Trash can be permanently deleted."]);
        document.toDos = document.toDos.filter((item) => item.id !== toDo.id);
        document.permanentDeletions.push({ entityKind: "toDo", entityId: toDo.id, deletedAt: dependencies.now() });
        return finishChange(previous, "to-do-permanently-deleted", [{ kind: "toDo", id: toDo.id }]);
      }
      if (change.type === "duplicateToDo") {
        const copy = duplicateToDoRecord(toDo, copyDocument(toDo.location), document.toDos.length, `${toDo.title} copy`);
        document.toDos.push(copy);
        return finishChange(previous, "to-do-duplicated", [{ kind: "toDo", id: copy.id }], `Delete “${copy.title}”`);
      }

      return fail(["This to-do change is not supported."]);
    },

    changeMany(changes) {
      if (!changes.length) return reject(["Choose at least one Workspace change."]);
      const previous = copyDocument(document);
      const affected: AffectedEntity[] = [];
      const temporaryUndoTokens: string[] = [];
      for (const change of changes) {
        const result = this.change(change);
        if (result.status === "rejected") {
          document = previous;
          for (const token of temporaryUndoTokens) undoEntries.delete(token);
          return result;
        }
        affected.push(...result.affected);
        if (result.undo) temporaryUndoTokens.push(result.undo.token);
      }
      for (const token of temporaryUndoTokens) undoEntries.delete(token);
      const uniqueAffected = [...new Map(affected.map((item) => [`${item.kind}:${item.id}`, item])).values()];
      return finishChange(previous, "to-dos-updated", uniqueAffected, "Undo changes to selected to-dos");
    },

    undo(token) {
      const entry = undoEntries.get(token);
      if (!entry) {
        return {
          status: "rejected",
          outcome: "undo-unavailable",
          affected: [],
          undo: null,
          errors: ["This change can no longer be undone."],
        };
      }
      entry.run();
      undoEntries.delete(token);
      return {
        status: "changed",
        outcome: "change-undone",
        affected: entry.affected,
        undo: null,
      };
    },
  };
}
