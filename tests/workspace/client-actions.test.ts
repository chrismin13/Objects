import assert from "node:assert/strict";
import { test } from "vite-plus/test";

import { reorderTasks } from "../../client/app/actions.ts";
import {
  applyInterfaceChangeSetToWorkspace,
  workspaceDocumentToInterfaceState,
  type InterfaceState,
} from "../../shared/workspace/interface-bridge.ts";
import { createInterfaceChangeSet } from "../../client/app/change-set.ts";
import { createEmptyWorkspace, createWorkspace } from "../../shared/workspace/workspace.ts";
import type { WorkspaceChangeResult, WorkspaceEntityKind } from "../../shared/workspace/model.ts";

const NOW = "2026-07-20T09:00:00.000Z";
const TODAY = NOW.slice(0, 10);

function fixture() {
  let sequence = 0;
  const document = createEmptyWorkspace(NOW);
  const workspace = createWorkspace(document, {
    now: () => NOW,
    createId: (kind: string) => `${kind}-${++sequence}`,
  });
  const created = (result: WorkspaceChangeResult, kind: WorkspaceEntityKind) => {
    if (result.status !== "changed") throw new Error(result.errors.join(" "));
    const id = result.affected.find((item) => item.kind === kind)?.id;
    if (!id) throw new Error(`fixture did not create ${kind}`);
    return id;
  };

  const spaceA = created(
    workspace.change({ type: "createSpace", title: "Personal", color: "#e49b3c" }),
    "space",
  );
  const spaceB = created(
    workspace.change({ type: "createSpace", title: "Work", color: "#2f80ed" }),
    "space",
  );
  const areaB = created(
    workspace.change({ type: "createArea", title: "Studio", spaceId: spaceB }),
    "area",
  );
  // Project A lives directly in a Space (no area); project B lives in an area.
  const projectA = created(
    workspace.change({
      type: "createProject",
      title: "Alpha",
      location: { kind: "space", spaceId: spaceA },
    }),
    "project",
  );
  const projectB = created(
    workspace.change({
      type: "createProject",
      title: "Beta",
      location: { kind: "area", areaId: areaB },
    }),
    "project",
  );
  const headingA = created(
    workspace.change({
      type: "createHeading",
      title: "Head A",
      location: { kind: "project", projectId: projectA },
    }),
    "heading",
  );
  const headingB = created(
    workspace.change({
      type: "createHeading",
      title: "Head B",
      location: { kind: "project", projectId: projectB },
    }),
    "heading",
  );
  const todoInHeading = created(
    workspace.change({
      type: "createToDo",
      title: "In heading",
      location: { kind: "heading", headingId: headingA },
      schedule: { kind: "scheduled", date: TODAY, evening: false },
    }),
    "toDo",
  );
  const todoInProjectB = created(
    workspace.change({
      type: "createToDo",
      title: "In Beta",
      location: { kind: "project", projectId: projectB },
      schedule: { kind: "scheduled", date: TODAY, evening: false },
    }),
    "toDo",
  );
  const populated = workspace.read();
  return {
    document: populated,
    deps: { now: () => NOW, createId: (kind: string) => `${kind}-${++sequence}` },
    projectA,
    projectB,
    areaB,
    spaceA,
    spaceB,
    headingA,
    headingB,
    todoInHeading,
    todoInProjectB,
  };
}

function cloneState(state: InterfaceState): InterfaceState {
  return structuredClone(state);
}

test("reorderTasks reparents a to-do across projects and clears the old heading", () => {
  const { document, projectA, projectB, areaB, spaceA, spaceB, headingA, todoInHeading } =
    fixture();
  const before = workspaceDocumentToInterfaceState(document, TODAY);
  const current = cloneState(before);
  const task = current.tasks.find((item) => item.id === todoInHeading)!;
  assert.equal(task.projectId, projectA);
  assert.equal(task.headingId, headingA);
  assert.equal(task.areaId, null);
  assert.equal(task.spaceId, spaceA);

  // Simulates a cross-project drag in grouped Today onto project B's group.
  reorderTasks(current, [todoInHeading], [todoInHeading], {
    projectId: projectB,
    areaId: areaB,
    spaceId: spaceB,
    headingId: null,
    bucket: "today",
    scheduledFor: TODAY,
    evening: false,
  });

  const after = current.tasks.find((item) => item.id === todoInHeading)!;
  assert.equal(after.projectId, projectB);
  assert.equal(after.areaId, areaB);
  assert.equal(after.spaceId, spaceB);
  assert.equal(after.headingId, null, "old heading is cleared on reparent");
  assert.equal(after.bucket, "today");
  assert.equal(after.scheduledFor, TODAY);
  assert.equal(after.evening, false);
});

test("reorderTasks with only headingId keeps the project, area, and space intact", () => {
  const { document, projectB, areaB, spaceB, headingB, todoInProjectB } = fixture();
  const before = workspaceDocumentToInterfaceState(document, TODAY);
  const current = cloneState(before);
  const task = current.tasks.find((item) => item.id === todoInProjectB)!;
  assert.equal(task.projectId, projectB);
  assert.equal(task.headingId, null);
  assert.equal(task.areaId, areaB);
  assert.equal(task.spaceId, spaceB);

  // Simulates a same-project heading drag in a Project/Area view.
  reorderTasks(current, [todoInProjectB], [todoInProjectB], { headingId: headingB });

  const after = current.tasks.find((item) => item.id === todoInProjectB)!;
  assert.equal(after.headingId, headingB);
  assert.equal(after.projectId, projectB, "project is untouched by a heading-only move");
  assert.equal(after.areaId, areaB);
  assert.equal(after.spaceId, spaceB);
});

test("reorderTasks reparent keeps an explicitly named destination heading", () => {
  const { document, projectA, projectB, areaB, spaceB, headingA, headingB, todoInHeading } =
    fixture();
  const before = workspaceDocumentToInterfaceState(document, TODAY);
  const current = cloneState(before);
  const task = current.tasks.find((item) => item.id === todoInHeading)!;
  assert.equal(task.projectId, projectA);
  assert.equal(task.headingId, headingA);

  // Reparent to project B AND explicitly into heading B (not the default clear).
  reorderTasks(current, [todoInHeading], [todoInHeading], {
    projectId: projectB,
    areaId: areaB,
    spaceId: spaceB,
    headingId: headingB,
  });

  const after = current.tasks.find((item) => item.id === todoInHeading)!;
  assert.equal(after.projectId, projectB);
  assert.equal(after.areaId, areaB);
  assert.equal(after.spaceId, spaceB);
  assert.equal(after.headingId, headingB, "explicit destination heading is preserved");
});

test("a cross-project reparent round-trips to a domain updateToDo Location change", () => {
  const { document, projectB, areaB, spaceB, todoInHeading, deps } = fixture();
  const before = workspaceDocumentToInterfaceState(document, TODAY);
  const current = cloneState(before);
  reorderTasks(current, [todoInHeading], [todoInHeading], {
    projectId: projectB,
    areaId: areaB,
    spaceId: spaceB,
    headingId: null,
  });

  const changes = createInterfaceChangeSet({ previous: before, current, mutationId: "m1" });
  assert.ok(changes, "the reparent produces a change set");

  const result = applyInterfaceChangeSetToWorkspace(document, changes!, deps);
  assert.equal(
    result.ok,
    true,
    result.ok ? "" : `bridge rejected the reparent: ${result.errors.join("; ")}`,
  );

  if (!result.ok) throw new Error("unreachable");
  const domainToDo = result.document.toDos.find((item) => item.id === todoInHeading)!;
  assert.deepEqual(domainToDo.location, { kind: "project", projectId: projectB });
});
