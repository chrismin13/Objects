# What iOS Reminders' CalDAV client actually requires of a server

Research findings for [Wayfinder ticket: What does iOS Reminders' CalDAV client actually require of a server?](https://github.com/chrismin13/Objects/issues/3) — map: [iOS Reminders sync via CalDAV](https://github.com/chrismin13/Objects/issues/1).

Scope: the minimal WebDAV/CalDAV surface (verbs, headers, reports, URLs) iOS Reminders' generic CalDAV account accepts and happily syncs VTODOs against, plus known quirks. Precise enough to size the Worker-side endpoint and to feed the prototype ticket.

Primary sources: RFC 4791/5545/6764/6578, server implementation issue trackers where real iOS request traces were captured (Vikunja, Tududi, Baïkal, forwardemail), and sabre/dav's iOS client notes. iCloud-specific servers were ignored — we care about iOS as *client*.

## TL;DR — the minimal surface

| Verb | Where | Why |
|---|---|---|
| `OPTIONS` | every DAV path | iOS checks `DAV: 1, 2, calendar-access` header; the tududi fix specifically made `Allow:` include PROPFIND on the principal path or account validation spun forever |
| `PROPFIND` (Depth 0/1) | `/.well-known/caldav`, `/principals/<u>/`, home set, each list, each `.ics` | discovery + change polling (getctag/sync-token + getetag) |
| `REPORT` | on lists | `calendar-query` (filter VTODOs, sometimes `prop-filter` on COMPLETED) and `calendar-multiget` (fetch bodies by href) |
| `GET` | `.ics` resources | fallback object fetch |
| `PUT` | `.ics` resources | create with `If-None-Match: *`, edit with `If-Match` — **must** honor both, answer 412 on mismatch, return the new strong ETag in the response |
| `DELETE` | `.ics` resources | delete/complete-and-remove from Reminders |
| `PROPPATCH` | lists | iOS rewrites `displayname` + `calendar-color` on lists; **405 here correlates with lists vanishing** — must answer `207` with `200` propstat (no-op acceptable) |
| `MKCALENDAR` | home set | iOS tries to create a default "Reminders" list (UUID-named) when it finds none — decide accept-vs-reject in the sync-engine ticket |

Auth: HTTP Basic only (confirmed by the map's earlier charting decision — iOS generic CalDAV accounts speak Basic). HTTPS effectively mandatory — Vikunja's maintainer observed iOS refusing to even send credentials over plain HTTP; a Cloudflare Worker is always HTTPS, so this is free.

## 1. Who's calling: three daemons, one account

From the Vikunja trace ([go-vikunja/vikunja#475](https://github.com/go-vikunja/vikunja/issues/475), iOS 14.3–16.0, user agents `accountsd/1.0`, `remindd/1.0`, `dataaccessd/1.0`):

- **accountsd** validates the account at setup: anonymous `PROPFIND /.well-known/caldav` → expects `401` + `WWW-Authenticate: Basic realm=...` → retries with Basic credentials. A server that answers 404 (or answers anonymously) makes iOS give up silently.
- **remindd** does the Reminders sync: PROPFINDs the principal → home set → each list; PROPPATCHes list properties; PUTs/DELETEs `.ics` resources.
- **dataaccessd** duplicates parts of the discovery.

All three issue the anonymous-first-then-Basic challenge dance, repeatedly, on every sync cycle. Expect a `401` on nearly every URL before the authenticated retry — that's normal, not a bug.

## 2. Discovery chain (RFC 6764)

iOS walks, in order (observed in [Vikunja #475](https://github.com/go-vikunja/vikunja/issues/475) and [tududi#1136](https://github.com/chrisvel/tududi/issues/1136)):

1. `PROPFIND /.well-known/caldav` (Depth 0) asking for `{DAV:}current-user-principal` (and friends).
2. Fallbacks on failure: `PROPFIND /`, `PROPFIND /principals/`, `PROPFIND /calendar/dav/<user>/user/`.
3. `PROPFIND <principal URL>` asking for `{urn:ietf:params:xml:ns:caldav}calendar-home-set`, `calendar-user-address-set`, `{DAV:}displayname`, and Calendar-server scheduling props (safely 404-able).
4. `PROPFIND <home set>` Depth 1 → the lists.

Hard-won quirks from servers that broke here:

- **Don't rely on redirects.** RFC 6764 permits `301/302/307` from the well-known URL, but forwardemail's iOS compliance work specifically switched their root/well-known `PROPFIND` from `302` to a direct `207` multistatus "enabling iOS/macOS discovery without following redirects" ([forwardemail commit](https://github.com/forwardemail/caldav-adapter/commit/68fc6e6)), and Baïkal behind a proxy broke because the redirect lost scheme/port ([Baïkal#1391](https://github.com/sabre-io/Baikal/issues/1391)). **Answer the well-known PROPFIND directly with 207 + `current-user-principal`.**
- **Anchor from anywhere.** iOS PROPFINDs collections mid-session and expects `current-user-principal` (and legacy `principal-URL`) in the response; its absence made iOS retry 3× and abort account validation ([tududi PR #1160](https://github.com/chrisvel/tududi/pull/1160), from tcpdump of `accountsd`).
- **`OPTIONS` matters.** The same tududi fix added `OPTIONS` on the principal path returning proper `DAV:` and `Allow:` headers — Express's default `Allow: GET,HEAD` stalled iOS.
- **Vikunja's Reminders fix** ([vikunja PR #2417](https://github.com/go-vikunja/vikunja/pull/2417)): Apple Reminders re-derives the home set from the account URL rather than remembering the principal-issued one — the home set should be predictable from the account URL.

Sizing for Objects: a tiny static tree — `/.well-known/caldav` → `/principals/<user>/` → `/dav/<user>/` (home) → `/dav/<user>/<project>/` (one list per Project, per the charting decision).

## 3. Lists: what makes Reminders show a collection

`PROPFIND <home> Depth 1` asks per child for: `resourcetype` (must include `{urn:ietf:params:xml:ns:caldav}calendar`), `displayname`, `{http://calendarserver.org/ns/}getctag`, `{DAV:}sync-token`, `{urn:ietf:params:xml:ns:caldav}supported-calendar-component-set`, `{http://apple.com/ns/ical/}calendar-color`, `current-user-privilege-set` ([sabre/dav iOS notes](https://sabre.io/dav/clients/ios/)).

- **`supported-calendar-component-set` is the gate.** Reminders only shows collections advertising `<comp name="VTODO"/>`. DAViCal documented that iOS 7+ *requires* separate VEVENT/VTODO collections and ignores mixed ones ([DAViCal wiki](https://wiki.davical.org/index.php?title=Setup_for_Apple_Users)). Every Objects list advertises VTODO only — cheap for us, fatal if omitted (this is the classic "Reminders shows 0 lists" bug, e.g. [Baïkal#995](https://github.com/sabre-io/Baikal/issues/995)).
- **PROPPATCH must succeed.** iOS immediately PROPPATCHes `displayname`/`calendar-color` on each list (visible in every trace). Vikunja returned 405 and the working hypothesis there is that those failures are what made lists disappear. Return `207` with `200` propstat; honoring the rename/color is optional (list names are web-app-only per the charting decision — so a polite no-op is right).
- **MKCALENDAR for a default list.** On first sync iOS attempts `MKCALENDAR <home>/<UUID>/` to create a default Reminders list ([Vikunja #475](https://github.com/go-vikunja/vikunja/issues/475) trace). If it finds existing VTODO lists it may not need it; the prototype should observe whether rejecting with 403/507 is tolerated. Decision deferred to the sync-engine ticket.

## 4. Reading VTODOs: reports and change detection

- **Initial listing**: iOS PROPFINDs each list (Depth 1) and/or issues a `calendar-query` REPORT filtered to `VCALENDAR/VTODO`. Evidence that Reminders specifically sends a `prop-filter` with a *negated text-match on COMPLETED* to exclude completed to-dos: [forwardemail commit](https://github.com/forwardemail/caldav-adapter/commit/b3024135b105140b3be2b9bb6498d50b523d595e). **Implement `calendar-query` with real filter evaluation** (comp-filter on VTODO; parse `prop-filter`, `is-not-defined`, `text-match`), not a filter-ignoring passthrough.
- **`calendar-multiget`** is then used to fetch bodies by href with `getetag + calendar-data` ([sabre/dav iOS notes](https://sabre.io/dav/clients/ios/)). Must implement.
- **RFC 4791 §9.9 time-range trap**: a VTODO with *none* of DTSTART/DUE/COMPLETED/CREATED **MUST be returned in all time-range queries**. Servers that skipped dateless VTODOs made Apple reminders (including location-based ones with no temporal anchor) vanish ([forwardemail commit](https://github.com/forwardemail/forwardemail.net/commit/0a81a5e76335718a98419e6821a3a231aac0c3a5)). Relevant to Objects: unscheduled to-dos must still be listed.
- **Incremental sync**: iOS polls each list with `PROPFIND Depth 0` for `getctag` and/or `sync-token` ([sabre/dav](https://sabre.io/dav/clients/ios/)); on change it re-runs the query/multiget and compares ETags. Two levels of support:
  1. **Minimum viable**: serve a `getctag` (CalendarServer namespace) that changes whenever any to-do in the list changes; let iOS re-fetch etags and diff. No server-side change log needed.
  2. **Full RFC 6578**: implement `sync-collection` REPORT with stable sync tokens + tombstones (and per §3.4, don't emit tombstones on an initial empty-token sync — iOS/macOS can't process them; [forwardemail commit](https://github.com/forwardemail/forwardemail.net/commit/79423d40a3a7c3d90ba7b1e88b709e47c0a757ff)).
  
  Recommendation for Objects: start with getctag + etag diff (option 1); a per-list revision counter from the Durable Object's existing revision counter likely serves as the ctag for free. This choice belongs to the sync-engine ticket.
- **ETags everywhere**: strong ETag on every GET/PROPFIND/REPORT/multiget result and on PUT responses; changes on any content change (RFC 4791 §5.3.8, errata; [CalConnect server guide](https://devguide.calconnect.org/caldav/server/)).

## 5. Writes from Reminders

Observed iOS PUT behavior (Vikunja trace + [sabredav-discuss report of a live iOS session](https://groups.google.com/g/sabredav-discuss/c/N0l6hUWpOBM)):

- **Create**: `PUT <list>/<UUID>.ics` with `If-None-Match: *` → expect `201` + `ETag` header. iOS generates UUID resource names itself.
- **Edit**: `PUT` with `If-Match: "<last known etag>"` → expect `204`/`200` + new `ETag`. **Honor the precondition — return `412 Precondition Failed` on mismatch.** If the server normalizes/rewrites the iCalendar body on storage, it must return the *new* ETag, not echo the client's ([sabre/dav client guide](https://sabre.io/dav/building-a-caldav-client/)). This maps cleanly onto Objects' revisioned-command pipeline: If-Match vs current revision = the natural lost-update check.
- **Delete**: `DELETE <list>/<uid>.ics` (may carry If-Match) → `204`. Feeds the Trash-on-delete wiring in the sync-engine ticket.
- A full VTODO round-trip must preserve the DATE vs DATE-TIME distinction (below) or iOS silently drops the reminder.

## 6. VTODO property quirks (the part that bites)

- **Date-only DUE uses `VALUE=DATE`.** When a user sets a date without a time, iOS sends `DUE;VALUE=DATE:20201229` — an 8-char date, not a datetime. Vikunja's datetime-only parser blew up on exactly this ([Vikunja #475](https://github.com/go-vikunja/vikunja/issues/475): `parsing time "20201229" as "20060102T150405"`). **The Worker's VTODO parser must accept both forms** (RFC 5545 §3.3.4/3.3.5).
- **Round-trip fidelity matters.** Tududi bug [#1166](https://github.com/chrisvel/tududi/issues/1166): a timed DUE collapsed to date-only on round-trip and the reminder was *lost*. Whether Objects' Schedule ("date and optionally This Evening") needs DATE vs DATE-TIME handling is exactly what the Objects-internals research ticket [#4](https://github.com/chrismin13/Objects/issues/4) must answer.
- **Serializing date-only as UTC datetime shifts the day.** Emitting `DUE:20260527T235900Z` made iOS treat all-day items as 23:59 timed reminders, and in UTC+2 timezones moved them to the next day; the fix was serializing `DUE;VALUE=DATE` ([tududi PR #1157](https://github.com/chrisvel/tududi/pull/1157)).
- **VALARM**: iOS writes `VALARM` blocks for timed/reminders-with-alerts. Tududi's round-trip dropped them (#1166 again). Out of scope as a *feature* (Reminders-only features are excluded by the map), but the sync-engine ticket should decide whether VALARM is preserved-as-opaque or dropped.
- **Completion**: iOS sets `STATUS:COMPLETED` + `COMPLETED:<timestamp>` (+ `PERCENT-COMPLETE:100`). Maps to Outcome. "Completed" to-dos excluded from Reminders' default queries via the COMPLETED prop-filter — but Objects must still serve them (Logbook) when queried.
- **Priority** is the inverse iCal scale (1 high … 9 low, 0 none); **subtasks** via `RELATED-TO`; **tags** via `CATEGORIES` — standard mappings already settled in the charting decision ([#2](https://github.com/chrismin13/Objects/issues/2)).
- **Recurrence exceptions** (`RECURRENCE-ID`) — deliberately left in the map's fog until the sync-engine/prototype passes.

## 7. Sizing summary for the Worker

Concrete minimal endpoint, per the above:

```
HTTPS + Basic auth (app-specific token) on objects.chrismin13.com:

OPTIONS   /*                          → DAV: 1, 2, calendar-access
PROPFIND  /.well-known/caldav         → 207, current-user-principal   (no redirect)
PROPFIND  /principals/<user>/         → 207, calendar-home-set + current-user-principal
PROPFIND  /dav/<user>/      (Depth 1) → 207, list of Project collections (VTODO-only comp set,
                                         displayname, getctag, sync-token, calendar-color)
PROPPATCH /dav/<user>/<project>/      → 207 no-op (displayname/color)
MKCALENDAR /dav/<user>/<uuid>/        → TBD by sync-engine ticket
REPORT    calendar-query              → VTODO hrefs+etags (real filter eval, §9.9 dateless rule)
REPORT    calendar-multiget           → VTODO bodies by href
REPORT    sync-collection             → optional (getctag+etag first)
GET/PUT/DELETE /dav/<user>/<project>/<uid>.ics
PUT preconditions: If-None-Match:* (201), If-Match (204, 412), always new ETag
```

No locking (Class 2 advertised but unused by iOS for this), no scheduling, no sharing, no delegation — iOS doesn't use them for Reminders sync ([sabre/dav](https://sabre.io/dav/clients/ios/)).

## Risk register for the prototype ticket

1. Redirect behavior at `/.well-known/caldav` — serve 207 directly. (Highest-frequency failure across Baïkal/tududi/forwardemail.)
2. `supported-calendar-component-set` VTODO-only on every list — omitting it yields "0 lists".
3. PROPPATCH 405 — suspected list-vanishing cause; return 207 no-op.
4. Date-only `DUE;VALUE=DATE` parse + round-trip fidelity.
5. Anonymous probe then Basic — 401 must carry `WWW-Authenticate`.
6. ETag discipline on PUT responses (new ETag, not echoed).
7. `calendar-query` must not filter out dateless VTODOs.

## Sources

- [Vikunja #475 — CalDAV not working properly with iOS](https://github.com/go-vikunja/vikunja/issues/475) — full request traces of iOS 14–16 `remindd`/`accountsd`/`dataaccessd`, incl. the DUE;VALUE=DATE parse failure and PROPPATCH/MKCALENDAR behavior.
- [Vikunja PR #2417 — Fix iOS/MacOS Reminders CalDAV support](https://github.com/go-vikunja/vikunja/pull/2417) — Reminders re-derives home set from account URL.
- [tududi #1136 / PR #1160 — iOS autodiscovery](https://github.com/chrisvel/tududi/pull/1160) — tcpdump of accountsd; current-user-principal on collections, OPTIONS/Allow, root PROPFIND routing.
- [tududi PR #1157](https://github.com/chrisvel/tududi/pull/1157) and [#1166](https://github.com/chrisvel/tududi/issues/1166) — VALUE=DATE serialization and timed-DUE round-trip loss.
- [sabre/dav — iOS client notes](https://sabre.io/dav/clients/ios/) — principal/home-set PROPFIND properties, getctag/sync-token polling, calendar-query/multiget shapes, non-root-URL bugs.
- [sabre/dav — Building a CalDAV client](https://sabre.io/dav/building-a-caldav-client/) — ctag→etag→multiget flow; ETag on PUT semantics.
- [sabredav-discuss — Update created events from iOS](https://groups.google.com/g/sabredav-discuss/c/N0l6hUWpOBM) — iOS sends If-None-Match on create, If-Match on edit.
- [DAViCal wiki — Setup for Apple Users](https://wiki.davical.org/index.php?title=Setup_for_Apple_Users) — iOS requires VEVENT/VTODO split via supported-calendar-component-set; port/SNI pickiness.
- [Baïkal #995](https://github.com/sabre-io/Baikal/issues/995), [#1171](https://github.com/sabre-io/Baikal/issues/1171), [#1391](https://github.com/sabre-io/Baikal/issues/1391) — iOS Reminders empty-list and redirect failures.
- [forwardemail commits](https://github.com/forwardemail/caldav-adapter/commit/68fc6e677e26d7a4880c4fc394fd9aa80e7a87b5) — 207-not-redirect at root, component-set gating, prop-filter for Reminders' COMPLETED exclusion, §9.9 dateless-VTODO rule, RFC 6578 tombstone rule.
- [RFC 4791](https://datatracker.ietf.org/doc/html/rfc4791) (CalDAV), [RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545) (iCalendar), [RFC 6764](https://datatracker.ietf.org/doc/html/rfc6764) (discovery), [RFC 6578](https://datatracker.ietf.org/doc/html/rfc6578) (sync-collection).
- [CalConnect dev guide — CalDAV server](https://devguide.calconnect.org/caldav/server/) — baseline server requirements checklist.
