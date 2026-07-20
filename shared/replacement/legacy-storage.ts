import type { WorkspaceDocument } from "./model.ts";
import type { WorkspaceSyncSnapshot } from "./sync.ts";

type JsonRecord = Record<string, unknown>;

export type LegacyEntityRow = {
  entityId: string;
  data: string;
};

export type LegacyChecklistRow = LegacyEntityRow & {
  taskId: string;
  position: string;
};

export type LegacyWorkspaceRows = {
  version: string;
  updatedAt: string;
  mutationId: string;
  settingsData: string;
  spaces: LegacyEntityRow[];
  areas: LegacyEntityRow[];
  projects: LegacyEntityRow[];
  headings: LegacyEntityRow[];
  calendarEvents: LegacyEntityRow[];
  tasks: LegacyEntityRow[];
  checklistItems: LegacyChecklistRow[];
};

export type LegacyMigrationIdentity = {
  updatedAt: string;
  mutationId: string;
};

function parseRecord(serialized: string): JsonRecord {
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("A retained legacy Workspace row is malformed");
  }
  return value as JsonRecord;
}

function inflate(rows: LegacyEntityRow[]): JsonRecord[] {
  return rows
    .map((row) => ({ ...parseRecord(row.data), id: row.entityId }))
    .sort((left, right) => {
      const order = Number(left.order ?? 0) - Number(right.order ?? 0);
      return order || String(left.id).localeCompare(String(right.id));
    });
}

export function assembleLegacyWorkspace(rows: LegacyWorkspaceRows): string {
  const checklistByToDo = new Map<string, JsonRecord[]>();
  for (const row of [...rows.checklistItems].sort((left, right) => left.position.localeCompare(right.position))) {
    const checklist = checklistByToDo.get(row.taskId) ?? [];
    checklist.push({ ...parseRecord(row.data), id: row.entityId });
    checklistByToDo.set(row.taskId, checklist);
  }

  const tasks = inflate(rows.tasks).map((toDo) => ({
    ...toDo,
    checklist: checklistByToDo.get(String(toDo.id)) ?? [],
  }));

  return JSON.stringify({
    version: Number(rows.version) || 7,
    updatedAt: rows.updatedAt,
    syncMutationId: rows.mutationId,
    settings: parseRecord(rows.settingsData),
    spaces: inflate(rows.spaces),
    areas: inflate(rows.areas),
    projects: inflate(rows.projects),
    headings: inflate(rows.headings),
    calendarEvents: inflate(rows.calendarEvents),
    tasks,
  });
}

function mergeByKey<T>(legacy: T[], current: T[], key: (value: T) => string): T[] {
  const merged = new Map(legacy.map((value) => [key(value), structuredClone(value)]));
  for (const value of current) merged.set(key(value), structuredClone(value));
  return [...merged.values()];
}

function mergeSettings(legacy: WorkspaceDocument["settings"], current: WorkspaceDocument["settings"]): WorkspaceDocument["settings"] {
  // The retained Workspace is the settings source of truth for the one-time cutover.
  // A replacement-only draft and rules are content, so keep them as well.
  return {
    ...legacy,
    launchRules: mergeByKey(legacy.launchRules, current.launchRules, (rule) => rule.id),
    quickDraft: current.quickDraft ?? legacy.quickDraft,
  };
}

function removeDurablyDeletedEntities(document: WorkspaceDocument): void {
  const deleted = new Map<string, Set<string>>();
  for (const marker of document.permanentDeletions) {
    const ids = deleted.get(marker.entityKind) ?? new Set<string>();
    ids.add(marker.entityId);
    deleted.set(marker.entityKind, ids);
  }
  const keep = (kind: string, id: string) => !deleted.get(kind)?.has(id);
  document.toDos = document.toDos.filter((item) => keep("toDo", item.id));
  document.projects = document.projects.filter((item) => keep("project", item.id));
  document.areas = document.areas.filter((item) => keep("area", item.id));
  document.headings = document.headings.filter((item) => keep("heading", item.id));
  document.spaces = document.spaces.filter((item) => keep("space", item.id));
  document.tags = document.tags.filter((item) => keep("tag", item.id));
  document.repeatingTemplates = document.repeatingTemplates.filter((item) => keep("repeatingTemplate", item.id));
  document.calendarEvents = document.calendarEvents.filter((item) => keep("calendarEvent", item.id));
}

export function mergeMigratedLegacySnapshot(
  current: WorkspaceSyncSnapshot | null,
  migrated: WorkspaceSyncSnapshot,
  source: LegacyMigrationIdentity,
): WorkspaceSyncSnapshot {
  if (
    current?.document.sync.legacyMigration?.updatedAt === source.updatedAt
    && current.document.sync.legacyMigration.mutationId === source.mutationId
  ) return current;

  const currentDocument = current?.document;
  const document = structuredClone(migrated.document);
  if (currentDocument) {
    document.settings = mergeSettings(document.settings, currentDocument.settings);
    document.spaces = mergeByKey(document.spaces, currentDocument.spaces, (item) => item.id);
    document.areas = mergeByKey(document.areas, currentDocument.areas, (item) => item.id);
    document.projects = mergeByKey(document.projects, currentDocument.projects, (item) => item.id);
    document.headings = mergeByKey(document.headings, currentDocument.headings, (item) => item.id);
    document.tags = mergeByKey(document.tags, currentDocument.tags, (item) => item.id);
    document.toDos = mergeByKey(document.toDos, currentDocument.toDos, (item) => item.id);
    document.repeatingTemplates = mergeByKey(document.repeatingTemplates, currentDocument.repeatingTemplates, (item) => item.id);
    document.projectClosures = mergeByKey(document.projectClosures, currentDocument.projectClosures, (item) => item.projectId);
    document.calendarEvents = mergeByKey(document.calendarEvents, currentDocument.calendarEvents, (item) => item.id);
    document.permanentDeletions = mergeByKey(
      document.permanentDeletions,
      currentDocument.permanentDeletions,
      (item) => `${item.entityKind}:${item.entityId}`,
    );
    document.captureReceipts = mergeByKey(document.captureReceipts, currentDocument.captureReceipts, (item) => item.submissionId);
    document.sync = { ...currentDocument.sync };
  }
  document.sync.legacyMigration = { ...source };
  removeDurablyDeletedEntities(document);
  if (!document.spaces.some((space) => space.id === document.settings.defaultSpaceId)) {
    document.settings.defaultSpaceId = document.spaces[0]?.id ?? null;
  }
  document.settings.launchRules = document.settings.launchRules.filter((rule) =>
    document.spaces.some((space) => space.id === rule.spaceId)
  );
  return { revision: current?.revision ?? migrated.revision, document };
}
