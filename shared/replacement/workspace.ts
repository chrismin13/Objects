import type {
  AffectedEntity,
  EntityId,
  IsoDateTime,
  ToDo,
  ToDoLocation,
  WorkspaceChangeResult,
  WorkspaceDocument,
  WorkspaceEntityKind,
} from "./model.ts";
import { createEmptyImportReport, parsePortableBackup, type ImportReport } from "./importer.ts";

export const FULL_IMPORT_CONFIRMATION = "REPLACE WORKSPACE";

export type WorkspaceDependencies = {
  now: () => IsoDateTime;
  createId: (kind: WorkspaceEntityKind | "undo") => string;
};

export type WorkspaceChange = {
  type: "createToDo";
  title: string;
  notes?: string;
  location?: ToDoLocation;
};

export type Workspace = {
  read(): WorkspaceDocument;
  change(change: WorkspaceChange): WorkspaceChangeResult;
  undo(token: string): WorkspaceChangeResult;
  view(view: WorkspaceView): ToDo[];
  locationOfToDo(id: EntityId): EffectiveToDoLocation | null;
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

export type WorkspaceView = {
  kind: "today" | "upcoming" | "inbox" | "anytime" | "someday" | "trash" | "logbook";
  date: string;
};

export type EffectiveToDoLocation = {
  headingId?: EntityId;
  projectId?: EntityId;
  areaId?: EntityId;
  spaceId: EntityId;
};

type UndoEntry = {
  affected: AffectedEntity[];
  run: () => void;
};

function copyDocument(document: WorkspaceDocument): WorkspaceDocument {
  return JSON.parse(JSON.stringify(document)) as WorkspaceDocument;
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
      if (project.location.kind === "space" && !document.spaces.some((space) => space.id === project.location.spaceId)) {
        errors.push(`Project “${project.id}” has no valid Space.`);
      }
      if (project.location.kind === "area" && !document.areas.some((area) => area.id === project.location.areaId)) {
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
      if (heading.location.kind === "project" && !document.projects.some((project) => project.id === heading.location.projectId)) {
        errors.push(`Heading “${heading.id}” has no valid Project.`);
      }
      if (heading.location.kind === "area" && !document.areas.some((area) => area.id === heading.location.areaId)) {
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
      const hasValidLocation = template.itemKind === "toDo"
        ? locationExists(template.location)
        : template.location.kind === "space"
          ? document.spaces.some((space) => space.id === template.location.spaceId)
          : template.location.kind === "area"
            ? document.areas.some((area) => area.id === template.location.areaId)
            : false;
      if (!hasValidLocation) errors.push(`Repeating Template “${template.id}” has no valid Location.`);
      if (!isIsoDate(template.nextDate)) errors.push(`Repeating Template “${template.id}” has an invalid next date.`);
      if (!isIsoDateTime(template.createdAt)) errors.push(`Repeating Template “${template.id}” has an invalid creation date.`);
      if (!Number.isInteger(template.pattern.interval) || template.pattern.interval < 1) errors.push(`Repeating Template “${template.id}” has an invalid interval.`);
      if (template.pattern.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) errors.push(`Repeating Template “${template.id}” has an invalid weekday.`);
      if (template.reminderTime && !isTime(template.reminderTime)) errors.push(`Repeating Template “${template.id}” has an invalid reminder time.`);
      for (const tagId of template.tags) if (!document.tags.some((tag) => tag.id === tagId)) errors.push(`Repeating Template “${template.id}” has an unknown Tag.`);
      if (template.itemKind === "project" && !template.projectContents) errors.push(`Repeating Project Template “${template.id}” has no Project contents.`);
      if (template.itemKind === "toDo" && template.projectContents) errors.push(`Repeating to-do Template “${template.id}” cannot contain Project contents.`);
      if (template.projectContents) {
        const headingKeys = new Set(template.projectContents.headings.map((heading) => heading.key));
        for (const toDo of template.projectContents.toDos) {
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
      return document.toDos.filter((toDo) => {
        if (view.kind === "trash") return toDo.trashedAt !== null;
        if (view.kind === "logbook") return toDo.logbookAt !== null && toDo.trashedAt === null;
        if (toDo.outcome !== "open" || toDo.trashedAt || toDo.logbookAt) return false;
        if (view.kind === "today") return toDo.schedule.kind === "scheduled" && toDo.schedule.date <= view.date;
        if (view.kind === "upcoming") return toDo.schedule.kind === "scheduled" && toDo.schedule.date > view.date;
        return toDo.schedule.kind === view.kind;
      }).map((toDo) => JSON.parse(JSON.stringify(toDo)) as ToDo);
    },

    locationOfToDo,

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
      const title = change.title.trim();
      if (!title) return reject(["A to-do title is required."]);
      if (title.length > 500) return reject(["A to-do title must be 500 characters or fewer."]);

      const location = change.location ?? (
        document.settings.defaultSpaceId
          ? { kind: "unfiled", spaceId: document.settings.defaultSpaceId }
          : null
      );
      if (!location) return reject(["Create a Space before adding an unfiled to-do."]);
      if (!locationExists(location)) return reject(["The selected to-do Location no longer exists."]);

      const createdAt = dependencies.now();
      const toDo: ToDo = {
        id: dependencies.createId("toDo"),
        title,
        notes: change.notes?.trim() ?? "",
        checklist: [],
        location,
        schedule: { kind: "inbox" },
        reminder: null,
        deadline: null,
        outcome: "open",
        trashedAt: null,
        logbookAt: null,
        tags: [],
        occurrence: null,
        createdAt,
        completedAt: null,
        order: document.toDos.length,
      };
      document.toDos.push(toDo);
      document.sync.updatedAt = createdAt;

      const affected: AffectedEntity[] = [{ kind: "toDo", id: toDo.id }];
      const token = dependencies.createId("undo");
      undoEntries.set(token, {
        affected,
        run: () => {
          document.toDos = document.toDos.filter((item) => item.id !== toDo.id);
          document.sync.updatedAt = dependencies.now();
        },
      });

      return {
        status: "changed",
        outcome: "to-do-created",
        affected,
        undo: { token, label: `Delete “${toDo.title}”` },
      };
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
