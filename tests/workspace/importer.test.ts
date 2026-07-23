import assert from "node:assert/strict";
import test from "node:test";

import { assembleLegacyWorkspace, mergeMigratedLegacySnapshot } from "../../shared/workspace/legacy-storage.ts";
import { createEmptyWorkspace, createWorkspace, exportPortableBackup, FULL_IMPORT_CONFIRMATION } from "../../shared/workspace/workspace.ts";

function deterministicWorkspace() {
  const counters = new Map<string, number>();
  return createWorkspace(createEmptyWorkspace("2026-07-19T08:00:00.000Z"), {
    now: () => "2026-07-19T09:00:00.000Z",
    createId: (kind) => {
      const next = (counters.get(kind) ?? 0) + 1;
      counters.set(kind, next);
      return `${kind}-${next}`;
    },
  });
}

test("a current portable backup round trip preserves all supported Workspace data and relationships", () => {
  const source = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  source.spaces.push({ id: "space-work", title: "Work", color: "#5577dd", pinned: true, order: 0 });
  source.settings.defaultSpaceId = "space-work";
  source.settings.theme = "dark";
  source.settings.launchRules.push({ id: "rule-work", spaceId: "space-work", weekdays: [1, 2, 3, 4, 5], start: "09:00", end: "17:30", order: 0 });
  source.tags.push({ id: "tag-focus", title: "Focus", order: 0 });
  source.toDos.push({
    id: "todo-review", title: "Review", notes: "Keep the history", checklist: [],
    location: { kind: "unfiled", spaceId: "space-work" }, schedule: { kind: "scheduled", date: "2026-07-20", evening: false },
    reminder: { at: "2026-07-20T08:30:00.000Z", sentAt: null }, deadline: "2026-07-21", outcome: "completed",
    trashedAt: "2026-07-21T12:00:00.000Z", logbookAt: "2026-07-20T12:00:00.000Z", tags: ["tag-focus"], occurrence: null,
    createdAt: "2026-07-19T08:00:00.000Z", completedAt: "2026-07-20T11:00:00.000Z", order: 0,
  });
  source.permanentDeletions.push({ entityKind: "toDo", entityId: "todo-deleted", deletedAt: "2026-07-18T08:00:00.000Z" });

  const target = deterministicWorkspace();
  const result = target.importPortableBackup(exportPortableBackup(source), FULL_IMPORT_CONFIRMATION);

  assert.equal(result.status, "changed");
  const imported = target.read();
  assert.deepEqual({ ...imported, sync: source.sync }, source);
});

test("full import requires exact confirmation and malformed JSON leaves the Workspace unchanged", () => {
  const workspace = deterministicWorkspace();
  const before = workspace.read();

  const unconfirmed = workspace.importPortableBackup("{}", "replace");
  assert.equal(unconfirmed.status, "rejected");
  assert.equal(unconfirmed.outcome, "confirmation-required");
  assert.deepEqual(workspace.read(), before);

  const malformed = workspace.importPortableBackup("{broken", FULL_IMPORT_CONFIRMATION);
  assert.equal(malformed.status, "rejected");
  assert.equal(malformed.outcome, "import-rejected");
  assert.equal(malformed.report.rejected, 1);
  assert.deepEqual(workspace.read(), before);
});

test("a structurally malformed current backup is rejected without throwing or replacing data", () => {
  const workspace = deterministicWorkspace();
  const before = workspace.read();
  const malformedCurrent = JSON.stringify({
    format: "objects-workspace",
    version: 1,
    settings: {},
    spaces: [], areas: [], projects: [], headings: [], tags: [], toDos: [{}], repeatingTemplates: [],
    projectClosures: [], calendarEvents: [], permanentDeletions: [], captureReceipts: [],
  });

  const result = workspace.importPortableBackup(malformedCurrent, FULL_IMPORT_CONFIRMATION);

  assert.equal(result.status, "rejected");
  assert.deepEqual(workspace.read(), before);
});

test("a current backup with invalid settings and entity enums is rejected atomically", () => {
  const workspace = deterministicWorkspace();
  const before = workspace.read();
  const malformed = createEmptyWorkspace("2026-07-19T08:00:00.000Z") as unknown as Record<string, unknown>;
  const settings = malformed.settings as Record<string, unknown>;
  settings.theme = "purple";
  settings.weekStartsOn = 9;
  settings.groupToday = "yes";
  malformed.toDos = [{
    id: "todo-bad", title: "Bad", notes: "", checklist: [],
    location: { kind: "unfiled", spaceId: "space-1" }, schedule: { kind: "later" },
    reminder: null, deadline: null, outcome: "maybe", trashedAt: null, logbookAt: null,
    tags: [], occurrence: null, createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 0,
  }];
  (malformed.spaces as unknown[]).push({ id: "space-1", title: "Personal", color: "#000000", pinned: true, order: 0 });
  settings.defaultSpaceId = "space-1";

  const result = workspace.importPortableBackup(JSON.stringify(malformed), FULL_IMPORT_CONFIRMATION);

  assert.equal(result.status, "rejected");
  assert.ok(result.errors.some((error) => error.includes("appearance")));
  assert.ok(result.errors.some((error) => error.includes("weekday")));
  assert.ok(result.errors.some((error) => error.includes("Outcome")));
  assert.deepEqual(workspace.read(), before);
});

test("a representative current backup imports with corrections and a clear report", () => {
  const workspace = deterministicWorkspace();
  const backup = {
    version: 7,
    updatedAt: "2026-07-18T12:00:00.000Z",
    settings: {
      theme: "dark",
      groupToday: false,
      notifications: true,
      weekStartsOn: 0,
      showCalendar: false,
      logCompletedItems: "manually",
      tags: ["Focused"],
      defaultSpaceId: "missing-space",
      spaceSchedule: { rules: [] },
      quickDraft: { value: "Unfinished capture", updatedAt: "2026-07-18T12:30:00.000Z", viewType: "inbox", viewId: null },
    },
    spaces: [],
    areas: [{ id: "area-work", spaceId: null, title: "Work", color: "#123456", tags: ["Focused"], order: 0 }],
    projects: [{
      id: "project-launch", spaceId: "copied-space", areaId: "area-work", title: "Launch", notes: "",
      bucket: "today", scheduledFor: "2026-07-19", deadline: "2026-07-25", tags: ["Focused"],
      status: "done", repeat: null, completedAt: "2026-07-18T10:00:00.000Z", order: 0,
    }],
    headings: [{ id: "heading-polish", projectId: "project-launch", areaId: "area-work", title: "Polish", archived: false, order: 0 }],
    calendarEvents: [{ id: "event-sync", spaceId: "missing-space", title: "Sync", start: "2026-07-19T11:00:00", end: "2026-07-19T11:30:00", calendar: "Work" }],
    tasks: [
      {
        id: "task-review", spaceId: "copied-space", areaId: "area-work", projectId: "project-launch", headingId: "heading-polish",
        title: "Review", notes: "Notes", status: "trashed", previousStatus: "completed", bucket: "today",
        scheduledFor: "2026-07-19", evening: true, reminderAt: "2026-07-19T08:00:00", deadline: "2026-07-20",
        tags: ["Focused"], checklist: [{ id: "check-1", title: "Read", done: true }],
        repeat: { mode: "fixed", frequency: "weekly", interval: 1, weekdays: [1, 5], nextDate: "2026-07-26", reminderTime: "08:00", deadlineOffset: 2, paused: false },
        createdAt: "2026-07-01T08:00:00.000Z", completedAt: "2026-07-18T10:00:00.000Z", trashedAt: "2026-07-18T11:00:00.000Z", order: 0,
      },
      {
        id: "task-review-copy", spaceId: "copied-space", areaId: "area-work", projectId: "project-launch", headingId: "heading-polish",
        title: "Review copy", notes: "", status: "open", bucket: "upcoming", scheduledFor: "2026-07-26", evening: false,
        reminderAt: null, deadline: null, tags: ["Focused"], checklist: [], repeat: null, repeatTemplateId: "task-review",
        createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 1,
      },
      { id: "broken", status: "open" },
    ],
  };

  const result = workspace.importPortableBackup(JSON.stringify(backup), FULL_IMPORT_CONFIRMATION);

  assert.equal(result.status, "changed");
  assert.equal(result.outcome, "backup-imported");
  assert.deepEqual(result.report.imported, {
    spaces: 1, areas: 1, projects: 1, headings: 1, tags: 1, toDos: 2,
    repeatingTemplates: 1, calendarEvents: 1,
  });
  assert.ok(result.report.corrected >= 5);
  assert.equal(result.report.skipped, 1);
  assert.equal(result.report.rejected, 0);

  const imported = workspace.read();
  assert.equal(imported.settings.theme, "dark");
  assert.equal(imported.settings.defaultSpaceId, "space-1");
  assert.deepEqual(imported.settings.quickDraft, {
    value: "Unfinished capture", updatedAt: "2026-07-18T12:30:00.000Z", viewType: "inbox", viewId: null,
  });
  assert.deepEqual(imported.projects[0].location, { kind: "area", areaId: "area-work" });
  assert.equal(imported.projects[0].outcome, "completed");
  assert.deepEqual(imported.toDos[0].location, { kind: "heading", headingId: "heading-polish" });
  assert.equal(imported.toDos[0].outcome, "completed");
  assert.equal(imported.toDos[0].trashedAt, "2026-07-18T11:00:00.000Z");
  assert.deepEqual(imported.toDos[0].schedule, { kind: "scheduled", date: "2026-07-19", evening: true });
  assert.equal(imported.toDos[0].occurrence?.templateId, imported.repeatingTemplates[0].id);
  assert.equal(imported.toDos[1].occurrence?.templateId, imported.repeatingTemplates[0].id);
  assert.equal(imported.toDos[1].occurrence?.scheduledDate, "2026-07-26");
  assert.equal(imported.repeatingTemplates[0].mode, "on-schedule");
  assert.deepEqual(imported.repeatingTemplates[0].pattern.weekdays, [1, 5]);
  assert.deepEqual(workspace.validate(), []);
});

test("retained normalized rows reassemble into the same portable legacy import", () => {
  const serialized = assembleLegacyWorkspace({
    version: "7",
    updatedAt: "2026-07-18T12:00:00.000Z",
    mutationId: "legacy-save-1",
    settingsData: JSON.stringify({ theme: "light", tags: ["Focused"], defaultSpaceId: "space-work", spaceSchedule: { rules: [] } }),
    spaces: [{ entityId: "space-work", data: JSON.stringify({ title: "Work", color: "#5577dd", pinned: true, order: 0 }) }],
    areas: [{ entityId: "area-client", data: JSON.stringify({ title: "Client", spaceId: "space-work", color: "#448866", tags: ["Focused"], order: 0 }) }],
    projects: [{ entityId: "project-launch", data: JSON.stringify({ title: "Launch", areaId: "area-client", spaceId: "space-work", status: "open", bucket: "anytime", tags: [], order: 0 }) }],
    headings: [{ entityId: "heading-final", data: JSON.stringify({ title: "Final", projectId: "project-launch", order: 0 }) }],
    calendarEvents: [],
    tasks: [{ entityId: "todo-review", data: JSON.stringify({ title: "Review", headingId: "heading-final", projectId: "project-launch", areaId: "area-client", spaceId: "space-work", status: "open", bucket: "today", scheduledFor: "2026-07-20", tags: ["Focused"], order: 0 }) }],
    checklistItems: [{ entityId: "check-copy", taskId: "todo-review", position: "000000", data: JSON.stringify({ title: "Read copy", done: true }) }],
  });

  const raw = JSON.parse(serialized);
  assert.equal(raw.tasks[0].id, "todo-review");
  assert.deepEqual(raw.tasks[0].checklist, [{ id: "check-copy", title: "Read copy", done: true }]);

  const workspace = deterministicWorkspace();
  const result = workspace.importPortableBackup(serialized, FULL_IMPORT_CONFIRMATION);
  assert.equal(result.status, "changed");
  assert.deepEqual(result.report.imported, {
    spaces: 1, areas: 1, projects: 1, headings: 1, tags: 1, toDos: 1,
    repeatingTemplates: 0, calendarEvents: 0,
  });
  assert.deepEqual(workspace.read().toDos[0].location, { kind: "heading", headingId: "heading-final" });
  assert.equal(workspace.read().toDos[0].checklist[0].title, "Read copy");
});

test("retained data merges into an existing replacement snapshot exactly once", () => {
  const legacy = createEmptyWorkspace("2026-07-18T12:00:00.000Z");
  legacy.settings.theme = "dark";
  legacy.spaces.push({ id: "space-legacy", title: "Legacy", color: "#5577dd", pinned: true, order: 0 });
  legacy.settings.defaultSpaceId = "space-legacy";
  legacy.toDos.push({
    id: "todo-legacy", title: "Retained work", notes: "", checklist: [],
    location: { kind: "unfiled", spaceId: "space-legacy" }, schedule: { kind: "inbox" },
    reminder: null, deadline: null, outcome: "open", trashedAt: null, logbookAt: null,
    tags: [], occurrence: null, createdAt: "2026-07-18T12:00:00.000Z", completedAt: null, order: 0,
  });
  const current = createEmptyWorkspace("2026-07-19T21:00:00.000Z");
  current.spaces.push({ id: "space-new", title: "New", color: "#e49b3c", pinned: true, order: 0 });
  current.settings.defaultSpaceId = "space-new";
  current.toDos.push({
    id: "todo-new", title: "Replacement-only work", notes: "", checklist: [],
    location: { kind: "unfiled", spaceId: "space-new" },
    schedule: { kind: "scheduled", date: "2026-07-20", evening: false },
    reminder: null, deadline: null, outcome: "open", trashedAt: null, logbookAt: null,
    tags: [], occurrence: null, createdAt: "2026-07-19T21:00:00.000Z", completedAt: null, order: 0,
  });
  const source = { updatedAt: "2026-07-19T11:55:16.000Z", mutationId: "legacy-final-save" };

  const merged = mergeMigratedLegacySnapshot(
    { revision: 8, document: current },
    { revision: 0, document: legacy },
    source,
  );
  const repeated = mergeMigratedLegacySnapshot(merged, { revision: 0, document: legacy }, source);

  assert.equal(merged.revision, 8);
  assert.deepEqual(merged.document.toDos.map((toDo) => toDo.title).sort(), ["Replacement-only work", "Retained work"]);
  assert.deepEqual(merged.document.spaces.map((space) => space.id).sort(), ["space-legacy", "space-new"]);
  assert.equal(merged.document.settings.theme, "dark");
  assert.equal(merged.document.settings.defaultSpaceId, "space-legacy");
  assert.deepEqual(merged.document.sync.legacyMigration, source);
  assert.deepEqual(repeated, merged);
});

test("legacy repetition keeps one meaningful Outcome for a duplicated Template date", () => {
  const workspace = deterministicWorkspace();
  const backup = {
    version: 7,
    updatedAt: "2026-07-19T12:00:00.000Z",
    settings: { theme: "system", tags: [], defaultSpaceId: "space-home", spaceSchedule: { rules: [] } },
    spaces: [{ id: "space-home", title: "Home", color: "#e49b3c", pinned: true, order: 0 }],
    areas: [], projects: [], headings: [], calendarEvents: [],
    tasks: [
      {
        id: "todo-repeat", title: "Water plants", status: "open", bucket: "upcoming", scheduledFor: "2026-07-15",
        spaceId: "space-home", tags: [], checklist: [], createdAt: "2026-07-15T08:00:00.000Z", order: 0,
        repeat: { mode: "fixed", frequency: "daily", interval: 1, nextDate: "2026-07-20" },
      },
      {
        id: "todo-completed", title: "Water plants", status: "completed", bucket: "upcoming", scheduledFor: "2026-07-15",
        spaceId: "space-home", tags: [], checklist: [], createdAt: "2026-07-15T09:00:00.000Z",
        completedAt: "2026-07-15T10:00:00.000Z", loggedAt: "2026-07-15T11:00:00.000Z", order: 1,
        repeat: null, repeatTemplateId: "todo-repeat",
      },
    ],
  };

  const result = workspace.importPortableBackup(JSON.stringify(backup), FULL_IMPORT_CONFIRMATION);

  assert.equal(result.status, "changed");
  assert.equal(workspace.read().toDos.length, 1);
  assert.equal(workspace.read().toDos[0].id, "todo-completed");
  assert.equal(workspace.read().toDos[0].outcome, "completed");
  assert.ok(result.report.messages.some((message) => message.message.includes("duplicate Repeating occurrence")));
});

test("nested invalid dates and times reject the full import without replacing existing data", () => {
  const workspace = deterministicWorkspace();
  const before = workspace.read();
  const backup = {
    version: 7,
    settings: {
      theme: "system", tags: [], defaultSpaceId: "space-1",
      spaceSchedule: { rules: [{ id: "rule-1", spaceId: "space-1", weekdays: [1], start: "29:00", end: "17:00", order: 0 }] },
    },
    spaces: [{ id: "space-1", title: "Personal", color: "#000000", pinned: true, order: 0 }],
    areas: [], projects: [], headings: [], calendarEvents: [],
    tasks: [{
      id: "todo-1", title: "Bad date", status: "open", bucket: "upcoming", scheduledFor: "not-a-date",
      spaceId: "space-1", tags: [], checklist: [], repeat: null, createdAt: "also-not-a-date", order: 0,
    }],
  };

  const result = workspace.importPortableBackup(JSON.stringify(backup), FULL_IMPORT_CONFIRMATION);

  assert.equal(result.status, "rejected");
  assert.equal(result.outcome, "import-rejected");
  assert.ok(result.report.rejected >= 3);
  assert.deepEqual(workspace.read(), before);
});

test("a repeating Project import keeps a reusable Heading and to-do blueprint", () => {
  const workspace = deterministicWorkspace();
  const backup = {
    version: 7,
    settings: { theme: "system", tags: ["Home"], defaultSpaceId: "space-home", spaceSchedule: { rules: [] } },
    spaces: [{ id: "space-home", title: "Home", color: "#000000", pinned: true, order: 0 }],
    areas: [],
    projects: [{
      id: "project-clean", spaceId: "space-home", areaId: null, title: "Clean house", notes: "", status: "open",
      bucket: "upcoming", scheduledFor: "2026-07-20", deadline: null, tags: ["Home"], completedAt: null, order: 0,
      repeat: { mode: "fixed", frequency: "weekly", interval: 1, weekdays: [1], nextDate: "2026-07-27" },
    }],
    headings: [{ id: "heading-kitchen", projectId: "project-clean", title: "Kitchen", archived: true, order: 0 }],
    calendarEvents: [],
    tasks: [{
      id: "todo-counters", title: "Wipe counters", notes: "", status: "open", bucket: "anytime", scheduledFor: null,
      spaceId: "space-home", projectId: "project-clean", headingId: "heading-kitchen", areaId: null,
      reminderAt: "2026-07-20T08:30:00.000Z", deadline: "2026-07-21",
      tags: ["Home"], checklist: [{ id: "check-spray", title: "Use spray", done: false }], repeat: null,
      createdAt: "2026-07-19T08:00:00.000Z", completedAt: null, order: 0,
    }],
  };

  const result = workspace.importPortableBackup(JSON.stringify(backup), FULL_IMPORT_CONFIRMATION);
  assert.equal(result.status, "changed");
  const template = workspace.read().repeatingTemplates[0];
  assert.equal(template.itemKind, "project");
  assert.deepEqual(template.projectContents, {
    headings: [{ key: "heading-kitchen", title: "Kitchen", archived: true, order: 0 }],
    toDos: [{
      key: "todo-counters", title: "Wipe counters", notes: "", headingKey: "heading-kitchen",
      tags: [workspace.read().tags[0].id], checklist: [{ title: "Use spray", completed: false, order: 0 }],
      schedule: { kind: "anytime" },
      reminder: { kind: "offset", days: 0, time: "08:30" },
      deadline: { kind: "fixed", date: "2026-07-21" }, order: 0,
    }],
  });
});
