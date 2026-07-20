import assert from "node:assert/strict";
import test from "node:test";

import { changesForIntent, toDoActionForShortcut, touchActionForDistance, updateSelection } from "../../client/workspace/interactions.ts";
import { createEmptyWorkspace, createWorkspace } from "../../shared/replacement/workspace.ts";

test("row, inspector, keyboard, menu, bulk, drag, and touch completion use the same Workspace operation", () => {
  const sources = ["row", "inspector", "keyboard", "menu", "bulk", "drag", "touch"] as const;

  for (const source of sources) {
    assert.deepEqual(changesForIntent({ source, ids: ["todo-1"], action: { type: "complete" } }), [
      { type: "completeToDo", id: "todo-1" },
    ]);
  }
});

test("interaction actions map to typed Workspace changes for every selected to-do", () => {
  assert.deepEqual(changesForIntent({ source: "bulk", ids: ["a", "b", "a"], action: { type: "schedule", schedule: { kind: "someday" } } }), [
    { type: "updateToDo", id: "a", changes: { schedule: { kind: "someday" } } },
    { type: "updateToDo", id: "b", changes: { schedule: { kind: "someday" } } },
  ]);
  assert.deepEqual(changesForIntent({ source: "drag", ids: ["a", "b"], action: { type: "move", location: { kind: "project", projectId: "project-1" } } }), [
    { type: "updateToDo", id: "a", changes: { location: { kind: "project", projectId: "project-1" } } },
    { type: "updateToDo", id: "b", changes: { location: { kind: "project", projectId: "project-1" } } },
  ]);
  assert.deepEqual(changesForIntent({ source: "menu", ids: ["a"], action: { type: "tag", titles: ["Home"] } }), [
    { type: "setToDoTags", id: "a", titles: ["Home"] },
  ]);
});

test("selection supports one item, toggles, ranges, and all visible items", () => {
  const visible = ["a", "b", "c", "d"];
  const single = updateSelection({ ids: [], anchorId: null }, visible, "b", "single");
  assert.deepEqual(single, { ids: ["b"], anchorId: "b" });
  assert.deepEqual(updateSelection(single, visible, "d", "range"), { ids: ["b", "c", "d"], anchorId: "b" });
  assert.deepEqual(updateSelection(single, visible, "c", "toggle"), { ids: ["b", "c"], anchorId: "c" });
  assert.deepEqual(updateSelection(single, visible, null, "all"), { ids: visible, anchorId: "b" });
});

test("keyboard-only commands reach the same typed actions as visible controls", () => {
  const today = "2026-07-19";
  assert.deepEqual(toDoActionForShortcut({ key: "Enter", command: true, alt: false, shift: false, today }), { type: "complete" });
  assert.deepEqual(toDoActionForShortcut({ key: "Backspace", command: false, alt: true, shift: false, today }), { type: "cancel" });
  assert.deepEqual(toDoActionForShortcut({ key: "t", command: true, alt: false, shift: false, today }), { type: "schedule", schedule: { kind: "scheduled", date: today, evening: false } });
  assert.deepEqual(toDoActionForShortcut({ key: "t", command: true, alt: true, shift: false, today }), { type: "schedule", schedule: { kind: "scheduled", date: today, evening: true } });
  assert.deepEqual(toDoActionForShortcut({ key: "d", command: true, alt: false, shift: false, today }), { type: "duplicate" });
});

test("touch swipes select or open a safe menu without destructive actions", () => {
  assert.equal(touchActionForDistance(40), null);
  assert.equal(touchActionForDistance(90), "select");
  assert.equal(touchActionForDistance(-90), "menu");
});

test("bulk changes are applied atomically through the Workspace seam", () => {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-1", title: "Personal", color: "#5577dd", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-1";
  document.toDos.push(
    { id: "a", title: "A", notes: "", checklist: [], location: { kind: "unfiled", spaceId: "space-1" }, schedule: { kind: "inbox" }, reminder: null, deadline: null, outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 0 },
    { id: "b", title: "B", notes: "", checklist: [], location: { kind: "unfiled", spaceId: "space-1" }, schedule: { kind: "inbox" }, reminder: null, deadline: null, outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 1 },
  );
  const workspace = createWorkspace(document, { now: () => "2026-07-19T09:00:00.000Z", createId: (kind) => `${kind}-fixed` });

  const result = workspace.changeMany(changesForIntent({ source: "bulk", ids: ["a", "b"], action: { type: "schedule", schedule: { kind: "someday" } } }));

  assert.equal(result.status, "changed");
  assert.deepEqual(workspace.read().toDos.map((toDo) => toDo.schedule), [{ kind: "someday" }, { kind: "someday" }]);

  const rejected = workspace.changeMany([
    { type: "trashToDo", id: "a" },
    { type: "trashToDo", id: "missing" },
  ]);
  assert.equal(rejected.status, "rejected");
  assert.equal(workspace.read().toDos[0].trashedAt, null);
});

test("appearance changes go through Workspace", () => {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  const workspace = createWorkspace(document, { now: () => "2026-07-19T09:00:00.000Z", createId: (kind) => `${kind}-fixed` });

  const result = workspace.change({ type: "setTheme", theme: "dark" });

  assert.equal(result.status, "changed");
  assert.equal(workspace.read().settings.theme, "dark");
});

test("Workspace reorders visible to-dos and can move dragged items in the same change", () => {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-1", title: "Personal", color: "#5577dd", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-1";
  for (const [order, id] of ["a", "b", "c"].entries()) document.toDos.push({ id, title: id.toUpperCase(), notes: "", checklist: [], location: { kind: "unfiled", spaceId: "space-1" }, schedule: { kind: "inbox" }, reminder: null, deadline: null, outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order });
  const workspace = createWorkspace(document, { now: () => "2026-07-19T09:00:00.000Z", createId: (kind) => `${kind}-fixed` });

  const result = workspace.change({
    type: "reorderToDos",
    movedIds: ["c"],
    orderedIds: ["c", "a", "b"],
    destination: { schedule: { kind: "someday" } },
  });

  assert.equal(result.status, "changed");
  assert.deepEqual(workspace.read().toDos.slice().sort((left, right) => left.order - right.order).map((toDo) => toDo.id), ["c", "a", "b"]);
  assert.deepEqual(workspace.read().toDos.find((toDo) => toDo.id === "c")?.schedule, { kind: "someday" });
});

test("reordering a filtered list preserves hidden to-do positions", () => {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-1", title: "Personal", color: "#5577dd", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-1";
  for (const [order, id] of ["a", "hidden", "c"].entries()) document.toDos.push({ id, title: id, notes: "", checklist: [], location: { kind: "unfiled", spaceId: "space-1" }, schedule: { kind: "inbox" }, reminder: null, deadline: null, outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order });
  const workspace = createWorkspace(document, { now: () => "2026-07-19T09:00:00.000Z", createId: (kind) => `${kind}-fixed` });

  workspace.change({ type: "reorderToDos", movedIds: ["c"], orderedIds: ["c", "a"] });

  assert.deepEqual(workspace.read().toDos.slice().sort((left, right) => left.order - right.order).map((toDo) => toDo.id), ["c", "hidden", "a"]);
});
