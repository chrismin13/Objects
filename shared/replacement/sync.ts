import type { IsoDateTime, PermanentDeletion, WorkspaceDocument } from "./model.ts";
import { createWorkspace } from "./workspace.ts";

export type WorkspaceSyncSnapshot = {
  revision: number;
  document: WorkspaceDocument;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type WorkspaceDeltaOperation = {
  path: string[];
  before: { present: boolean; value?: JsonValue };
  after: { present: boolean; value?: JsonValue };
};

export type WorkspaceDelta = {
  operations: WorkspaceDeltaOperation[];
  orderings?: WorkspaceOrderingChange[];
};

export type WorkspaceOrderingChange = {
  path: string[];
  before: string[];
  after: string[];
};

export type WorkspaceSyncCommand = {
  expectedRevision: number;
  mutationId: string;
  document: WorkspaceDocument;
  changes?: WorkspaceDelta;
};

export type WorkspaceSyncConflict = {
  path: string;
  resolution: "local-change-kept" | "permanent-deletion-kept" | "remote-removal-kept";
};

export type WorkspaceSyncAcknowledgement = {
  status: "acknowledged";
  mutationId: string;
  revision: number;
  snapshot: WorkspaceSyncSnapshot;
  conflicts: WorkspaceSyncConflict[];
};

export type WorkspaceSyncResult =
  | WorkspaceSyncAcknowledgement
  | { status: "conflict"; snapshot: WorkspaceSyncSnapshot }
  | { status: "rejected"; errors: string[] };

export type WorkspaceSyncAdapter = {
  load(): Promise<WorkspaceSyncSnapshot | null>;
  save(command: WorkspaceSyncCommand): Promise<WorkspaceSyncResult>;
  subscribe?(listener: () => void): () => void;
};

export type InMemorySyncStore = {
  forOwner(ownerId: string): WorkspaceSyncAdapter;
};

export type ResolvedSyncCommand = {
  result: WorkspaceSyncResult;
  next: WorkspaceSyncSnapshot | null;
};

type JsonObject = { [key: string]: JsonValue };

const ENTITY_COLLECTIONS = new Map<string, PermanentDeletion["entityKind"]>([
  ["toDos", "toDo"],
  ["projects", "project"],
  ["areas", "area"],
  ["headings", "heading"],
  ["spaces", "space"],
  ["tags", "tag"],
  ["repeatingTemplates", "repeatingTemplate"],
  ["calendarEvents", "calendarEvent"],
]);

export function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function record(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function mapBy<T>(items: T[], key: (item: T) => string): JsonObject {
  const mapped: JsonObject = {};
  for (const item of items) mapped[key(item)] = cloneJsonValue(item) as JsonValue;
  return mapped;
}

function values<T>(value: unknown): T[] {
  return Object.values(record(value)) as T[];
}

function byOrder<T extends { order: number; id?: string }>(left: T, right: T): number {
  return left.order - right.order || String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

function toSyncTree(document: WorkspaceDocument): JsonObject {
  const tree = cloneJsonValue(document) as unknown as JsonObject;
  for (const name of ["spaces", "areas", "projects", "headings", "tags", "toDos", "repeatingTemplates", "projectClosures", "calendarEvents"] as const) {
    tree[name] = mapBy(document[name], (item) => item.id);
  }
  tree.permanentDeletions = mapBy(document.permanentDeletions, (item) => `${item.entityKind}:${item.entityId}`);
  tree.captureReceipts = mapBy(document.captureReceipts, (item) => item.submissionId);

  const settings = record(tree.settings);
  settings.launchRules = mapBy(document.settings.launchRules, (item) => item.id);

  const toDos = record(tree.toDos);
  for (const toDo of document.toDos) record(toDos[toDo.id]).checklist = mapBy(toDo.checklist, (item) => item.id);

  const templates = record(tree.repeatingTemplates);
  for (const template of document.repeatingTemplates) {
    const stored = record(templates[template.id]);
    stored.checklist = mapBy(template.checklist, (item) => item.id);
    if (template.projectContents) {
      const contents = record(stored.projectContents);
      contents.headings = mapBy(template.projectContents.headings, (item) => item.key);
      contents.toDos = mapBy(template.projectContents.toDos, (item) => item.key);
    }
  }
  delete tree.sync;
  return tree;
}

function fromSyncTree(tree: JsonObject, sync: WorkspaceDocument["sync"]): WorkspaceDocument {
  const document = cloneJsonValue(tree) as unknown as WorkspaceDocument;
  document.spaces = values(document.spaces).sort(byOrder);
  document.areas = values(document.areas).sort(byOrder);
  document.projects = values(document.projects).sort(byOrder);
  document.headings = values(document.headings).sort(byOrder);
  document.tags = values(document.tags).sort(byOrder);
  document.toDos = values(document.toDos).sort(byOrder);
  document.repeatingTemplates = values(document.repeatingTemplates);
  document.projectClosures = values(document.projectClosures).sort((left, right) => left.closedAt.localeCompare(right.closedAt));
  document.calendarEvents = values(document.calendarEvents).sort((left, right) => left.start.localeCompare(right.start));
  document.permanentDeletions = values(document.permanentDeletions).sort((left, right) => left.deletedAt.localeCompare(right.deletedAt));
  document.captureReceipts = values(document.captureReceipts).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  document.settings.launchRules = values(document.settings.launchRules).sort(byOrder);
  for (const toDo of document.toDos) toDo.checklist = values(toDo.checklist).sort(byOrder);
  for (const template of document.repeatingTemplates) {
    template.checklist = values(template.checklist).sort(byOrder);
    if (template.projectContents) {
      template.projectContents.headings = values(template.projectContents.headings).sort(byOrder);
      template.projectContents.toDos = values(template.projectContents.toDos).sort(byOrder);
    }
  }
  document.sync = cloneJsonValue(sync);
  return document;
}

function diffValue(before: JsonValue | undefined, after: JsonValue | undefined, path: string[], operations: WorkspaceDeltaOperation[]): void {
  if (equal(before, after)) return;
  if (path.at(-1) === "order") return;
  const beforeObject = before && typeof before === "object" && !Array.isArray(before);
  const afterObject = after && typeof after === "object" && !Array.isArray(after);
  if (beforeObject && afterObject) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) diffValue(before[key], after[key], [...path, key], operations);
    return;
  }
  operations.push({
    path,
    before: before === undefined ? { present: false } : { present: true, value: cloneJsonValue(before) },
    after: after === undefined ? { present: false } : { present: true, value: cloneJsonValue(after) },
  });
}

function orderedKeys<T extends { order: number }>(items: T[], key: (item: T) => string): string[] {
  return [...items].sort((left, right) => left.order - right.order || key(left).localeCompare(key(right))).map(key);
}

function workspaceOrderings(document: WorkspaceDocument): WorkspaceOrderingChange[] {
  const orderings: WorkspaceOrderingChange[] = [];
  const add = (path: string[], after: string[]) => orderings.push({ path, before: [], after });
  add(["spaces"], orderedKeys(document.spaces, (item) => item.id));
  add(["areas"], orderedKeys(document.areas, (item) => item.id));
  add(["projects"], orderedKeys(document.projects, (item) => item.id));
  add(["headings"], orderedKeys(document.headings, (item) => item.id));
  add(["tags"], orderedKeys(document.tags, (item) => item.id));
  add(["toDos"], orderedKeys(document.toDos, (item) => item.id));
  add(["settings", "launchRules"], orderedKeys(document.settings.launchRules, (item) => item.id));
  for (const toDo of document.toDos) add(["toDos", toDo.id, "checklist"], orderedKeys(toDo.checklist, (item) => item.id));
  for (const template of document.repeatingTemplates) {
    add(["repeatingTemplates", template.id, "checklist"], orderedKeys(template.checklist, (item) => item.id));
    if (template.projectContents) {
      add(["repeatingTemplates", template.id, "projectContents", "headings"], orderedKeys(template.projectContents.headings, (item) => item.key));
      add(["repeatingTemplates", template.id, "projectContents", "toDos"], orderedKeys(template.projectContents.toDos, (item) => item.key));
    }
  }
  return orderings;
}

export function createWorkspaceDelta(before: WorkspaceDocument, after: WorkspaceDocument): WorkspaceDelta {
  const operations: WorkspaceDeltaOperation[] = [];
  diffValue(toSyncTree(before), toSyncTree(after), [], operations);
  const beforeOrderings = new Map(workspaceOrderings(before).map((ordering) => [ordering.path.join("/"), ordering.after]));
  const orderings = workspaceOrderings(after)
    .map((ordering) => ({ ...ordering, before: beforeOrderings.get(ordering.path.join("/")) ?? [] }))
    .filter((ordering) => !equal(ordering.before, ordering.after));
  return { operations, ...(orderings.length ? { orderings } : {}) };
}

function valueAt(root: JsonObject, path: string[]): { present: boolean; value?: JsonValue } {
  let parent: JsonValue = root;
  for (const segment of path) {
    if (!parent || typeof parent !== "object" || Array.isArray(parent) || !Object.prototype.hasOwnProperty.call(parent, segment)) {
      return { present: false };
    }
    parent = parent[segment];
  }
  return { present: true, value: cloneJsonValue(parent) };
}

function setAt(root: JsonObject, path: string[], next: { present: boolean; value?: JsonValue }): void {
  if (!path.length) throw new Error("A sync change cannot replace the Workspace root.");
  let parent = root;
  for (const segment of path.slice(0, -1)) {
    const current = parent[segment];
    if (!current || typeof current !== "object" || Array.isArray(current)) parent[segment] = {};
    parent = parent[segment] as JsonObject;
  }
  const key = path[path.length - 1];
  if (next.present) parent[key] = cloneJsonValue(next.value as JsonValue);
  else delete parent[key];
}

function sameStoredValue(left: { present: boolean; value?: JsonValue }, right: { present: boolean; value?: JsonValue }): boolean {
  return left.present === right.present && (!left.present || equal(left.value, right.value));
}

function conflictPath(path: string[]): string {
  return path.join("/");
}

function permanentDeletionFor(document: WorkspaceDocument, path: string[]): PermanentDeletion | null {
  const entityKind = ENTITY_COLLECTIONS.get(path[0]);
  if (!entityKind || !path[1]) return null;
  return document.permanentDeletions.find((marker) => marker.entityKind === entityKind && marker.entityId === path[1]) ?? null;
}

function keyedItemWasRemoved(tree: JsonObject, path: string[]): boolean {
  const keyedCollections = [
    { prefix: [path[0]], keyIndex: 1, applies: ENTITY_COLLECTIONS.has(path[0]) },
    { prefix: ["toDos", path[1], "checklist"], keyIndex: 3, applies: path[0] === "toDos" && path[2] === "checklist" },
    { prefix: ["repeatingTemplates", path[1], "checklist"], keyIndex: 3, applies: path[0] === "repeatingTemplates" && path[2] === "checklist" },
    { prefix: ["repeatingTemplates", path[1], "projectContents", path[3]], keyIndex: 4, applies: path[0] === "repeatingTemplates" && path[2] === "projectContents" && ["headings", "toDos"].includes(path[3]) },
    { prefix: ["settings", "launchRules"], keyIndex: 2, applies: path[0] === "settings" && path[1] === "launchRules" },
  ];
  for (const collection of keyedCollections) {
    if (!collection.applies || path.length <= collection.keyIndex + 1) continue;
    let parent: JsonValue = tree;
    for (const segment of collection.prefix) {
      if (!parent || typeof parent !== "object" || Array.isArray(parent)) return true;
      parent = parent[segment];
    }
    if (!Object.prototype.hasOwnProperty.call(record(parent), path[collection.keyIndex])) return true;
  }
  return false;
}

function objectAt(root: JsonObject, path: string[]): JsonObject | null {
  let current: JsonValue = root;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = current[segment];
  }
  return current && typeof current === "object" && !Array.isArray(current) ? current : null;
}

function currentOrder(container: JsonObject): string[] {
  return Object.entries(container)
    .sort(([leftKey, left], [rightKey, right]) => Number(record(left).order ?? 0) - Number(record(right).order ?? 0) || leftKey.localeCompare(rightKey))
    .map(([key]) => key);
}

function applyOrderingChanges(tree: JsonObject, orderings: WorkspaceOrderingChange[], conflicts: WorkspaceSyncConflict[]): void {
  for (const ordering of orderings) {
    const container = objectAt(tree, ordering.path);
    if (!container) continue;
    const remoteOrder = currentOrder(container);
    const localOrder = ordering.after.filter((key) => Object.prototype.hasOwnProperty.call(container, key));
    const remoteOnly = remoteOrder.filter((key) => !ordering.after.includes(key));
    const mergedOrder = [...localOrder, ...remoteOnly];
    if (!equal(remoteOrder, ordering.before) && !equal(remoteOrder, mergedOrder)) {
      conflicts.push({ path: `${ordering.path.join("/")}/order`, resolution: "local-change-kept" });
    }
    mergedOrder.forEach((key, index) => { record(container[key]).order = index; });
  }
}

function removePermanentlyDeletedEntities(document: WorkspaceDocument): void {
  for (const [collection, entityKind] of ENTITY_COLLECTIONS) {
    const blocked = new Set(document.permanentDeletions.filter((marker) => marker.entityKind === entityKind).map((marker) => marker.entityId));
    const items = document[collection as keyof WorkspaceDocument];
    if (Array.isArray(items)) (document as unknown as Record<string, unknown>)[collection] = items.filter((item) => !blocked.has((item as { id: string }).id));
  }
}

function removeProjectOccurrence(document: WorkspaceDocument, projectId: string): void {
  const headingIds = new Set(document.headings.filter((heading) => heading.location.kind === "project" && heading.location.projectId === projectId).map((heading) => heading.id));
  document.projects = document.projects.filter((project) => project.id !== projectId);
  document.headings = document.headings.filter((heading) => !headingIds.has(heading.id));
  document.toDos = document.toDos.filter((toDo) => !(toDo.location.kind === "project" && toDo.location.projectId === projectId)
    && !(toDo.location.kind === "heading" && headingIds.has(toDo.location.headingId)));
  document.projectClosures = document.projectClosures.filter((closure) => closure.projectId !== projectId);
}

function deduplicateRemoteWork(document: WorkspaceDocument, remote: WorkspaceDocument, conflicts: WorkspaceSyncConflict[]): void {
  const remoteToDoOccurrences = new Map(remote.toDos.filter((item) => item.occurrence).map((item) => [`${item.occurrence!.templateId}:${item.occurrence!.scheduledDate}`, item.id]));
  const seenToDoOccurrences = new Map<string, string>();
  for (const toDo of [...document.toDos]) {
    if (!toDo.occurrence) continue;
    const key = `${toDo.occurrence.templateId}:${toDo.occurrence.scheduledDate}`;
    const preferred = remoteToDoOccurrences.get(key) ?? seenToDoOccurrences.get(key) ?? toDo.id;
    if (preferred !== toDo.id) {
      document.toDos = document.toDos.filter((item) => item.id !== toDo.id);
      conflicts.push({ path: `toDos/${toDo.id}/occurrence`, resolution: "remote-removal-kept" });
    } else seenToDoOccurrences.set(key, toDo.id);
  }

  const remoteProjectOccurrences = new Map(remote.projects.filter((item) => item.occurrence).map((item) => [`${item.occurrence!.templateId}:${item.occurrence!.scheduledDate}`, item.id]));
  const seenProjectOccurrences = new Map<string, string>();
  for (const project of [...document.projects]) {
    if (!project.occurrence) continue;
    const key = `${project.occurrence.templateId}:${project.occurrence.scheduledDate}`;
    const preferred = remoteProjectOccurrences.get(key) ?? seenProjectOccurrences.get(key) ?? project.id;
    if (preferred !== project.id) {
      removeProjectOccurrence(document, project.id);
      conflicts.push({ path: `projects/${project.id}/occurrence`, resolution: "remote-removal-kept" });
    } else seenProjectOccurrences.set(key, project.id);
  }

  const remoteReceipts = new Map(remote.captureReceipts.map((receipt) => [receipt.submissionId, receipt]));
  for (const receipt of [...document.captureReceipts]) {
    const preferred = remoteReceipts.get(receipt.submissionId);
    if (!preferred || preferred.toDoId === receipt.toDoId) continue;
    document.toDos = document.toDos.filter((toDo) => toDo.id !== receipt.toDoId);
    document.captureReceipts = document.captureReceipts.filter((item) => item.submissionId !== receipt.submissionId);
    document.captureReceipts.push(cloneJsonValue(preferred));
    conflicts.push({ path: `captureReceipts/${receipt.submissionId}`, resolution: "remote-removal-kept" });
  }

  const remoteCalendarSources = new Map(remote.calendarEvents.filter((event) => event.sourceUid).map((event) => [event.sourceUid!, event.id]));
  for (const event of [...document.calendarEvents]) {
    if (!event.sourceUid) continue;
    const preferredId = remoteCalendarSources.get(event.sourceUid);
    if (!preferredId || preferredId === event.id) continue;
    document.calendarEvents = document.calendarEvents.filter((item) => item.id !== event.id);
    conflicts.push({ path: `calendarEvents/${event.id}/sourceUid`, resolution: "remote-removal-kept" });
  }
}

export function applyWorkspaceDelta(
  remote: WorkspaceDocument,
  delta: WorkspaceDelta,
): { document: WorkspaceDocument; conflicts: WorkspaceSyncConflict[]; errors: string[] } {
  if (!delta || !Array.isArray(delta.operations) || delta.operations.length > 100_000) {
    return { document: cloneJsonValue(remote), conflicts: [], errors: ["Workspace changes are malformed or too large."] };
  }
  const orderings = delta.orderings ?? [];
  if (!Array.isArray(orderings) || orderings.length > 100_000 || orderings.some((ordering) =>
    !ordering || !Array.isArray(ordering.path) || !ordering.path.length || ordering.path.length > 20
    || ordering.path.some((segment) => typeof segment !== "string" || !segment || segment.length > 500 || ["__proto__", "prototype", "constructor"].includes(segment))
    || !Array.isArray(ordering.before) || !Array.isArray(ordering.after)
    || [...ordering.before, ...ordering.after].some((key) => typeof key !== "string" || !key || key.length > 500)
    || new Set(ordering.before).size !== ordering.before.length || new Set(ordering.after).size !== ordering.after.length
  )) {
    return { document: cloneJsonValue(remote), conflicts: [], errors: ["Workspace ordering changes are malformed or too large."] };
  }
  let tree: JsonObject;
  try {
    tree = toSyncTree(remote);
  } catch {
    return { document: cloneJsonValue(remote), conflicts: [], errors: ["The saved Workspace is malformed and needs recovery."] };
  }
  const conflicts: WorkspaceSyncConflict[] = [];
  for (const operation of delta.operations) {
    if (!operation || !Array.isArray(operation.path) || !operation.path.length || operation.path.length > 20
      || operation.path.some((segment) => typeof segment !== "string" || !segment || segment.length > 500 || ["__proto__", "prototype", "constructor"].includes(segment))
      || !operation.before || typeof operation.before.present !== "boolean"
      || !operation.after || typeof operation.after.present !== "boolean"
      || operation.before.present && !Object.prototype.hasOwnProperty.call(operation.before, "value")
      || operation.after.present && !Object.prototype.hasOwnProperty.call(operation.after, "value")) {
      return { document: cloneJsonValue(remote), conflicts: [], errors: ["A Workspace change has a malformed path or value."] };
    }
    const path = operation.path;
    if (permanentDeletionFor(remote, path)) {
      conflicts.push({ path: conflictPath(path), resolution: "permanent-deletion-kept" });
      continue;
    }
    if (keyedItemWasRemoved(tree, path)) {
      conflicts.push({ path: conflictPath(path), resolution: "remote-removal-kept" });
      continue;
    }
    const current = valueAt(tree, path);
    if (sameStoredValue(current, operation.after)) continue;
    if (!sameStoredValue(current, operation.before)) conflicts.push({ path: conflictPath(path), resolution: "local-change-kept" });
    setAt(tree, path, operation.after);
  }
  applyOrderingChanges(tree, orderings, conflicts);
  try {
    const document = fromSyncTree(tree, remote.sync);
    removePermanentlyDeletedEntities(document);
    deduplicateRemoteWork(document, remote, conflicts);
    return { document, conflicts, errors: [] };
  } catch {
    return { document: cloneJsonValue(remote), conflicts: [], errors: ["Workspace changes could not be reconstructed safely."] };
  }
}

export function validateSyncDocument(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["Workspace data must be one object."];
  const document = value as Partial<WorkspaceDocument>;
  const errors: string[] = [];
  if (document.format !== "objects-workspace" || document.version !== 1) errors.push("Workspace format or version is not supported.");
  const collections: Array<keyof WorkspaceDocument> = [
    "spaces", "areas", "projects", "headings", "tags", "toDos", "repeatingTemplates",
    "projectClosures", "calendarEvents", "permanentDeletions", "captureReceipts",
  ];
  for (const name of collections) if (!Array.isArray(document[name])) errors.push(`Workspace ${name} must be a list.`);
  if (!document.settings || typeof document.settings !== "object") errors.push("Workspace settings are missing.");
  if (!document.sync || typeof document.sync !== "object") errors.push("Workspace sync metadata is missing.");
  return errors;
}

function validateWorkspaceRules(document: WorkspaceDocument, now: IsoDateTime): string[] {
  try {
    return createWorkspace(document, { now: () => now, createId: (kind) => `sync-validation-${kind}` }).validate();
  } catch {
    return ["Workspace data is malformed and could not be validated safely."];
  }
}

function entityExists(document: WorkspaceDocument, marker: PermanentDeletion): boolean {
  const collections = {
    toDo: document.toDos,
    project: document.projects,
    area: document.areas,
    heading: document.headings,
    space: document.spaces,
    tag: document.tags,
    repeatingTemplate: document.repeatingTemplates,
    calendarEvent: document.calendarEvents,
  };
  return collections[marker.entityKind].some((entity) => entity.id === marker.entityId);
}

function mergeDeletionMarkers(current: WorkspaceDocument | null, next: WorkspaceDocument): PermanentDeletion[] {
  const markers = new Map<string, PermanentDeletion>();
  for (const marker of current?.permanentDeletions ?? []) markers.set(`${marker.entityKind}:${marker.entityId}`, marker);
  for (const marker of next.permanentDeletions) markers.set(`${marker.entityKind}:${marker.entityId}`, marker);
  return [...markers.values()];
}

function acknowledgement(mutationId: string, snapshot: WorkspaceSyncSnapshot, conflicts: WorkspaceSyncConflict[] = []): WorkspaceSyncAcknowledgement {
  return { status: "acknowledged", mutationId, revision: snapshot.revision, snapshot: cloneJsonValue(snapshot), conflicts: cloneJsonValue(conflicts) };
}

export function resolveSyncCommand(
  current: WorkspaceSyncSnapshot | null,
  command: WorkspaceSyncCommand,
  updatedAt: IsoDateTime,
): ResolvedSyncCommand {
  if (!command.mutationId || command.mutationId.length > 200) {
    return { result: { status: "rejected", errors: ["A valid mutation identity is required."] }, next: null };
  }
  const submittedErrors = validateSyncDocument(command.document);
  if (submittedErrors.length) return { result: { status: "rejected", errors: submittedErrors }, next: null };

  if (current?.document.sync.lastMutationId === command.mutationId) {
    return { result: acknowledgement(command.mutationId, current), next: null };
  }
  const currentRevision = current?.revision ?? 0;
  if (command.expectedRevision !== currentRevision && !command.changes) {
    return current
      ? { result: { status: "conflict", snapshot: cloneJsonValue(current) }, next: null }
      : { result: { status: "conflict", snapshot: { revision: 0, document: cloneJsonValue(command.document) } }, next: null };
  }

  let nextDocument = cloneJsonValue(command.document);
  let conflicts: WorkspaceSyncConflict[] = [];
  if (current && command.changes) {
    const applied = applyWorkspaceDelta(current.document, command.changes);
    if (applied.errors.length) return { result: { status: "rejected", errors: applied.errors }, next: null };
    nextDocument = applied.document;
    conflicts = applied.conflicts.slice(0, 40);
  }
  nextDocument.captureReceipts = Array.isArray(nextDocument.captureReceipts) ? nextDocument.captureReceipts : [];
  nextDocument.permanentDeletions = mergeDeletionMarkers(current?.document ?? null, nextDocument);
  const recreated = nextDocument.permanentDeletions.filter((marker) => entityExists(nextDocument, marker));
  if (recreated.length && !command.changes) {
    return {
      result: {
        status: "rejected",
        errors: recreated.map((marker) => `${marker.entityKind} “${marker.entityId}” was permanently deleted and cannot be recreated.`),
      },
      next: null,
    };
  }
  removePermanentlyDeletedEntities(nextDocument);
  const errors = validateSyncDocument(nextDocument);
  if (errors.length) return { result: { status: "rejected", errors }, next: null };
  const ruleErrors = validateWorkspaceRules(nextDocument, updatedAt);
  if (ruleErrors.length) return { result: { status: "rejected", errors: ruleErrors }, next: null };

  const revision = currentRevision + 1;
  nextDocument.sync = { revision, lastMutationId: command.mutationId, updatedAt };
  const next = { revision, document: nextDocument };
  return { result: acknowledgement(command.mutationId, next, conflicts), next };
}

export function createInMemorySyncStore(now: () => IsoDateTime): InMemorySyncStore {
  const snapshots = new Map<string, WorkspaceSyncSnapshot>();
  const receipts = new Map<string, Map<string, WorkspaceSyncAcknowledgement>>();

  return {
    forOwner(ownerId) {
      return {
        async load() {
          const snapshot = snapshots.get(ownerId);
          return snapshot ? cloneJsonValue(snapshot) : null;
        },

        async save(command) {
          const known = receipts.get(ownerId)?.get(command.mutationId);
          if (known) {
            const snapshot = snapshots.get(ownerId) ?? known.snapshot;
            return acknowledgement(command.mutationId, snapshot, known.conflicts);
          }
          const resolved = resolveSyncCommand(snapshots.get(ownerId) ?? null, command, now());
          if (resolved.next && resolved.result.status === "acknowledged") {
            snapshots.set(ownerId, resolved.next);
            const ownerReceipts = receipts.get(ownerId) ?? new Map<string, WorkspaceSyncAcknowledgement>();
            ownerReceipts.set(command.mutationId, resolved.result);
            receipts.set(ownerId, ownerReceipts);
          }
          return resolved.result;
        },
      };
    },
  };
}
