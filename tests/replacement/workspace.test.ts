import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyWorkspace, createWorkspace } from "../../shared/replacement/workspace.ts";
import type { RepeatingTemplate } from "../../shared/replacement/model.ts";

test("creating a to-do is deterministic and returns validation and undo details", () => {
  const document = createEmptyWorkspace("2026-07-19T09:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";

  const workspace = createWorkspace(document, {
    now: () => "2026-07-19T09:30:00.000Z",
    createId: (kind) => `${kind}-fixed`,
  });

  const result = workspace.change({ type: "createToDo", title: "  Review the plan  " });

  assert.equal(result.status, "changed");
  assert.deepEqual(result.affected, [{ kind: "toDo", id: "toDo-fixed" }]);
  assert.equal(result.outcome, "to-do-created");
  assert.ok(result.undo);
  assert.deepEqual(workspace.read().toDos[0], {
    id: "toDo-fixed",
    title: "Review the plan",
    notes: "",
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
    createdAt: "2026-07-19T09:30:00.000Z",
    completedAt: null,
    order: 0,
  });

  const undoResult = workspace.undo(result.undo!.token);
  assert.equal(undoResult.status, "changed");
  assert.equal(workspace.read().toDos.length, 0);
});

test("derived Today results and inherited locations come from the Workspace", () => {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push(
    { id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 },
    { id: "space-work", title: "Work", color: "#5b7cfa", pinned: true, order: 1 },
  );
  document.areas.push({ id: "area-work", title: "Work", spaceId: "space-work", color: "#5b7cfa", tags: [], order: 0 });
  document.projects.push({
    id: "project-site", title: "Website", notes: "", location: { kind: "area", areaId: "area-work" },
    schedule: { kind: "anytime" }, deadline: null, outcome: "open", trashedAt: null, logbookAt: null,
    tags: [], occurrence: null, completedAt: null, order: 0,
  });
  document.headings.push({
    id: "heading-polish", title: "Polish", location: { kind: "project", projectId: "project-site" }, archivedAt: null, order: 0,
  });
  document.toDos.push(
    {
      id: "todo-overdue", title: "Overdue", notes: "", checklist: [], location: { kind: "heading", headingId: "heading-polish" },
      schedule: { kind: "scheduled", date: "2026-07-18", evening: false }, reminder: null, deadline: null,
      outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null,
      createdAt: "2026-07-18T08:00:00.000Z", completedAt: null, order: 0,
    },
    {
      id: "todo-future", title: "Future", notes: "", checklist: [], location: { kind: "unfiled", spaceId: "space-personal" },
      schedule: { kind: "scheduled", date: "2026-07-20", evening: false }, reminder: null, deadline: null,
      outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null,
      createdAt: "2026-07-18T08:00:00.000Z", completedAt: null, order: 1,
    },
  );

  const workspace = createWorkspace(document, {
    now: () => "2026-07-19T10:00:00.000Z",
    createId: (kind) => `${kind}-fixed`,
  });

  assert.deepEqual(workspace.view({ kind: "today", date: "2026-07-19" }).map((item) => item.id), ["todo-overdue"]);
  assert.deepEqual(workspace.locationOfToDo("todo-overdue"), {
    headingId: "heading-polish",
    projectId: "project-site",
    areaId: "area-work",
    spaceId: "space-work",
  });
  assert.deepEqual(workspace.validate(), []);
});

test("changes that would create a dangling Location are rejected", () => {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  const workspace = createWorkspace(document, {
    now: () => "2026-07-19T09:00:00.000Z",
    createId: (kind) => `${kind}-fixed`,
  });

  const result = workspace.change({
    type: "createToDo",
    title: "Misfiled",
    location: { kind: "area", areaId: "missing-area" },
  });

  assert.equal(result.status, "rejected");
  assert.deepEqual(workspace.read().toDos, []);
});

test("validation rejects an impossible Repeating Template Location from synced data", () => {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.repeatingTemplates.push({
    id: "template-1", itemKind: "project", title: "Broken", notes: "",
    location: { kind: "heading", headingId: "missing-heading" }, tags: [], checklist: [],
    pattern: { frequency: "weekly", interval: 1, weekdays: [1] }, mode: "on-schedule", state: "active",
    nextDate: "2026-07-20", reminderTime: null, deadlineOffsetDays: null,
    projectContents: { headings: [], toDos: [] }, createdAt: "2026-07-19T08:00:00.000Z",
  } as unknown as RepeatingTemplate);
  const workspace = createWorkspace(document, {
    now: () => "2026-07-19T09:00:00.000Z",
    createId: (kind) => `${kind}-fixed`,
  });

  assert.ok(workspace.validate().some((error) => error.includes("valid Location")));
});
