import type { Schedule, ToDoLocation } from "../../shared/workspace/model.ts";
import type { WorkspaceChange } from "../../shared/workspace/workspace.ts";

export type InteractionSource = "row" | "inspector" | "keyboard" | "menu" | "bulk" | "drag" | "touch";

export type ToDoAction =
  | { type: "complete" }
  | { type: "cancel" }
  | { type: "reopen" }
  | { type: "trash" }
  | { type: "restore" }
  | { type: "duplicate" }
  | { type: "schedule"; schedule: Schedule }
  | { type: "move"; location: ToDoLocation }
  | { type: "tag"; titles: string[] };

export type ToDoIntent = {
  source: InteractionSource;
  ids: string[];
  action: ToDoAction;
};

export type InterfaceRepeatRule = {
  mode: "fixed" | "afterCompletion";
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays: number[];
  nextDate: string;
  reminderTime?: string | null;
  deadlineOffset?: number | null;
  paused: boolean;
};

function repeatingTemplateDetails(repeat: InterfaceRepeatRule) {
  const pattern = {
    frequency: repeat.frequency,
    interval: Math.max(1, Math.floor(repeat.interval)),
    weekdays: [...repeat.weekdays],
  };
  const mode = repeat.mode === "afterCompletion" ? "after-completion" as const : "on-schedule" as const;
  const changes = {
    nextDate: repeat.nextDate,
    pattern,
    mode,
    reminderTime: repeat.reminderTime || null,
    deadlineOffsetDays: Number.isFinite(repeat.deadlineOffset) ? repeat.deadlineOffset : null,
  };
  return { pattern, mode, changes };
}

export type SelectionState = { ids: string[]; anchorId: string | null };
export type SelectionMode = "single" | "toggle" | "range" | "all";

export function toDoActionForShortcut(input: {
  key: string;
  command: boolean;
  alt: boolean;
  shift: boolean;
  today: string;
}): ToDoAction | null {
  const key = input.key.toLowerCase();
  if (input.command && !input.alt && !input.shift && (input.key === "Enter" || input.key === ".")) return { type: "complete" };
  if (!input.command && input.alt && input.key === "Backspace") return { type: "cancel" };
  if (input.command && !input.alt && !input.shift && key === "t") return { type: "schedule", schedule: { kind: "scheduled", date: input.today, evening: false } };
  if (input.command && input.alt && !input.shift && key === "t") return { type: "schedule", schedule: { kind: "scheduled", date: input.today, evening: true } };
  if (input.command && !input.alt && !input.shift && key === "d") return { type: "duplicate" };
  return null;
}

export function touchActionForDistance(horizontalDistance: number, threshold = 70): "select" | "menu" | null {
  if (Math.abs(horizontalDistance) <= threshold) return null;
  return horizontalDistance > 0 ? "select" : "menu";
}

export function updateSelection(
  selection: SelectionState,
  visibleIds: string[],
  itemId: string | null,
  mode: SelectionMode,
): SelectionState {
  if (mode === "all") return { ids: [...visibleIds], anchorId: selection.anchorId ?? visibleIds[0] ?? null };
  if (!itemId || !visibleIds.includes(itemId)) return selection;
  if (mode === "single") return { ids: [itemId], anchorId: itemId };
  if (mode === "toggle") {
    const selected = new Set(selection.ids);
    if (selected.has(itemId)) selected.delete(itemId);
    else selected.add(itemId);
    return { ids: visibleIds.filter((id) => selected.has(id)), anchorId: itemId };
  }
  const anchorId = selection.anchorId && visibleIds.includes(selection.anchorId) ? selection.anchorId : itemId;
  const start = visibleIds.indexOf(anchorId);
  const end = visibleIds.indexOf(itemId);
  return { ids: visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1), anchorId };
}

export function changesForIntent(intent: ToDoIntent): WorkspaceChange[] {
  const ids = [...new Set(intent.ids)];
  return ids.map((id): WorkspaceChange => {
    const action = intent.action;
    if (action.type === "complete") return { type: "completeToDo", id };
    if (action.type === "cancel") return { type: "cancelToDo", id };
    if (action.type === "reopen") return { type: "reopenToDo", id };
    if (action.type === "trash") return { type: "trashToDo", id };
    if (action.type === "restore") return { type: "restoreToDo", id };
    if (action.type === "duplicate") return { type: "duplicateToDo", id };
    if (action.type === "schedule") return { type: "updateToDo", id, changes: { schedule: action.schedule } };
    if (action.type === "move") return { type: "updateToDo", id, changes: { location: action.location } };
    return { type: "setToDoTags", id, titles: action.titles };
  });
}

export function changesForToDoRepetition(input: {
  toDoId: string;
  templateId: string | null;
  newTemplateId: string | null;
  wasPaused: boolean;
  repeat: InterfaceRepeatRule;
}): WorkspaceChange[] {
  const details = repeatingTemplateDetails(input.repeat);
  const templateId = input.templateId ?? input.newTemplateId;
  if (!templateId) return [];
  const changes: WorkspaceChange[] = [];
  if (!input.templateId) {
    changes.push({ type: "makeToDoRepeating", id: input.toDoId, nextDate: input.repeat.nextDate, pattern: details.pattern, mode: details.mode });
  }
  changes.push({ type: "updateRepeatingTemplate", id: templateId, changes: details.changes });
  if (input.repeat.paused && !input.wasPaused) changes.push({ type: "pauseRepeatingTemplate", id: templateId });
  if (!input.repeat.paused && input.wasPaused) changes.push({ type: "resumeRepeatingTemplate", id: templateId });
  return changes;
}

export function changesForProjectRepetition(input: {
  projectId: string;
  templateId: string | null;
  newTemplateId: string | null;
  wasPaused: boolean;
  repeat: InterfaceRepeatRule;
}): WorkspaceChange[] {
  const details = repeatingTemplateDetails(input.repeat);
  const templateId = input.templateId ?? input.newTemplateId;
  if (!templateId) return [];
  const changes: WorkspaceChange[] = [];
  if (!input.templateId) {
    changes.push({ type: "makeProjectRepeating", id: input.projectId, firstDate: input.repeat.nextDate, pattern: details.pattern, mode: details.mode });
  }
  changes.push({ type: "updateRepeatingTemplate", id: templateId, changes: details.changes });
  if (input.repeat.paused && !input.wasPaused) changes.push({ type: "pauseRepeatingTemplate", id: templateId });
  if (!input.repeat.paused && input.wasPaused) changes.push({ type: "resumeRepeatingTemplate", id: templateId });
  return changes;
}
