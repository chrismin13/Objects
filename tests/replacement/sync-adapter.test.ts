import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyWorkspace } from "../../shared/replacement/workspace.ts";
import { createInMemorySyncStore, type WorkspaceSyncAdapter } from "../../shared/replacement/sync.ts";

async function runAdapterContract(adapter: WorkspaceSyncAdapter) {
  assert.equal(await adapter.load(), null);

  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";

  const first = await adapter.save({ expectedRevision: 0, mutationId: "mutation-1", document });
  assert.deepEqual(first, { status: "acknowledged", mutationId: "mutation-1", revision: 1 });
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
