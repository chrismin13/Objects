import type { WorkspaceDocument, WorkspaceEntityKind } from "../../shared/replacement/model.ts";
import { createEmptyWorkspace, createWorkspace } from "../../shared/replacement/workspace.ts";

export const FIXTURE_NOW = "2026-07-20T09:00:00.000Z";

export function representativeWorkspace(prefix: string): WorkspaceDocument {
  let sequence = 0;
  const document = createEmptyWorkspace(FIXTURE_NOW);
  const workspace = createWorkspace(document, {
    now: () => FIXTURE_NOW,
    createId: (kind: WorkspaceEntityKind | "projectClosure" | "undo") => `${prefix}-${kind}-${++sequence}`,
  });
  const changedId = (result: ReturnType<typeof workspace.change>, kind: WorkspaceEntityKind) => {
    if (result.status !== "changed") throw new Error(result.errors.join(" "));
    const id = result.affected.find((item) => item.kind === kind)?.id;
    if (!id) throw new Error(`Fixture did not create ${kind}`);
    return id;
  };

  const personalId = changedId(workspace.change({ type: "createSpace", title: `${prefix} Personal`, color: "#e49b3c" }), "space");
  const workId = changedId(workspace.change({ type: "createSpace", title: `${prefix} Work`, color: "#2f80ed" }), "space");
  workspace.change({ type: "setDefaultSpace", spaceId: personalId });
  const tagId = changedId(workspace.change({ type: "createTag", title: `${prefix} Important` }), "tag");
  const areaId = changedId(workspace.change({ type: "createArea", title: `${prefix} Studio`, spaceId: workId, tags: [tagId] }), "area");
  const projectId = changedId(workspace.change({
    type: "createProject", title: `${prefix} Launch`, location: { kind: "area", areaId }, tags: [tagId], deadline: "2026-08-01",
  }), "project");
  const headingId = changedId(workspace.change({ type: "createHeading", title: `${prefix} Delivery`, location: { kind: "project", projectId } }), "heading");
  changedId(workspace.change({
    type: "createToDo", title: `${prefix} Nested`, location: { kind: "heading", headingId }, checklist: ["First", "Second"],
  }), "toDo");
  changedId(workspace.change({ type: "createToDo", title: `${prefix} Project child`, location: { kind: "project", projectId } }), "toDo");
  const completedId = changedId(workspace.change({ type: "createToDo", title: `${prefix} Completed`, location: { kind: "area", areaId } }), "toDo");
  workspace.change({ type: "completeToDo", id: completedId });
  const trashedId = changedId(workspace.change({ type: "createToDo", title: `${prefix} Trashed`, location: { kind: "unfiled", spaceId: personalId } }), "toDo");
  workspace.change({ type: "trashToDo", id: trashedId });
  const repeatingId = changedId(workspace.change({
    type: "createToDo", title: `${prefix} Weekly`, location: { kind: "unfiled", spaceId: personalId },
    schedule: { kind: "scheduled", date: "2026-07-27", evening: false },
  }), "toDo");
  workspace.change({
    type: "makeToDoRepeating", id: repeatingId, nextDate: "2026-07-27",
    pattern: { frequency: "weekly", interval: 1, weekdays: [1] }, mode: "on-schedule",
  });
  const repeatingProjectId = changedId(workspace.change({
    type: "createProject", title: `${prefix} Monthly project`, location: { kind: "space", spaceId: personalId },
  }), "project");
  const repeatingHeadingId = changedId(workspace.change({
    type: "createHeading", title: `${prefix} Monthly steps`, location: { kind: "project", projectId: repeatingProjectId },
  }), "heading");
  changedId(workspace.change({
    type: "createToDo", title: `${prefix} Monthly child`, location: { kind: "heading", headingId: repeatingHeadingId }, checklist: ["Prepare"],
  }), "toDo");
  workspace.change({
    type: "makeProjectRepeating", id: repeatingProjectId, firstDate: "2026-08-01",
    pattern: { frequency: "monthly", interval: 1, weekdays: [] }, mode: "on-schedule",
  });
  workspace.change({
    type: "createCalendarEvent", title: `${prefix} Review`, spaceId: workId,
    start: "2026-07-21T10:00:00.000Z", end: "2026-07-21T11:00:00.000Z",
  });
  workspace.change({ type: "setTheme", theme: prefix === "backup" ? "dark" : "light" });
  workspace.change({ type: "setShowCalendar", show: prefix === "backup" });
  return workspace.read();
}
