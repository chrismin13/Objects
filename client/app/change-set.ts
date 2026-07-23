import type { InterfaceChangeSet, InterfaceState } from "../../shared/replacement/interface-bridge";
import type { WorkspaceChange } from "../../shared/replacement/workspace";

const COLLECTIONS = ["spaces", "areas", "projects", "headings", "calendarEvents", "tasks"] as const;
type CollectionName = typeof COLLECTIONS[number];
type JsonRecord = Record<string, unknown>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function recordPatch(previous: JsonRecord = {}, current: JsonRecord = {}): JsonRecord {
  const patch: JsonRecord = {};
  for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    if (key === "id" || current[key] === undefined || sameValue(previous[key], current[key])) continue;
    patch[key] = clone(current[key]);
  }
  return patch;
}

export function createInterfaceChangeSet(input: {
  previous: InterfaceState;
  current: InterfaceState;
  mutationId: string;
  workspaceChanges?: WorkspaceChange[];
  replaceWorkspace?: boolean;
}): InterfaceChangeSet | null {
  const changes: InterfaceChangeSet = {
    mutationId: input.mutationId,
    replaceWorkspace: input.replaceWorkspace,
    workspaceChanges: clone(input.workspaceChanges ?? []),
    settings: recordPatch(input.previous.settings, input.current.settings),
    entities: {},
    deletes: {},
  };
  let changed = Boolean(changes.workspaceChanges?.length || Object.keys(changes.settings ?? {}).length);
  for (const kind of COLLECTIONS) {
    const previous = new Map(input.previous[kind].map((item) => [item.id, item as JsonRecord & { id: string }]));
    const current = new Map(input.current[kind].map((item) => [item.id, item as JsonRecord & { id: string }]));
    const patches: Array<{ id: string; patch: JsonRecord }> = [];
    const deletes: string[] = [];
    for (const [id, item] of current) {
      const patch = recordPatch(previous.get(id), item);
      if (!previous.has(id)) {
        for (const [key, value] of Object.entries(item)) if (key !== "id") patch[key] = clone(value);
      }
      if (Object.keys(patch).length) patches.push({ id, patch });
    }
    for (const id of previous.keys()) if (!current.has(id)) deletes.push(id);
    if (patches.length) {
      changes.entities![kind as CollectionName] = patches;
      changed = true;
    }
    if (deletes.length) {
      changes.deletes![kind as CollectionName] = deletes;
      changed = true;
    }
  }
  return changed ? changes : null;
}
