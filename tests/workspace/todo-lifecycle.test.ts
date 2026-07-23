import assert from "node:assert/strict";
import test from "node:test";

import type { Project, ToDo } from "../../shared/workspace/model.ts";
import {
  EMPTY_TRASH_CONFIRMATION,
  PERMANENT_DELETE_CONFIRMATION,
  createEmptyWorkspace,
  createWorkspace,
} from "../../shared/workspace/workspace.ts";

const NOW = "2026-07-19T09:30:00.000Z";

function setup() {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  let nextId = 0;
  const workspace = createWorkspace(document, {
    now: () => NOW,
    createId: (kind) => `${kind}-${++nextId}`,
  });
  return workspace;
}

function changedId(result: ReturnType<ReturnType<typeof setup>["change"]>) {
  assert.equal(result.status, "changed");
  return result.affected[0]!.id;
}

function toDo(workspace: ReturnType<typeof setup>, id: string): ToDo {
  const item = workspace.read().toDos.find((candidate) => candidate.id === id);
  assert.ok(item);
  return item;
}

test("quick entry saves a normal to-do and understands dates, times, deadlines, and tags", () => {
  const workspace = setup();
  const result = workspace.change({
    type: "createToDo",
    title: "Call Sam tomorrow at 2pm due Friday #people",
    quickEntry: { referenceDate: "2026-07-19" },
  });
  const id = changedId(result);

  assert.deepEqual(toDo(workspace, id), {
    id,
    title: "Call Sam",
    notes: "",
    checklist: [],
    location: { kind: "unfiled", spaceId: "space-personal" },
    schedule: { kind: "scheduled", date: "2026-07-20", evening: false },
    reminder: { at: "2026-07-20T14:00:00.000Z", sentAt: null },
    deadline: "2026-07-24",
    outcome: "open",
    trashedAt: null,
    logbookAt: null,
    tags: ["tag-1"],
    occurrence: null,
    createdAt: NOW,
    completedAt: null,
    order: 0,
  });
  assert.deepEqual(workspace.read().tags.map((tag) => tag.title), ["people"]);

  const relativeId = changedId(workspace.change({ type: "createToDo", title: "Renew card in 3 weeks", quickEntry: { referenceDate: "2026-07-19" } }));
  assert.deepEqual(toDo(workspace, relativeId).schedule, { kind: "scheduled", date: "2026-08-09", evening: false });
});

test("unfinished quick entry text is saved, restored, and cleared explicitly", () => {
  const workspace = setup();
  assert.equal(workspace.change({ type: "saveQuickDraft", value: "Call the dentist", view: { kind: "today", date: "2026-07-19" } }).status, "changed");
  assert.equal(workspace.read().settings.quickDraft?.value, "Call the dentist");
  assert.equal(workspace.change({ type: "clearQuickDraft" }).status, "changed");
  assert.equal(workspace.read().settings.quickDraft, null);
});

test("a to-do can enter a weekly repeating schedule through Workspace", () => {
  const workspace = setup();
  const id = changedId(workspace.change({ type: "createToDo", title: "Plan the week" }));

  const result = workspace.change({ type: "makeToDoRepeating", id, nextDate: "2026-07-26" });

  assert.equal(result.status, "changed");
  assert.equal(workspace.read().repeatingTemplates[0]?.title, "Plan the week");
  assert.deepEqual(toDo(workspace, id).schedule, { kind: "scheduled", date: "2026-07-26", evening: false });
  assert.equal(toDo(workspace, id).occurrence?.templateId, workspace.read().repeatingTemplates[0]?.id);
});

test("the inspector edit path updates fields and manages independent checklist items", () => {
  const workspace = setup();
  const id = changedId(workspace.change({ type: "createToDo", title: "Plan trip" }));
  assert.equal(workspace.change({
    type: "updateToDo",
    id,
    changes: {
      title: "Plan summer trip",
      notes: "## Places\nSearch the coast",
      schedule: { kind: "scheduled", date: "2026-07-21", evening: true },
      reminder: { at: "2026-07-21T08:00:00.000Z", sentAt: null },
      deadline: "2026-07-25",
    },
  }).status, "changed");
  const first = changedId(workspace.change({ type: "addChecklistItem", toDoId: id, title: "Book train" }));
  const second = changedId(workspace.change({ type: "addChecklistItem", toDoId: id, title: "Reserve room" }));
  workspace.change({ type: "updateChecklistItem", toDoId: id, itemId: first, changes: { completed: true, title: "Book night train" } });
  workspace.change({ type: "removeChecklistItem", toDoId: id, itemId: second });

  const updated = toDo(workspace, id);
  assert.equal(updated.title, "Plan summer trip");
  assert.equal(updated.notes, "## Places\nSearch the coast");
  assert.equal(updated.schedule.kind, "scheduled");
  assert.deepEqual(updated.checklist, [{ id: first, title: "Book night train", completed: true, order: 0 }]);
  workspace.change({ type: "setToDoTags", id, titles: ["travel", "important", "travel"] });
  assert.deepEqual(toDo(workspace, id).tags.map((tagId) => workspace.read().tags.find((tag) => tag.id === tagId)?.title), ["travel", "important"]);
});

test("checklist order changes through the public Workspace seam", () => {
  const workspace = setup();
  const created = workspace.change({
    type: "createToDo",
    title: "Release",
    location: { kind: "unfiled", spaceId: "space-personal" },
    checklist: ["Write notes", "Tag build", "Publish"],
  });
  const toDoId = created.affected.find((item) => item.kind === "toDo")!.id;
  const before = workspace.read().toDos.find((item) => item.id === toDoId)!;
  const orderedIds = [before.checklist[2].id, before.checklist[0].id, before.checklist[1].id];

  const changed = workspace.change({ type: "reorderChecklistItems", toDoId, orderedIds });

  assert.equal(changed.status, "changed");
  assert.deepEqual(workspace.read().toDos.find((item) => item.id === toDoId)?.checklist.map((item) => [item.id, item.order]), [
    [orderedIds[0], 0],
    [orderedIds[1], 1],
    [orderedIds[2], 2],
  ]);
  const rejected = workspace.change({ type: "reorderChecklistItems", toDoId, orderedIds: [orderedIds[0]] });
  assert.equal(rejected.status, "rejected");
  assert.deepEqual(workspace.read().toDos.find((item) => item.id === toDoId)?.checklist.map((item) => item.id), orderedIds);
});

test("moving a scheduled to-do keeps a same-day reminder at the same time", () => {
  const workspace = setup();
  const id = changedId(workspace.change({ type: "createToDo", title: "Prepare", schedule: { kind: "scheduled", date: "2026-07-20", evening: false }, reminderAt: "2026-07-20T16:45:00.000Z" }));
  workspace.change({ type: "updateToDo", id, changes: { schedule: { kind: "scheduled", date: "2026-07-23", evening: false } } });
  assert.equal(toDo(workspace, id).reminder?.at, "2026-07-23T16:45:00.000Z");
  workspace.change({ type: "snoozeReminder", id, until: "2026-07-23T17:15:00.000Z" });
  assert.deepEqual(toDo(workspace, id).reminder, { at: "2026-07-23T17:15:00.000Z", sentAt: null });
});

test("complete, cancel, reopen, undo completion, duplicate, and manual logging have explicit results", () => {
  const workspace = setup();
  workspace.change({ type: "setLogbookPolicy", policy: "manually" });
  const id = changedId(workspace.change({ type: "createToDo", title: "Ship release" }));
  const completed = workspace.change({ type: "completeToDo", id });
  assert.equal(completed.status, "changed");
  assert.equal(completed.outcome, "to-do-completed");
  assert.equal(toDo(workspace, id).logbookAt, null);
  assert.ok(completed.undo);
  workspace.undo(completed.undo!.token);
  assert.equal(toDo(workspace, id).outcome, "open");

  workspace.change({ type: "cancelToDo", id });
  assert.equal(toDo(workspace, id).outcome, "canceled");
  assert.equal(workspace.change({ type: "logToDo", id }).outcome, "to-do-logged");
  assert.equal(workspace.view({ kind: "logbook", date: "2026-07-19" })[0]?.outcome, "canceled");
  workspace.change({ type: "reopenToDo", id });
  assert.equal(toDo(workspace, id).outcome, "open");

  const copyId = changedId(workspace.change({ type: "duplicateToDo", id }));
  assert.equal(toDo(workspace, copyId).title, "Ship release copy");
  assert.equal(toDo(workspace, copyId).outcome, "open");
});

test("immediate, daily, and manual Logbook policies remain distinct", () => {
  const workspace = setup();
  const immediateId = changedId(workspace.change({ type: "createToDo", title: "Immediate" }));
  workspace.change({ type: "setLogbookPolicy", policy: "immediately" });
  workspace.change({ type: "completeToDo", id: immediateId });
  assert.equal(toDo(workspace, immediateId).logbookAt, NOW);

  const dailyId = changedId(workspace.change({ type: "createToDo", title: "Daily", schedule: { kind: "scheduled", date: "2026-07-19", evening: false } }));
  workspace.change({ type: "setLogbookPolicy", policy: "daily" });
  workspace.change({ type: "cancelToDo", id: dailyId });
  assert.equal(toDo(workspace, dailyId).logbookAt, null);
  assert.deepEqual(workspace.view({ kind: "today", date: "2026-07-19" }).map((item) => item.id), [dailyId]);
  workspace.change({ type: "runDailyLogbook" });
  assert.equal(toDo(workspace, dailyId).logbookAt, NOW);
  assert.deepEqual(workspace.view({ kind: "today", date: "2026-07-19" }), []);

  const workSpaceId = changedId(workspace.change({ type: "createSpace", title: "Work", color: "#5577dd" }));
  const workId = changedId(workspace.change({ type: "createToDo", title: "Work only", location: { kind: "unfiled", spaceId: workSpaceId } }));
  const personalId = changedId(workspace.change({ type: "createToDo", title: "Personal only" }));
  workspace.change({ type: "cancelToDo", id: workId });
  workspace.change({ type: "cancelToDo", id: personalId });
  workspace.change({ type: "runDailyLogbook", spaceId: "space-personal" });
  assert.equal(toDo(workspace, personalId).logbookAt, NOW);
  assert.equal(toDo(workspace, workId).logbookAt, null);

  const manualId = changedId(workspace.change({ type: "createToDo", title: "Manual" }));
  workspace.change({ type: "setLogbookPolicy", policy: "manually" });
  workspace.change({ type: "completeToDo", id: manualId });
  assert.equal(toDo(workspace, manualId).logbookAt, null);
});

test("Trash is separate from Outcome and destructive actions require exact confirmation", () => {
  const workspace = setup();
  const id = changedId(workspace.change({ type: "createToDo", title: "Old receipt" }));
  workspace.change({ type: "cancelToDo", id });
  workspace.change({ type: "trashToDo", id });
  assert.equal(workspace.change({ type: "reopenToDo", id }).status, "rejected");
  workspace.change({ type: "restoreToDo", id });
  assert.equal(toDo(workspace, id).outcome, "canceled");

  workspace.change({ type: "trashToDo", id });
  assert.equal(workspace.change({ type: "permanentlyDeleteToDo", id, confirmation: "yes" }).outcome, "confirmation-required");
  assert.equal(workspace.change({ type: "permanentlyDeleteToDo", id, confirmation: PERMANENT_DELETE_CONFIRMATION }).status, "changed");
  assert.equal(workspace.read().toDos.length, 0);
  assert.equal(workspace.read().permanentDeletions[0]?.entityId, id);

  const second = changedId(workspace.change({ type: "createToDo", title: "Second" }));
  workspace.change({ type: "trashToDo", id: second });
  assert.equal(workspace.change({ type: "emptyTrash", spaceId: "space-personal", confirmation: "" }).outcome, "confirmation-required");
  assert.equal(workspace.change({ type: "emptyTrash", spaceId: "space-personal", confirmation: EMPTY_TRASH_CONFIRMATION }).status, "changed");
});

test("all standard views are derived, filtered, and ordered through Workspace", () => {
  const workspace = setup();
  const create = (title: string, schedule: ToDo["schedule"], deadline: string | null = null) => changedId(workspace.change({ type: "createToDo", title, schedule, deadline }));
  const inbox = create("Inbox", { kind: "inbox" });
  const anytime = create("Anytime", { kind: "anytime" });
  const someday = create("Someday", { kind: "someday" });
  const overdue = create("Overdue", { kind: "scheduled", date: "2026-07-18", evening: false }, "2026-07-22");
  const today = create("Today", { kind: "scheduled", date: "2026-07-19", evening: false });
  const evening = create("Evening", { kind: "scheduled", date: "2026-07-19", evening: true });
  const tomorrow = create("Tomorrow", { kind: "scheduled", date: "2026-07-20", evening: false });
  const future = create("Future", { kind: "scheduled", date: "2026-07-25", evening: false }, "2026-07-21");

  const project: Project = {
    id: "project-deadline", title: "Project deadline", notes: "", location: { kind: "space", spaceId: "space-personal" },
    schedule: { kind: "anytime" }, deadline: "2026-07-20", outcome: "open", trashedAt: null, logbookAt: null,
    tags: [], occurrence: null, completedAt: null, order: 0,
  };
  const withProject = workspace.read();
  withProject.projects.push(project);
  const projectWorkspace = createWorkspace(withProject, { now: () => NOW, createId: (kind) => `${kind}-view` });

  assert.deepEqual(workspace.view({ kind: "inbox", date: "2026-07-19" }).map((item) => item.id), [inbox]);
  assert.deepEqual(workspace.view({ kind: "today", date: "2026-07-19" }).map((item) => item.id), [overdue, today, evening]);
  assert.deepEqual(workspace.view({ kind: "thisEvening", date: "2026-07-19" }).map((item) => item.id), [evening]);
  assert.deepEqual(workspace.view({ kind: "tomorrow", date: "2026-07-20" }).map((item) => item.id), [tomorrow]);
  assert.deepEqual(workspace.view({ kind: "upcoming", date: "2026-07-19" }).map((item) => item.id), [tomorrow, future]);
  assert.deepEqual(workspace.view({ kind: "anytime", date: "2026-07-19" }).map((item) => item.id), [anytime]);
  assert.deepEqual(workspace.view({ kind: "someday", date: "2026-07-19" }).map((item) => item.id), [someday]);
  assert.deepEqual(projectWorkspace.view({ kind: "deadlines", date: "2026-07-19" }).map((item) => item.id), ["project-deadline", future, overdue]);
});

test("Trash and every Location view are derived through Workspace", () => {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-work", title: "Work", color: "#5577dd", pinned: true, order: 0 });
  document.areas.push({ id: "area-work", title: "Work", spaceId: "space-work", color: "#5577dd", tags: [], order: 0 });
  document.projects.push({ id: "project-site", title: "Site", notes: "", location: { kind: "area", areaId: "area-work" }, schedule: { kind: "anytime" }, deadline: null, outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null, completedAt: null, order: 0 });
  document.headings.push({ id: "heading-copy", title: "Copy", location: { kind: "project", projectId: "project-site" }, archivedAt: null, order: 0 });
  document.settings.defaultSpaceId = "space-work";
  const workspace = createWorkspace(document, { now: () => NOW, createId: (kind) => `${kind}-location` });
  const id = changedId(workspace.change({ type: "createToDo", title: "Write copy", location: { kind: "heading", headingId: "heading-copy" } }));

  for (const view of [
    { kind: "space", id: "space-work", date: "2026-07-19" },
    { kind: "area", id: "area-work", date: "2026-07-19" },
    { kind: "project", id: "project-site", date: "2026-07-19" },
    { kind: "heading", id: "heading-copy", date: "2026-07-19" },
  ] as const) {
    assert.deepEqual(workspace.view(view).map((item) => item.id), [id]);
    assert.equal(workspace.spaceIdForView(view), "space-work");
  }

  workspace.change({ type: "updateToDo", id, changes: { location: { kind: "area", areaId: "area-work" } } });
  assert.deepEqual(workspace.view({ kind: "heading", id: "heading-copy", date: "2026-07-19" }), []);
  assert.deepEqual(workspace.view({ kind: "project", id: "project-site", date: "2026-07-19" }), []);
  assert.deepEqual(workspace.view({ kind: "area", id: "area-work", date: "2026-07-19" }).map((item) => item.id), [id]);

  workspace.change({ type: "trashToDo", id });
  assert.deepEqual(workspace.view({ kind: "trash", date: "2026-07-19" }).map((item) => item.id), [id]);
  assert.deepEqual(workspace.view({ kind: "space", id: "space-work", date: "2026-07-19" }), []);
});

test("malformed and rejected lifecycle actions never change the Workspace", () => {
  const workspace = setup();
  const id = changedId(workspace.change({ type: "createToDo", title: "Safe" }));
  const before = workspace.read();
  assert.equal(workspace.change({ type: "updateToDo", id, changes: { title: "Must not stick", schedule: { kind: "scheduled", date: "not-a-date", evening: false } } }).status, "rejected");
  assert.equal(workspace.change({ type: "completeToDo", id: "missing" }).outcome, "not-found");
  assert.equal(workspace.change({ type: "snoozeReminder", id, until: "soon" }).status, "rejected");
  assert.equal(workspace.change({ type: "logToDo", id }).status, "rejected");
  assert.equal(workspace.change({ type: "restoreToDo", id }).status, "rejected");
  assert.equal(workspace.change({ type: "permanentlyDeleteToDo", id, confirmation: PERMANENT_DELETE_CONFIRMATION }).status, "rejected");
  assert.equal(workspace.change({ type: "addChecklistItem", toDoId: id, title: " " }).status, "rejected");
  assert.equal(workspace.change({ type: "setToDoTags", id, titles: ["x".repeat(101)] }).status, "rejected");
  assert.deepEqual(workspace.read(), before);
});
