import assert from "node:assert/strict";
import { test } from "vite-plus/test";

import {
  escapeIcsText,
  foldIcsLine,
  parseVTodo,
  renderVTodo,
  unescapeIcsText,
  vtodoEtag,
} from "../../shared/workspace/caldav/ics.ts";
import {
  changesForInboundPut,
  listNameForContainer,
  listNameForToDo,
  renderToDoResource,
  servedFieldsFor,
  stampFor,
  type CalDavAnchor,
} from "../../shared/workspace/caldav/adapter.ts";
import { parseXml, davDescendants } from "../../shared/workspace/caldav/xml.ts";
import { createEmptyWorkspace, createWorkspace } from "../../shared/workspace/workspace.ts";
import type { ToDo, WorkspaceDocument, WorkspaceEntityKind } from "../../shared/workspace/model.ts";

const NOW = "2026-08-15T15:55:20.000Z";

type Fixture = {
  document: WorkspaceDocument;
  spaceId: string;
  homeTagId: string;
  areaId: string;
  projectId: string;
  headingId: string;
};

function fixture(): Fixture {
  let sequence = 0;
  const document = createEmptyWorkspace(NOW);
  const workspace = createWorkspace(document, {
    now: () => NOW,
    createId: (kind: WorkspaceEntityKind | "undo" | "projectClosure") => `fx-${kind}-${++sequence}`,
  });
  const expectChange = (result: { status: string; errors?: string[] }, label: string) => {
    if (result.status !== "changed") throw new Error(`${label}: ${result.errors?.join(" ")}`);
  };
  expectChange(
    workspace.change({ type: "createSpace", title: "Personal", color: "#e49b3c" }),
    "space",
  );
  expectChange(workspace.change({ type: "setDefaultSpace", spaceId: "fx-space-1" }), "default");
  expectChange(workspace.change({ type: "createTag", title: "home" }), "tag");
  expectChange(workspace.change({ type: "createTag", title: "errand" }), "tag");
  const areaId = changedId(
    workspace.change({ type: "createArea", title: "Studio", spaceId: "fx-space-1" }),
    "area",
  );
  const projectId = changedId(
    workspace.change({
      type: "createProject",
      title: "Launch",
      location: { kind: "space", spaceId: "fx-space-1" },
    }),
    "project",
  );
  const headingId = changedId(
    workspace.change({
      type: "createHeading",
      title: "Delivery",
      location: { kind: "project", projectId },
    }),
    "heading",
  );
  const final = workspace.read();
  const homeTagId = final.tags.find((tag) => tag.title === "home")!.id;
  return {
    document: final,
    spaceId: "fx-space-1",
    homeTagId,
    areaId,
    projectId,
    headingId,
  };
}

function changedId(
  result: { status: string; errors?: string[]; affected: { kind: string; id: string }[] },
  kind: string,
) {
  if (result.status !== "changed")
    throw new Error(result.errors?.join(" ") ?? "fixture change failed");
  const id = result.affected.find((item) => item.kind === kind)?.id;
  if (!id) throw new Error(`fixture did not create ${kind}`);
  return id;
}

function fixtureDocument(): WorkspaceDocument {
  return fixture().document;
}

function addToDo(document: WorkspaceDocument, toDo: ToDo): WorkspaceDocument {
  return { ...document, toDos: [...document.toDos, toDo] };
}

function sampleToDo(overrides: Partial<ToDo> = {}): ToDo {
  return {
    id: "fx-toDo-9",
    title: "Water the plants",
    notes: "Ferns first",
    checklist: [],
    location: { kind: "unfiled", spaceId: "fx-space-1" },
    schedule: { kind: "scheduled", date: "2026-08-20", evening: false },
    reminder: null,
    deadline: null,
    outcome: "open",
    trashedAt: null,
    logbookAt: null,
    tags: [],
    occurrence: null,
    createdAt: NOW,
    completedAt: null,
    order: 0,
    ...overrides,
  };
}

test("renderVTodo emits CRLF line endings and stable field order", () => {
  const body = renderVTodo({
    uid: "abc123",
    title: "Water the plants",
    notes: "Ferns, and the orchid",
    due: { date: "2026-08-20", time: null },
    status: "NEEDS-ACTION",
    completedUtc: null,
    percentComplete: false,
    categories: ["home"],
    reminder: null,
    createdAtUtc: "20260815T155520Z",
    stampUtc: "20260815T160000Z",
  });
  assert.ok(body.endsWith("\r\n"));
  assert.ok(!/(?<!\r)\n/.test(body));
  assert.match(body, /BEGIN:VCALENDAR\r\nVERSION:2.0\r\n/);
  assert.match(body, /DUE;VALUE=DATE:20260820\r\n/);
  assert.match(body, /STATUS:NEEDS-ACTION\r\n/);
  assert.match(body, /CATEGORIES:home\r\n/);
});

test("text escaping round-trips commas, semicolons, backslashes and newlines", () => {
  const raw = "a,b;c\nd\\e";
  const escaped = escapeIcsText(raw);
  assert.equal(escaped, "a\\,b\\;c\\nd\\\\e");
  assert.equal(unescapeIcsText(escaped), raw);
});

test("foldIcsLine splits long lines at the octet limit and parsing unfolds them", () => {
  const long = `SUMMARY:${"ü".repeat(60)}`; // 2-byte code points
  const folded = foldIcsLine(long);
  const parsed = parseVTodo(
    renderVTodo({
      uid: "u1",
      title: "ü".repeat(60),
      notes: "",
      due: null,
      status: "NEEDS-ACTION",
      completedUtc: null,
      categories: [],
      reminder: null,
      createdAtUtc: "20260815T155520Z",
      percentComplete: false,
      stampUtc: "20260815T160000Z",
    }),
  );
  assert.equal(parsed?.summary, "ü".repeat(60));
  assert.ok(folded.includes("\r\n "));
});

test("outbound mapping: scheduled date renders VALUE=DATE, timed reminder renders floating DUE plus at-due VALARM", () => {
  const document = fixtureDocument();
  const dateOnly = renderToDoResource(document, sampleToDo(), "r1.ics", "20260815T160000Z");
  assert.match(dateOnly.body, /DUE;VALUE=DATE:20260820\r\n/);
  assert.ok(!dateOnly.body.includes("VALARM"));

  const timed = renderToDoResource(
    document,
    sampleToDo({ reminder: { at: "2026-08-20T09:30:00.000Z", sentAt: null } }),
    "r2.ics",
    "20260815T160000Z",
  );
  assert.match(timed.body, /DUE:20260820T093000\r\n/); // floating, no Z, no TZID
  assert.match(timed.body, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:PT0S\r\n/);
});

test("outbound mapping: inbox/anytime/someday omit DUE entirely (dateless rule)", () => {
  const document = fixtureDocument();
  for (const schedule of [
    { kind: "inbox" as const },
    { kind: "anytime" as const },
    { kind: "someday" as const },
  ]) {
    const rendered = renderToDoResource(
      document,
      sampleToDo({ schedule }),
      "r3.ics",
      "20260815T160000Z",
    );
    assert.ok(!rendered.body.includes("DUE:"), schedule.kind);
    assert.ok(!rendered.body.includes("VALARM"));
  }
});

test("outbound mapping: outcomes render the captured iOS completion shape; canceled omits percent", () => {
  const document = fixtureDocument();
  const completed = renderToDoResource(
    document,
    sampleToDo({ outcome: "completed", completedAt: "2026-08-15T15:55:20.000Z" }),
    "r4.ics",
    "20260815T160000Z",
  );
  assert.match(
    completed.body,
    /STATUS:COMPLETED\r\nCOMPLETED:20260815T155520Z\r\nPERCENT-COMPLETE:100\r\n/,
  );

  const canceled = renderToDoResource(
    document,
    sampleToDo({ outcome: "canceled", completedAt: "2026-08-15T15:55:20.000Z" }),
    "r5.ics",
    "20260815T160000Z",
  );
  assert.match(canceled.body, /STATUS:COMPLETED\r\nCOMPLETED:20260815T155520Z\r\n/);
  assert.ok(!canceled.body.includes("PERCENT-COMPLETE"));
});

test("ETag is deterministic and excludes DTSTAMP/LAST-MODIFIED", () => {
  const document = fixtureDocument();
  const toDo = sampleToDo();
  const first = renderToDoResource(document, toDo, "r6.ics", "20260815T160000Z");
  const later = renderToDoResource(document, toDo, "r6.ics", "2027-01-01T00:00:00.000Z");
  assert.notEqual(first.body, later.body); // stamps advanced
  assert.equal(first.etag, later.etag); // etag stable
  const edited = renderToDoResource(
    document,
    sampleToDo({ title: "Water everything" }),
    "r6.ics",
    "20260815T160000Z",
  );
  assert.notEqual(first.etag, edited.etag);
  assert.equal(vtodoEtag(first.body), first.etag);
});

test("parser corpus: DUE;VALUE=DATE, floating DUE, TZID + embedded VTIMEZONE, LF input", () => {
  const dateOnly = parseVTodo(
    "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VTODO\nSUMMARY:x\nDUE;VALUE=DATE:20260820\nEND:VTODO\nEND:VCALENDAR\n",
  );
  assert.deepEqual(dateOnly?.due, { date: "2026-08-20", time: null });

  const floating = parseVTodo(
    "BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nDUE:20260820T093000\r\nEND:VTODO\r\nEND:VCALENDAR\r\n",
  );
  assert.deepEqual(floating?.due, { date: "2026-08-20", time: "09:30:00" });

  const tzid = parseVTodo(
    [
      "BEGIN:VCALENDAR",
      "BEGIN:VTIMEZONE",
      "TZID:America/New_York",
      "BEGIN:STANDARD",
      "DTSTART:19701101T020000",
      "END:STANDARD",
      "END:VTIMEZONE",
      "BEGIN:VTODO",
      "DTSTART;TZID=America/New_York:20260820T093000",
      "DUE;TZID=America/New_York:20260820T093000",
      "END:VTODO",
      "END:VCALENDAR",
      "",
    ].join("\r\n"),
  );
  assert.deepEqual(tzid?.due, { date: "2026-08-20", time: "09:30:00" }); // wall time read, block ignored
});

test("parser corpus: captured iOS completion PUT", () => {
  const parsed = parseVTodo(
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Apple Inc.//iOS 27.0//EN",
      "BEGIN:VTODO",
      "UID:abc",
      "SUMMARY:Buy milk",
      "STATUS:COMPLETED",
      "COMPLETED:20260815T155520Z",
      "PERCENT-COMPLETE:100",
      "X-APPLE-SORT-ORDER:1",
      "END:VTODO",
      "END:VCALENDAR",
      "",
    ].join("\r\n"),
  );
  assert.equal(parsed?.status, "COMPLETED");
  assert.equal(parsed?.completed, "20260815T155520Z");
  assert.equal(parsed?.percentComplete, 100);
});

test("parser corpus: timed reminder with absolute Siri-form trigger", () => {
  const parsed = parseVTodo(
    [
      "BEGIN:VCALENDAR",
      "BEGIN:VTIMEZONE",
      "TZID:America/New_York",
      "END:VTIMEZONE",
      "BEGIN:VTODO",
      "SUMMARY:Call the dentist",
      "DTSTART;TZID=America/New_York:20260820T090000",
      "DUE;TZID=America/New_York:20260820T090000",
      "BEGIN:VALARM",
      "X-WR-ALARMUID:xyz",
      "UID:alarm-1",
      "TRIGGER;VALUE=DATE-TIME:20260820T090000Z",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder",
      "END:VALARM",
      "END:VTODO",
      "END:VCALENDAR",
      "",
    ].join("\r\n"),
  );
  assert.deepEqual(parsed?.due, { date: "2026-08-20", time: "09:00:00" });
  assert.deepEqual(parsed?.alarm, { kind: "absolute", date: "2026-08-20", time: "09:00:00" });
});

test("parser corpus: Apple proximity placeholder alarm is ignored", () => {
  const parsed = parseVTodo(
    [
      "BEGIN:VCALENDAR",
      "BEGIN:VTODO",
      "SUMMARY:Arrive somewhere",
      "BEGIN:VALARM",
      "TRIGGER;VALUE=DATE-TIME:19760401T005545Z",
      "X-APPLE-PROXIMITY:ARRIVE",
      "ACTION:NONE",
      "END:VALARM",
      "END:VTODO",
      "END:VCALENDAR",
      "",
    ].join("\r\n"),
  );
  assert.equal(parsed?.alarm, null);
});

test("parser corpus: folded lines are unfolded before parsing", () => {
  const parsed = parseVTodo(
    [
      "BEGIN:VCALENDAR",
      "BEGIN:VTODO",
      "SUMMARY:This is a very long summary that someone folded acr",
      " oss several physical lines with a fold marker",
      "END:VTODO",
      "END:VCALENDAR",
      "",
    ].join("\r\n"),
  );
  assert.equal(
    parsed?.summary,
    "This is a very long summary that someone folded across several physical lines with a fold marker",
  );
});

test("three-way merge: an echo PUT (phone == anchor) is a no-op even when Objects changed the field", () => {
  const document = addToDo(fixtureDocument(), sampleToDo({ title: "Newer Objects title" }));
  const anchor: CalDavAnchor = {
    resource: "r7.ics",
    toDoId: "fx-toDo-9",
    list: "inbox",
    served: { ...servedFieldsFor(document, sampleToDo()), reminder: null },
  };
  const echo = parseVTodo(
    renderVTodo({
      uid: "r7",
      title: "Water the plants", // old title, same as anchor
      notes: "Ferns first",
      due: { date: "2026-08-20", time: null },
      status: "NEEDS-ACTION",
      completedUtc: null,
      percentComplete: false,
      categories: [],
      reminder: null,
      createdAtUtc: "20260815T155520Z",
      stampUtc: "20260815T160000Z",
    }),
  )!;
  const result = changesForInboundPut(document, anchor, echo, inboxList(document));
  assert.equal(result.changes.length, 0); // stale echo cannot clobber the newer Objects write
});

test("three-way merge: a phone edit (phone != anchor) applies the phone value", () => {
  const document = addToDo(fixtureDocument(), sampleToDo());
  const toDo = document.toDos[0];
  const anchor: CalDavAnchor = {
    resource: "r8.ics",
    toDoId: toDo.id,
    list: "inbox",
    served: servedFieldsFor(document, toDo),
  };
  const edited = parseVTodo(
    renderVTodo({
      uid: "r8",
      title: "Water all the plants",
      notes: "Ferns first",
      due: { date: "2026-08-21", time: "07:00:00" },
      status: "NEEDS-ACTION",
      completedUtc: null,
      categories: ["home"],
      reminder: null,
      createdAtUtc: "20260815T155520Z",
      percentComplete: false,
      stampUtc: "20260815T160000Z",
    }),
  )!;
  const result = changesForInboundPut(document, anchor, edited, inboxList(document));
  const merged: Record<string, unknown> = {};
  for (const entry of result.changes)
    if (entry.change.type === "updateToDo")
      Object.assign(merged, (entry.change as { changes: Record<string, unknown> }).changes);
  const changes = merged;
  assert.equal(changes.title, "Water all the plants");
  assert.deepEqual(changes.schedule, { kind: "scheduled", date: "2026-08-21", evening: false });
  assert.deepEqual(changes.reminder, { at: "2026-08-21T07:00:00.000Z", sentAt: null });
});

test("three-way merge: missing anchor degrades to Objects-wins", () => {
  const document = fixtureDocument();
  const parsed = parseVTodo(
    renderVTodo({
      uid: "ghost",
      title: "Renamed by phone",
      notes: "",
      due: null,
      status: "NEEDS-ACTION",
      completedUtc: null,
      categories: [],
      reminder: null,
      createdAtUtc: "20260815T155520Z",
      percentComplete: false,
      stampUtc: "20260815T160000Z",
    }),
  )!;
  // No anchor: this PUT is treated as a create, never a blind edit.
  const result = changesForInboundPut(document, null, parsed, inboxList(document));
  assert.equal(result.changes[0].change.type, "createToDo");
});

test("inbound status changes map to completeToDo and reopenToDo; un-checking canceled is ignored", () => {
  const document = fixtureDocument();
  const anchor = (toDo: ToDo): CalDavAnchor => ({
    resource: "r9.ics",
    toDoId: toDo.id,
    list: "inbox",
    served: servedFieldsFor(document, toDo),
  });
  const bodyWith = (status: string, completed: string | null) =>
    parseVTodo(
      [
        "BEGIN:VCALENDAR",
        "BEGIN:VTODO",
        "SUMMARY:Water the plants",
        ...(status === "COMPLETED" ? ["STATUS:COMPLETED"] : ["STATUS:NEEDS-ACTION"]),
        ...(completed ? [`COMPLETED:${completed}`] : []),
        "END:VTODO",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
    )!;

  const openToDo = sampleToDo();
  const complete = changesForInboundPut(
    addToDo(document, openToDo),
    anchor(openToDo),
    bodyWith("COMPLETED", "20260815T160000Z"),
    inboxList(document),
  );
  assert.ok(complete.changes.some((entry) => entry.change.type === "completeToDo"));

  const completedToDo = sampleToDo({ outcome: "completed", completedAt: NOW });
  const reopen = changesForInboundPut(
    addToDo(document, completedToDo),
    anchor(completedToDo),
    bodyWith("NEEDS-ACTION", null),
    inboxList(document),
  );
  assert.ok(reopen.changes.some((entry) => entry.change.type === "reopenToDo"));

  const canceledToDo = sampleToDo({ outcome: "canceled", completedAt: NOW });
  const uncheckCanceled = changesForInboundPut(
    addToDo(document, canceledToDo),
    anchor(canceledToDo),
    bodyWith("NEEDS-ACTION", null),
    inboxList(document),
  );
  assert.ok(!uncheckCanceled.changes.some((entry) => entry.change.type === "reopenToDo"));
});

test("inbound create maps DUE, notes, and categories; RRULE is accepted as a plain to-do", () => {
  const document = fixtureDocument();
  const parsed = parseVTodo(
    [
      "BEGIN:VCALENDAR",
      "BEGIN:VTODO",
      "SUMMARY:Pay the water bill",
      "DESCRIPTION:Quarterly",
      "DUE:20260901T100000",
      "CATEGORIES:home,bills",
      "RRULE:FREQ=MONTHLY",
      "STATUS:NEEDS-ACTION",
      "END:VTODO",
      "END:VCALENDAR",
      "",
    ].join("\r\n"),
  )!;
  const result = changesForInboundPut(document, null, parsed, inboxList(document));
  const create = result.changes[0].change as Record<string, unknown>;
  assert.equal(create.type, "createToDo");
  assert.equal(create.title, "Pay the water bill");
  assert.equal(create.notes, "Quarterly");
  assert.deepEqual(create.schedule, { kind: "scheduled", date: "2026-09-01", evening: false });
  assert.equal(create.reminderAt, "2026-09-01T10:00:00.000Z");
  assert.deepEqual(create.location, { kind: "unfiled", spaceId: "fx-space-1" });
  const tags = result.changes.find((entry) => entry.change.type === "setToDoTags");
  assert.ok(tags);
  assert.deepEqual((tags.change as { titles: string[] }).titles, ["home", "bills"]);
});

test("PUT to a different list becomes a location change", () => {
  const { document: base, projectId } = fixture();
  const document = addToDo(base, sampleToDo());
  const toDo = document.toDos[0];
  const anchor: CalDavAnchor = {
    resource: "r10.ics",
    toDoId: toDo.id,
    list: "inbox",
    served: servedFieldsFor(document, toDo),
  };
  const withAnchor = document;
  const projectList = {
    name: listNameForContainer({ kind: "project", id: projectId }),
    displayName: "Launch",
    color: "#e49b3c",
    container: { kind: "project" as const, id: projectId },
  };
  const echo = parseVTodo(renderToDoResource(withAnchor, toDo, "r10.ics", "20260815T160000Z").body);
  const result = changesForInboundPut(withAnchor, anchor, echo!, projectList);
  const move = result.changes.find(
    (entry) =>
      entry.change.type === "updateToDo" &&
      (entry.change.changes as Record<string, unknown> | undefined)?.location !== undefined,
  );
  assert.ok(move, "the move produces an updateToDo location change");
  assert.deepEqual((move.change.changes as Record<string, unknown>).location, {
    kind: "project",
    projectId,
  });
});

test("list membership: unfiled → Inbox, heading-parented → its Project list, trashed → none", () => {
  const { document, projectId, headingId } = fixture();
  const unfiled = sampleToDo();
  assert.equal(listNameForToDo(document, unfiled), "inbox");
  const inProject = sampleToDo({ location: { kind: "project", projectId } });
  assert.equal(listNameForToDo(document, inProject), `project-${projectId}`);
  const inHeading = sampleToDo({ location: { kind: "heading", headingId } });
  assert.equal(listNameForToDo(document, inHeading), `project-${projectId}`); // heading inherits its Project
  const trashed = sampleToDo({ trashedAt: NOW });
  assert.equal(listNameForToDo(document, trashed), null);
});

test("stampFor renders the iCalendar UTC form of the render clock", () => {
  assert.equal(stampFor(NOW), "20260815T155520Z");
});

test("the XML parser resolves inline namespace decorations on hrefs", () => {
  const parsed = parseXml(
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">',
      '<A:prop xmlns:A="DAV:"><A:getetag/></A:prop>',
      '<B:href xmlns:B="DAV:">/dav/user_1/inbox/a.ics</B:href>',
      "<D:href>/dav/user_1/inbox/b.ics</D:href>",
      "</C:calendar-multiget>",
    ].join(""),
  );
  assert.equal(parsed?.local, "calendar-multiget");
  const hrefs = davDescendants(parsed, "href").map((node) => node.text);
  assert.deepEqual(hrefs, ["/dav/user_1/inbox/a.ics", "/dav/user_1/inbox/b.ics"]);
  const props = davDescendants(parsed, "prop");
  assert.equal(props.length, 1);
  assert.equal(props[0].children[0].local, "getetag");
});

function inboxList(document: WorkspaceDocument) {
  return {
    name: "inbox",
    displayName: "Inbox",
    color: "#8e8e93",
    container: { kind: "inbox" as const, ...(document.settings.defaultSpaceId ? {} : {}) },
  };
}
