import assert from "node:assert/strict";
import test from "node:test";

import {
  applyInterfaceChangeSetToWorkspace,
  interfaceLocationForWorkspaceUrl,
  workspaceDocumentToInterfaceState,
} from "../../shared/replacement/interface-bridge.ts";
import {
  createEmptyWorkspace,
  createWorkspace,
} from "../../shared/replacement/workspace.ts";

const NOW = "2026-07-20T09:00:00.000Z";

function workspaceFixture() {
  let sequence = 0;
  const document = createEmptyWorkspace(NOW);
  document.spaces.push({ id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-personal";
  return createWorkspace(document, {
    now: () => NOW,
    createId: (kind) => `${kind}-${++sequence}`,
  });
}

test("the restored interface reads Workspace data without changing its domain meaning", () => {
  const workspace = workspaceFixture();
  workspace.change({
    type: "createToDo",
    title: "Review launch brief",
    notes: "Check the final scope",
    location: { kind: "unfiled", spaceId: "space-personal" },
    schedule: { kind: "scheduled", date: "2026-07-20", evening: true },
    reminderAt: "2026-07-20T14:30:00.000+03:00",
    deadline: "2026-07-22",
    checklist: ["Read final copy", "Confirm analytics"],
  });

  const state = workspaceDocumentToInterfaceState(workspace.read());
  const toDo = state.tasks.find((item) => item.title === "Review launch brief");

  assert.equal(toDo?.bucket, "today");
  assert.equal(toDo?.scheduledFor, "2026-07-20");
  assert.equal(toDo?.evening, true);
  assert.equal(toDo?.reminderAt, "2026-07-20T14:30");
  assert.equal(toDo?.deadline, "2026-07-22");
  assert.deepEqual(toDo?.checklist.map((item) => item.title), ["Read final copy", "Confirm analytics"]);
});

test("repeating Schedule and Deadline stay separate in the restored interface", () => {
  const workspace = workspaceFixture();
  workspace.change({
    type: "createRepeatingTemplate",
    template: {
      itemKind: "toDo",
      title: "Send report",
      location: { kind: "unfiled", spaceId: "space-personal" },
      pattern: { frequency: "weekly", interval: 1, weekdays: [1] },
      mode: "on-schedule",
      firstDate: "2026-07-27",
      deadlineOffsetDays: 2,
    },
  });

  const template = workspaceDocumentToInterfaceState(workspace.read()).tasks.find((item) => item.workspaceTemplate);

  assert.equal(template?.scheduledFor, "2026-07-27");
  assert.equal(template?.deadline, "2026-07-29");
});

test("interface edits cross the public Workspace seam and preserve Workspace-only records", () => {
  const workspace = workspaceFixture();
  const created = workspace.change({
    type: "createToDo",
    title: "Draft copy",
    location: { kind: "unfiled", spaceId: "space-personal" },
    checklist: ["Headline", "Body"],
  });
  assert.equal(created.status, "changed");
  const toDoId = created.affected.find((item) => item.kind === "toDo")!.id;
  workspace.change({
    type: "createRepeatingTemplate",
    template: {
      itemKind: "toDo",
      title: "Weekly review",
      location: { kind: "unfiled", spaceId: "space-personal" },
      pattern: { frequency: "weekly", interval: 1, weekdays: [1] },
      mode: "on-schedule",
      firstDate: "2026-07-27",
    },
  });
  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-27" });
  const before = workspace.read();
  before.captureReceipts.push({ submissionId: "capture-1", toDoId, createdAt: NOW });

  const next = applyInterfaceChangeSetToWorkspace(before, {
    mutationId: "mutation-interface-edit",
    entities: {
      tasks: [{
        id: toDoId,
        patch: {
          title: "Draft final copy",
          checklist: [
            { id: before.toDos[0].checklist[1].id, title: "Body", done: false },
            { id: before.toDos[0].checklist[0].id, title: "Headline", done: true },
          ],
        },
      }],
    },
  }, {
    now: () => NOW,
    createId: (kind) => `bridge-${kind}`,
  });

  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.document.toDos[0].title, "Draft final copy");
  assert.deepEqual(next.document.toDos[0].checklist.map((item) => [item.title, item.completed, item.order]), [
    ["Body", false, 0],
    ["Headline", true, 1],
  ]);
  assert.equal(next.document.repeatingTemplates[0].title, "Weekly review");
  assert.equal(next.document.repeatingTemplates[0].id, before.repeatingTemplates[0].id);
  assert.equal(next.document.toDos.find((item) => item.occurrence)?.occurrence?.templateId, before.repeatingTemplates[0].id);
  assert.deepEqual(next.document.captureReceipts, before.captureReceipts);
  assert.deepEqual(createWorkspace(next.document, { now: () => NOW, createId: () => "unused" }).validate(), []);
});

test("interface completion keeps after-completion repetition behavior inside Workspace", () => {
  const workspace = workspaceFixture();
  workspace.change({
    type: "createRepeatingTemplate",
    template: {
      itemKind: "toDo",
      title: "Weekly review",
      location: { kind: "unfiled", spaceId: "space-personal" },
      pattern: { frequency: "weekly", interval: 1, weekdays: [] },
      mode: "after-completion",
      firstDate: "2026-07-20",
    },
  });
  workspace.change({ type: "generateRepeatingOccurrences", throughDate: "2026-07-20" });
  const before = workspace.read();
  const occurrence = before.toDos[0];

  const next = applyInterfaceChangeSetToWorkspace(before, {
    mutationId: "mutation-complete-occurrence",
    entities: { tasks: [{ id: occurrence.id, patch: { status: "completed", completedAt: NOW } }] },
  }, { now: () => NOW, createId: (kind) => `bridge-${kind}` });

  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.document.toDos[0].outcome, "completed");
  assert.equal(next.document.repeatingTemplates[0].nextDate, "2026-07-27");
});

test("interface Project completion records Workspace Project Closure", () => {
  const workspace = workspaceFixture();
  workspace.change({ type: "createProject", title: "Launch", location: { kind: "space", spaceId: "space-personal" } });
  const projectId = workspace.read().projects[0].id;
  for (let index = 0; index < 25; index += 1) {
    workspace.change({ type: "createToDo", title: `Launch step ${index + 1}`, location: { kind: "project", projectId } });
  }
  const toDoIds = workspace.read().toDos.map((item) => item.id);
  const before = workspace.read();

  const next = applyInterfaceChangeSetToWorkspace(before, {
    mutationId: "mutation-close-project",
    entities: {
      projects: [{ id: projectId, patch: { status: "completed", completedAt: NOW } }],
      tasks: toDoIds.map((id) => ({ id, patch: { status: "completed", completedAt: NOW } })),
    },
  }, { now: () => NOW, createId: (kind) => `bridge-${kind}` });

  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.document.projectClosures.length, 1);
  assert.deepEqual(next.document.projectClosures[0].changedToDoIds, toDoIds);
});

test("published Workspace links open the matching restored interface target", () => {
  const workspace = workspaceFixture();
  workspace.change({ type: "createArea", title: "Studio", spaceId: "space-personal" });
  const areaId = workspace.read().areas[0].id;
  workspace.change({ type: "createHeading", title: "Final polish", location: { kind: "area", areaId } });
  const headingId = workspace.read().headings[0].id;
  workspace.change({
    type: "createToDo",
    title: "Review layout",
    location: { kind: "heading", headingId },
  });
  const toDoId = workspace.read().toDos[0].id;

  assert.deepEqual(interfaceLocationForWorkspaceUrl(workspace.read(), `?open=toDo&id=${toDoId}`), {
    search: `?task=${toDoId}`,
    activeSpaceId: "space-personal",
  });
  assert.deepEqual(interfaceLocationForWorkspaceUrl(workspace.read(), `?open=heading&id=${headingId}`), {
    search: `?view=area&id=${areaId}`,
    activeSpaceId: "space-personal",
  });
  assert.deepEqual(interfaceLocationForWorkspaceUrl(workspace.read(), "?open=view&view=today"), {
    search: "?view=today",
    activeSpaceId: null,
  });
});
