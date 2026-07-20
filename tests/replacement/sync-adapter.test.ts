import assert from "node:assert/strict";
import test from "node:test";

import {
  createLakebedWorkspaceAdapter,
  migrationCommandForQuery,
  parseLakebedWorkspaceQuery,
  scopeWorkspaceAdapter,
} from "../../client/replacement/lakebed-adapter-core.ts";
import { createEmptyWorkspace } from "../../shared/replacement/workspace.ts";
import {
  createInMemorySyncStore,
  createWorkspaceDelta,
  type WorkspaceSyncAdapter,
  type WorkspaceSyncSnapshot,
} from "../../shared/replacement/sync.ts";

function changedDocument(snapshot: WorkspaceSyncSnapshot, change: (document: WorkspaceSyncSnapshot["document"]) => void) {
  const document = structuredClone(snapshot.document);
  change(document);
  return document;
}

async function saveChanged(
  adapter: WorkspaceSyncAdapter,
  base: WorkspaceSyncSnapshot,
  mutationId: string,
  change: (document: WorkspaceSyncSnapshot["document"]) => void,
) {
  const document = changedDocument(base, change);
  return adapter.save({
    expectedRevision: base.revision,
    mutationId,
    changes: createWorkspaceDelta(base.document, document),
    document,
  });
}

async function runAdapterContract(adapter: WorkspaceSyncAdapter) {
  assert.equal(await adapter.load(), null);

  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";

  const first = await adapter.save({ expectedRevision: 0, mutationId: "mutation-1", document });
  assert.equal(first.status, "acknowledged");
  if (first.status !== "acknowledged") return;
  assert.equal(first.mutationId, "mutation-1");
  assert.equal(first.revision, 1);
  assert.deepEqual(first.conflicts, []);
  assert.equal((await adapter.load())?.document.spaces[0].title, "Personal");

  const replay = await adapter.save({ expectedRevision: 0, mutationId: "mutation-1", document });
  assert.deepEqual(replay, first);

  const staleDocument = structuredClone(document);
  staleDocument.spaces[0].title = "Stale title";
  const stale = await adapter.save({ expectedRevision: 0, mutationId: "mutation-2", document: staleDocument });
  assert.equal(stale.status, "conflict");
  if (stale.status === "conflict") assert.equal(stale.snapshot.document.spaces[0].title, "Personal");

  const malformed = structuredClone(document);
  malformed.format = "broken" as "objects-workspace";
  const rejected = await adapter.save({ expectedRevision: 1, mutationId: "mutation-3", document: malformed });
  assert.equal(rejected.status, "rejected");
}

test("the in-memory adapter follows the shared sync contract", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  await runAdapterContract(store.forOwner("alice"));
});

test("the serialized Lakebed adapter follows the shared sync contract", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const durable = store.forOwner("alice");
  let serializedSnapshot: string | null = null;
  const listeners = new Set<() => void>();
  const adapter = createLakebedWorkspaceAdapter({
    readSnapshot: () => serializedSnapshot,
    async saveCommand(serialized) {
      const result = await durable.save(JSON.parse(serialized));
      const saved = await durable.load();
      serializedSnapshot = saved ? JSON.stringify(saved) : null;
      for (const listener of listeners) listener();
      return JSON.stringify(result);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  await runAdapterContract(adapter);
});

test("the Lakebed query stays loading while its serialized result is empty", () => {
  const loaded = { ownerIdentity: "guest:alice", snapshot: null };
  assert.equal(parseLakebedWorkspaceQuery(undefined), undefined);
  assert.equal(parseLakebedWorkspaceQuery(null), undefined);
  assert.equal(parseLakebedWorkspaceQuery(""), undefined);
  assert.equal(parseLakebedWorkspaceQuery([]), undefined);
  assert.deepEqual(parseLakebedWorkspaceQuery(loaded), loaded);
  assert.deepEqual(
    parseLakebedWorkspaceQuery('{"ownerIdentity":"guest:alice","snapshot":null}'),
    { ownerIdentity: "guest:alice", snapshot: null },
  );
});

test("a prepared legacy merge becomes one normal sync command", () => {
  const document = createEmptyWorkspace("2026-07-20T09:00:00.000Z");
  document.sync.legacyMigration = { updatedAt: "2026-07-19T11:55:16.000Z", mutationId: "legacy-final-save" };
  const command = migrationCommandForQuery({
    ownerIdentity: "google:owner",
    snapshot: { revision: 8, document },
    migrationRequired: true,
  });

  assert.equal(command?.expectedRevision, 8);
  assert.equal(command?.mutationId, "legacy-migration-2026-07-19T11:55:16.000Z-legacy-final-save");
  assert.equal(command?.document, document);
  assert.equal(migrationCommandForQuery({ ownerIdentity: "google:owner", snapshot: { revision: 8, document } }), null);
});

test("the Lakebed adapter cannot cross an unconfirmed account boundary", async () => {
  let loads = 0;
  let saves = 0;
  let subscriptions = 0;
  let remoteNotification = () => undefined;
  const underlying: WorkspaceSyncAdapter = {
    async load() { loads += 1; return null; },
    async save() { saves += 1; return { status: "rejected", errors: [] }; },
    subscribe(listener) { subscriptions += 1; remoteNotification = listener; return () => undefined; },
  };
  let confirmedOwner = "account-a";
  const blocked = scopeWorkspaceAdapter(underlying, "account-a", () => confirmedOwner);
  assert.equal(await blocked.load(), null);
  assert.equal(loads, 1);
  let notifications = 0;
  blocked.subscribe?.(() => { notifications += 1; });
  remoteNotification();
  assert.equal(notifications, 1);
  confirmedOwner = "account-b";
  remoteNotification();
  assert.equal(notifications, 1);
  await assert.rejects(blocked.load(), /Session unavailable/);
  await assert.rejects(blocked.save({ expectedRevision: 0, mutationId: "blocked", document: createEmptyWorkspace("2026-07-19T08:00:00.000Z") }), /Session unavailable/);
  assert.deepEqual({ loads, saves, subscriptions }, { loads: 1, saves: 0, subscriptions: 1 });
});

test("adapter scopes isolate accounts and preserve permanent-deletion markers", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const alice = store.forOwner("alice");
  const bob = store.forOwner("bob");
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";

  await alice.save({ expectedRevision: 0, mutationId: "alice-1", document });
  assert.equal(await bob.load(), null);

  const deleted = structuredClone((await alice.load())!.document);
  deleted.spaces = [];
  deleted.settings.defaultSpaceId = null;
  deleted.permanentDeletions.push({ entityKind: "space", entityId: "space-personal", deletedAt: "2026-07-19T09:00:00.000Z" });
  await alice.save({ expectedRevision: 1, mutationId: "alice-2", document: deleted });

  const recreated = structuredClone(deleted);
  recreated.spaces.push({ id: "space-personal", title: "Recreated", color: "#000000", pinned: true, order: 0 });
  const result = await alice.save({ expectedRevision: 2, mutationId: "alice-3", document: recreated });
  assert.equal(result.status, "rejected");
  assert.equal((await alice.load())!.document.spaces.length, 0);
});

test("multi-device saves merge unrelated fields and report same-field conflicts", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const firstDevice = store.forOwner("alice");
  const secondDevice = store.forOwner("alice");
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  document.toDos.push({
    id: "todo-1",
    title: "Original title",
    notes: "Original notes",
    checklist: [],
    location: { kind: "unfiled", spaceId: "space-personal" },
    schedule: { kind: "inbox" },
    reminder: null,
    deadline: null,
    outcome: "open",
    trashedAt: null,
    logbookAt: null,
    tags: [],
    occurrence: null,
    createdAt: "2026-07-19T08:00:00.000Z",
    completedAt: null,
    order: 0,
  });
  await firstDevice.save({ expectedRevision: 0, mutationId: "seed", document });
  const commonBase = (await firstDevice.load())!;

  await saveChanged(firstDevice, commonBase, "title-from-first", (next) => {
    next.toDos[0].title = "First device title";
  });
  const unrelated = await saveChanged(secondDevice, commonBase, "notes-from-second", (next) => {
    next.toDos[0].notes = "Second device notes";
  });
  assert.equal(unrelated.status, "acknowledged");
  if (unrelated.status !== "acknowledged") return;
  assert.equal(unrelated.snapshot.document.toDos[0].title, "First device title");
  assert.equal(unrelated.snapshot.document.toDos[0].notes, "Second device notes");
  assert.deepEqual(unrelated.conflicts, []);

  const sameFieldBase = unrelated.snapshot;
  await saveChanged(firstDevice, sameFieldBase, "title-a", (next) => {
    next.toDos[0].title = "First choice";
  });
  const sameField = await saveChanged(secondDevice, sameFieldBase, "title-b", (next) => {
    next.toDos[0].title = "Second choice";
  });
  assert.equal(sameField.status, "acknowledged");
  if (sameField.status !== "acknowledged") return;
  assert.equal(sameField.snapshot.document.toDos[0].title, "Second choice");
  assert.deepEqual(sameField.conflicts, [{ path: "toDos/todo-1/title", resolution: "local-change-kept" }]);
});

test("an acknowledged mutation remains safe to retry after later saves", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const adapter = store.forOwner("alice");
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  const firstCommand = { expectedRevision: 0, mutationId: "first", document };
  await adapter.save(firstCommand);
  const firstSnapshot = (await adapter.load())!;
  await saveChanged(adapter, firstSnapshot, "second", (next) => { next.settings.theme = "dark"; });

  const retried = await adapter.save(firstCommand);
  assert.equal(retried.status, "acknowledged");
  if (retried.status !== "acknowledged") return;
  assert.equal(retried.revision, 2);
  assert.equal(retried.snapshot.document.settings.theme, "dark");
  assert.equal((await adapter.load())!.revision, 2);
});

test("a stale device cannot recreate permanently deleted work", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const deletingDevice = store.forOwner("alice");
  const staleDevice = store.forOwner("alice");
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  document.toDos.push({
    id: "todo-deleted", title: "Delete me", notes: "", checklist: [], location: { kind: "unfiled", spaceId: "space-personal" },
    schedule: { kind: "inbox" }, reminder: null, deadline: null, outcome: "open", trashedAt: null, logbookAt: null,
    tags: [], occurrence: null, createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 0,
  });
  await deletingDevice.save({ expectedRevision: 0, mutationId: "seed", document });
  const commonBase = (await deletingDevice.load())!;
  await saveChanged(deletingDevice, commonBase, "delete", (next) => {
    next.toDos = [];
    next.permanentDeletions.push({ entityKind: "toDo", entityId: "todo-deleted", deletedAt: "2026-07-19T09:00:00.000Z" });
  });
  const staleEdit = await saveChanged(staleDevice, commonBase, "stale-edit", (next) => {
    next.toDos[0].title = "Bring me back";
  });

  assert.equal(staleEdit.status, "acknowledged");
  if (staleEdit.status !== "acknowledged") return;
  assert.equal(staleEdit.snapshot.document.toDos.length, 0);
  assert.deepEqual(staleEdit.conflicts, [{ path: "toDos/todo-deleted/title", resolution: "permanent-deletion-kept" }]);
});

test("several devices materialize one Occurrence for the same Template date", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const firstDevice = store.forOwner("alice");
  const secondDevice = store.forOwner("alice");
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  document.repeatingTemplates.push({
    id: "template-1", title: "Review", notes: "", tags: [], checklist: [], pattern: { frequency: "daily", interval: 1, weekdays: [] },
    mode: "on-schedule", state: "active", firstDate: "2026-07-19", nextDate: "2026-07-19", reminderTime: null,
    deadlineOffsetDays: null, createdAt: "2026-07-19T08:00:00.000Z", itemKind: "toDo",
    location: { kind: "unfiled", spaceId: "space-personal" }, projectContents: null,
  });
  await firstDevice.save({ expectedRevision: 0, mutationId: "seed", document });
  const commonBase = (await firstDevice.load())!;
  const occurrence = (id: string) => ({
    id, title: "Review", notes: "", checklist: [], location: { kind: "unfiled" as const, spaceId: "space-personal" },
    schedule: { kind: "scheduled" as const, date: "2026-07-19", evening: false }, reminder: null, deadline: null,
    outcome: "open" as const, trashedAt: null, logbookAt: null, tags: [], occurrence: { templateId: "template-1", scheduledDate: "2026-07-19" },
    createdAt: "2026-07-19T09:00:00.000Z", completedAt: null, order: 0,
  });
  await saveChanged(firstDevice, commonBase, "materialize-a", (next) => {
    next.toDos.push(occurrence("occurrence-a"));
    next.repeatingTemplates[0].nextDate = "2026-07-20";
  });
  const second = await saveChanged(secondDevice, commonBase, "materialize-b", (next) => {
    next.toDos.push(occurrence("occurrence-b"));
    next.repeatingTemplates[0].nextDate = "2026-07-20";
  });

  assert.equal(second.status, "acknowledged");
  if (second.status !== "acknowledged") return;
  assert.deepEqual(second.snapshot.document.toDos.map((item) => item.id), ["occurrence-a"]);
  assert.ok(second.conflicts.some((conflict) => conflict.path === "toDos/occurrence-b/occurrence"));
});

test("a malformed delta is rejected without applying its earlier operations", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const adapter = store.forOwner("alice");
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  await adapter.save({ expectedRevision: 0, mutationId: "seed", document });
  const before = (await adapter.load())!;
  const changed = structuredClone(before.document);
  changed.settings.theme = "dark";
  const changes = createWorkspaceDelta(before.document, changed);
  changes.operations.push({ path: [], before: { present: false }, after: { present: false } });
  const result = await adapter.save({ expectedRevision: before.revision, mutationId: "malformed", document: changed, changes });

  assert.equal(result.status, "rejected");
  assert.equal((await adapter.load())!.document.settings.theme, "system");
  assert.equal((await adapter.load())!.revision, 1);
});

test("moves, completion, Trash, checklists, Project Closure, settings, and Template state merge as one valid Workspace", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const firstDevice = store.forOwner("alice");
  const secondDevice = store.forOwner("alice");
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  document.projects.push({
    id: "project-1", title: "Project", notes: "", location: { kind: "space", spaceId: "space-personal" }, schedule: { kind: "anytime" },
    deadline: null, outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, completedAt: null, order: 0,
  });
  document.toDos.push({
    id: "todo-1", title: "Work", notes: "", checklist: [
      { id: "check-1", title: "First", completed: false, order: 0 },
      { id: "check-2", title: "Second", completed: false, order: 1 },
    ], location: { kind: "unfiled", spaceId: "space-personal" }, schedule: { kind: "inbox" }, reminder: null, deadline: null,
    outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 0,
  });
  document.repeatingTemplates.push({
    id: "template-1", title: "Repeat", notes: "", tags: [], checklist: [], pattern: { frequency: "daily", interval: 1, weekdays: [] },
    mode: "on-schedule", state: "active", firstDate: "2026-07-20", nextDate: "2026-07-20", reminderTime: null,
    deadlineOffsetDays: null, createdAt: "2026-07-19T08:00:00.000Z", itemKind: "toDo",
    location: { kind: "unfiled", spaceId: "space-personal" }, projectContents: null,
  });
  await firstDevice.save({ expectedRevision: 0, mutationId: "seed", document });
  const commonBase = (await firstDevice.load())!;

  await saveChanged(firstDevice, commonBase, "structural-change", (next) => {
    next.toDos[0].location = { kind: "project", projectId: "project-1" };
    next.toDos[0].checklist[0].completed = true;
    next.toDos[0].trashedAt = "2026-07-19T09:00:00.000Z";
    next.projects[0].outcome = "completed";
    next.projects[0].completedAt = "2026-07-19T09:00:00.000Z";
    next.projectClosures.push({ id: "closure-1", projectId: "project-1", projectOutcome: "completed", changedToDoIds: [], closedAt: "2026-07-19T09:00:00.000Z" });
  });
  const merged = await saveChanged(secondDevice, commonBase, "independent-change", (next) => {
    next.toDos[0].outcome = "completed";
    next.toDos[0].completedAt = "2026-07-19T09:01:00.000Z";
    next.toDos[0].checklist[1].title = "Second edited elsewhere";
    next.projects[0].notes = "Notes from the second device";
    next.settings.theme = "dark";
    next.repeatingTemplates[0].state = "paused";
  });

  assert.equal(merged.status, "acknowledged");
  if (merged.status !== "acknowledged") return;
  const saved = merged.snapshot.document;
  assert.deepEqual(saved.toDos[0].location, { kind: "project", projectId: "project-1" });
  assert.equal(saved.toDos[0].trashedAt, "2026-07-19T09:00:00.000Z");
  assert.equal(saved.toDos[0].outcome, "completed");
  assert.equal(saved.toDos[0].checklist[0].completed, true);
  assert.equal(saved.toDos[0].checklist[1].title, "Second edited elsewhere");
  assert.equal(saved.projects[0].outcome, "completed");
  assert.equal(saved.projects[0].notes, "Notes from the second device");
  assert.equal(saved.projectClosures.length, 1);
  assert.equal(saved.settings.theme, "dark");
  assert.equal(saved.repeatingTemplates[0].state, "paused");
});

test("concurrent parent moves and checklist removal keep a complete valid result", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const firstDevice = store.forOwner("alice");
  const secondDevice = store.forOwner("alice");
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  for (const id of ["project-a", "project-b"]) {
    document.projects.push({
      id, title: id, notes: "", location: { kind: "space", spaceId: "space-personal" }, schedule: { kind: "anytime" },
      deadline: null, outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, completedAt: null, order: document.projects.length,
    });
  }
  document.toDos.push({
    id: "todo-1", title: "Move and edit", notes: "", checklist: [
      { id: "check-1", title: "Remove this", completed: false, order: 0 },
      { id: "check-2", title: "Keep this", completed: false, order: 1 },
    ], location: { kind: "unfiled", spaceId: "space-personal" }, schedule: { kind: "inbox" }, reminder: null, deadline: null,
    outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 0,
  });
  await firstDevice.save({ expectedRevision: 0, mutationId: "seed", document });
  const commonBase = (await firstDevice.load())!;

  await saveChanged(firstDevice, commonBase, "first-structure", (next) => {
    next.toDos[0].location = { kind: "project", projectId: "project-a" };
    next.toDos[0].checklist = [{ ...next.toDos[0].checklist[1], order: 0 }];
  });
  const merged = await saveChanged(secondDevice, commonBase, "second-structure", (next) => {
    next.toDos[0].location = { kind: "project", projectId: "project-b" };
    next.toDos[0].checklist[0].title = "A stale edit must not recreate this item";
    next.toDos[0].checklist[1].completed = true;
  });

  assert.equal(merged.status, "acknowledged");
  if (merged.status !== "acknowledged") return;
  assert.deepEqual(merged.snapshot.document.toDos[0].location, { kind: "project", projectId: "project-b" });
  assert.deepEqual(merged.snapshot.document.toDos[0].checklist, [{ id: "check-2", title: "Keep this", completed: true, order: 0 }]);
  assert.ok(merged.conflicts.some((conflict) => conflict.path === "toDos/todo-1/checklist/check-1/title" && conflict.resolution === "remote-removal-kept"));
  assert.deepEqual(createEmptyWorkspace("2026-07-19T09:00:00.000Z").format, merged.snapshot.document.format);
});

test("a concurrent checklist reorder keeps one device's complete intended order", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const firstDevice = store.forOwner("alice");
  const secondDevice = store.forOwner("alice");
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  document.toDos.push({
    id: "todo-1", title: "Reorder", notes: "", checklist: [
      { id: "check-a", title: "A", completed: false, order: 0 },
      { id: "check-b", title: "B", completed: false, order: 1 },
      { id: "check-z", title: "Z", completed: false, order: 2 },
    ], location: { kind: "unfiled", spaceId: "space-personal" }, schedule: { kind: "inbox" }, reminder: null, deadline: null,
    outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 0,
  });
  await firstDevice.save({ expectedRevision: 0, mutationId: "seed", document });
  const commonBase = (await firstDevice.load())!;
  const reorder = (next: WorkspaceSyncSnapshot["document"], ids: string[]) => {
    for (const item of next.toDos[0].checklist) item.order = ids.indexOf(item.id);
  };

  await saveChanged(firstDevice, commonBase, "order-first", (next) => reorder(next, ["check-b", "check-z", "check-a"]));
  const merged = await saveChanged(secondDevice, commonBase, "order-second", (next) => reorder(next, ["check-z", "check-a", "check-b"]));

  assert.equal(merged.status, "acknowledged");
  if (merged.status !== "acknowledged") return;
  assert.deepEqual(merged.snapshot.document.toDos[0].checklist.map((item) => [item.id, item.order]), [
    ["check-z", 0],
    ["check-a", 1],
    ["check-b", 2],
  ]);
  assert.ok(merged.conflicts.some((conflict) => conflict.path === "toDos/todo-1/checklist/order" && conflict.resolution === "local-change-kept"));
});

test("concurrent capture and calendar retries keep one durable result", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const firstDevice = store.forOwner("alice");
  const secondDevice = store.forOwner("alice");
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  await firstDevice.save({ expectedRevision: 0, mutationId: "seed", document });
  const commonBase = (await firstDevice.load())!;
  const addCapturedWork = (next: WorkspaceSyncSnapshot["document"], suffix: string) => {
    next.toDos.push({
      id: `todo-${suffix}`, title: "Captured", notes: "", checklist: [], location: { kind: "unfiled", spaceId: "space-personal" },
      schedule: { kind: "inbox" }, reminder: null, deadline: null, outcome: "open", trashedAt: null, logbookAt: null,
      tags: [], occurrence: null, createdAt: "2026-07-19T09:00:00.000Z", completedAt: null, order: 0,
    });
    next.captureReceipts.push({ submissionId: "capture-1", toDoId: `todo-${suffix}`, createdAt: "2026-07-19T09:00:00.000Z" });
    next.calendarEvents.push({
      id: `event-${suffix}`, spaceId: "space-personal", title: "Imported", start: "2026-07-20T10:00:00.000Z",
      end: "2026-07-20T11:00:00.000Z", calendar: "Work", allDay: false, sourceUid: "calendar-uid-1",
    });
  };
  await saveChanged(firstDevice, commonBase, "capture-a", (next) => addCapturedWork(next, "a"));
  const merged = await saveChanged(secondDevice, commonBase, "capture-b", (next) => addCapturedWork(next, "b"));

  assert.equal(merged.status, "acknowledged");
  if (merged.status !== "acknowledged") return;
  assert.deepEqual(merged.snapshot.document.toDos.map((item) => item.id), ["todo-a"]);
  assert.deepEqual(merged.snapshot.document.captureReceipts.map((item) => item.toDoId), ["todo-a"]);
  assert.deepEqual(merged.snapshot.document.calendarEvents.map((item) => item.id), ["event-a"]);
});
