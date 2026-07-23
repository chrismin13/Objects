import assert from "node:assert/strict";
import test from "node:test";

import { agendaForView, parseIcsCalendar } from "../../shared/workspace/calendar.ts";
import { dateInTimeZone } from "../../shared/workspace/dates.ts";
import { createEmptyWorkspace, createWorkspace } from "../../shared/workspace/workspace.ts";

const NOW = "2026-07-19T08:00:00.000Z";

function setup() {
  const document = createEmptyWorkspace(NOW);
  document.spaces.push({ id: "space-work", title: "Work", color: "#5577dd", pinned: true, order: 0 });
  document.settings.defaultSpaceId = "space-work";
  let id = 0;
  return createWorkspace(document, { now: () => NOW, createId: (kind) => `${kind}-${++id}` });
}

test("ICS parsing unfolds content, converts named time zones, and keeps all-day dates", () => {
  const parsed = parseIcsCalendar([
    "BEGIN:VCALENDAR",
    "X-WR-CALNAME:Team",
    "BEGIN:VEVENT",
    "UID:sync-1",
    "SUMMARY:Design sync",
    "DTSTART;TZID=America/New_York:20260720T090000",
    "DTEND;TZID=America/New_York:20260720T094500",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:holiday-1",
    "SUMMARY:Company offsite",
    "DTSTART;VALUE=DATE:20260721",
    "DTEND;VALUE=DATE:20260722",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n"));

  assert.equal(parsed.status, "parsed");
  if (parsed.status !== "parsed") return;
  assert.deepEqual(parsed.events, [
    { uid: "sync-1", title: "Design sync", start: "2026-07-20T13:00:00.000Z", end: "2026-07-20T13:45:00.000Z", calendar: "Team", allDay: false },
    { uid: "holiday-1", title: "Company offsite", start: "2026-07-21T00:00:00.000Z", end: "2026-07-22T00:00:00.000Z", calendar: "Team", allDay: true },
  ]);
});

test("ICS parsing rejects invalid ranges and duplicate events clearly", () => {
  const invalid = parseIcsCalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Broken\nDTSTART:20260720T100000Z\nDTEND:20260720T090000Z\nEND:VEVENT\nEND:VCALENDAR");
  assert.equal(invalid.status, "rejected");
  assert.ok(invalid.errors.some((error) => error.includes("ends before")));

  const duplicate = parseIcsCalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:same\nSUMMARY:First\nDTSTART:20260720T090000Z\nDTEND:20260720T100000Z\nEND:VEVENT\nBEGIN:VEVENT\nUID:same\nSUMMARY:Again\nDTSTART:20260720T110000Z\nDTEND:20260720T120000Z\nEND:VEVENT\nEND:VCALENDAR");
  assert.equal(duplicate.status, "rejected");
  assert.ok(duplicate.errors.some((error) => error.includes("duplicate UID")));

  const malformed = parseIcsCalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Broken timestamp\nDTSTART:20260720T090000T\nEND:VEVENT\nEND:VCALENDAR");
  assert.equal(malformed.status, "rejected");
  assert.ok(malformed.errors.some((error) => error.includes("invalid start")));
});

test("manual calendar events can be created, edited, imported once, and deleted through Workspace", () => {
  const workspace = setup();
  const created = workspace.change({
    type: "createCalendarEvent", title: "Lunch", spaceId: "space-work", start: "2026-07-19T12:00:00.000Z",
    end: "2026-07-19T13:00:00.000Z", calendar: "Personal", allDay: false,
  });
  assert.equal(created.status, "changed");
  const eventId = created.affected[0]!.id;
  assert.equal(workspace.change({ type: "updateCalendarEvent", id: eventId, changes: { title: "Team lunch" } }).status, "changed");

  const ics = "BEGIN:VCALENDAR\nX-WR-CALNAME:Work\nBEGIN:VEVENT\nUID:demo\nSUMMARY:Demo\nDTSTART:20260720T090000Z\nDTEND:20260720T093000Z\nEND:VEVENT\nEND:VCALENDAR";
  assert.equal(workspace.change({ type: "importIcsCalendar", source: ics, spaceId: "space-work" }).status, "changed");
  const duplicate = workspace.change({ type: "importIcsCalendar", source: ics, spaceId: "space-work" });
  assert.equal(duplicate.status, "rejected");
  assert.ok(duplicate.errors.some((error) => error.includes("already exists")));
  const changedSameUid = workspace.change({
    type: "importIcsCalendar",
    source: ics
      .replace("SUMMARY:Demo", "SUMMARY:Renamed demo")
      .replace("20260720T090000Z", "20260720T100000Z")
      .replace("20260720T093000Z", "20260720T103000Z"),
    spaceId: "space-work",
  });
  assert.equal(changedSameUid.status, "rejected");
  assert.ok(changedSameUid.errors.some((error) => error.includes("already exists")));
  assert.equal(workspace.change({ type: "deleteCalendarEvent", id: eventId }).status, "changed");
  assert.deepEqual(workspace.read().calendarEvents.map((event) => event.title), ["Demo"]);
});

test("Today, Tomorrow, and Upcoming agendas order calendar events beside scheduled Projects and to-dos", () => {
  const workspace = setup();
  workspace.change({ type: "createProject", title: "Launch", location: { kind: "space", spaceId: "space-work" }, schedule: { kind: "scheduled", date: "2026-07-20", evening: false } });
  workspace.change({ type: "createToDo", title: "Send brief", location: { kind: "unfiled", spaceId: "space-work" }, schedule: { kind: "scheduled", date: "2026-07-20", evening: false } });
  workspace.change({ type: "createCalendarEvent", title: "Stand-up", spaceId: "space-work", start: "2026-07-20T08:30:00.000Z", end: "2026-07-20T09:00:00.000Z", calendar: "Work", allDay: false });

  const document = workspace.read();
  const tomorrow = agendaForView(document, { kind: "tomorrow", date: "2026-07-20" }, "space-work");
  assert.deepEqual(tomorrow.map((item) => [item.kind, item.title]), [
    ["calendarEvent", "Stand-up"],
    ["project", "Launch"],
    ["toDo", "Send brief"],
  ]);
  assert.ok(tomorrow[0]!.actionable === false && tomorrow.slice(1).every((item) => item.actionable));
  assert.deepEqual(agendaForView(document, { kind: "today", date: "2026-07-19" }, "space-work"), []);
  assert.deepEqual(agendaForView(document, { kind: "upcoming", date: "2026-07-19" }, "space-work").map((item) => item.title), ["Stand-up", "Launch", "Send brief"]);
});

test("an all-day ICS end date is exclusive when agenda days are calculated", () => {
  const workspace = setup();
  const zeroLength = workspace.change({ type: "createCalendarEvent", title: "Broken offsite", spaceId: "space-work", start: "2026-07-21T00:00:00.000Z", end: "2026-07-21T00:00:00.000Z", calendar: "Work", allDay: true });
  assert.equal(zeroLength.status, "rejected");
  workspace.change({ type: "createCalendarEvent", title: "Offsite", spaceId: "space-work", start: "2026-07-21T00:00:00.000Z", end: "2026-07-22T00:00:00.000Z", calendar: "Work", allDay: true });
  const document = workspace.read();
  assert.deepEqual(agendaForView(document, { kind: "tomorrow", date: "2026-07-21" }, "space-work").map((item) => item.title), ["Offsite"]);
  assert.deepEqual(agendaForView(document, { kind: "tomorrow", date: "2026-07-22" }, "space-work"), []);
});

test("agenda Tag filters use effective Tags and hide untagged calendar events", () => {
  const workspace = setup();
  workspace.change({ type: "createTag", title: "Focused" });
  const tagId = workspace.read().tags[0]!.id;
  workspace.change({
    type: "createProject",
    title: "Tagged project",
    location: { kind: "space", spaceId: "space-work" },
    schedule: { kind: "scheduled", date: "2026-07-20", evening: false },
    tags: [tagId],
  });
  workspace.change({
    type: "createToDo",
    title: "Tagged to-do",
    location: { kind: "unfiled", spaceId: "space-work" },
    schedule: { kind: "scheduled", date: "2026-07-20", evening: false },
    tags: [tagId],
  });
  workspace.change({
    type: "createCalendarEvent",
    title: "Untagged meeting",
    spaceId: "space-work",
    start: "2026-07-20T09:00:00.000Z",
    end: "2026-07-20T10:00:00.000Z",
    allDay: false,
  });

  const agenda = agendaForView(workspace.read(), { kind: "tomorrow", date: "2026-07-20" }, "space-work", "UTC", [tagId]);
  assert.deepEqual(agenda.map((item) => item.title), ["Tagged project", "Tagged to-do"]);
});

test("calendar events sort by their displayed time in the requested time zone", () => {
  const workspace = setup();
  workspace.change({
    type: "createCalendarEvent",
    title: "Late local event",
    spaceId: "space-work",
    start: "2026-07-20T20:00:00.000Z",
    end: "2026-07-20T20:30:00.000Z",
    allDay: false,
  });
  workspace.change({
    type: "createCalendarEvent",
    title: "Early local event",
    spaceId: "space-work",
    start: "2026-07-19T22:00:00.000Z",
    end: "2026-07-19T22:30:00.000Z",
    allDay: false,
  });

  const agenda = agendaForView(workspace.read(), { kind: "tomorrow", date: "2026-07-20" }, "space-work", "Europe/Athens");
  assert.deepEqual(agenda.map((item) => item.title), ["Early local event", "Late local event"]);
});

test("local dates and midnight event ends respect the requested time zone", () => {
  const instant = new Date("2026-07-19T22:30:00.000Z");
  assert.equal(dateInTimeZone(instant, "Europe/Athens"), "2026-07-20");
  assert.equal(dateInTimeZone(instant, "America/New_York"), "2026-07-19");

  const workspace = setup();
  workspace.change({
    type: "createCalendarEvent",
    title: "Ends at midnight",
    spaceId: "space-work",
    start: "2026-07-19T22:00:00.000Z",
    end: "2026-07-20T00:00:00.000Z",
    allDay: false,
  });
  assert.deepEqual(agendaForView(workspace.read(), { kind: "tomorrow", date: "2026-07-20" }, "space-work", "UTC"), []);
});
