import type {
  Area,
  Bucket,
  ChecklistItem,
  Heading,
  ItemStatus,
  ObjectsState,
  Project,
  RepeatRule,
  Space,
  Task,
} from "../../shared/state";
import { addDays, areaById, cloneState, itemSpaceId, localDay, nextRepeatDate, projectById, uid } from "./model";

export type MoveDestination =
  | { kind: "inbox" }
  | { kind: "anytime" }
  | { kind: "area"; id: string }
  | { kind: "project"; id: string }
  | { kind: "heading"; id: string };

export type ProjectCompletionResolution = "complete" | "cancel" | "move-anytime";

function touch(state: ObjectsState): void {
  state.updatedAt = new Date().toISOString();
}

function entityOrder(items: Array<{ order: number }>): number {
  return Math.max(-1, ...items.map((item) => Number(item.order) || 0)) + 1;
}

function taskById(state: ObjectsState, id: string): Task | undefined {
  return state.tasks.find((task) => task.id === id);
}

function headingById(state: ObjectsState, id: string): Heading | undefined {
  return state.headings.find((heading) => heading.id === id);
}

function moveReminder(task: Task, day: string | null): void {
  if (!task.reminderAt) return;
  task.reminderAt = day ? `${day}T${task.reminderAt.slice(11, 16) || "09:00"}` : null;
  task.reminderSentAt = null;
}

export function updateTask(state: ObjectsState, id: string, patch: Partial<Task>): Task | undefined {
  const task = taskById(state, id);
  if (!task) return;
  Object.assign(task, patch, { id: task.id });
  touch(state);
  return task;
}

export function scheduleTasks(state: ObjectsState, ids: string[], bucket: Bucket, scheduledFor: string | null = null, evening = false): void {
  const today = localDay();
  for (const id of ids) {
    const task = taskById(state, id);
    if (!task || task.status !== "open" || task.repeat) continue;
    task.bucket = bucket;
    task.evening = bucket === "today" && evening;
    task.scheduledFor = bucket === "today" ? today : bucket === "upcoming" ? scheduledFor || addDays(today, 1) : null;
    moveReminder(task, task.scheduledFor);
  }
  touch(state);
}

export function moveTasks(state: ObjectsState, ids: string[], destination: MoveDestination): void {
  const heading = destination.kind === "heading" ? headingById(state, destination.id) : undefined;
  const project = destination.kind === "project"
    ? projectById(state, destination.id)
    : heading?.projectId ? projectById(state, heading.projectId) : undefined;
  const area = destination.kind === "area"
    ? areaById(state, destination.id)
    : project?.areaId ? areaById(state, project.areaId) : heading?.areaId ? areaById(state, heading.areaId) : undefined;

  for (const id of ids) {
    const task = taskById(state, id);
    if (!task || task.repeat) continue;
    task.projectId = project?.id || null;
    task.headingId = heading?.id || null;
    task.areaId = project?.areaId || area?.id || heading?.areaId || null;
    task.spaceId = project?.spaceId || area?.spaceId || task.spaceId;
    if (destination.kind === "inbox") {
      task.bucket = "inbox";
      task.scheduledFor = null;
      task.evening = false;
      moveReminder(task, null);
    } else if (task.bucket === "inbox") {
      task.bucket = "anytime";
    }
  }
  touch(state);
}

export function completeTasks(state: ObjectsState, ids: string[], status: Extract<ItemStatus, "completed" | "canceled"> = "completed", now = new Date()): void {
  const completedAt = now.toISOString();
  for (const id of ids) {
    const task = taskById(state, id);
    if (!task || task.status !== "open" || task.repeat) continue;
    task.status = status;
    task.completedAt = completedAt;
    task.loggedAt = state.settings.logCompletedItems === "immediately" ? completedAt : null;
    if (task.repeatTemplateId) {
      const template = taskById(state, task.repeatTemplateId);
      if (template?.repeat?.mode === "afterCompletion") template.repeat.nextDate = nextRepeatDate(localDay(now), template.repeat);
    }
  }
  touch(state);
}

export function reopenTasks(state: ObjectsState, ids: string[]): void {
  for (const id of ids) {
    const task = taskById(state, id);
    if (!task || !["completed", "canceled"].includes(task.status)) continue;
    task.status = "open";
    task.completedAt = null;
    task.loggedAt = null;
    task.completedWithProjectId = null;
  }
  touch(state);
}

export function trashTasks(state: ObjectsState, ids: string[], now = new Date()): void {
  const trashedAt = now.toISOString();
  for (const id of ids) {
    const task = taskById(state, id);
    if (!task || task.status === "trashed") continue;
    task.previousStatus = task.status;
    task.status = "trashed";
    task.trashedAt = trashedAt;
    task.loggedAt = null;
  }
  touch(state);
}

export function restoreTasks(state: ObjectsState, ids: string[]): void {
  for (const id of ids) {
    const task = taskById(state, id);
    if (!task || task.status !== "trashed") continue;
    const project = projectById(state, task.projectId);
    if (project?.status === "trashed") {
      project.status = project.previousStatus || "open";
      project.previousStatus = undefined;
      project.trashedAt = null;
    }
    task.status = task.previousStatus || "open";
    task.previousStatus = undefined;
    task.trashedAt = null;
  }
  touch(state);
}

export function deleteTasksForever(state: ObjectsState, ids: string[]): void {
  const deleted = new Set(ids);
  state.tasks = state.tasks.filter((task) => !deleted.has(task.id));
  touch(state);
}

export function duplicateTask(state: ObjectsState, id: string): Task | undefined {
  const task = taskById(state, id);
  if (!task) return;
  const copy: Task = {
    ...cloneState(task),
    id: uid("task"),
    title: `${task.title} copy`,
    status: "open",
    completedAt: null,
    loggedAt: null,
    trashedAt: null,
    previousStatus: undefined,
    completedWithProjectId: null,
    reminderSentAt: null,
    repeatTemplateId: null,
    createdAt: new Date().toISOString(),
    order: entityOrder(state.tasks),
    checklist: task.checklist.map((item) => ({ ...item, id: uid("check") })),
  };
  state.tasks.push(copy);
  touch(state);
  return copy;
}

export function addChecklistItem(state: ObjectsState, taskId: string, title = ""): ChecklistItem | undefined {
  const task = taskById(state, taskId);
  if (!task) return;
  const item = { id: uid("check"), title, done: false };
  task.checklist.push(item);
  touch(state);
  return item;
}

export function removeChecklistItem(state: ObjectsState, taskId: string, itemId: string): void {
  const task = taskById(state, taskId);
  if (!task) return;
  task.checklist = task.checklist.filter((item) => item.id !== itemId);
  touch(state);
}

export function reorderChecklist(state: ObjectsState, taskId: string, orderedIds: string[]): void {
  const task = taskById(state, taskId);
  if (!task) return;
  const byId = new Map(task.checklist.map((item) => [item.id, item]));
  task.checklist = orderedIds.map((id) => byId.get(id)).filter((item): item is ChecklistItem => Boolean(item));
  touch(state);
}

export type TaskOrderDestination = {
  headingId?: string | null;
  bucket?: Bucket;
  scheduledFor?: string | null;
  evening?: boolean;
};

export function reorderTasks(
  state: ObjectsState,
  movedIds: string[],
  orderedIds: string[],
  destination: TaskOrderDestination = {},
): void {
  const moved = new Set(movedIds);
  for (const task of state.tasks) {
    if (!moved.has(task.id) || task.repeat) continue;
    if ("headingId" in destination) task.headingId = destination.headingId || null;
    if (destination.bucket) task.bucket = destination.bucket;
    if ("scheduledFor" in destination) {
      task.scheduledFor = destination.scheduledFor || null;
      moveReminder(task, task.scheduledFor);
    }
    if (destination.evening !== undefined) task.evening = destination.evening;
  }
  const position = new Map(orderedIds.map((id, index) => [id, index]));
  for (const task of state.tasks) if (position.has(task.id)) task.order = position.get(task.id)!;
  touch(state);
}

export function createSpace(state: ObjectsState, title: string, color = "#5b7cfa"): Space {
  const space: Space = { id: uid("space"), title: title.trim() || "New Space", color, pinned: state.spaces.filter((item) => item.pinned).length < 2, order: entityOrder(state.spaces) };
  state.spaces.push(space);
  touch(state);
  return space;
}

export function deleteSpace(state: ObjectsState, id: string): void {
  if (state.spaces.length <= 1) return;
  const fallback = state.spaces.find((space) => space.id !== id && space.id === state.settings.defaultSpaceId) || state.spaces.find((space) => space.id !== id);
  if (!fallback) return;
  for (const item of [...state.areas, ...state.projects, ...state.tasks, ...state.calendarEvents]) {
    if (item.spaceId === id) item.spaceId = fallback.id;
  }
  state.spaces = state.spaces.filter((space) => space.id !== id);
  state.settings.spaceSchedule.rules = state.settings.spaceSchedule.rules.filter((rule) => rule.spaceId !== id);
  if (state.settings.defaultSpaceId === id) state.settings.defaultSpaceId = fallback.id;
  touch(state);
}

export function createArea(state: ObjectsState, input: Pick<Area, "title" | "spaceId"> & Partial<Pick<Area, "color" | "tags">>): Area {
  const area: Area = { id: uid("area"), spaceId: input.spaceId, title: input.title.trim(), color: input.color || "#5b7cfa", tags: [...(input.tags || [])], order: entityOrder(state.areas) };
  state.areas.push(area);
  touch(state);
  return area;
}

export function removeArea(state: ObjectsState, id: string): void {
  const area = areaById(state, id);
  if (!area) return;
  for (const project of state.projects.filter((item) => item.areaId === id)) project.areaId = null;
  for (const task of state.tasks.filter((item) => item.areaId === id && !item.projectId)) {
    task.areaId = null;
    task.headingId = null;
  }
  state.headings = state.headings.filter((heading) => heading.areaId !== id);
  state.areas = state.areas.filter((item) => item.id !== id);
  touch(state);
}

export function createProject(state: ObjectsState, input: Pick<Project, "title"> & Partial<Project>): Project {
  const area = areaById(state, input.areaId);
  const project: Project = {
    id: uid("project"),
    spaceId: area?.spaceId || input.spaceId || state.settings.defaultSpaceId,
    areaId: input.areaId || null,
    title: input.title.trim(),
    notes: input.notes || "",
    bucket: input.bucket || "anytime",
    scheduledFor: input.scheduledFor || null,
    deadline: input.deadline || null,
    tags: [...(input.tags || [])],
    status: "open",
    repeat: input.repeat ? cloneState(input.repeat) : null,
    completedAt: null,
    loggedAt: null,
    order: entityOrder(state.projects),
  };
  state.projects.push(project);
  touch(state);
  return project;
}

export function trashProject(state: ObjectsState, id: string, now = new Date()): void {
  const project = projectById(state, id);
  if (!project || project.status === "trashed") return;
  const trashedAt = now.toISOString();
  project.previousStatus = project.status;
  project.status = "trashed";
  project.trashedAt = trashedAt;
  project.loggedAt = null;
  for (const task of state.tasks.filter((item) => item.projectId === id)) {
    task.previousStatus = task.status;
    task.status = "trashed";
    task.trashedAt = trashedAt;
    task.loggedAt = null;
  }
  touch(state);
}

export function completeProject(state: ObjectsState, id: string, status: Extract<ItemStatus, "completed" | "canceled">, remaining: ProjectCompletionResolution, now = new Date()): void {
  const project = projectById(state, id);
  if (!project || project.status !== "open") return;
  const openTasks = state.tasks.filter((task) => task.projectId === id && task.status === "open" && !task.repeat);
  if (remaining === "move-anytime") {
    for (const task of openTasks) {
      task.projectId = null;
      task.headingId = null;
      task.areaId = null;
      task.bucket = "anytime";
    }
  } else {
    completeTasks(state, openTasks.map((task) => task.id), remaining === "cancel" ? "canceled" : "completed", now);
    for (const task of openTasks) task.completedWithProjectId = project.id;
  }
  project.status = status;
  project.completedAt = now.toISOString();
  project.loggedAt = state.settings.logCompletedItems === "immediately" ? project.completedAt : null;
  if (project.repeatTemplateId) {
    const template = projectById(state, project.repeatTemplateId);
    if (template?.repeat?.mode === "afterCompletion") template.repeat.nextDate = nextRepeatDate(localDay(now), template.repeat);
  }
  touch(state);
}

export function duplicateProject(state: ObjectsState, id: string): Project | undefined {
  const project = projectById(state, id);
  if (!project) return;
  const copy: Project = { ...cloneState(project), id: uid("project"), title: `${project.title} copy`, status: "open", completedAt: null, loggedAt: null, trashedAt: null, previousStatus: undefined, repeatTemplateId: null, order: entityOrder(state.projects) };
  state.projects.push(copy);
  const headingMap = new Map<string, string>();
  for (const heading of state.headings.filter((item) => item.projectId === id)) {
    const nextId = uid("heading");
    headingMap.set(heading.id, nextId);
    state.headings.push({ ...cloneState(heading), id: nextId, projectId: copy.id });
  }
  for (const task of state.tasks.filter((item) => item.projectId === id && item.status === "open")) {
    state.tasks.push({ ...cloneState(task), id: uid("task"), projectId: copy.id, headingId: task.headingId ? headingMap.get(task.headingId) || null : null, status: "open", completedAt: null, loggedAt: null, repeatTemplateId: null, checklist: task.checklist.map((item) => ({ ...item, id: uid("check"), done: false })), createdAt: new Date().toISOString(), order: entityOrder(state.tasks) });
  }
  touch(state);
  return copy;
}

export function createHeading(state: ObjectsState, title: string, parent: { projectId?: string | null; areaId?: string | null }): Heading {
  const siblings = state.headings.filter((heading) => heading.projectId === (parent.projectId || null) && heading.areaId === (parent.areaId || null));
  const heading: Heading = { id: uid("heading"), projectId: parent.projectId || null, areaId: parent.areaId || null, title: title.trim(), archived: false, order: entityOrder(siblings) };
  state.headings.push(heading);
  touch(state);
  return heading;
}

export function deleteHeading(state: ObjectsState, id: string): void {
  for (const task of state.tasks.filter((item) => item.headingId === id)) task.headingId = null;
  state.headings = state.headings.filter((heading) => heading.id !== id);
  touch(state);
}

export function convertHeadingToProject(state: ObjectsState, id: string): Project | undefined {
  const heading = headingById(state, id);
  if (!heading) return;
  const parentProject = projectById(state, heading.projectId);
  const areaId = parentProject?.areaId || heading.areaId || null;
  const project = createProject(state, { title: heading.title, areaId, spaceId: parentProject?.spaceId || areaById(state, areaId)?.spaceId || state.settings.defaultSpaceId });
  for (const task of state.tasks.filter((item) => item.headingId === id)) {
    task.projectId = project.id;
    task.headingId = null;
    task.areaId = project.areaId;
    task.spaceId = project.spaceId;
  }
  state.headings = state.headings.filter((item) => item.id !== id);
  touch(state);
  return project;
}

export function reorderEntities<T extends { id: string; order: number }>(items: T[], orderedIds: string[]): void {
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  for (const item of items) if (positions.has(item.id)) item.order = positions.get(item.id)!;
}

export function makeRepeatRule(input: Partial<RepeatRule> = {}): RepeatRule {
  return {
    mode: input.mode || "fixed",
    frequency: input.frequency || "weekly",
    interval: Math.max(1, Number(input.interval) || 1),
    weekdays: [...(input.weekdays || [])],
    nextDate: input.nextDate || addDays(localDay(), 7),
    reminderTime: input.reminderTime || "",
    deadlineOffset: input.deadlineOffset ?? null,
    paused: Boolean(input.paused),
  };
}

export function taskSpaceBeforeMove(state: ObjectsState, id: string): string | null {
  const task = taskById(state, id);
  return task ? itemSpaceId(state, task) : null;
}
