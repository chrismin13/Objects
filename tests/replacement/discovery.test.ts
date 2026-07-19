import assert from "node:assert/strict";
import test from "node:test";

import type { WorkspaceDocument } from "../../shared/replacement/model.ts";
import { effectiveTagIdsForRepeatingTemplate, spaceIdForRepeatingTemplate } from "../../shared/replacement/location.ts";
import {
  directTargetUrl,
  moveQuickFindSelection,
  parseDirectTarget,
  recoverDirectTargetAfterLoad,
  resolveDirectTarget,
  searchWorkspace,
} from "../../shared/replacement/discovery.ts";
import { createEmptyWorkspace } from "../../shared/replacement/workspace.ts";

const TODAY = "2026-07-19";

function discoveryDocument(): WorkspaceDocument {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push({ id: "space-work", title: "Work", color: "#5577dd", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-work";
  document.areas.push({ id: "area-launch", title: "Launch", spaceId: "space-work", color: "#5577dd", tags: ["tag-focus"], order: 0 });
  document.projects.push({
    id: "project-site", title: "Website", notes: "Public release plan", location: { kind: "area", areaId: "area-launch" },
    schedule: { kind: "scheduled", date: TODAY, evening: false }, deadline: null, outcome: "open", trashedAt: null,
    logbookAt: null, tags: [], occurrence: null, completedAt: null, order: 0,
  });
  document.projects.push({
    id: "project-trash", title: "Discarded roadmap", notes: "Removed release plan", location: { kind: "space", spaceId: "space-work" },
    schedule: { kind: "anytime" }, deadline: null, outcome: "open", trashedAt: "2026-07-18T11:00:00.000Z",
    logbookAt: null, tags: [], occurrence: null, completedAt: null, order: 1,
  });
  document.headings.push({ id: "heading-copy", title: "Copy", location: { kind: "project", projectId: "project-site" }, archivedAt: null, order: 0 });
  document.tags.push({ id: "tag-focus", title: "Focused", order: 0 });
  document.toDos.push(
    {
      id: "todo-active", title: "Review homepage", notes: "Check the release wording", checklist: [{ id: "check-legal", title: "Ask legal", completed: false, order: 0 }],
      location: { kind: "heading", headingId: "heading-copy" }, schedule: { kind: "scheduled", date: TODAY, evening: false }, reminder: null,
      deadline: null, outcome: "open", trashedAt: null, logbookAt: null, tags: [], occurrence: null,
      createdAt: "2026-07-18T08:00:00.000Z", completedAt: null, order: 0,
    },
    {
      id: "todo-history", title: "Archive launch notes", notes: "Old release", checklist: [], location: { kind: "unfiled", spaceId: "space-work" },
      schedule: { kind: "anytime" }, reminder: null, deadline: null, outcome: "completed", trashedAt: null,
      logbookAt: "2026-07-18T10:00:00.000Z", tags: [], occurrence: null, createdAt: "2026-07-17T08:00:00.000Z",
      completedAt: "2026-07-18T09:00:00.000Z", order: 1,
    },
    {
      id: "todo-trash", title: "Discard launch draft", notes: "Unused release", checklist: [], location: { kind: "unfiled", spaceId: "space-work" },
      schedule: { kind: "anytime" }, reminder: null, deadline: null, outcome: "open", trashedAt: "2026-07-18T11:00:00.000Z",
      logbookAt: null, tags: [], occurrence: null, createdAt: "2026-07-17T08:00:00.000Z", completedAt: null, order: 2,
    },
  );
  document.repeatingTemplates.push({
    id: "template-report", itemKind: "toDo", title: "Weekly launch report", notes: "Send release numbers", tags: [], checklist: [],
    location: { kind: "heading", headingId: "heading-copy" }, pattern: { frequency: "weekly", interval: 1, weekdays: [1] },
    mode: "on-schedule", state: "active", firstDate: "2026-07-20", nextDate: "2026-07-20", reminderTime: null,
    deadlineOffsetDays: null, projectContents: null, createdAt: "2026-07-19T08:00:00.000Z",
  });
  document.repeatingTemplates.push({
    id: "template-project", itemKind: "project", title: "Monthly launch", notes: "", tags: [], checklist: [],
    location: { kind: "area", areaId: "area-launch" }, pattern: { frequency: "monthly", interval: 1, weekdays: [] },
    mode: "on-schedule", state: "active", firstDate: "2026-08-01", nextDate: "2026-08-01", reminderTime: null,
    deadlineOffsetDays: null,
    projectContents: {
      headings: [{ key: "heading-metrics", title: "Metrics packet", archived: false, order: 0 }],
      toDos: [{
        key: "todo-analytics", title: "Collect analytics", notes: "Include conversion totals", headingKey: "heading-metrics",
        tags: [], checklist: [{ title: "Export dashboard", completed: false, order: 0 }], reminder: null, deadline: null, order: 0,
      }],
    },
    createdAt: "2026-07-19T08:00:00.000Z",
  });
  return document;
}

test("Quick Find indexes navigation, organization, tags, active content, history, Trash, and Repeating Templates", () => {
  const document = discoveryDocument();
  const releaseResults = searchWorkspace(document, "release", TODAY);
  assert.deepEqual(new Set(releaseResults.map((result) => result.group)), new Set(["Organization", "Active work", "History", "Trash", "Repeating Previews", "Repeating Templates"]));
  assert.ok(searchWorkspace(document, "legal", TODAY).some((result) => result.target.kind === "toDo" && result.target.id === "todo-active"));
  assert.ok(searchWorkspace(document, "focused", TODAY).some((result) => result.group === "Tags"));
  assert.ok(searchWorkspace(document, "website", TODAY).some((result) => result.group === "Organization"));
  assert.ok(searchWorkspace(document, "today", TODAY).some((result) => result.group === "Lists & views"));
  assert.ok(searchWorkspace(document, "discarded", TODAY).some((result) => result.group === "Trash" && result.target.kind === "project"));
  assert.deepEqual(
    new Set(searchWorkspace(document, "weekly", TODAY).map((result) => result.group)),
    new Set(["Repeating Previews", "Repeating Templates"]),
  );
  assert.ok(searchWorkspace(document, "dashboard", TODAY).some((result) => result.target.kind === "repeatingTemplate" && result.target.id === "template-project"));
});

test("stale search results and inaccessible direct targets resolve to useful missing states", () => {
  const document = discoveryDocument();
  const result = searchWorkspace(document, "homepage", TODAY)[0]!;
  document.toDos = document.toDos.filter((toDo) => toDo.id !== "todo-active");
  assert.deepEqual(resolveDirectTarget(document, result.target, TODAY), {
    status: "missing",
    message: "This to-do is no longer available or you do not have access to it.",
  });
  assert.deepEqual(resolveDirectTarget(document, { kind: "project", id: "private-project" }, TODAY), {
    status: "missing",
    message: "This Project is no longer available or you do not have access to it.",
  });
  assert.equal(resolveDirectTarget(document, { kind: "project", id: "project-trash" }, TODAY).status, "resolved");
  const trashedProject = resolveDirectTarget(document, { kind: "project", id: "project-trash" }, TODAY);
  assert.deepEqual(trashedProject.status === "resolved" ? trashedProject.view : null, { kind: "trash", date: TODAY });
});

test("a direct target is recovered after the Workspace finishes loading", () => {
  const document = discoveryDocument();
  const externalSearch = "?open=toDo&id=todo-active";
  const recovered = recoverDirectTargetAfterLoad(document, externalSearch, TODAY);
  assert.deepEqual(recovered?.target, { kind: "toDo", id: "todo-active" });
  assert.equal(recovered?.resolved.status, "resolved");
  if (recovered?.resolved.status === "resolved") assert.equal(recovered.resolved.selectedToDoId, "todo-active");
});

test("Quick Find suppresses an after-completion preview while its occurrence is still open", () => {
  const document = discoveryDocument();
  const template = document.repeatingTemplates.find((item) => item.id === "template-report")!;
  template.mode = "after-completion";
  document.toDos.push({
    id: "todo-occurrence", title: template.title, notes: "", checklist: [], location: { kind: "heading", headingId: "heading-copy" },
    schedule: { kind: "scheduled", date: template.nextDate, evening: false }, reminder: null, deadline: null, outcome: "open",
    trashedAt: null, logbookAt: null, tags: [], occurrence: { templateId: template.id, scheduledDate: template.nextDate },
    createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 3,
  });
  assert.deepEqual(
    new Set(searchWorkspace(document, "weekly", TODAY).map((result) => result.group)),
    new Set(["Active work", "Repeating Templates"]),
  );
});

test("direct targets round-trip through shareable URLs and resolve every navigation target", () => {
  const document = discoveryDocument();
  const targets = [
    { kind: "view", viewKind: "today" },
    { kind: "space", id: "space-work" },
    { kind: "area", id: "area-launch" },
    { kind: "project", id: "project-site" },
    { kind: "heading", id: "heading-copy" },
    { kind: "tag", id: "tag-focus" },
    { kind: "toDo", id: "todo-active" },
    { kind: "repeatingTemplate", id: "template-report" },
  ] as const;
  for (const target of targets) {
    const url = directTargetUrl(target, "https://objects.example/app");
    assert.deepEqual(parseDirectTarget(new URL(url).search), target);
    assert.equal(resolveDirectTarget(document, target, TODAY).status, "resolved");
  }
  const template = document.repeatingTemplates.find((item) => item.id === "template-report")!;
  assert.equal(spaceIdForRepeatingTemplate(document, template), "space-work");
  assert.deepEqual(effectiveTagIdsForRepeatingTemplate(document, template), ["tag-focus"]);
  const projectTemplate = document.repeatingTemplates.find((item) => item.id === "template-project")!;
  assert.equal(spaceIdForRepeatingTemplate(document, projectTemplate), "space-work");
  assert.deepEqual(effectiveTagIdsForRepeatingTemplate(document, projectTemplate), ["tag-focus"]);
});

test("keyboard-only Quick Find movement clamps safely and supports Home and End", () => {
  assert.equal(moveQuickFindSelection(0, 3, "ArrowDown"), 1);
  assert.equal(moveQuickFindSelection(2, 3, "ArrowDown"), 2);
  assert.equal(moveQuickFindSelection(2, 3, "ArrowUp"), 1);
  assert.equal(moveQuickFindSelection(1, 3, "Home"), 0);
  assert.equal(moveQuickFindSelection(1, 3, "End"), 2);
  assert.equal(moveQuickFindSelection(1, 0, "ArrowDown"), 0);
});
