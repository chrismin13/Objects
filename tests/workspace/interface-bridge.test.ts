import assert from "node:assert/strict";
import test from "node:test";

import {
  applyInterfaceChangeSetToWorkspace,
  interfaceLocationForWorkspaceUrl,
  workspaceDocumentToInterfaceState,
} from "../../shared/workspace/interface-bridge.ts";
import {
  createEmptyWorkspace,
  createWorkspace,
} from "../../shared/workspace/workspace.ts";

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

test("explicit Workspace lifecycle changes are authoritative over compatibility status fields", () => {
  const workspace = workspaceFixture();
  const created = workspace.change({
    type: "createToDo",
    title: "Review report",
    location: { kind: "unfiled", spaceId: "space-personal" },
  });
  assert.equal(created.status, "changed");
  const toDoId = created.affected.find((item) => item.kind === "toDo")!.id;

  const next = applyInterfaceChangeSetToWorkspace(workspace.read(), {
    mutationId: "mutation-explicit-cancel",
    workspaceChanges: [{ type: "cancelToDo", id: toDoId }],
    entities: { tasks: [{ id: toDoId, patch: { status: "completed", completedAt: NOW } }] },
  }, { now: () => NOW, createId: (kind) => `bridge-${kind}` });

  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.document.toDos[0].outcome, "canceled");
});

test("making an existing to-do repeat keeps the to-do as the first Occurrence", () => {
  const workspace = workspaceFixture();
  const created = workspace.change({
    type: "createToDo",
    title: "Weekly review",
    location: { kind: "unfiled", spaceId: "space-personal" },
    schedule: { kind: "scheduled", date: "2026-07-27", evening: false },
  });
  assert.equal(created.status, "changed");
  const toDoId = created.affected.find((item) => item.kind === "toDo")!.id;
  const before = workspace.read();

  const next = applyInterfaceChangeSetToWorkspace(before, {
    mutationId: "mutation-start-repeat",
    workspaceChanges: [{
      type: "makeToDoRepeating",
      id: toDoId,
      nextDate: "2026-07-27",
      pattern: { frequency: "weekly", interval: 1, weekdays: [] },
      mode: "on-schedule",
    }],
    entities: {
      tasks: [{
        id: toDoId,
        patch: {
          repeatTemplateId: "repeat-weekly-review",
        },
      }, {
        id: "repeat-weekly-review",
        patch: {
          title: "Weekly review",
          notes: "",
          status: "open",
          bucket: "upcoming",
          scheduledFor: "2026-07-27",
          evening: false,
          reminderAt: null,
          reminderSentAt: null,
          deadline: null,
          projectId: null,
          headingId: null,
          areaId: null,
          spaceId: "space-personal",
          tags: [],
          checklist: [],
          repeat: {
            mode: "fixed",
            frequency: "weekly",
            interval: 1,
            weekdays: [],
            nextDate: "2026-07-27",
            reminderTime: "",
            deadlineOffset: null,
            paused: false,
          },
          repeatTemplateId: null,
          workspaceTemplate: true,
          createdAt: NOW,
          completedAt: null,
          loggedAt: null,
          order: 1,
        },
      }],
    },
  }, { now: () => NOW, createId: (kind) => `bridge-${kind}` });

  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.document.toDos.some((item) => item.id === toDoId), true);
  assert.equal(next.document.toDos.find((item) => item.id === toDoId)?.occurrence?.templateId, "repeat-weekly-review");
  assert.equal(next.document.repeatingTemplates.length, 1);
  assert.equal(next.document.repeatingTemplates[0].id, "repeat-weekly-review");
  assert.deepEqual(createWorkspace(next.document, { now: () => NOW, createId: () => "unused" }).validate(), []);
});

test("an interface-materialized Occurrence is generated through Workspace with the same identity", () => {
  const workspace = workspaceFixture();
  const created = workspace.change({
    type: "createRepeatingTemplate",
    template: {
      itemKind: "toDo",
      title: "Water plants",
      location: { kind: "unfiled", spaceId: "space-personal" },
      pattern: { frequency: "daily", interval: 1, weekdays: [] },
      mode: "on-schedule",
      firstDate: "2026-07-20",
    },
  });
  assert.equal(created.status, "changed");
  const templateId = created.affected.find((item) => item.kind === "repeatingTemplate")!.id;
  const before = workspace.read();

  const next = applyInterfaceChangeSetToWorkspace(before, {
    mutationId: "mutation-generate-interface-occurrence",
    entities: {
      tasks: [{
        id: "occurrence-water-plants",
        patch: {
          title: "Water plants",
          notes: "",
          status: "open",
          bucket: "today",
          scheduledFor: "2026-07-20",
          evening: false,
          reminderAt: null,
          reminderSentAt: null,
          deadline: null,
          projectId: null,
          headingId: null,
          areaId: null,
          spaceId: "space-personal",
          tags: [],
          checklist: [],
          repeat: null,
          repeatTemplateId: templateId,
          createdAt: NOW,
          completedAt: null,
          loggedAt: null,
          order: 0,
        },
      }],
    },
  }, { now: () => NOW, createId: (kind) => `bridge-${kind}` });

  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.document.toDos.length, 1);
  assert.equal(next.document.toDos[0].id, "occurrence-water-plants");
  assert.deepEqual(next.document.toDos[0].occurrence, { templateId, scheduledDate: "2026-07-20" });
  assert.equal(next.document.repeatingTemplates[0].nextDate, "2026-07-21");
});

test("unrelated interface changes preserve repeating Project child defaults", () => {
  const workspace = workspaceFixture();
  const created = workspace.change({
    type: "createRepeatingTemplate",
    template: {
      itemKind: "project",
      title: "Weekly launch",
      location: { kind: "space", spaceId: "space-personal" },
      pattern: { frequency: "weekly", interval: 1, weekdays: [1] },
      mode: "on-schedule",
      firstDate: "2026-07-27",
      projectContents: {
        headings: [],
        toDos: [{
          key: "send-brief",
          title: "Send brief",
          notes: "",
          headingKey: null,
          tags: [],
          checklist: [],
          schedule: { kind: "scheduled", offsetDays: 2, evening: false },
          reminder: { kind: "offset", days: 2, time: "08:30" },
          deadline: { kind: "offset", days: 4 },
          order: 0,
        }],
      },
    },
  });
  assert.equal(created.status, "changed");
  const before = workspace.read();

  const next = applyInterfaceChangeSetToWorkspace(before, {
    mutationId: "mutation-unrelated-setting",
    settings: { theme: "dark" },
  }, { now: () => NOW, createId: (kind) => `bridge-${kind}` });

  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.deepEqual(
    next.document.repeatingTemplates[0].projectContents,
    before.repeatingTemplates[0].projectContents,
  );
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

test("skipping a repeating Project uses the distinct Workspace Skip lifecycle", () => {
  const workspace = workspaceFixture();
  workspace.change({ type: "createProject", title: "Weekly reset", location: { kind: "space", spaceId: "space-personal" } });
  const projectId = workspace.read().projects[0].id;
  workspace.change({ type: "createToDo", title: "Clear desk", location: { kind: "project", projectId } });
  const toDoId = workspace.read().toDos[0].id;
  workspace.change({
    type: "makeProjectRepeating",
    id: projectId,
    firstDate: "2026-07-20",
    pattern: { frequency: "weekly", interval: 1, weekdays: [1] },
    mode: "on-schedule",
  });
  const before = workspace.read();

  const next = applyInterfaceChangeSetToWorkspace(before, {
    mutationId: "mutation-skip-project-occurrence",
    entities: {
      projects: [{ id: projectId, patch: { status: "canceled", completedAt: NOW, loggedAt: NOW } }],
      tasks: [{ id: toDoId, patch: { status: "canceled", completedAt: NOW, loggedAt: NOW } }],
    },
  }, { now: () => NOW, createId: (kind) => `bridge-${kind}` });

  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.document.projects[0].outcome, "canceled");
  assert.equal(next.document.projects[0].logbookAt, NOW);
  assert.equal(next.document.toDos[0].outcome, "canceled");
  assert.equal(next.document.toDos[0].logbookAt, NOW);
  assert.equal(next.document.projectClosures.length, 1);
  assert.deepEqual(next.document.projectClosures[0].changedToDoIds, [toDoId]);
});

test("a restored backup replaces the complete Workspace through the interface bridge", () => {
  const workspace = workspaceFixture();
  workspace.change({ type: "createProject", title: "Current project", location: { kind: "space", spaceId: "space-personal" } });
  const currentProjectId = workspace.read().projects[0].id;
  workspace.change({ type: "createToDo", title: "Current item", location: { kind: "project", projectId: currentProjectId } });
  const before = workspace.read();

  const next = applyInterfaceChangeSetToWorkspace(before, {
    mutationId: "restore-backup",
    replaceWorkspace: true,
    settings: { defaultSpaceId: "space-restored", tags: [] },
    entities: {
      spaces: [{ id: "space-restored", patch: { title: "Restored", color: "#123456", pinned: true, order: 0 } }],
      tasks: [{ id: "todo-restored", patch: {
        title: "Restored item", notes: "", status: "open", bucket: "inbox", scheduledFor: null, evening: false,
        reminderAt: null, reminderSentAt: null, deadline: null, projectId: null, headingId: null, areaId: null,
        spaceId: "space-restored", tags: [], checklist: [], repeat: null, createdAt: NOW, completedAt: null, loggedAt: null,
      } }],
    },
    deletes: { spaces: ["space-personal"], projects: [currentProjectId], tasks: [before.toDos[0].id] },
  }, { now: () => NOW, createId: (kind) => `bridge-${kind}` });

  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.deepEqual(next.document.spaces.map((item) => item.id), ["space-restored"]);
  assert.deepEqual(next.document.toDos.map((item) => item.id), ["todo-restored"]);
  assert.equal(next.document.toDos[0].title, "Restored item");
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
