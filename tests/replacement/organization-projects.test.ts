import assert from "node:assert/strict";
import test from "node:test";

import type { ToDo } from "../../shared/replacement/model.ts";
import {
  DELETE_SPACE_CONFIRMATION,
  DELETE_HEADING_CONFIRMATION,
  DELETE_TAG_CONFIRMATION,
  PERMANENT_DELETE_CONFIRMATION,
  REMOVE_AREA_CONFIRMATION,
  createEmptyWorkspace,
  createWorkspace,
} from "../../shared/replacement/workspace.ts";

const NOW = "2026-07-19T12:00:00.000Z";

function setup() {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push(
    { id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 },
    { id: "space-work", title: "Work", color: "#5577dd", pinned: true, order: 1 },
  );
  document.settings.defaultSpaceId = "space-personal";
  let nextId = 0;
  return createWorkspace(document, {
    now: () => NOW,
    createId: (kind) => `${kind}-${++nextId}`,
  });
}

function changedId(result: ReturnType<ReturnType<typeof setup>["change"]>, kind: string): string {
  assert.equal(result.status, "changed");
  const affected = result.affected.find((item) => item.kind === kind);
  assert.ok(affected);
  return affected.id;
}

function storedToDo(workspace: ReturnType<typeof setup>, id: string): ToDo {
  const item = workspace.read().toDos.find((candidate) => candidate.id === id);
  assert.ok(item);
  return item;
}

test("moving organization parents changes inherited Location without rewriting the to-do", () => {
  const workspace = setup();
  const areaId = changedId(workspace.change({ type: "createArea", title: "Clients", spaceId: "space-personal" }), "area");
  const projectId = changedId(workspace.change({ type: "createProject", title: "Website", location: { kind: "area", areaId } }), "project");
  const headingId = changedId(workspace.change({ type: "createHeading", title: "Polish", location: { kind: "project", projectId } }), "heading");
  const toDoId = changedId(workspace.change({ type: "createToDo", title: "Fix spacing", location: { kind: "heading", headingId } }), "toDo");

  workspace.change({ type: "updateArea", id: areaId, changes: { spaceId: "space-work" } });
  assert.deepEqual(workspace.locationOfToDo(toDoId), { headingId, projectId, areaId, spaceId: "space-work" });

  workspace.change({ type: "updateProject", id: projectId, changes: { location: { kind: "space", spaceId: "space-personal" } } });
  assert.deepEqual(workspace.locationOfToDo(toDoId), { headingId, projectId, spaceId: "space-personal" });

  workspace.change({ type: "updateHeading", id: headingId, changes: { location: { kind: "area", areaId } } });
  assert.deepEqual(workspace.locationOfToDo(toDoId), { headingId, areaId, spaceId: "space-work" });
  assert.deepEqual(storedToDo(workspace, toDoId).location, { kind: "heading", headingId });
});

test("Spaces can be edited and reordered, then deleted by moving all content to a chosen Space", () => {
  const workspace = setup();
  const areaId = changedId(workspace.change({ type: "createArea", title: "Home", spaceId: "space-personal" }), "area");
  const projectId = changedId(workspace.change({ type: "createProject", title: "Move", location: { kind: "space", spaceId: "space-personal" } }), "project");
  const unfiledId = changedId(workspace.change({ type: "createToDo", title: "Loose", location: { kind: "unfiled", spaceId: "space-personal" } }), "toDo");
  const areaToDoId = changedId(workspace.change({ type: "createToDo", title: "Filed", location: { kind: "area", areaId } }), "toDo");
  const projectToDoId = changedId(workspace.change({ type: "createToDo", title: "Packed", location: { kind: "project", projectId } }), "toDo");

  workspace.change({ type: "updateSpace", id: "space-work", changes: { title: "Studio", color: "#123456", pinned: false } });
  workspace.change({ type: "reorderSpace", id: "space-work", toIndex: 0 });
  assert.deepEqual(workspace.read().spaces.map((space) => [space.title, space.color, space.pinned, space.order]), [
    ["Studio", "#123456", false, 0],
    ["Personal", "#e49b3c", true, 1],
  ]);

  const rejected = workspace.change({ type: "deleteSpace", id: "space-personal", moveToSpaceId: "space-work", confirmation: "yes" });
  assert.equal(rejected.outcome, "confirmation-required");
  const deleted = workspace.change({ type: "deleteSpace", id: "space-personal", moveToSpaceId: "space-work", confirmation: DELETE_SPACE_CONFIRMATION });
  assert.equal(deleted.status, "changed");
  assert.deepEqual(workspace.read().spaces.map((space) => space.id), ["space-work"]);
  assert.equal(workspace.read().settings.defaultSpaceId, "space-work");
  for (const id of [unfiledId, areaToDoId, projectToDoId]) assert.equal(workspace.locationOfToDo(id)?.spaceId, "space-work");
  assert.deepEqual(storedToDo(workspace, areaToDoId).location, { kind: "area", areaId });
  assert.deepEqual(storedToDo(workspace, projectToDoId).location, { kind: "project", projectId });
});

test("removing an Area keeps its Projects and to-dos in the same Space", () => {
  const workspace = setup();
  const areaId = changedId(workspace.change({ type: "createArea", title: "Home", spaceId: "space-personal" }), "area");
  const projectId = changedId(workspace.change({ type: "createProject", title: "Kitchen", location: { kind: "area", areaId } }), "project");
  const headingId = changedId(workspace.change({ type: "createHeading", title: "Calls", location: { kind: "area", areaId } }), "heading");
  const directId = changedId(workspace.change({ type: "createToDo", title: "Direct", location: { kind: "area", areaId } }), "toDo");
  const headingToDoId = changedId(workspace.change({ type: "createToDo", title: "Under heading", location: { kind: "heading", headingId } }), "toDo");
  const projectToDoId = changedId(workspace.change({ type: "createToDo", title: "In project", location: { kind: "project", projectId } }), "toDo");

  assert.equal(workspace.change({ type: "removeArea", id: areaId, confirmation: "" }).outcome, "confirmation-required");
  assert.equal(workspace.change({ type: "removeArea", id: areaId, confirmation: REMOVE_AREA_CONFIRMATION }).status, "changed");
  assert.equal(workspace.read().areas.length, 0);
  assert.equal(workspace.read().headings.length, 0);
  assert.deepEqual(workspace.read().projects[0]?.location, { kind: "space", spaceId: "space-personal" });
  assert.deepEqual(storedToDo(workspace, directId).location, { kind: "unfiled", spaceId: "space-personal" });
  assert.deepEqual(storedToDo(workspace, headingToDoId).location, { kind: "unfiled", spaceId: "space-personal" });
  assert.deepEqual(storedToDo(workspace, projectToDoId).location, { kind: "project", projectId });
});

test("Project Closure requires every open to-do outcome and restore reopens only closure changes", () => {
  const workspace = setup();
  const projectId = changedId(workspace.change({ type: "createProject", title: "Launch", location: { kind: "space", spaceId: "space-personal" } }), "project");
  const headingId = changedId(workspace.change({ type: "createHeading", title: "Final", location: { kind: "project", projectId } }), "heading");
  const earlierId = changedId(workspace.change({ type: "createToDo", title: "Already done", location: { kind: "project", projectId } }), "toDo");
  const completeId = changedId(workspace.change({ type: "createToDo", title: "Ship", location: { kind: "heading", headingId } }), "toDo");
  const cancelId = changedId(workspace.change({ type: "createToDo", title: "Drop extra", location: { kind: "project", projectId } }), "toDo");
  workspace.change({ type: "completeToDo", id: earlierId });

  const before = workspace.read();
  const incomplete = workspace.change({
    type: "closeProject", id: projectId, outcome: "completed",
    toDoOutcomes: [{ id: completeId, outcome: "completed" }],
  });
  assert.equal(incomplete.status, "rejected");
  assert.deepEqual(workspace.read(), before);

  const closed = workspace.change({
    type: "closeProject", id: projectId, outcome: "completed",
    toDoOutcomes: [
      { id: completeId, outcome: "completed" },
      { id: cancelId, outcome: "canceled" },
    ],
  });
  assert.equal(closed.status, "changed");
  assert.deepEqual(closed.affected.map((item) => item.id), [projectId, completeId, cancelId]);
  assert.equal(workspace.read().projects[0]?.outcome, "completed");
  assert.equal(storedToDo(workspace, earlierId).outcome, "completed");
  assert.equal(storedToDo(workspace, completeId).outcome, "completed");
  assert.equal(storedToDo(workspace, cancelId).outcome, "canceled");
  assert.deepEqual(workspace.read().projectClosures[0]?.changedToDoIds, [completeId, cancelId]);

  assert.equal(workspace.change({ type: "restoreProject", id: projectId }).status, "changed");
  assert.equal(workspace.read().projects[0]?.outcome, "open");
  assert.equal(storedToDo(workspace, earlierId).outcome, "completed");
  assert.equal(storedToDo(workspace, completeId).outcome, "open");
  assert.equal(storedToDo(workspace, cancelId).outcome, "open");
});

test("Projects report progress, duplicate with fresh identity, and retain children through Trash", () => {
  const workspace = setup();
  const projectId = changedId(workspace.change({ type: "createProject", title: "Launch", location: { kind: "space", spaceId: "space-personal" } }), "project");
  const headingId = changedId(workspace.change({ type: "createHeading", title: "Final", location: { kind: "project", projectId } }), "heading");
  const firstId = changedId(workspace.change({ type: "createToDo", title: "One", location: { kind: "heading", headingId }, checklist: ["Check"] }), "toDo");
  const secondId = changedId(workspace.change({ type: "createToDo", title: "Two", location: { kind: "project", projectId } }), "toDo");
  workspace.change({ type: "completeToDo", id: firstId });
  assert.deepEqual(workspace.projectProgress(projectId), { total: 2, open: 1, completed: 1, canceled: 0, percent: 50 });
  workspace.change({ type: "cancelToDo", id: secondId });
  assert.deepEqual(workspace.projectProgress(projectId), { total: 1, open: 0, completed: 1, canceled: 1, percent: 100 });

  const copyId = changedId(workspace.change({ type: "duplicateProject", id: projectId }), "project");
  const document = workspace.read();
  const copiedHeading = document.headings.find((heading) => heading.location.kind === "project" && heading.location.projectId === copyId);
  const copiedToDos = document.toDos.filter((item) => workspace.locationOfToDo(item.id)?.projectId === copyId);
  assert.ok(copiedHeading);
  assert.equal(copiedToDos.length, 2);
  assert.ok(copiedToDos.every((item) => item.outcome === "open" && item.id !== firstId && item.id !== secondId));
  assert.notEqual(copiedHeading.id, headingId);
  assert.notEqual(copiedToDos.find((item) => item.checklist.length)?.checklist[0]?.id, storedToDo(workspace, firstId).checklist[0]?.id);

  workspace.change({ type: "trashProject", id: projectId });
  assert.deepEqual(workspace.view({ kind: "trash", date: "2026-07-19" }).map((item) => item.id), [projectId]);
  assert.equal(workspace.read().toDos.filter((item) => workspace.locationOfToDo(item.id)?.projectId === projectId).length, 2);
  workspace.change({ type: "restoreProjectFromTrash", id: projectId });
  assert.equal(workspace.read().projects.find((project) => project.id === projectId)?.trashedAt, null);
});

test("Project Closure ignores work in Trash and includes child work restored before closure", () => {
  const workspace = setup();
  const projectId = changedId(workspace.change({ type: "createProject", title: "Launch", location: { kind: "space", spaceId: "space-personal" } }), "project");
  const trashedId = changedId(workspace.change({ type: "createToDo", title: "In Trash", location: { kind: "project", projectId } }), "toDo");
  const restoredId = changedId(workspace.change({ type: "createToDo", title: "Restored", location: { kind: "project", projectId } }), "toDo");
  workspace.change({ type: "trashToDo", id: trashedId });
  workspace.change({ type: "trashToDo", id: restoredId });
  workspace.change({ type: "restoreToDo", id: restoredId });

  const closed = workspace.change({
    type: "closeProject",
    id: projectId,
    outcome: "canceled",
    toDoOutcomes: [{ id: restoredId, outcome: "canceled" }],
  });
  assert.equal(closed.status, "changed");
  assert.deepEqual(workspace.read().projectClosures[0]?.changedToDoIds, [restoredId]);
  assert.equal(storedToDo(workspace, trashedId).outcome, "open");

  workspace.change({ type: "restoreProject", id: projectId });
  assert.equal(storedToDo(workspace, restoredId).outcome, "open");
  assert.equal(storedToDo(workspace, trashedId).outcome, "open");
  assert.equal(storedToDo(workspace, trashedId).trashedAt, NOW);
});

test("Project Closure changes and restores a repeating occurrence as normal child work", () => {
  const initial = setup();
  const projectId = changedId(initial.change({ type: "createProject", title: "Weekly", location: { kind: "space", spaceId: "space-personal" } }), "project");
  const occurrenceId = changedId(initial.change({ type: "createToDo", title: "Weekly review", location: { kind: "project", projectId } }), "toDo");
  const document = initial.read();
  document.repeatingTemplates.push({
    id: "template-weekly",
    itemKind: "toDo",
    title: "Weekly review",
    notes: "",
    location: { kind: "project", projectId },
    tags: [],
    checklist: [],
    pattern: { frequency: "weekly", interval: 1, weekdays: [1] },
    mode: "on-schedule",
    state: "active",
    nextDate: "2026-07-20",
    reminderTime: null,
    deadlineOffsetDays: null,
    projectContents: null,
    createdAt: "2026-07-19T08:00:00.000Z",
  });
  document.toDos.find((toDo) => toDo.id === occurrenceId)!.occurrence = {
    templateId: "template-weekly",
    scheduledDate: "2026-07-19",
  };
  let nextId = 0;
  const workspace = createWorkspace(document, { now: () => NOW, createId: (kind) => `${kind}-closure-${++nextId}` });

  workspace.change({
    type: "closeProject",
    id: projectId,
    outcome: "completed",
    toDoOutcomes: [{ id: occurrenceId, outcome: "completed" }],
  });
  assert.equal(storedToDo(workspace, occurrenceId).outcome, "completed");
  assert.deepEqual(storedToDo(workspace, occurrenceId).occurrence, { templateId: "template-weekly", scheduledDate: "2026-07-19" });
  workspace.change({ type: "restoreProject", id: projectId });
  assert.equal(storedToDo(workspace, occurrenceId).outcome, "open");
  assert.deepEqual(storedToDo(workspace, occurrenceId).occurrence, { templateId: "template-weekly", scheduledDate: "2026-07-19" });
});

test("permanent Project deletion requires confirmation and removes its complete child tree", () => {
  const workspace = setup();
  const projectId = changedId(workspace.change({ type: "createProject", title: "Old", location: { kind: "space", spaceId: "space-personal" } }), "project");
  const headingId = changedId(workspace.change({ type: "createHeading", title: "Part", location: { kind: "project", projectId } }), "heading");
  const toDoId = changedId(workspace.change({ type: "createToDo", title: "Child", location: { kind: "heading", headingId } }), "toDo");
  workspace.change({ type: "trashProject", id: projectId });

  assert.equal(workspace.change({ type: "permanentlyDeleteProject", id: projectId, confirmation: "yes" }).outcome, "confirmation-required");
  assert.equal(workspace.change({ type: "permanentlyDeleteProject", id: projectId, confirmation: PERMANENT_DELETE_CONFIRMATION }).status, "changed");
  assert.equal(workspace.read().projects.some((project) => project.id === projectId), false);
  assert.equal(workspace.read().headings.some((heading) => heading.id === headingId), false);
  assert.equal(workspace.read().toDos.some((item) => item.id === toDoId), false);
  assert.ok(workspace.read().permanentDeletions.some((marker) => marker.entityKind === "project" && marker.entityId === projectId));
});

test("Headings duplicate with their to-dos and archive without changing their contents", () => {
  const workspace = setup();
  const projectId = changedId(workspace.change({ type: "createProject", title: "Launch", location: { kind: "space", spaceId: "space-personal" } }), "project");
  const headingId = changedId(workspace.change({ type: "createHeading", title: "Final", location: { kind: "project", projectId } }), "heading");
  const toDoId = changedId(workspace.change({ type: "createToDo", title: "Ship", location: { kind: "heading", headingId }, checklist: ["Check"] }), "toDo");

  const copyHeadingId = changedId(workspace.change({ type: "duplicateHeading", id: headingId }), "heading");
  const copyToDo = workspace.read().toDos.find((item) => item.location.kind === "heading" && item.location.headingId === copyHeadingId);
  assert.ok(copyToDo);
  assert.notEqual(copyToDo.id, toDoId);
  assert.notEqual(copyToDo.checklist[0]?.id, storedToDo(workspace, toDoId).checklist[0]?.id);

  workspace.change({ type: "archiveHeading", id: headingId });
  assert.equal(workspace.read().headings.find((heading) => heading.id === headingId)?.archivedAt, NOW);
  assert.deepEqual(storedToDo(workspace, toDoId).location, { kind: "heading", headingId });
  workspace.change({ type: "restoreHeading", id: headingId });
  assert.equal(workspace.read().headings.find((heading) => heading.id === headingId)?.archivedAt, null);
});

test("deleting a Heading keeps its to-dos in the same parent", () => {
  const workspace = setup();
  const areaId = changedId(workspace.change({ type: "createArea", title: "Home", spaceId: "space-personal" }), "area");
  const headingId = changedId(workspace.change({ type: "createHeading", title: "Calls", location: { kind: "area", areaId } }), "heading");
  const toDoId = changedId(workspace.change({ type: "createToDo", title: "Phone", location: { kind: "heading", headingId } }), "toDo");

  assert.equal(workspace.change({ type: "deleteHeading", id: headingId, confirmation: "" }).outcome, "confirmation-required");
  assert.equal(workspace.change({ type: "deleteHeading", id: headingId, confirmation: DELETE_HEADING_CONFIRMATION }).status, "changed");
  assert.equal(workspace.read().headings.some((heading) => heading.id === headingId), false);
  assert.deepEqual(storedToDo(workspace, toDoId).location, { kind: "area", areaId });
});

test("converting a Heading into a Project keeps its contents together at the same higher Location", () => {
  const workspace = setup();
  const areaId = changedId(workspace.change({ type: "createArea", title: "Home", spaceId: "space-personal" }), "area");
  const parentProjectId = changedId(workspace.change({ type: "createProject", title: "Parent", location: { kind: "area", areaId } }), "project");
  const headingId = changedId(workspace.change({ type: "createHeading", title: "Calls", location: { kind: "project", projectId: parentProjectId } }), "heading");
  const toDoId = changedId(workspace.change({ type: "createToDo", title: "Phone", location: { kind: "heading", headingId } }), "toDo");

  const newProjectId = changedId(workspace.change({ type: "convertHeadingToProject", id: headingId }), "project");
  const project = workspace.read().projects.find((item) => item.id === newProjectId);
  assert.deepEqual(project?.location, { kind: "area", areaId });
  assert.equal(project?.title, "Calls");
  assert.equal(workspace.read().headings.some((heading) => heading.id === headingId), false);
  assert.deepEqual(storedToDo(workspace, toDoId).location, { kind: "project", projectId: newProjectId });
});

test("effective Tags combine Area, Project, and direct tags without copying them onto to-dos", () => {
  const workspace = setup();
  const areaTagId = changedId(workspace.change({ type: "createTag", title: "Home" }), "tag");
  const projectTagId = changedId(workspace.change({ type: "createTag", title: "Launch" }), "tag");
  const directTagId = changedId(workspace.change({ type: "createTag", title: "Urgent" }), "tag");
  const areaId = changedId(workspace.change({ type: "createArea", title: "House", spaceId: "space-personal", tags: [areaTagId] }), "area");
  const projectId = changedId(workspace.change({ type: "createProject", title: "Kitchen", location: { kind: "area", areaId }, tags: [projectTagId] }), "project");
  const toDoId = changedId(workspace.change({ type: "createToDo", title: "Order tiles", location: { kind: "project", projectId }, schedule: { kind: "anytime" }, tags: [directTagId] }), "toDo");

  assert.deepEqual(workspace.effectiveTagIdsForToDo(toDoId), [areaTagId, projectTagId, directTagId]);
  assert.deepEqual(storedToDo(workspace, toDoId).tags, [directTagId]);
  assert.deepEqual(workspace.view({ kind: "anytime", date: "2026-07-19", tagIds: [areaTagId, projectTagId] }).map((item) => item.id), [toDoId]);
  assert.deepEqual(workspace.view({ kind: "anytime", date: "2026-07-19", tagIds: [areaTagId, "missing"] }), []);

  workspace.change({ type: "updateProject", id: projectId, changes: { location: { kind: "space", spaceId: "space-work" } } });
  assert.deepEqual(workspace.effectiveTagIdsForToDo(toDoId), [projectTagId, directTagId]);
  assert.deepEqual(workspace.view({ kind: "anytime", date: "2026-07-19", tagIds: [areaTagId] }), []);
});

test("Tags can be renamed and deleted from every direct and inherited use", () => {
  const workspace = setup();
  const tagId = changedId(workspace.change({ type: "createTag", title: "Soon" }), "tag");
  const areaId = changedId(workspace.change({ type: "createArea", title: "Home", spaceId: "space-personal", tags: [tagId] }), "area");
  const projectId = changedId(workspace.change({ type: "createProject", title: "Kitchen", location: { kind: "area", areaId }, tags: [tagId] }), "project");
  const toDoId = changedId(workspace.change({ type: "createToDo", title: "Order", location: { kind: "project", projectId }, tags: [tagId] }), "toDo");

  workspace.change({ type: "updateTag", id: tagId, title: "Next" });
  assert.equal(workspace.read().tags.find((tag) => tag.id === tagId)?.title, "Next");
  assert.equal(workspace.change({ type: "deleteTag", id: tagId, confirmation: "" }).outcome, "confirmation-required");
  assert.equal(workspace.change({ type: "deleteTag", id: tagId, confirmation: DELETE_TAG_CONFIRMATION }).status, "changed");
  assert.equal(workspace.read().tags.some((tag) => tag.id === tagId), false);
  assert.deepEqual(workspace.read().areas[0]?.tags, []);
  assert.deepEqual(workspace.read().projects[0]?.tags, []);
  assert.deepEqual(storedToDo(workspace, toDoId).tags, []);
  assert.deepEqual(workspace.effectiveTagIdsForToDo(toDoId), []);
});
