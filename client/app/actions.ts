import type {
  InterfaceBucket,
  InterfaceChecklistItem,
  InterfaceState,
  InterfaceToDo,
} from "../../shared/workspace/interface-bridge";

type ToDoPresentationState = {
  repeat?: { stopped?: unknown } | null;
  repeatTemplateId?: string | null;
  workspaceTemplateId?: string | null;
};

export function toDoRowCapabilities(task: ToDoPresentationState): {
  completable: boolean;
  selectable: boolean;
  draggable: boolean;
} {
  const isRepeatingTemplate = Boolean(task.repeat);
  const isProjectTemplateItem = Boolean(task.workspaceTemplateId);
  const actionable = !isRepeatingTemplate && !isProjectTemplateItem;
  return {
    completable: actionable,
    selectable: actionable,
    draggable: actionable,
  };
}

export function repeatingEditorAccess(
  task: ToDoPresentationState,
): "create" | "edit" | "read-only" | "unavailable" {
  if (task.repeatTemplateId || task.workspaceTemplateId) return "unavailable";
  if (!task.repeat) return "create";
  return task.repeat.stopped ? "read-only" : "edit";
}

function touch(state: InterfaceState): void {
  state.updatedAt = new Date().toISOString();
}

function moveReminder(task: InterfaceToDo, day: string | null): void {
  if (!task.reminderAt) return;
  task.reminderAt = day ? `${day}T${task.reminderAt.slice(11, 16) || "09:00"}` : null;
  task.reminderSentAt = null;
}

export function reorderChecklist(
  state: InterfaceState,
  taskId: string,
  orderedIds: string[],
): void {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return;
  const byId = new Map(task.checklist.map((item) => [item.id, item]));
  task.checklist = orderedIds
    .map((id) => byId.get(id))
    .filter((item): item is InterfaceChecklistItem => Boolean(item));
  touch(state);
}

export type TaskOrderDestination = {
  projectId?: string | null;
  areaId?: string | null;
  headingId?: string | null;
  spaceId?: string | null;
  bucket?: InterfaceBucket;
  scheduledFor?: string | null;
  evening?: boolean;
};

export function reorderTasks(
  state: InterfaceState,
  movedIds: string[],
  orderedIds: string[],
  destination: TaskOrderDestination = {},
): void {
  const moved = new Set(movedIds);
  // A drag that names a project/area/space is a reparent: it replaces the full
  // Location projection rather than nudging one leaf. The old heading belonged
  // to the previous parent, so clear it unless the destination names a new one
  // (matching openMoveTaskModal). A heading-only destination is the project/area
  // view case and only reassigns that single leaf.
  const reparenting =
    "projectId" in destination || "areaId" in destination || "spaceId" in destination;
  for (const task of state.tasks) {
    if (!moved.has(task.id) || task.repeat) continue;
    if (reparenting) {
      if ("projectId" in destination) task.projectId = destination.projectId || null;
      if ("areaId" in destination) task.areaId = destination.areaId || null;
      if ("spaceId" in destination) task.spaceId = destination.spaceId || null;
      task.headingId = "headingId" in destination ? destination.headingId || null : null;
    } else if ("headingId" in destination) {
      task.headingId = destination.headingId || null;
    }
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

export function reorderEntities<T extends { id: string; order: number }>(
  items: T[],
  orderedIds: string[],
): void {
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  for (const item of items) if (positions.has(item.id)) item.order = positions.get(item.id)!;
}
