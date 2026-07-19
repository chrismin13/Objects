import type {
  Area,
  CalendarEvent,
  ChecklistItem,
  Heading,
  IsoDateTime,
  Outcome,
  Project,
  RepeatingTemplate,
  Schedule,
  Space,
  Tag,
  ToDo,
  ToDoLocation,
  WorkspaceDocument,
  WorkspaceEntityKind,
} from "./model.ts";

type JsonRecord = Record<string, unknown>;

export type ImportReport = {
  imported: {
    spaces: number;
    areas: number;
    projects: number;
    headings: number;
    tags: number;
    toDos: number;
    repeatingTemplates: number;
    calendarEvents: number;
  };
  corrected: number;
  skipped: number;
  rejected: number;
  messages: Array<{ kind: "corrected" | "skipped" | "rejected"; message: string }>;
};

export type ImportDependencies = {
  now: () => IsoDateTime;
  createId: (kind: WorkspaceEntityKind | "undo") => string;
};

export type ParsedImport =
  | { ok: true; document: WorkspaceDocument; report: ImportReport }
  | { ok: false; report: ImportReport };

export function createEmptyImportReport(): ImportReport {
  return {
    imported: {
      spaces: 0, areas: 0, projects: 0, headings: 0, tags: 0, toDos: 0,
      repeatingTemplates: 0, calendarEvents: 0,
    },
    corrected: 0,
    skipped: 0,
    rejected: 0,
    messages: [],
  };
}

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function correction(report: ImportReport, message: string) {
  report.corrected += 1;
  report.messages.push({ kind: "corrected", message });
}

function skip(report: ImportReport, message: string) {
  report.skipped += 1;
  report.messages.push({ kind: "skipped", message });
}

function reject(report: ImportReport, message: string): ParsedImport {
  report.rejected += 1;
  report.messages.push({ kind: "rejected", message });
  return { ok: false, report };
}

function outcomeFromLegacy(item: JsonRecord, report: ImportReport, label: string): Outcome {
  const rawStatus = item.status;
  if (rawStatus === "trashed" || rawStatus === "trash") {
    correction(report, `${label}: separated Trash placement from its Outcome.`);
    return outcomeValue(item.previousStatus, report, label);
  }
  return outcomeValue(rawStatus, report, label);
}

function outcomeValue(value: unknown, report: ImportReport, label: string): Outcome {
  if (value === "open") return "open";
  if (value === "completed") return "completed";
  if (value === "canceled") return "canceled";
  if (value === "done" || value === "complete") {
    correction(report, `${label}: changed legacy status “${String(value)}” to completed.`);
    return "completed";
  }
  if (value === "cancelled" || value === "skipped") {
    correction(report, `${label}: changed legacy status “${String(value)}” to canceled.`);
    return "canceled";
  }
  correction(report, `${label}: replaced an unknown status with open.`);
  return "open";
}

function scheduleFromLegacy(item: JsonRecord, today: string, report: ImportReport, label: string): Schedule {
  const bucket = item.bucket;
  const scheduledFor = optionalText(item.scheduledFor);
  if (scheduledFor) return { kind: "scheduled", date: scheduledFor, evening: Boolean(item.evening) };
  if (bucket === "inbox" || bucket === "anytime" || bucket === "someday") return { kind: bucket };
  if (bucket === "today" || bucket === "upcoming") {
    correction(report, `${label}: supplied a missing scheduled date.`);
    return { kind: "scheduled", date: today, evening: Boolean(item.evening) };
  }
  correction(report, `${label}: replaced an unknown Schedule with Inbox.`);
  return { kind: "inbox" };
}

function checklistFromLegacy(value: unknown, report: ImportReport, label: string): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  const checklist: ChecklistItem[] = [];
  const ids = new Set<string>();
  for (const [index, rawItem] of value.entries()) {
    const item = record(rawItem);
    const id = item && text(item.id);
    const title = item && text(item.title);
    if (!item || !id || !title || ids.has(id)) {
      correction(report, `${label}: removed a malformed checklist item.`);
      continue;
    }
    ids.add(id);
    checklist.push({ id, title, completed: Boolean(item.done), order: index });
  }
  return checklist;
}

function repeatingReminderDefault(toDo: ToDo, firstDate: string) {
  if (!toDo.reminder) return null;
  const time = /T(\d{2}:\d{2})/.exec(toDo.reminder.at)?.[1];
  if (time) {
    const reminderDate = toDo.reminder.at.slice(0, 10);
    const days = Math.round((Date.parse(`${reminderDate}T00:00:00.000Z`) - Date.parse(`${firstDate}T00:00:00.000Z`)) / 86_400_000);
    return { kind: "offset" as const, days, time };
  }
  return { kind: "fixed" as const, at: toDo.reminder.at };
}

function repeatingDeadlineDefault(toDo: ToDo) {
  if (!toDo.deadline) return null;
  if (toDo.schedule.kind !== "scheduled") return { kind: "fixed" as const, date: toDo.deadline };
  const scheduled = Date.parse(`${toDo.schedule.date}T00:00:00.000Z`);
  const deadline = Date.parse(`${toDo.deadline}T00:00:00.000Z`);
  return { kind: "offset" as const, days: Math.round((deadline - scheduled) / 86_400_000) };
}

function legacyRepeat(
  item: JsonRecord,
  itemKind: "toDo" | "project",
  location: ToDoLocation | Project["location"],
  tags: string[],
  checklist: ChecklistItem[],
  dependencies: ImportDependencies,
  report: ImportReport,
): RepeatingTemplate | null {
  const repeat = record(item.repeat);
  if (!repeat) return null;
  const frequency = ["daily", "weekly", "monthly", "yearly"].includes(String(repeat.frequency))
    ? repeat.frequency as RepeatingTemplate["pattern"]["frequency"]
    : "daily";
  if (frequency !== repeat.frequency) correction(report, `${String(item.title)}: repaired an unknown repeat frequency.`);
  const interval = Math.max(1, Math.floor(numberOr(repeat.interval, 1)));
  const weekdays = Array.isArray(repeat.weekdays)
    ? repeat.weekdays.filter((day): day is number => typeof day === "number" && day >= 0 && day <= 6)
    : [];
  const nextDate = optionalText(repeat.nextDate) ?? dependencies.now().slice(0, 10);
  if (!optionalText(repeat.nextDate)) correction(report, `${String(item.title)}: supplied a missing next repeat date.`);
  correction(report, `${String(item.title)}: moved legacy repetition into a separate Repeating Template.`);
  const template = {
    id: dependencies.createId("repeatingTemplate"),
    title: text(item.title) ?? "Untitled",
    notes: typeof item.notes === "string" ? item.notes : "",
    tags,
    checklist,
    pattern: { frequency, interval, weekdays },
    mode: repeat.mode === "afterCompletion" ? "after-completion" as const : "on-schedule" as const,
    state: repeat.paused ? "paused" as const : "active" as const,
    firstDate: optionalText(item.scheduledFor) ?? nextDate,
    nextDate,
    reminderTime: optionalText(repeat.reminderTime),
    deadlineOffsetDays: typeof repeat.deadlineOffset === "number" ? repeat.deadlineOffset : null,
    createdAt: optionalText(item.createdAt) ?? dependencies.now(),
  };
  if (itemKind === "toDo") {
    return { ...template, itemKind, location: location as ToDoLocation, projectContents: null };
  }
  return {
    ...template,
    itemKind,
    location: location as Project["location"],
    projectContents: { headings: [], toDos: [] },
  };
}

export function parsePortableBackup(serialized: string, dependencies: ImportDependencies): ParsedImport {
  const report = createEmptyImportReport();
  let source: JsonRecord | null = null;
  try {
    source = record(JSON.parse(serialized) as unknown);
  } catch {
    return reject(report, "The backup is not valid JSON.");
  }
  if (!source) return reject(report, "The backup must contain one JSON object.");
  if (!Array.isArray(source.tasks) || !Array.isArray(source.projects) || !Array.isArray(source.areas)) {
    return reject(report, "The backup does not match the current Objects portable format.");
  }

  const now = dependencies.now();
  const today = now.slice(0, 10);
  const rawSpaces = Array.isArray(source.spaces) ? source.spaces : [];
  const spaces: Space[] = [];
  const spaceIds = new Set<string>();
  for (const rawSpace of rawSpaces) {
    const item = record(rawSpace);
    const id = item && text(item.id);
    const title = item && text(item.title);
    if (!item || !id || !title || spaceIds.has(id)) {
      skip(report, "Skipped a malformed or duplicate Space.");
      continue;
    }
    spaceIds.add(id);
    spaces.push({
      id, title, color: optionalText(item.color) ?? "#5b7cfa", pinned: item.pinned !== false,
      order: numberOr(item.order, spaces.length),
    });
  }
  if (!spaces.length) {
    const recoveryId = dependencies.createId("space");
    spaces.push({ id: recoveryId, title: "Imported", color: "#5b7cfa", pinned: true, order: 0 });
    spaceIds.add(recoveryId);
    correction(report, "Created an Imported Space because the backup had no usable Spaces.");
  }
  const fallbackSpaceId = spaces[0].id;
  report.imported.spaces = spaces.length;

  const settingsSource = record(source.settings) ?? {};
  const requestedDefaultSpaceId = optionalText(settingsSource.defaultSpaceId);
  const defaultSpaceId = requestedDefaultSpaceId && spaceIds.has(requestedDefaultSpaceId) ? requestedDefaultSpaceId : fallbackSpaceId;
  if (requestedDefaultSpaceId !== defaultSpaceId) correction(report, "Replaced the missing default Space with the Imported Space.");

  const tagNames = new Set<string>();
  if (Array.isArray(settingsSource.tags)) {
    for (const tag of settingsSource.tags) if (text(tag)) tagNames.add(text(tag)!);
  }
  for (const collectionName of ["areas", "projects", "tasks"] as const) {
    for (const rawItem of source[collectionName] as unknown[]) {
      const item = record(rawItem);
      if (!item || !Array.isArray(item.tags)) continue;
      for (const tag of item.tags) if (text(tag)) tagNames.add(text(tag)!);
    }
  }
  const tags: Tag[] = [...tagNames].map((title, order) => ({ id: dependencies.createId("tag"), title, order }));
  const tagIdByTitle = new Map(tags.map((tag) => [tag.title, tag.id]));
  const tagIds = (value: unknown) => Array.isArray(value)
    ? value.map(text).filter((tag): tag is string => Boolean(tag)).map((tag) => tagIdByTitle.get(tag)).filter((id): id is string => Boolean(id))
    : [];
  report.imported.tags = tags.length;

  const areas: Area[] = [];
  const areaIds = new Set<string>();
  for (const rawArea of source.areas as unknown[]) {
    const item = record(rawArea);
    const id = item && text(item.id);
    const title = item && text(item.title);
    if (!item || !id || !title || areaIds.has(id)) {
      skip(report, "Skipped a malformed or duplicate Area.");
      continue;
    }
    let spaceId = optionalText(item.spaceId);
    if (!spaceId || !spaceIds.has(spaceId)) {
      spaceId = fallbackSpaceId;
      correction(report, `Area “${title}”: replaced its missing Space.`);
    }
    areaIds.add(id);
    areas.push({ id, title, spaceId, color: optionalText(item.color) ?? "#5b7cfa", tags: tagIds(item.tags), order: numberOr(item.order, areas.length) });
  }
  report.imported.areas = areas.length;

  const projects: Project[] = [];
  const projectIds = new Set<string>();
  const projectSources = new Map<string, JsonRecord>();
  for (const rawProject of source.projects as unknown[]) {
    const item = record(rawProject);
    const id = item && text(item.id);
    const title = item && text(item.title);
    if (!item || !id || !title || projectIds.has(id)) {
      skip(report, "Skipped a malformed or duplicate Project.");
      continue;
    }
    const areaId = optionalText(item.areaId);
    const location: Project["location"] = areaId && areaIds.has(areaId)
      ? { kind: "area", areaId }
      : { kind: "space", spaceId: optionalText(item.spaceId) && spaceIds.has(String(item.spaceId)) ? String(item.spaceId) : fallbackSpaceId };
    if (location.kind === "area" && item.spaceId) correction(report, `Project “${title}”: removed its copied Space.`);
    if (location.kind === "space" && optionalText(item.spaceId) !== location.spaceId) correction(report, `Project “${title}”: replaced its missing Space.`);
    const outcome = outcomeFromLegacy(item, report, `Project “${title}”`);
    projects.push({
      id, title, notes: typeof item.notes === "string" ? item.notes : "", location,
      schedule: scheduleFromLegacy(item, today, report, `Project “${title}”`),
      deadline: optionalText(item.deadline), outcome,
      trashedAt: item.status === "trashed" || item.status === "trash" ? optionalText(item.trashedAt) ?? now : null,
      logbookAt: optionalText(item.loggedAt), tags: tagIds(item.tags), occurrence: null,
      completedAt: outcome === "completed" ? optionalText(item.completedAt) ?? now : null,
      order: numberOr(item.order, projects.length),
    });
    projectIds.add(id);
    projectSources.set(id, item);
  }
  report.imported.projects = projects.length;

  const headings: Heading[] = [];
  const headingIds = new Set<string>();
  const rawHeadings = Array.isArray(source.headings) ? source.headings : [];
  for (const rawHeading of rawHeadings) {
    const item = record(rawHeading);
    const id = item && text(item.id);
    const title = item && text(item.title);
    if (!item || !id || !title || headingIds.has(id)) {
      skip(report, "Skipped a malformed or duplicate Heading.");
      continue;
    }
    const projectId = optionalText(item.projectId);
    const areaId = optionalText(item.areaId);
    const location: Heading["location"] | null = projectId && projectIds.has(projectId)
      ? { kind: "project", projectId }
      : areaId && areaIds.has(areaId) ? { kind: "area", areaId } : null;
    if (!location) {
      skip(report, `Skipped Heading “${title}” because its parent is missing.`);
      continue;
    }
    if (location.kind === "project" && areaId) correction(report, `Heading “${title}”: removed its copied Area.`);
    headings.push({ id, title, location, archivedAt: item.archived ? now : null, order: numberOr(item.order, headings.length) });
    headingIds.add(id);
  }
  report.imported.headings = headings.length;

  const repeatingTemplates: RepeatingTemplate[] = [];
  const templateIdByLegacyItemId = new Map<string, string>();
  for (const project of projects) {
    const sourceProject = projectSources.get(project.id)!;
    const template = legacyRepeat(sourceProject, "project", project.location, project.tags, [], dependencies, report);
    if (template) {
      repeatingTemplates.push(template);
      templateIdByLegacyItemId.set(project.id, template.id);
      project.occurrence = {
        templateId: template.id,
        scheduledDate: optionalText(sourceProject.scheduledFor) ?? template.nextDate,
      };
    }
  }

  const toDos: ToDo[] = [];
  const toDoIds = new Set<string>();
  const toDoSources = new Map<string, JsonRecord>();
  for (const rawToDo of source.tasks as unknown[]) {
    const item = record(rawToDo);
    const id = item && text(item.id);
    const title = item && text(item.title);
    if (!item || !id || !title || toDoIds.has(id)) {
      skip(report, "Skipped a malformed or duplicate to-do.");
      continue;
    }
    const headingId = optionalText(item.headingId);
    const projectId = optionalText(item.projectId);
    const areaId = optionalText(item.areaId);
    let location: ToDoLocation;
    if (headingId && headingIds.has(headingId)) location = { kind: "heading", headingId };
    else if (projectId && projectIds.has(projectId)) location = { kind: "project", projectId };
    else if (areaId && areaIds.has(areaId)) location = { kind: "area", areaId };
    else {
      const requestedSpaceId = optionalText(item.spaceId);
      location = { kind: "unfiled", spaceId: requestedSpaceId && spaceIds.has(requestedSpaceId) ? requestedSpaceId : fallbackSpaceId };
      if (requestedSpaceId !== location.spaceId) correction(report, `To-do “${title}”: replaced its missing Space.`);
    }
    const copiedParentCount = [headingId, projectId, areaId, optionalText(item.spaceId)].filter(Boolean).length;
    if (copiedParentCount > 1) correction(report, `To-do “${title}”: kept only its closest parent Location.`);
    const outcome = outcomeFromLegacy(item, report, `To-do “${title}”`);
    const checklist = checklistFromLegacy(item.checklist, report, `To-do “${title}”`);
    const template = legacyRepeat(item, "toDo", location, tagIds(item.tags), checklist, dependencies, report);
    if (template) {
      repeatingTemplates.push(template);
      templateIdByLegacyItemId.set(id, template.id);
    }
    toDos.push({
      id, title, notes: typeof item.notes === "string" ? item.notes : "", checklist, location,
      schedule: scheduleFromLegacy(item, today, report, `To-do “${title}”`),
      reminder: optionalText(item.reminderAt) ? { at: String(item.reminderAt), sentAt: optionalText(item.reminderSentAt) } : null,
      deadline: optionalText(item.deadline), outcome,
      trashedAt: item.status === "trashed" || item.status === "trash" ? optionalText(item.trashedAt) ?? now : null,
      logbookAt: optionalText(item.loggedAt), tags: tagIds(item.tags),
      occurrence: template ? { templateId: template.id, scheduledDate: optionalText(item.scheduledFor) ?? template.nextDate } : null,
      createdAt: optionalText(item.createdAt) ?? now,
      completedAt: outcome === "completed" ? optionalText(item.completedAt) ?? now : null,
      order: numberOr(item.order, toDos.length),
    });
    toDoIds.add(id);
    toDoSources.set(id, item);
  }

  const templateById = new Map(repeatingTemplates.map((template) => [template.id, template]));
  for (const project of projects) {
    if (project.occurrence) continue;
    const sourceProject = projectSources.get(project.id)!;
    const legacyTemplateId = optionalText(sourceProject.repeatTemplateId);
    const templateId = legacyTemplateId ? templateIdByLegacyItemId.get(legacyTemplateId) : null;
    const template = templateId ? templateById.get(templateId) : null;
    if (template?.itemKind === "project") {
      project.occurrence = {
        templateId: template.id,
        scheduledDate: optionalText(sourceProject.scheduledFor) ?? template.nextDate,
      };
      correction(report, `Project “${project.title}”: restored its Repeating Template connection.`);
    } else if (legacyTemplateId) {
      correction(report, `Project “${project.title}”: removed a missing Repeating Template connection.`);
    }
  }
  for (const toDo of toDos) {
    if (toDo.occurrence) continue;
    const sourceToDo = toDoSources.get(toDo.id)!;
    const legacyTemplateId = optionalText(sourceToDo.repeatTemplateId);
    const templateId = legacyTemplateId ? templateIdByLegacyItemId.get(legacyTemplateId) : null;
    const template = templateId ? templateById.get(templateId) : null;
    if (template?.itemKind === "toDo") {
      toDo.occurrence = {
        templateId: template.id,
        scheduledDate: optionalText(sourceToDo.scheduledFor) ?? template.nextDate,
      };
      correction(report, `To-do “${toDo.title}”: restored its Repeating Template connection.`);
    } else if (legacyTemplateId) {
      correction(report, `To-do “${toDo.title}”: removed a missing Repeating Template connection.`);
    }
  }

  for (const project of projects) {
    if (!project.occurrence) continue;
    const template = templateById.get(project.occurrence.templateId);
    if (!template || template.itemKind !== "project") continue;
    if (templateIdByLegacyItemId.get(project.id) !== template.id) continue;
    const projectHeadings = headings.filter((heading) => heading.location.kind === "project" && heading.location.projectId === project.id);
    const headingIdsForProject = new Set(projectHeadings.map((heading) => heading.id));
    const projectToDos = toDos.filter((toDo) =>
      (toDo.location.kind === "project" && toDo.location.projectId === project.id)
      || (toDo.location.kind === "heading" && headingIdsForProject.has(toDo.location.headingId))
    );
    template.projectContents = {
      headings: projectHeadings.map((heading) => ({
        key: heading.id,
        title: heading.title,
        archived: heading.archivedAt !== null,
        order: heading.order,
      })),
      toDos: projectToDos.map((toDo) => ({
        key: toDo.id,
        title: toDo.title,
        notes: toDo.notes,
        headingKey: toDo.location.kind === "heading" ? toDo.location.headingId : null,
        tags: [...toDo.tags],
        checklist: toDo.checklist.map(({ id: _id, ...item }) => item),
        schedule: toDo.schedule.kind === "scheduled"
          ? {
              kind: "scheduled" as const,
              offsetDays: Math.round((Date.parse(`${toDo.schedule.date}T00:00:00.000Z`) - Date.parse(`${template.nextDate}T00:00:00.000Z`)) / 86_400_000),
              evening: toDo.schedule.evening,
            }
          : toDo.schedule,
        reminder: repeatingReminderDefault(toDo, template.firstDate ?? template.nextDate),
        deadline: repeatingDeadlineDefault(toDo),
        order: toDo.order,
      })),
    };
  }
  report.imported.toDos = toDos.length;
  report.imported.repeatingTemplates = repeatingTemplates.length;

  const calendarEvents: CalendarEvent[] = [];
  const eventIds = new Set<string>();
  const rawEvents = Array.isArray(source.calendarEvents) ? source.calendarEvents : [];
  for (const rawEvent of rawEvents) {
    const item = record(rawEvent);
    const id = item && text(item.id);
    const title = item && text(item.title);
    const start = item && text(item.start);
    const end = item && text(item.end);
    if (!item || !id || !title || !start || !end || eventIds.has(id)) {
      skip(report, "Skipped a malformed or duplicate calendar event.");
      continue;
    }
    const requestedSpaceId = optionalText(item.spaceId);
    const spaceId = requestedSpaceId && spaceIds.has(requestedSpaceId) ? requestedSpaceId : fallbackSpaceId;
    if (requestedSpaceId !== spaceId) correction(report, `Calendar event “${title}”: replaced its missing Space.`);
    calendarEvents.push({ id, title, start, end, spaceId, calendar: optionalText(item.calendar) ?? "Imported", allDay: Boolean(item.allDay) });
    eventIds.add(id);
  }
  report.imported.calendarEvents = calendarEvents.length;

  const theme = ["system", "light", "dark"].includes(String(settingsSource.theme))
    ? settingsSource.theme as "system" | "light" | "dark" : "system";
  const logCompletedItems = ["immediately", "daily", "manually"].includes(String(settingsSource.logCompletedItems))
    ? settingsSource.logCompletedItems as "immediately" | "daily" | "manually" : "daily";
  const launchRulesSource = record(settingsSource.spaceSchedule);
  const launchRules = Array.isArray(launchRulesSource?.rules)
    ? launchRulesSource!.rules.map(record).filter((rule): rule is JsonRecord => Boolean(rule)).flatMap((rule, order) => {
      const id = text(rule.id);
      if (!id) return [];
      const requestedSpaceId = optionalText(rule.spaceId);
      return [{
        id, spaceId: requestedSpaceId && spaceIds.has(requestedSpaceId) ? requestedSpaceId : fallbackSpaceId,
        weekdays: Array.isArray(rule.weekdays) ? rule.weekdays.filter((day): day is number => typeof day === "number" && day >= 0 && day <= 6) : [],
        start: optionalText(rule.start) ?? "00:00", end: optionalText(rule.end) ?? "23:59", order: numberOr(rule.order, order),
      }];
    }) : [];
  const quickDraftSource = record(settingsSource.quickDraft);
  let quickDraft: WorkspaceDocument["settings"]["quickDraft"] = null;
  if (quickDraftSource && typeof quickDraftSource.value === "string") {
    quickDraft = {
      value: quickDraftSource.value,
      ...(optionalText(quickDraftSource.updatedAt) ? { updatedAt: String(quickDraftSource.updatedAt) } : {}),
      ...(optionalText(quickDraftSource.viewType) ? { viewType: String(quickDraftSource.viewType) } : {}),
      ...(typeof quickDraftSource.viewId === "string" || quickDraftSource.viewId === null ? { viewId: quickDraftSource.viewId } : {}),
      ...(optionalText(quickDraftSource.sectionKey) ? { sectionKey: String(quickDraftSource.sectionKey) } : {}),
    };
  } else if (settingsSource.quickDraft !== undefined && settingsSource.quickDraft !== null) {
    correction(report, "Removed a malformed unfinished quick entry.");
  }

  return {
    ok: true,
    report,
    document: {
      format: "objects-workspace",
      version: 1,
      settings: {
        theme,
        groupToday: settingsSource.groupToday !== false,
        notifications: Boolean(settingsSource.notifications),
        weekStartsOn: settingsSource.weekStartsOn === 0 ? 0 : 1,
        showCalendar: settingsSource.showCalendar !== false,
        logCompletedItems,
        defaultSpaceId,
        launchRules,
        quickDraft,
      },
      spaces, areas, projects, headings, tags, toDos, repeatingTemplates,
      projectClosures: [], calendarEvents, permanentDeletions: [],
      sync: { revision: 0, lastMutationId: null, updatedAt: now },
    },
  };
}
