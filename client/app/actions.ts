import type {
  LegacyBucket,
  LegacyChecklistItem,
  LegacyInterfaceState,
  LegacyTask,
} from "./legacy-types";

function touch(state: LegacyInterfaceState): void {
  state.updatedAt = new Date().toISOString();
}

function moveReminder(task: LegacyTask, day: string | null): void {
  if (!task.reminderAt) return;
  task.reminderAt = day ? `${day}T${task.reminderAt.slice(11, 16) || "09:00"}` : null;
  task.reminderSentAt = null;
}

export function reorderChecklist(state: LegacyInterfaceState, taskId: string, orderedIds: string[]): void {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return;
  const byId = new Map(task.checklist.map((item) => [item.id, item]));
  task.checklist = orderedIds.map((id) => byId.get(id)).filter((item): item is LegacyChecklistItem => Boolean(item));
  touch(state);
}

export type TaskOrderDestination = {
  headingId?: string | null;
  bucket?: LegacyBucket;
  scheduledFor?: string | null;
  evening?: boolean;
};

export function reorderTasks(state: LegacyInterfaceState, movedIds: string[], orderedIds: string[], destination: TaskOrderDestination = {}): void {
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
