import assert from "node:assert/strict";
import test from "node:test";

import type { RepeatingPattern } from "../../shared/workspace/model.ts";
import {
  DELETE_REPEATING_TEMPLATE_CONFIRMATION,
  createEmptyWorkspace,
  createWorkspace,
} from "../../shared/workspace/workspace.ts";

const NOW = "2026-07-19T09:30:00.000Z";

function setup(now: () => string = () => NOW) {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  let nextId = 0;
  return createWorkspace(document, {
    now,
    createId: (kind) => `${kind}-${++nextId}`,
  });
}

test("on-schedule repetition creates every due Occurrence once while earlier ones remain open", () => {
  const workspace = setup();
  const pattern: RepeatingPattern = { frequency: "daily", interval: 2, weekdays: [] };
  const created = workspace.change({
    type: "createRepeatingTemplate",
    template: {
      itemKind: "toDo",
      title: "Water plants",
      notes: "Kitchen and study",
      location: { kind: "unfiled", spaceId: "space-personal" },
      tags: [],
      checklist: ["Kitchen", "Study"],
      pattern,
      mode: "on-schedule",
      firstDate: "2026-07-15",
      reminderTime: "08:30",
      deadlineOffsetDays: 1,
    },
  });
  assert.equal(created.status, "changed");

  const firstRun = workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-19", batchSize: 2 });
  assert.equal(firstRun.status, "changed");
  assert.deepEqual(workspace.read().toDos.map((item) => item.occurrence?.scheduledDate), ["2026-07-15", "2026-07-17"]);

  const secondRun = workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-19", batchSize: 2 });
  assert.equal(secondRun.status, "changed");
  assert.deepEqual(workspace.read().toDos.map((item) => item.occurrence?.scheduledDate), ["2026-07-15", "2026-07-17", "2026-07-19"]);
  assert.deepEqual(workspace.read().toDos.map((item) => item.deadline), ["2026-07-16", "2026-07-18", "2026-07-20"]);
  assert.equal(workspace.read().toDos[0]?.reminder?.at, "2026-07-15T08:30:00.000Z");
  assert.equal(workspace.read().toDos[0]?.checklist[0]?.id === workspace.read().toDos[1]?.checklist[0]?.id, false);

  const idempotentRun = workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-19" });
  assert.equal(idempotentRun.status, "changed");
  assert.equal(workspace.read().toDos.length, 3);
  assert.equal(workspace.read().repeatingTemplates[0]?.nextDate, "2026-07-21");
});

test("after-completion repetition keeps one open Occurrence and advances from completion or Skip day", () => {
  const workspace = setup();
  workspace.change({
    type: "createRepeatingTemplate",
    template: {
      itemKind: "toDo",
      title: "Clean filter",
      location: { kind: "unfiled", spaceId: "space-personal" },
      pattern: { frequency: "daily", interval: 3, weekdays: [] },
      mode: "after-completion",
      firstDate: "2026-07-15",
    },
  });
  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-19" });
  const first = workspace.read().toDos[0]!;
  assert.equal(first.occurrence?.scheduledDate, "2026-07-15");

  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-08-01" });
  assert.equal(workspace.read().toDos.length, 1);
  workspace.change({ type: "trashToDo", id: first.id });
  assert.equal(workspace.read().repeatingTemplates[0]?.nextDate, "2026-07-15");
  workspace.change({ type: "restoreToDo", id: first.id });
  const templateId = workspace.read().repeatingTemplates[0]!.id;
  workspace.change({ type: "pauseRepeatingTemplate", id: templateId });
  workspace.change({ type: "completeToDo", id: first.id });
  assert.equal(workspace.read().repeatingTemplates[0]?.nextDate, "2026-07-22");
  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-22" });
  assert.equal(workspace.read().toDos.length, 1);
  workspace.change({ type: "resumeRepeatingTemplate", id: templateId });
  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-22" });
  const second = workspace.read().toDos[1]!;
  assert.equal(second.occurrence?.scheduledDate, "2026-07-22");

  const skipped = workspace.change({ type: "skipOccurrence", itemKind: "toDo", id: second.id });
  assert.equal(skipped.status, "changed");
  assert.equal(workspace.read().toDos[1]?.outcome, "canceled");
  assert.equal(workspace.read().toDos[1]?.logbookAt, NOW);
  assert.equal(workspace.read().repeatingTemplates[0]?.nextDate, "2026-07-22");
  assert.equal(workspace.read().toDos.length, 2);

  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-22" });
  assert.equal(workspace.read().toDos.length, 2);
  workspace.change({ type: "trashToDo", id: second.id });
  assert.equal(workspace.read().repeatingTemplates[0]?.nextDate, "2026-07-22");
});

test("template edits affect only future Occurrences and pause, resume, stop, delete, and undo stay distinct", () => {
  const workspace = setup();
  const created = workspace.change({
    type: "createRepeatingTemplate",
    template: {
      itemKind: "toDo",
      title: "Old title",
      location: { kind: "unfiled", spaceId: "space-personal" },
      pattern: { frequency: "daily", interval: 1, weekdays: [] },
      mode: "on-schedule",
      firstDate: "2026-07-19",
    },
  });
  assert.equal(created.status, "changed");
  const templateId = created.affected[0]!.id;
  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-19" });

  workspace.change({ type: "updateRepeatingTemplate", id: templateId, changes: { title: "New title" } });
  assert.equal(workspace.read().toDos[0]?.title, "Old title");
  const paused = workspace.change({ type: "pauseRepeatingTemplate", id: templateId });
  assert.equal(paused.status, "changed");
  assert.ok(paused.undo);
  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-21" });
  assert.equal(workspace.read().toDos.length, 1);

  workspace.undo(paused.undo!.token);
  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-21" });
  assert.deepEqual(workspace.read().toDos.map((item) => item.title), ["Old title", "New title", "New title"]);

  assert.equal(workspace.change({ type: "stopRepeatingTemplate", id: templateId }).status, "changed");
  assert.equal(workspace.change({ type: "resumeRepeatingTemplate", id: templateId }).status, "rejected");
  assert.equal(workspace.change({ type: "updateRepeatingTemplate", id: templateId, changes: { title: "Ignored" } }).status, "rejected");
  assert.equal(workspace.read().toDos[0]?.title, "Old title");

  assert.equal(workspace.change({ type: "deleteRepeatingTemplate", id: templateId, confirmation: "yes" }).outcome, "confirmation-required");
  assert.equal(workspace.change({ type: "deleteRepeatingTemplate", id: templateId, confirmation: DELETE_REPEATING_TEMPLATE_CONFIRMATION }).status, "changed");
  assert.equal(workspace.read().repeatingTemplates.length, 0);
  assert.ok(workspace.read().toDos.every((item) => item.occurrence === null));
});

test("a repeating Project copies independent Projects, Headings, to-dos, and checklist items", () => {
  const workspace = setup();
  const projectResult = workspace.change({
    type: "createProject",
    title: "Weekly reset",
    location: { kind: "space", spaceId: "space-personal" },
    schedule: { kind: "scheduled", date: "2026-07-20", evening: false },
    deadline: "2026-07-22",
  });
  assert.equal(projectResult.status, "changed");
  const projectId = projectResult.affected[0]!.id;
  const headingResult = workspace.change({ type: "createHeading", title: "Kitchen", location: { kind: "project", projectId } });
  assert.equal(headingResult.status, "changed");
  const headingId = headingResult.affected[0]!.id;
  const toDoResult = workspace.change({
    type: "createToDo",
    title: "Wipe counters",
    location: { kind: "heading", headingId },
    schedule: { kind: "scheduled", date: "2026-07-21", evening: true },
    reminderAt: "2026-07-21T18:00:00.000Z",
    deadline: "2026-07-23",
    checklist: ["Use spray"],
  });
  assert.equal(toDoResult.status, "changed");
  const toDoId = toDoResult.affected[0]!.id;

  assert.equal(workspace.change({
    type: "makeProjectRepeating",
    id: projectId,
    firstDate: "2026-07-20",
    pattern: { frequency: "weekly", interval: 1, weekdays: [1] },
    mode: "on-schedule",
  }).status, "changed");
  workspace.change({ type: "updateProject", id: projectId, changes: { title: "Local override" } });
  workspace.change({ type: "updateToDo", id: toDoId, changes: { title: "Local child override" } });
  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-27" });

  const document = workspace.read();
  assert.equal(document.projects.length, 2);
  const copy = document.projects.find((project) => project.id !== projectId)!;
  assert.equal(copy.title, "Weekly reset");
  assert.equal(copy.occurrence?.scheduledDate, "2026-07-27");
  assert.equal(copy.deadline, "2026-07-29");
  const copiedHeading = document.headings.find((heading) => heading.id !== headingId)!;
  assert.deepEqual(copiedHeading.location, { kind: "project", projectId: copy.id });
  const copiedToDo = document.toDos.find((item) => item.id !== toDoId)!;
  assert.equal(copiedToDo.title, "Wipe counters");
  assert.deepEqual(copiedToDo.location, { kind: "heading", headingId: copiedHeading.id });
  assert.deepEqual(copiedToDo.schedule, { kind: "scheduled", date: "2026-07-28", evening: true });
  assert.equal(copiedToDo.reminder?.at, "2026-07-28T18:00:00.000Z");
  assert.equal(copiedToDo.deadline, "2026-07-30");
  assert.notEqual(copiedToDo.checklist[0]?.id, document.toDos.find((item) => item.id === toDoId)?.checklist[0]?.id);
});

test("rule boundaries and future previews are deterministic without creating actionable work early", () => {
  const workspace = setup();
  const rules = [
    { title: "Weekdays", firstDate: "2026-07-21", pattern: { frequency: "weekly" as const, interval: 2, weekdays: [2, 4] } },
    { title: "Month end", firstDate: "2024-01-31", pattern: { frequency: "monthly" as const, interval: 1, weekdays: [] } },
    { title: "Leap day", firstDate: "2024-02-29", pattern: { frequency: "yearly" as const, interval: 1, weekdays: [] } },
  ];
  for (const rule of rules) workspace.change({
    type: "createRepeatingTemplate",
    template: {
      itemKind: "toDo", title: rule.title, location: { kind: "unfiled", spaceId: "space-personal" },
      pattern: rule.pattern, mode: "on-schedule", firstDate: rule.firstDate,
    },
  });

  assert.deepEqual(
    workspace.repeatingPreviews("2026-07-01", "2026-08-31").filter((preview) => preview.title === "Weekdays").map((preview) => preview.scheduledDate),
    ["2026-07-21", "2026-07-23", "2026-08-04", "2026-08-06", "2026-08-18", "2026-08-20"],
  );
  assert.deepEqual(
    workspace.repeatingPreviews("2024-01-01", "2024-04-30").filter((preview) => preview.title === "Month end").map((preview) => preview.scheduledDate),
    ["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"],
  );
  assert.deepEqual(
    workspace.repeatingPreviews("2024-01-01", "2028-12-31", 500).filter((preview) => preview.title === "Leap day").map((preview) => preview.scheduledDate),
    ["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"],
  );
  assert.equal(workspace.read().toDos.length, 0);
  assert.deepEqual(workspace.nextRepeatingPreviews("2026-07-20").map((preview) => [preview.title, preview.scheduledDate]), [
    ["Weekdays", "2026-07-21"],
    ["Month end", "2026-07-31"],
    ["Leap day", "2027-02-28"],
  ]);

  const invalidBefore = workspace.read();
  assert.equal(workspace.change({
    type: "createRepeatingTemplate",
    template: {
      itemKind: "toDo", title: "Damaged", location: { kind: "unfiled", spaceId: "space-personal" },
      pattern: { frequency: "daily", interval: 0, weekdays: [] }, mode: "on-schedule", firstDate: "not-a-date",
    },
  }).status, "rejected");
  assert.deepEqual(workspace.read(), invalidBefore);

  assert.equal(workspace.change({
    type: "createRepeatingTemplate",
    template: {
      itemKind: "project",
      title: "Damaged Project",
      location: { kind: "space", spaceId: "space-personal" },
      pattern: { frequency: "daily", interval: 1, weekdays: [] },
      mode: "on-schedule",
      firstDate: "2026-07-20",
      projectContents: {
        headings: [],
        toDos: [{
          key: "child-1", title: "Child", notes: "", headingKey: null, tags: [], checklist: [],
          schedule: { kind: "scheduled", offsetDays: 0.5, evening: false },
          reminder: { kind: "offset", days: 0, time: "25:90" },
          deadline: { kind: "offset", days: 1.5 }, order: 0,
        }],
      },
    },
  }).status, "rejected");
  assert.deepEqual(workspace.read(), invalidBefore);
});

test("converting a to-do uses its chosen date as the first Occurrence and keeps local overrides local", () => {
  const workspace = setup();
  const created = workspace.change({
    type: "createToDo",
    title: "Send invoice",
    notes: "Use the saved rate",
    schedule: { kind: "scheduled", date: "2026-07-31", evening: false },
    reminderAt: "2026-07-31T09:15:00.000Z",
    deadline: "2026-08-02",
    checklist: ["Check hours"],
  });
  assert.equal(created.status, "changed");
  const id = created.affected[0]!.id;
  assert.equal(workspace.change({
    type: "makeToDoRepeating",
    id,
    nextDate: "2026-07-31",
    pattern: { frequency: "monthly", interval: 1, weekdays: [] },
    mode: "on-schedule",
  }).status, "changed");
  workspace.change({ type: "updateToDo", id, changes: { title: "July invoice" } });
  const templateId = workspace.read().repeatingTemplates[0]!.id;
  workspace.change({ type: "updateRepeatingTemplate", id: templateId, changes: { notes: "Future note" } });
  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-08-31" });

  const next = workspace.read().toDos.find((item) => item.id !== id)!;
  assert.equal(next.title, "Send invoice");
  assert.equal(next.notes, "Future note");
  assert.equal(next.occurrence?.scheduledDate, "2026-08-31");
  assert.equal(next.reminder?.at, "2026-08-31T09:15:00.000Z");
  assert.equal(next.deadline, "2026-09-02");
  assert.notEqual(next.checklist[0]?.id, workspace.read().toDos.find((item) => item.id === id)?.checklist[0]?.id);
});

test("after-completion repeating Projects advance on completion and Project Skip closes their copied work", () => {
  let currentNow = "2026-07-19T09:30:00.000Z";
  const workspace = setup(() => currentNow);
  const projectResult = workspace.change({ type: "createProject", title: "Sunday reset", location: { kind: "space", spaceId: "space-personal" } });
  assert.equal(projectResult.status, "changed");
  const projectId = projectResult.affected[0]!.id;
  const toDoResult = workspace.change({ type: "createToDo", title: "Empty inbox", location: { kind: "project", projectId } });
  assert.equal(toDoResult.status, "changed");
  const toDoId = toDoResult.affected[0]!.id;
  workspace.change({
    type: "makeProjectRepeating", id: projectId, firstDate: "2026-07-19",
    pattern: { frequency: "weekly", interval: 1, weekdays: [] }, mode: "after-completion",
  });
  workspace.change({ type: "closeProject", id: projectId, outcome: "completed", toDoOutcomes: [{ id: toDoId, outcome: "completed" }] });
  assert.equal(workspace.read().repeatingTemplates[0]?.nextDate, "2026-07-26");

  currentNow = "2026-07-26T10:00:00.000Z";
  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-26" });
  const copy = workspace.read().projects.find((project) => project.id !== projectId)!;
  const skipped = workspace.change({ type: "skipOccurrence", itemKind: "project", id: copy.id });
  assert.equal(skipped.status, "changed");
  assert.equal(workspace.read().projects.find((project) => project.id === copy.id)?.outcome, "canceled");
  const copiedToDo = workspace.read().toDos.find((item) => item.id !== toDoId)!;
  assert.equal(copiedToDo.outcome, "canceled");
  assert.equal(workspace.read().repeatingTemplates[0]?.nextDate, "2026-08-02");
});
