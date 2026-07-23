import assert from "node:assert/strict";
import test from "node:test";

import { applyInterfaceChangeSetToWorkspace, workspaceDocumentToInterfaceState } from "../../shared/replacement/interface-bridge.ts";
import { createEmptyWorkspace } from "../../shared/replacement/workspace.ts";
import { createWorkspaceSyncClient, type WorkspaceSyncPersistence } from "../../shared/replacement/sync-client.ts";
import { createInMemorySyncStore, type WorkspaceSyncAdapter } from "../../shared/replacement/sync.ts";

function initialWorkspace() {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  return document;
}

function memoryPersistence(): WorkspaceSyncPersistence & { serialized: string | null } {
  return {
    serialized: null,
    load() { return this.serialized; },
    save(serialized) { this.serialized = serialized; },
  };
}

test("restoring a backup replaces active work durably after the app is reopened", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const durable = store.forOwner("alice");
  const firstSession = createWorkspaceSyncClient(durable, memoryPersistence(), () => "2026-07-19T09:00:00.000Z");
  const current = initialWorkspace();
  current.toDos.push({
    id: "todo-current", title: "Current item", notes: "Must disappear", checklist: [],
    location: { kind: "unfiled", spaceId: "space-personal" }, schedule: { kind: "inbox" }, reminder: null,
    deadline: null, outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null,
    createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 0,
  });
  await firstSession.initialize(() => current);
  firstSession.stage(current, "save-current-workspace");
  await firstSession.flush();

  const restoredState = workspaceDocumentToInterfaceState(firstSession.read().snapshot!.document, "2026-07-19");
  restoredState.settings.defaultSpaceId = "space-restored";
  restoredState.spaces = [{ id: "space-restored", title: "Restored", color: "#123456", pinned: true, order: 0 }];
  restoredState.tasks = [{
    id: "todo-restored", title: "Restored item", notes: "From backup", status: "open", bucket: "inbox",
    scheduledFor: null, evening: false, reminderAt: null, reminderSentAt: null, deadline: null, projectId: null,
    headingId: null, areaId: null, spaceId: "space-restored", tags: [], checklist: [], repeat: null,
    createdAt: "2026-07-18T08:00:00.000Z", completedAt: null, loggedAt: null,
  }];
  const replacement = applyInterfaceChangeSetToWorkspace(firstSession.read().snapshot!.document, {
    mutationId: "restore-backup",
    replaceWorkspace: true,
    settings: restoredState.settings,
    entities: {
      spaces: restoredState.spaces.map(({ id, ...patch }) => ({ id, patch })),
      tasks: restoredState.tasks.map(({ id, ...patch }) => ({ id, patch })),
    },
    deletes: { spaces: ["space-personal"], tasks: ["todo-current"] },
  }, { now: () => "2026-07-19T09:00:00.000Z", createId: (kind) => `restore-${kind}` });
  assert.equal(replacement.ok, true);
  if (!replacement.ok) return;
  firstSession.stage(replacement.document, "restore-backup");
  await firstSession.flush();

  const reopened = createWorkspaceSyncClient(durable, memoryPersistence(), () => "2026-07-19T09:01:00.000Z");
  const loaded = await reopened.initialize(initialWorkspace);
  assert.deepEqual(loaded.snapshot!.document.spaces.map((space) => [space.id, space.title]), [["space-restored", "Restored"]]);
  assert.deepEqual(loaded.snapshot!.document.toDos.map((toDo) => [toDo.id, toDo.title, toDo.notes]), [["todo-restored", "Restored item", "From backup"]]);
  assert.equal(loaded.pendingCount, 0);
  assert.equal(loaded.status, "saved");
});

test("pending changes survive reload and an interrupted acknowledgement", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const durable = store.forOwner("alice");
  let interruptAfterSave = true;
  const uncertainAdapter: WorkspaceSyncAdapter = {
    load: () => durable.load(),
    async save(command) {
      const result = await durable.save(command);
      if (interruptAfterSave) {
        interruptAfterSave = false;
        throw new Error("Network connection was interrupted");
      }
      return result;
    },
  };
  const persistence = memoryPersistence();
  const firstSession = createWorkspaceSyncClient(uncertainAdapter, persistence, () => "2026-07-19T09:00:00.000Z");
  await firstSession.initialize(initialWorkspace);
  const changed = structuredClone(firstSession.read().snapshot!.document);
  changed.settings.theme = "dark";
  firstSession.stage(changed, "theme-dark");
  await firstSession.flush();
  assert.equal(firstSession.read().status, "offline");
  assert.equal(firstSession.read().pendingCount, 1);

  const recoveredSession = createWorkspaceSyncClient(durable, persistence, () => "2026-07-19T09:01:00.000Z");
  const recovered = await recoveredSession.initialize(initialWorkspace);
  assert.equal(recovered.snapshot!.document.settings.theme, "dark");
  await recoveredSession.flush();
  assert.equal(recoveredSession.read().pendingCount, 0);
  assert.equal(recoveredSession.read().status, "recovered");
  assert.equal((await durable.load())!.revision, 1);
});

test("a long offline queue gives immediate feedback and flushes in order", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const durable = store.forOwner("alice");
  let online = false;
  const adapter: WorkspaceSyncAdapter = {
    load: () => online ? durable.load() : Promise.reject(new Error("offline")),
    save: (command) => online ? durable.save(command) : Promise.reject(new Error("offline")),
  };
  const persistence = memoryPersistence();
  const client = createWorkspaceSyncClient(adapter, persistence, () => "2026-07-19T09:00:00.000Z");
  await client.initialize(initialWorkspace);

  for (let index = 0; index < 75; index += 1) {
    const next = structuredClone(client.read().snapshot!.document);
    next.settings.quickDraft = { value: `Draft ${index}` };
    const state = client.stage(next, `draft-${index}`);
    assert.equal(state.snapshot!.document.settings.quickDraft?.value, `Draft ${index}`);
  }
  assert.equal(client.read().pendingCount, 75);
  assert.ok((persistence.serialized?.length ?? 0) < 100_000);

  online = true;
  await client.flush();
  assert.equal(client.read().pendingCount, 0);
  assert.equal(client.read().snapshot!.document.settings.quickDraft?.value, "Draft 74");
  assert.equal((await durable.load())!.document.settings.quickDraft?.value, "Draft 74");
});

test("session expiry is visible without discarding local work", async () => {
  const adapter: WorkspaceSyncAdapter = {
    load: () => Promise.reject(new Error("Authentication required")),
    save: () => Promise.reject(new Error("Authentication required")),
  };
  const persistence = memoryPersistence();
  const client = createWorkspaceSyncClient(adapter, persistence, () => "2026-07-19T09:00:00.000Z");
  await client.initialize(initialWorkspace);
  const changed = structuredClone(client.read().snapshot!.document);
  changed.settings.showCalendar = false;
  client.stage(changed, "calendar-hidden");
  await client.flush();

  assert.equal(client.read().status, "session-expired");
  assert.equal(client.read().pendingCount, 1);
  assert.equal(client.read().snapshot!.document.settings.showCalendar, false);
});

test("an order-only local change enters the durable queue and syncs", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T09:00:00.000Z");
  const durable = store.forOwner("alice");
  const persistence = memoryPersistence();
  const document = initialWorkspace();
  document.toDos.push(
    { id: "todo-a", title: "A", notes: "", checklist: [], location: { kind: "unfiled", spaceId: "space-personal" }, schedule: { kind: "inbox" }, reminder: null, deadline: null, outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 0 },
    { id: "todo-b", title: "B", notes: "", checklist: [], location: { kind: "unfiled", spaceId: "space-personal" }, schedule: { kind: "inbox" }, reminder: null, deadline: null, outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 1 },
  );
  const client = createWorkspaceSyncClient(durable, persistence, () => "2026-07-19T09:00:00.000Z");
  await client.initialize(() => document);
  const reordered = structuredClone(client.read().snapshot!.document);
  reordered.toDos[0].order = 1;
  reordered.toDos[1].order = 0;

  client.stage(reordered, "reorder-only");
  assert.equal(client.read().pendingCount, 1);
  await client.flush();
  assert.deepEqual((await durable.load())!.document.toDos.map((item) => item.id), ["todo-b", "todo-a"]);
});
