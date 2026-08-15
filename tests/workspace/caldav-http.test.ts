import assert from "node:assert/strict";
import { beforeEach, describe, it } from "vite-plus/test";

import { env, SELF } from "cloudflare:test";
import { SESSION_COOKIE, sealSession, type Session } from "../../worker/auth.ts";
import { representativeWorkspace } from "./workspace-fixtures.ts";

const USER_ID = "user_01CALDAV000000000000000";
const ORIGIN = "https://objects.test";

const session: Session = {
  userId: USER_ID,
  email: "caldav@example.com",
  firstName: "Cal",
  lastName: "Dav",
};

async function sessionCookie(): Promise<string> {
  const sealed = await sealSession(env, session);
  return `${SESSION_COOKIE}=${encodeURIComponent(sealed)}`;
}

async function seedWorkspace(): Promise<void> {
  const response = await SELF.fetch(`${ORIGIN}/api/workspace`, {
    method: "POST",
    headers: { Cookie: await sessionCookie() },
    body: JSON.stringify({
      expectedRevision: 0,
      mutationId: "caldav-seed",
      document: representativeWorkspace("caldav"),
    }),
  });
  assert.equal(response.status, 200);
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${path}`, {
    ...init,
    headers: { Cookie: await sessionCookie(), ...init.headers },
  });
}

function basic(password: string, username = "anything"): Record<string, string> {
  return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
}

async function createToken(label = "iPhone"): Promise<string> {
  const response = await api("/api/caldav/tokens", {
    method: "POST",
    body: JSON.stringify({ label, timeZone: "America/New_York" }),
  });
  assert.equal(response.status, 201);
  const body = (await response.json()) as { token: { token: string } };
  return body.token.token;
}

const PROPFIND_PRINCIPAL = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<D:propfind xmlns:D="DAV:">',
  "<D:prop><D:displayname/><D:resourcetype/><D:calendar-home-set/><D:current-user-principal/></D:prop>",
  "</D:propfind>",
].join("");

const PROPFIND_LISTS = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/" xmlns:CS="http://calendarserver.org/ns/">',
  "<D:prop><D:displayname/><D:resourcetype/><D:current-user-principal/>",
  "<C:supported-calendar-component-set/><C:calendar-home-set/>",
  "<A:calendar-color/><CS:getctag/><D:sync-token/></D:prop>",
  "</D:propfind>",
].join("");

const SYNC_COLLECTION = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<D:sync-collection xmlns:D="DAV:">',
  "<D:sync-token/>",
  "<D:prop><D:getetag/><D:getcontenttype/></D:prop>",
  "</D:sync-collection>",
].join("");

const CALENDAR_QUERY = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">',
  "<D:prop><D:getetag/><D:getcontenttype/><C:calendar-data/></D:prop>",
  '<C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VTODO"/></C:comp-filter></C:filter>',
  "</C:calendar-query>",
].join("");

function multiget(href: string): string {
  // Attribute-carrying hrefs: iOS decorates elements with inline namespace
  // declarations; the parser must resolve them.
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">',
    '<A:prop xmlns:A="DAV:"><A:getetag/><B:calendar-data xmlns:B="urn:ietf:params:xml:ns:caldav"/></A:prop>',
    `<X:href xmlns:X="DAV:">${href}</X:href>`,
    "</C:calendar-multiget>",
  ].join("");
}

function newVtodoBody(title: string, due: string | null): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Apple Inc.//iOS 27.0//EN",
    "BEGIN:VTODO",
    `UID:${crypto.randomUUID()}`,
    `SUMMARY:${title}`,
    ...(due ? [`DUE;VALUE=DATE:${due}`] : []),
    "STATUS:NEEDS-ACTION",
    "END:VTODO",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function extractHrefResource(xml: string): string {
  const href = /<D:href>([^<]+)<\/D:href>/.exec(xml)?.[1];
  assert.ok(href, "no href in response");
  return href.split("/").filter(Boolean).at(-1)!;
}

async function loadedWorkspace(): Promise<Record<string, unknown>> {
  const response = await api("/api/workspace");
  assert.equal(response.status, 200);
  const body = (await response.json()) as { snapshot: { document: Record<string, unknown> } };
  assert.ok(body.snapshot, "the workspace snapshot loaded");
  return body.snapshot.document;
}

describe("CalDAV endpoint", () => {
  let token: string;

  beforeEach(async () => {
    await seedWorkspace();
    token = await createToken();
  });

  it("answers OPTIONS anonymously and challenges every other method with Basic", async () => {
    const options = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/`, { method: "OPTIONS" });
    assert.equal(options.status, 200);
    assert.match(options.headers.get("DAV") ?? "", /calendar-access/);

    for (const path of ["/.well-known/caldav", `/dav/${USER_ID}/`, `/principals/${USER_ID}/`]) {
      const anonymous = await SELF.fetch(`${ORIGIN}${path}`, {
        method: "PROPFIND",
        body: PROPFIND_PRINCIPAL,
      });
      assert.equal(anonymous.status, 401, path);
      assert.match(anonymous.headers.get("WWW-Authenticate") ?? "", /^Basic realm="Objects"$/);
      const wrong = await SELF.fetch(`${ORIGIN}${path}`, {
        method: "PROPFIND",
        headers: basic("objcal_notarealtoken"),
        body: PROPFIND_PRINCIPAL,
      });
      assert.equal(wrong.status, 401, path);
    }
  });

  it("serves 207-direct well-known with the token owner's principal", async () => {
    const response = await SELF.fetch(`${ORIGIN}/.well-known/caldav`, {
      method: "PROPFIND",
      headers: basic(token),
      body: PROPFIND_PRINCIPAL,
    });
    assert.equal(response.status, 207);
    const xml = await response.text();
    assert.match(xml, /current-user-principal/);
    assert.match(xml, new RegExp(`/principals/${USER_ID}/`));
  });

  it("walks principal → home → lists with VTODO-only component sets", async () => {
    const principal = await SELF.fetch(`${ORIGIN}/principals/${USER_ID}/`, {
      method: "PROPFIND",
      headers: basic(token),
      body: PROPFIND_PRINCIPAL,
    });
    assert.equal(principal.status, 207);
    const principalXml = await principal.text();
    assert.match(principalXml, /calendar-home-set/);
    assert.match(principalXml, new RegExp(`/dav/${USER_ID}/`));

    const home = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/`, {
      method: "PROPFIND",
      headers: { ...basic(token), Depth: "1" },
      body: PROPFIND_LISTS,
    });
    assert.equal(home.status, 207);
    const homeXml = await home.text();
    assert.match(homeXml, /<D:displayname>Inbox<\/D:displayname>/);
    assert.match(homeXml, /supported-calendar-component-set/);
    assert.match(homeXml, /comp name="VTODO"/);
    assert.ok(!homeXml.includes('comp name="VEVENT"'));
    assert.match(homeXml, /getctag/);
  });

  it("accepts a PUT create, serves it back with CRLF and a strong ETag, and lands it in the workspace", async () => {
    const resource = `${crypto.randomUUID()}.ics`;
    const href = `/dav/${USER_ID}/inbox/${resource}`;
    const put = await SELF.fetch(`${ORIGIN}${href}`, {
      method: "PUT",
      headers: { ...basic(token), "If-None-Match": "*", "Content-Type": "text/calendar" },
      body: newVtodoBody("From the phone", "20260820"),
    });
    assert.equal(put.status, 201);
    const etag = put.headers.get("ETag");
    assert.ok(etag && etag.startsWith('"'), "PUT returns the new strong ETag");

    const got = await SELF.fetch(`${ORIGIN}${href}`, { headers: basic(token) });
    assert.equal(got.status, 200);
    assert.equal(got.headers.get("ETag"), etag);
    const body = await got.text();
    assert.ok(body.includes("\r\n"), "GET serves CRLF bodies");
    assert.ok(!/(?<!\r)\n/.test(body));
    assert.match(body, /SUMMARY:From the phone\r\n/);

    // The workspace snapshot holds exactly what the web client's change would hold.
    const document = await loadedWorkspace();
    const toDos = document.toDos as Array<Record<string, unknown>>;
    const created = toDos.find((toDo) => toDo.title === "From the phone");
    assert.ok(created);
    assert.deepEqual(created.schedule, { kind: "scheduled", date: "2026-08-20", evening: false });
    assert.equal(created.trashedAt, null);
  });

  it("completes, reopens, and trashes through the phone", async () => {
    const resource = `${crypto.randomUUID()}.ics`;
    const href = `/dav/${USER_ID}/inbox/${resource}`;
    const put = await SELF.fetch(`${ORIGIN}${href}`, {
      method: "PUT",
      headers: { ...basic(token), "If-None-Match": "*" },
      body: newVtodoBody("Lifecycle", null),
    });
    assert.equal(put.status, 201);

    const query = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/inbox/`, {
      method: "REPORT",
      headers: basic(token),
      body: CALENDAR_QUERY,
    });
    assert.equal(query.status, 207);
    const queryXml = await query.text();
    assert.match(queryXml, /SUMMARY:Lifecycle/);

    // Complete on the phone.
    const completedBody = newVtodoBody("Lifecycle", null).replace(
      "STATUS:NEEDS-ACTION",
      "STATUS:COMPLETED\r\nCOMPLETED:20260815T160000Z\r\nPERCENT-COMPLETE:100",
    );
    const complete = await SELF.fetch(`${ORIGIN}${href}`, {
      method: "PUT",
      headers: { ...basic(token), "If-Match": "*" },
      body: completedBody,
    });
    assert.ok([200, 204].includes(complete.status));
    const afterComplete = await loadedWorkspace();
    const completedToDo = (afterComplete.toDos as Array<Record<string, unknown>>).find(
      (toDo) => toDo.title === "Lifecycle",
    );
    assert.ok(completedToDo);
    assert.equal(completedToDo.outcome, "completed");

    // Reopen on the phone.
    const reopen = await SELF.fetch(`${ORIGIN}${href}`, {
      method: "PUT",
      headers: { ...basic(token), "If-Match": "*" },
      body: newVtodoBody("Lifecycle", null),
    });
    assert.ok([200, 204].includes(reopen.status));
    const afterReopen = await loadedWorkspace();
    const reopenedToDo = (afterReopen.toDos as Array<Record<string, unknown>>).find(
      (toDo) => toDo.title === "Lifecycle",
    );
    assert.ok(reopenedToDo);
    assert.equal(reopenedToDo.outcome, "open");

    // Delete on the phone → Trash.
    const deleted = await SELF.fetch(`${ORIGIN}${href}`, {
      method: "DELETE",
      headers: basic(token),
    });
    assert.equal(deleted.status, 204);
    const afterDelete = await loadedWorkspace();
    const trashedToDo = (afterDelete.toDos as Array<Record<string, unknown>>).find(
      (toDo) => toDo.title === "Lifecycle",
    );
    assert.ok(trashedToDo);
    assert.ok(trashedToDo.trashedAt, "deleting an open to-do trashes it");

    // The vanished resource 404s so the phone drops its stale copy.
    const gone = await SELF.fetch(`${ORIGIN}${href}`, { headers: basic(token) });
    assert.equal(gone.status, 404);
    const gonePut = await SELF.fetch(`${ORIGIN}${href}`, {
      method: "PUT",
      headers: basic(token),
      body: newVtodoBody("Lifecycle", null),
    });
    assert.equal(gonePut.status, 404);
  });

  it("moves a to-do between lists from the phone (PUT new href, DELETE old href)", async () => {
    const resource = `${crypto.randomUUID()}.ics`;
    const inboxHref = `/dav/${USER_ID}/inbox/${resource}`;
    const put = await SELF.fetch(`${ORIGIN}${inboxHref}`, {
      method: "PUT",
      headers: { ...basic(token), "If-None-Match": "*" },
      body: newVtodoBody("Move me", null),
    });
    assert.equal(put.status, 201);

    // Discover the Project list name from the home set.
    const home = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/`, {
      method: "PROPFIND",
      headers: { ...basic(token), Depth: "1" },
      body: PROPFIND_LISTS,
    });
    const homeXml = await home.text();
    const projectList = /<D:href>\/dav\/[^<]*\/project-[^<]*\/<\/D:href>/
      .exec(homeXml)?.[0]
      ?.replace(/<D:href>|<\/D:href>/g, "")
      ?.split("/")
      .filter(Boolean)
      .at(-1);
    assert.ok(projectList, "a project list exists");

    // The phone PUTs the same resource into the project list.
    const movePut = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/${projectList}/${resource}`, {
      method: "PUT",
      headers: { ...basic(token), "If-Match": put.headers.get("ETag") ?? "*" },
      body: newVtodoBody("Move me", null),
    });
    assert.ok([200, 201, 204].includes(movePut.status), `move PUT status ${movePut.status}`);

    const document = await loadedWorkspace();
    const moved = (document.toDos as Array<Record<string, unknown>>).find(
      (toDo) => toDo.title === "Move me",
    );
    assert.ok(moved);
    assert.deepEqual(moved.location, {
      kind: "project",
      projectId: projectList.replace(/^project-/, ""),
    });

    // The follow-up DELETE of the old Inbox href must not trash the moved
    // to-do — it aimed at the previous list of a moved resource.
    const oldDelete = await SELF.fetch(`${ORIGIN}${inboxHref}`, {
      method: "DELETE",
      headers: basic(token),
    });
    assert.equal(oldDelete.status, 204);
    const after = await loadedWorkspace();
    const survived = (after.toDos as Array<Record<string, unknown>>).find(
      (toDo) => toDo.title === "Move me",
    );
    assert.ok(survived);
    assert.equal(survived.trashedAt, null, "deleting the old href of a move is a no-op");
  });

  it("emits RFC 6578 tombstones on incremental syncs but never on initial syncs", async () => {
    const listUrl = `${ORIGIN}/dav/${USER_ID}/inbox/`;
    // Create and delete one item.
    const resource = `${crypto.randomUUID()}.ics`;
    await SELF.fetch(`${listUrl}${resource}`, {
      method: "PUT",
      headers: { ...basic(token), "If-None-Match": "*" },
      body: newVtodoBody("Doomed", null),
    });
    await SELF.fetch(`${listUrl}${resource}`, { method: "DELETE", headers: basic(token) });

    const initial = await SELF.fetch(listUrl, {
      method: "REPORT",
      headers: basic(token),
      body: SYNC_COLLECTION,
    });
    assert.equal(initial.status, 207);
    const initialXml = await initial.text();
    assert.ok(!initialXml.includes("404"), "initial sync carries no tombstones");
    const syncToken = /<D:sync-token>([^<]+)<\/D:sync-token>/.exec(initialXml)?.[1];
    assert.ok(syncToken);

    // Incremental sync with the same token: no changes.
    const same = await SELF.fetch(listUrl, {
      method: "REPORT",
      headers: basic(token),
      body: SYNC_COLLECTION.replace("<D:sync-token/>", `<D:sync-token>${syncToken}</D:sync-token>`),
    });
    const sameXml = await same.text();
    assert.ok(!/<D:response>/.test(sameXml), "unchanged token returns no members");

    // A new phone edit bumps the revision: the incremental sync re-lists
    // members and now includes the tombstone for the deleted resource.
    const bump = await SELF.fetch(`${listUrl}${crypto.randomUUID()}.ics`, {
      method: "PUT",
      headers: { ...basic(token), "If-None-Match": "*" },
      body: newVtodoBody("Bump", null),
    });
    assert.equal(bump.status, 201);
    const incremental = await SELF.fetch(listUrl, {
      method: "REPORT",
      headers: basic(token),
      body: SYNC_COLLECTION.replace("<D:sync-token/>", `<D:sync-token>${syncToken}</D:sync-token>`),
    });
    const incrementalXml = await incremental.text();
    assert.match(incrementalXml, /404 Not Found/, "deleted resources appear as tombstones");
    assert.match(incrementalXml, new RegExp(resource));
  });

  it("answers multiget for attribute-carrying hrefs", async () => {
    const resource = `${crypto.randomUUID()}.ics`;
    await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/inbox/${resource}`, {
      method: "PUT",
      headers: { ...basic(token), "If-None-Match": "*" },
      body: newVtodoBody("Multiget target", null),
    });
    const response = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/inbox/`, {
      method: "REPORT",
      headers: basic(token),
      body: multiget(`/dav/${USER_ID}/inbox/${resource}`),
    });
    assert.equal(response.status, 207);
    const xml = await response.text();
    assert.match(xml, /getetag/);
    assert.match(xml, /SUMMARY:Multiget target/);
    assert.equal(extractHrefResource(xml), resource);
  });

  it("keeps calendar-query serving dateless VTODOs", async () => {
    await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/inbox/${crypto.randomUUID()}.ics`, {
      method: "PUT",
      headers: { ...basic(token), "If-None-Match": "*" },
      body: newVtodoBody("No dates at all", null),
    });
    const response = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/inbox/`, {
      method: "REPORT",
      headers: basic(token),
      body: CALENDAR_QUERY,
    });
    const xml = await response.text();
    assert.match(xml, /SUMMARY:No dates at all/);
  });

  it("survives identical PUT retries through idempotency receipts", async () => {
    const resource = `${crypto.randomUUID()}.ics`;
    const body = newVtodoBody("Retry me", null);
    const first = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/inbox/${resource}`, {
      method: "PUT",
      headers: { ...basic(token), "If-None-Match": "*" },
      body,
    });
    assert.equal(first.status, 201);
    const retry = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/inbox/${resource}`, {
      method: "PUT",
      headers: { ...basic(token), "If-None-Match": "*" },
      body,
    });
    assert.ok([201, 204, 412].includes(retry.status));
    const document = await loadedWorkspace();
    const matches = (document.toDos as Array<Record<string, unknown>>).filter(
      (toDo) => toDo.title === "Retry me",
    );
    assert.equal(matches.length, 1, "an identical retry never creates a second to-do");
  });

  it("revoking the token kills the account", async () => {
    const label = `revoke-${crypto.randomUUID()}`;
    const marked = await createToken(label);
    const list = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/inbox/`, {
      method: "PROPFIND",
      headers: { ...basic(marked), Depth: "0" },
      body: PROPFIND_PRINCIPAL,
    });
    assert.equal(list.status, 207);

    const listed = await api("/api/caldav/tokens");
    const { tokens } = (await listed.json()) as { tokens: Array<{ id: string; label: string }> };
    const target = tokens.find((entry) => entry.label === label);
    assert.ok(target);
    const revoked = await api(`/api/caldav/tokens/${target.id}`, { method: "DELETE" });
    assert.equal(revoked.status, 200);

    const after = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/inbox/`, {
      method: "PROPFIND",
      headers: { ...basic(marked), Depth: "0" },
      body: PROPFIND_PRINCIPAL,
    });
    assert.equal(after.status, 401, "a revoked token no longer authenticates");
  });

  it("rejects a token minted for another account", async () => {
    const otherSession: Session = { ...session, userId: "user_02OTHER0000000000000000" };
    const sealed = await sealSession(env, otherSession);
    const created = await SELF.fetch(`${ORIGIN}/api/caldav/tokens`, {
      method: "POST",
      headers: { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(sealed)}` },
      body: JSON.stringify({ label: "Other phone", timeZone: "Europe/Berlin" }),
    });
    assert.equal(created.status, 201);
    const { token: otherToken } = (await created.json()) as { token: { token: string } };
    const response = await SELF.fetch(`${ORIGIN}/dav/${USER_ID}/inbox/`, {
      method: "PROPFIND",
      headers: { ...basic(otherToken.token), Depth: "0" },
      body: PROPFIND_PRINCIPAL,
    });
    assert.equal(response.status, 401);
  });

  it("requires a session for the token API and validates input", async () => {
    const anonymous = await SELF.fetch(`${ORIGIN}/api/caldav/tokens`);
    assert.equal(anonymous.status, 401);
    const bad = await api("/api/caldav/tokens", {
      method: "POST",
      body: JSON.stringify({ label: "", timeZone: "America/New_York" }),
    });
    assert.equal(bad.status, 400);
    const badZone = await api("/api/caldav/tokens", {
      method: "POST",
      body: JSON.stringify({ label: "Phone", timeZone: "Middle/Earth" }),
    });
    assert.equal(badZone.status, 400);
  });
});
