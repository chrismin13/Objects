import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyWorkspace, createWorkspace } from "../../shared/replacement/workspace.ts";
import { resolveAppearance, selectLaunchSpace, shouldRememberManualSpace } from "../../shared/replacement/settings.ts";
import { captureInputFromRecord, captureInputFromUrl } from "../../shared/replacement/capture.ts";
import { createInMemorySyncStore } from "../../shared/replacement/sync.ts";
import { dateInTimeZone } from "../../shared/replacement/dates.ts";
import { captureIntoSnapshot } from "../../shared/replacement/http-capture.ts";

function settingsDocument() {
  const document = createEmptyWorkspace("2026-07-19T08:00:00.000Z");
  document.spaces.push(
    { id: "space-personal", title: "Personal", color: "#e49b3c", pinned: true, order: 0 },
    { id: "space-work", title: "Work", color: "#5b7cfa", pinned: true, order: 1 },
  );
  document.settings.defaultSpaceId = "space-personal";
  document.settings.launchRules.push({
    id: "rule-work", spaceId: "space-work", weekdays: [1, 2, 3, 4, 5], start: "09:00", end: "17:30", order: 0,
  });
  return document;
}

test("system appearance follows device changes while explicit modes stay fixed", () => {
  assert.equal(resolveAppearance("system", false), "light");
  assert.equal(resolveAppearance("system", true), "dark");
  assert.equal(resolveAppearance("light", true), "light");
  assert.equal(resolveAppearance("dark", false), "dark");
});

test("device launch preferences choose a matching rule or remember a manual Space", () => {
  const document = settingsDocument();

  assert.equal(selectLaunchSpace(document, { launchRulesEnabled: true, manualSpaceId: "space-personal" }, new Date("2026-07-20T10:00:00")), "space-work");
  assert.equal(selectLaunchSpace(document, { launchRulesEnabled: false, manualSpaceId: "space-work" }, new Date("2026-07-20T10:00:00")), "space-work");
  assert.equal(selectLaunchSpace(document, { launchRulesEnabled: true, manualSpaceId: "space-work" }, new Date("2026-07-19T10:00:00")), "space-personal");
  assert.equal(selectLaunchSpace(document, { launchRulesEnabled: false, manualSpaceId: "missing" }, new Date("2026-07-20T10:00:00")), "space-personal");
});

test("only an explicit Space choice replaces the device's remembered manual Space", () => {
  assert.equal(shouldRememberManualSpace("space", true), true);
  assert.equal(shouldRememberManualSpace("today", true), false);
  assert.equal(shouldRememberManualSpace("view", true), false);
  assert.equal(shouldRememberManualSpace("space", false), false);
});

test("overnight launch rules use the previous weekday after midnight", () => {
  const document = settingsDocument();
  document.settings.launchRules = [{ id: "night", spaceId: "space-work", weekdays: [1], start: "22:00", end: "02:00", order: 0 }];

  assert.equal(selectLaunchSpace(document, { launchRulesEnabled: true, manualSpaceId: null }, new Date("2026-07-21T01:00:00")), "space-work");
});

test("HTTP-style capture can resolve relative dates in the caller's time zone", () => {
  const instant = new Date("2026-07-19T22:30:00.000Z");
  const athensToday = dateInTimeZone(instant, "Europe/Athens");
  const parsed = captureInputFromRecord(settingsDocument(), { title: "Tomorrow there", when: "tomorrow", submissionId: "zone-1" }, athensToday);

  assert.equal(athensToday, "2026-07-20");
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.input.schedule, { kind: "scheduled", date: "2026-07-21", evening: false });
});

test("Application and Space settings persist through validated Workspace changes", () => {
  const workspace = createWorkspace(settingsDocument(), {
    now: () => "2026-07-19T09:00:00.000Z",
    createId: (kind) => `${kind}-fixed`,
  });

  assert.equal(workspace.change({
    type: "updateSettings",
    changes: { theme: "dark", groupToday: false, notifications: true, weekStartsOn: 0, showCalendar: false },
  }).status, "changed");
  assert.equal(workspace.change({ type: "setDefaultSpace", spaceId: "space-work" }).status, "changed");
  assert.equal(workspace.change({
    type: "replaceLaunchRules",
    rules: [{ id: "rule-night", spaceId: "space-personal", weekdays: [5, 6], start: "20:00", end: "01:00", order: 0 }],
  }).status, "changed");

  assert.deepEqual(workspace.read().settings, {
    theme: "dark",
    groupToday: false,
    notifications: true,
    weekStartsOn: 0,
    showCalendar: false,
    logCompletedItems: "daily",
    defaultSpaceId: "space-work",
    launchRules: [{ id: "rule-night", spaceId: "space-personal", weekdays: [5, 6], start: "20:00", end: "01:00", order: 0 }],
    quickDraft: null,
  });
});

test("invalid Space settings are rejected without changing the Workspace", () => {
  const workspace = createWorkspace(settingsDocument(), {
    now: () => "2026-07-19T09:00:00.000Z",
    createId: (kind) => `${kind}-fixed`,
  });
  const before = workspace.read();

  assert.equal(workspace.change({ type: "setDefaultSpace", spaceId: "missing" }).status, "rejected");
  assert.equal(workspace.change({
    type: "replaceLaunchRules",
    rules: [{ id: "bad", spaceId: "space-work", weekdays: [9], start: "29:00", end: "17:00", order: 0 }],
  }).status, "rejected");
  assert.deepEqual(workspace.read(), before);
});

test("capture links keep shared text, URLs, Location, Tags, Schedule, Reminder, and Deadline", () => {
  const document = settingsDocument();
  document.areas.push({ id: "area-work", title: "Work", spaceId: "space-work", color: "#5577dd", tags: [], order: 0 });
  const workspace = createWorkspace(document, {
    now: () => "2026-07-19T09:00:00.000Z",
    createId: (() => { let next = 0; return (kind: string) => `${kind}-${++next}`; })(),
  });
  const parsed = captureInputFromUrl(
    workspace.read(),
    "?capture=1&title=Read%20this&text=Shared%20context&url=https%3A%2F%2Fexample.com%2Farticle&area=area-work&tags=Research%2CDeep%20work&when=tomorrow&reminder=2026-07-20T08%3A30%3A00.000Z&deadline=2026-07-21&submission=share-123",
    "2026-07-19",
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const result = workspace.change({ type: "captureToDo", capture: parsed.input });

  assert.equal(result.status, "changed");
  const toDo = workspace.read().toDos[0];
  assert.equal(toDo.title, "Read this");
  assert.equal(toDo.notes, "Shared context\n\nhttps://example.com/article");
  assert.deepEqual(toDo.location, { kind: "area", areaId: "area-work" });
  assert.deepEqual(toDo.schedule, { kind: "scheduled", date: "2026-07-20", evening: false });
  assert.deepEqual(toDo.reminder, { at: "2026-07-20T08:30:00.000Z", sentAt: null });
  assert.equal(toDo.deadline, "2026-07-21");
  assert.deepEqual(toDo.tags.map((id) => workspace.read().tags.find((tag) => tag.id === id)?.title), ["Research", "Deep work"]);
});

test("capture retries reuse a submission receipt instead of creating a duplicate", () => {
  const workspace = createWorkspace(settingsDocument(), {
    now: () => "2026-07-19T09:00:00.000Z",
    createId: (() => { let next = 0; return (kind: string) => `${kind}-${++next}`; })(),
  });
  const parsed = captureInputFromRecord(workspace.read(), { title: "Inbox item", submissionId: "request-42" }, "2026-07-19");
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const first = workspace.change({ type: "captureToDo", capture: parsed.input });
  const retry = workspace.change({ type: "captureToDo", capture: parsed.input });

  assert.equal(first.status, "changed");
  assert.equal(retry.status, "changed");
  assert.equal(retry.outcome, "capture-reused");
  assert.equal(workspace.read().toDos.length, 1);
  assert.equal(workspace.read().captureReceipts[0].toDoId, workspace.read().toDos[0].id);
});

test("the HTTP capture seam uses Workspace validation and returns the saved item on a retry", () => {
  let nextId = 0;
  const dependencies = {
    now: "2026-07-19T09:00:00.000Z",
    today: "2026-07-19",
    createId: (kind: string) => `${kind}-${++nextId}`,
  };
  const first = captureIntoSnapshot(null, settingsDocument(), {
    title: "Endpoint item", submissionId: "http-42", spaceId: "space-work", when: "tomorrow",
  }, dependencies);

  assert.equal(first.status, "created");
  if (first.status !== "created" || !first.next) return;
  assert.deepEqual(first.toDo?.schedule, { kind: "scheduled", date: "2026-07-20", evening: false });
  assert.deepEqual(first.toDo?.location, { kind: "unfiled", spaceId: "space-work" });

  const retry = captureIntoSnapshot(first.next, first.next.document, {
    title: "Endpoint item", submissionId: "http-42", spaceId: "space-work", when: "tomorrow",
  }, dependencies);
  assert.equal(retry.status, "duplicate");
  if (retry.status === "duplicate") assert.equal(retry.toDo?.id, first.toDo?.id);

  const foreignLocation = captureIntoSnapshot(first.next, first.next.document, {
    title: "Wrong owner", submissionId: "http-43", areaId: "another-account-area",
  }, dependencies);
  assert.equal(foreignLocation.status, "invalid");
});

test("malformed capture data and another account's Location are rejected without partial work", () => {
  const workspace = createWorkspace(settingsDocument(), {
    now: () => "2026-07-19T09:00:00.000Z",
    createId: (kind) => `${kind}-fixed`,
  });
  const malformed = captureInputFromRecord(workspace.read(), {
    title: "Bad capture", areaId: "another-account-area", reminderAt: "not-a-date", submissionId: "bad-request",
  }, "2026-07-19");

  assert.equal(malformed.ok, false);
  assert.deepEqual(workspace.read().toDos, []);
  assert.deepEqual(workspace.read().captureReceipts, []);
});

test("saved settings and capture receipts survive reload and remain isolated by account", async () => {
  const store = createInMemorySyncStore(() => "2026-07-19T10:00:00.000Z");
  const alice = store.forOwner("alice");
  const bob = store.forOwner("bob");
  const workspace = createWorkspace(settingsDocument(), {
    now: () => "2026-07-19T09:00:00.000Z",
    createId: (() => { let next = 0; return (kind: string) => `${kind}-${++next}`; })(),
  });
  workspace.change({ type: "updateSettings", changes: { theme: "dark", groupToday: false } });
  const capture = captureInputFromRecord(workspace.read(), { title: "Private", submissionId: "private-1" }, "2026-07-19");
  assert.equal(capture.ok, true);
  if (!capture.ok) return;
  workspace.change({ type: "captureToDo", capture: capture.input });

  const saved = await alice.save({ expectedRevision: 0, mutationId: "settings-1", document: workspace.read() });
  assert.equal(saved.status, "acknowledged");
  assert.equal((await alice.load())?.document.settings.theme, "dark");
  assert.equal((await alice.load())?.document.captureReceipts[0].submissionId, "private-1");
  assert.equal(await bob.load(), null);
});
