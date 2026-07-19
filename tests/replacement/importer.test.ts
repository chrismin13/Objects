import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyWorkspace, createWorkspace, FULL_IMPORT_CONFIRMATION } from "../../shared/replacement/workspace.ts";

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
      reminder: { kind: "fixed", at: "2026-07-20T08:30:00.000Z" },
      deadline: { kind: "fixed", date: "2026-07-21" }, order: 0,
    }],
  });
});
