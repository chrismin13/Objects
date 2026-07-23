import type {
  InterfaceBucket,
  InterfaceChecklistItem,
  InterfaceStateSnapshot,
  InterfaceTask,
} from "./interface-types";

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

export function repeatingEditorAccess(task: ToDoPresentationState): "create" | "edit" | "read-only" | "unavailable" {
  if (task.repeatTemplateId || task.workspaceTemplateId) return "unavailable";
  if (!task.repeat) return "create";
  return task.repeat.stopped ? "read-only" : "edit";
}

function touch(state: InterfaceStateSnapshot): void {
  state.updatedAt = new Date().toISOString();
}

function moveReminder(task: InterfaceTask, day: string | null): void {
  if (!task.reminderAt) return;
  task.reminderAt = day ? `${day}T${task.reminderAt.slice(11, 16) || "09:00"}` : null;
  task.reminderSentAt = null;
}

export function reorderChecklist(state: InterfaceStateSnapshot, taskId: string, orderedIds: string[]): void {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return;
  const byId = new Map(task.checklist.map((item) => [item.id, item]));
  task.checklist = orderedIds.map((id) => byId.get(id)).filter((item): item is InterfaceChecklistItem => Boolean(item));
  touch(state);
}

export type TaskOrderDestination = {
  headingId?: string | null;
  bucket?: InterfaceBucket;
  scheduledFor?: string | null;
  evening?: boolean;
};

export function reorderTasks(state: InterfaceStateSnapshot, movedIds: string[], orderedIds: string[], destination: TaskOrderDestination = {}): void {
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

export function reorderEntities<T extends { id: string; order: number }>(items: T[], orderedIds: string[]): void {
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  for (const item of items) if (positions.has(item.id)) item.order = positions.get(item.id)!;
}
