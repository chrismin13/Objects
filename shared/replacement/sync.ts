import type { IsoDateTime, PermanentDeletion, WorkspaceDocument } from "./model.ts";

export type WorkspaceSyncSnapshot = {
  revision: number;
  document: WorkspaceDocument;
};

export type WorkspaceSyncCommand = {
  expectedRevision: number;
  mutationId: string;
  document: WorkspaceDocument;
};

export type WorkspaceSyncResult =
  | { status: "acknowledged"; mutationId: string; revision: number }
  | { status: "conflict"; snapshot: WorkspaceSyncSnapshot }
  | { status: "rejected"; errors: string[] };

export type WorkspaceSyncAdapter = {
  load(): Promise<WorkspaceSyncSnapshot | null>;
  save(command: WorkspaceSyncCommand): Promise<WorkspaceSyncResult>;
};

export type InMemorySyncStore = {
  forOwner(ownerId: string): WorkspaceSyncAdapter;
};

export type ResolvedSyncCommand = {
  result: WorkspaceSyncResult;
  next: WorkspaceSyncSnapshot | null;
};

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function validateSyncDocument(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["Workspace data must be one object."];
  const document = value as Partial<WorkspaceDocument>;
  const errors: string[] = [];
  if (document.format !== "objects-workspace" || document.version !== 1) errors.push("Workspace format or version is not supported.");
  const collections: Array<keyof WorkspaceDocument> = [
    "spaces", "areas", "projects", "headings", "tags", "toDos", "repeatingTemplates",
    "projectClosures", "calendarEvents", "permanentDeletions",
  ];
  for (const name of collections) if (!Array.isArray(document[name])) errors.push(`Workspace ${name} must be a list.`);
  if (!document.settings || typeof document.settings !== "object") errors.push("Workspace settings are missing.");
  if (!document.sync || typeof document.sync !== "object") errors.push("Workspace sync metadata is missing.");
  return errors;
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

export function resolveSyncCommand(
  current: WorkspaceSyncSnapshot | null,
  command: WorkspaceSyncCommand,
  updatedAt: IsoDateTime,
): ResolvedSyncCommand {
  if (!command.mutationId || command.mutationId.length > 200) {
    return { result: { status: "rejected", errors: ["A valid mutation identity is required."] }, next: null };
  }
  const errors = validateSyncDocument(command.document);
  if (errors.length) return { result: { status: "rejected", errors }, next: null };

  if (current?.document.sync.lastMutationId === command.mutationId) {
    return {
      result: { status: "acknowledged", mutationId: command.mutationId, revision: current.revision },
      next: null,
    };
  }
  const currentRevision = current?.revision ?? 0;
  if (command.expectedRevision !== currentRevision) {
    return current
      ? { result: { status: "conflict", snapshot: copy(current) }, next: null }
      : { result: { status: "conflict", snapshot: { revision: 0, document: copy(command.document) } }, next: null };
  }

  const nextDocument = copy(command.document);
  nextDocument.permanentDeletions = mergeDeletionMarkers(current?.document ?? null, nextDocument);
  const recreated = nextDocument.permanentDeletions.filter((marker) => entityExists(nextDocument, marker));
  if (recreated.length) {
    return {
      result: {
        status: "rejected",
        errors: recreated.map((marker) => `${marker.entityKind} “${marker.entityId}” was permanently deleted and cannot be recreated.`),
      },
      next: null,
    };
  }

  const revision = currentRevision + 1;
  nextDocument.sync = { revision, lastMutationId: command.mutationId, updatedAt };
  return {
    result: { status: "acknowledged", mutationId: command.mutationId, revision },
    next: { revision, document: nextDocument },
  };
}

export function createInMemorySyncStore(now: () => IsoDateTime): InMemorySyncStore {
  const snapshots = new Map<string, WorkspaceSyncSnapshot>();

  return {
    forOwner(ownerId) {
      return {
        async load() {
          const snapshot = snapshots.get(ownerId);
          return snapshot ? copy(snapshot) : null;
        },

        async save(command) {
          const resolved = resolveSyncCommand(snapshots.get(ownerId) ?? null, command, now());
          if (resolved.next) snapshots.set(ownerId, resolved.next);
          return resolved.result;
        },
      };
    },
  };
}
