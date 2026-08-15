# Spec: iOS Reminders sync via CalDAV

Status: **locked** — ready for implementation. Decisions trace to map #1 and
tickets #2–#7; on-device facts trace to the #5 prototype and the #7 probe
session (iOS 27.0 beta, remindd/4043, real iPhone over the live prototype
worker). ADRs: [0001](../adr/0001-caldav-in-worker.md),
[0002](../adr/0002-do-single-source-of-truth.md),
[0003](../adr/0003-floating-time-alarms.md),
[0004](../adr/0004-basic-auth-app-tokens.md).

Vocabulary per `CONTEXT.md`: to-do (not task), Schedule vs Deadline,
Outcome, Trash, Occurrence, Repeating Template.

## 1. The contract this spec must uphold

The Durable Object is the single source of truth (ADR 0002). The CalDAV
layer is an adapter: it reads the workspace snapshot and writes typed
`WorkspaceChange`s through `resolveSyncCommand` under `transactionSync` —
the capture-path pattern (`worker/workspace-do.ts` `capture`, documented in
`shared/workspace/http-capture.ts`). No private write path, no second
storage, no hand-edited documents. **The failure mode of any sync bug is
staleness, never corruption or data loss.** Every mechanism below was chosen
so its worst case is a stale VTODO or a dropped phone edit, never a wrong
write.

## 2. Endpoint surface

Host: the production domain (`objects.chrismin13.com`). Add `/.well-known/*`
and `/dav/*` and `/principals/*` to `run_worker_first` in `wrangler.jsonc`
(today only `/api/*`, `/auth/*`, `/.well-known/*`, `/caldav-proto/*` are
routed; strip the prototype prefix when the prototype is torn down).

```
OPTIONS   any CalDAV path               → 200; DAV: 1, 2, calendar-access; full Allow:
                                          OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND,
                                          PROPPATCH, REPORT, MKCALENDAR
PROPFIND  /.well-known/caldav           → 207 + current-user-principal, 207-DIRECT
                                          (never a redirect — highest-frequency iOS
                                          failure across Baïkal/tududi/forwardemail)
PROPFIND  /principals/<userId>/         → 207: calendar-home-set, displayname,
                                          resourcetype collection+principal,
                                          current-user-principal (anchor from anywhere)
PROPFIND  /dav/<userId>/     (Depth 1)  → 207: home + one collection per list
PROPFIND  /dav/<userId>/<list>/         → 207: list props (+ members at Depth 1)
PROPPATCH /dav/<userId>/<list>/         → 207 no-op (405s correlate with lists
                                          vanishing in Reminders)
REPORT    calendar-query                → hrefs+etags(+bodies); real filter eval
REPORT    calendar-multiget             → bodies by href (see §9 parsing rule)
REPORT    sync-collection               → members + RFC 6578 tombstones
GET/HEAD  /dav/<userId>/<list>/<uuid>.ics → body + strong ETag
PUT       same                          → If-None-Match:* → 201; If-Match → 204/412;
                                          ALWAYS return the new ETag
DELETE    same                          → 204 (idempotent)
MKCALENDAR                              → unreachable: edge-blocked 501
                                          (cloudflare/workerd#6877) — no code path needed
```

`<userId>` is the opaque WorkOS user id — the same key the Workspace DO is
named by, so routing is `WORKSPACE_DO.idFromName(userId)` with no lookup.
The home set is predictable from the account URL (Reminders re-derives it;
Vikunja PR #2417). Username in Basic auth is ignored (ADR 0004).

Auth dance: iOS probes anonymously first — answer `401` +
`WWW-Authenticate: Basic realm="Objects"` on every CalDAV path (including
well-known), then accept Basic. HTTPS is inherent.

Lists (per #2): one collection per **Project**, one per **Area**, plus a
special **Inbox** list for unfiled to-dos (the Siri default target).
Headings are invisible (to-dos appear directly in their Project/Area list).
Containers are created/renamed/moved web-only; the Inbox/Project/Area lists
appear and disappear as containers do. Each app token has a Space scope:
**All Spaces** (the default and the value for pre-existing tokens) or exactly
one Space. A single-Space token exposes only that Space's Projects and Areas;
its Inbox contains only unfiled to-dos in that Space, and inbound Inbox writes
land there rather than in the workspace default Space. Guessed URLs outside
the scope answer 404. If the selected Space is deleted, the token exposes no
lists until it is replaced. List `displayname` = plain container title;
`calendar-color` = owning Space's color (revisit prefixes after lived
experience — rendering-only change). Every list advertises
`supported-calendar-component-set: VTODO` **only** (omitting this yields
"0 lists"). Trashed containers vanish from the home set.

`getctag` per list includes the token's Space scope plus the snapshot
revision (any write anywhere bumps it; iOS re-diffs by ETag — false positives
are harmless). `sync-token` is scope-specific for the same reason: changing
from All Spaces to one Space must force a fresh collection sync even when iOS
reuses an earlier account's token. All-Spaces tokens preserve the original
`https://objects.chrismin13.com/dav/sync/<revision>` format.

## 3. Outbound mapping (Objects → VTODO)

Resources are named `<uuid>.ics`, allocated at first render, **stable for
the to-do's lifetime** (survives Trash and restore; permanent deletion
removes the anchor; the phone drops its copy by tombstone/absence).

Deterministic render — the ETag is the content hash of exactly these bytes,
so the render must be a pure function of to-do + container state (plus
DTSTAMP/LAST-MODIFIED, see §8). CRLF line endings, always.

| Objects                                  | VTODO                                                           | Notes                                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| title                                    | `SUMMARY`                                                       |                                                                                                                                 |
| notes                                    | `DESCRIPTION`                                                   | escaped per RFC 5545                                                                                                            |
| Schedule `scheduled` (no Reminder)       | `DUE;VALUE=DATE:YYYYMMDD`                                       | date-only, never a UTC datetime (day-shift bug class)                                                                           |
| Schedule `scheduled` + Reminder          | `DUE:YYYYMMDDTHHMMSS` floating (ADR 0003)                       | wall time, no Z, no TZID; `evening` has no carrier — drops outbound                                                             |
| Schedule inbox/anytime/someday           | _(omitted)_                                                     | RFC 4791 §9.9 dateless rule keeps them listed — do NOT invent a DUE                                                             |
| Reminder                                 | `VALARM` `ACTION:DISPLAY`, `TRIGGER:PT0S`                       | one per to-do; validated at-due form; `sentAt` is web-only (marking an alert done on iOS does not clear Objects' delivery flag) |
| Outcome open                             | `STATUS:NEEDS-ACTION`                                           |                                                                                                                                 |
| Outcome completed                        | `STATUS:COMPLETED` + `COMPLETED:<utc>` + `PERCENT-COMPLETE:100` | matches what iOS itself writes (captured on-device)                                                                             |
| Outcome canceled                         | `STATUS:COMPLETED` + `COMPLETED:<utc>`                          | shown-as-completed, read-only on the phone (#2); un-checking is ignored                                                         |
| Tags                                     | `CATEGORIES:a,b`                                                |                                                                                                                                 |
| Location (Project/Area/Inbox membership) | which list the resource lives in                                | Heading-parented to-dos render in their Project/Area list                                                                       |
| `createdAt`                              | `CREATED:<utc>`                                                 |                                                                                                                                 |
| —                                        | `DTSTAMP`, `LAST-MODIFIED: <render time>`                       | §8: must advance on every outbound change                                                                                       |
| Deadline, checklist, evening flag        | _(no carrier)_                                                  | feature matrix                                                                                                                  |
| Occurrences                              | plain VTODOs (never RRULE)                                      | so RECURRENCE-ID can never occur; #6 graduation                                                                                 |
| Repeating Templates                      | not rendered                                                    | repeat rules are Objects-only                                                                                                   |

Inbox/Area/Project lists expose only to-dos whose Location resolves to that
container (or unfiled for Inbox). Completed and canceled to-dos are served
in query/multiget (iOS filters them itself with the COMPLETED prop-filter;
"Show Completed" works); trashed and permanently-deleted to-dos vanish from
query/multiget/sync-collection members, and GET/PUT on their resources
returns 404 so the phone drops stale copies.

## 4. Inbound mapping (VTODO → WorkspaceChanges)

All inbound writes are typed `WorkspaceChange`s applied inside the DO under
`transactionSync` (ADR 0002). Rejected changes leave state untouched; the
VTODO stays stale until iOS re-syncs.

**PUT (create):** `If-None-Match: *` on an unknown resource → `createToDo`
with `location` = the list's container (Inbox list → unfiled in the default
Space), `schedule` from DUE (`VALUE=DATE` → `{kind:"scheduled", date,
evening:false}`; floating or TZID time → scheduled + `reminderAt` as
**wall-time fake-UTC**, ignoring Z/TZID — ADR 0003; no DUE → `{kind:"inbox"}`,
the domain default). `SUMMARY` → title, `DESCRIPTION` → notes, `CATEGORIES`
→ `setToDoTags {titles}` (auto-creates tags — the domain's own semantics).
`STATUS:COMPLETED` present → follow with `completeToDo`. RRULE present →
accept as a plain open to-do; repeat rules are Objects-only (the phone's
local repeating copy diverges by design — feature matrix). VALARM: relative
`TRIGGER:PT0S`/`RELATED=END` at-due → Reminder at the DUE wall time;
absolute `TRIGGER;VALUE=DATE-TIME` (Apple's Siri form, observed) → Reminder
at that UTC instant read as wall time; proximity/`X-APPLE-*` alarms
(observed: `TRIGGER;VALUE=DATE-TIME:19760401T005545Z` placeholder +
`X-APPLE-PROXIMITY:ARRIVE`) → ignored. One alert per to-do, first wins.

**PUT (edit):** per-field three-way merge against the per-resource anchor
(§6). Derived fields: `STATUS:COMPLETED` + `COMPLETED` added →
`completeToDo`; removed → `reopenToDo` (unless Outcome canceled — ignored,
reopening canceled is Objects-only); DUE/DTSTART date change → `updateToDo`
schedule (the domain moves a matching Reminder along — never set both
independently); `DTSTART` is parsed but not stored (iOS writes DTSTART=
DUE for timed items, observed).

**DELETE:** open to-do → `trashToDo`; completed/canceled to-do → ignored
(204, no state change) — which makes Reminders' clear-completed a no-op
automatically. The adapter stops at Trash, like the web client; no
`permanentlyDeleteToDo`.

**MOVE (re-file):** drag between lists = `updateToDo` location change
(moved to-dos land directly in the Project/Area; Headings stay invisible).
Creating/renaming/moving containers from the phone is not possible
(MKCALENDAR edge-blocked) and not desired.

**Idempotency:** `mutationId = caldav:put:<resource>:<sha256(body)>` —
identical iOS retries replay the original ack from the receipts table.
DELETE needs no receipt (`trashToDo` on a trashed to-do is a natural no-op).
Anchors survive Trash and restore; permanent deletion removes the anchor.

## 5. Conflict policy — "Objects wins ties"

The adapter keeps a small per-resource anchor in the DO: resource name →
`{toDoId, last-served field values}`. An inbound PUT is a per-field
three-way merge against the anchor:

- phone value == anchor value (phone didn't change the field) → no-op — a
  stale echo cannot clobber a newer Objects write (this is the tie rule);
  this also neutralizes remindd's echo-PUTs (observed: our own VTODOs
  returned with `X-APPLE-SORT-ORDER` and rewritten `CREATED`);
- phone value ≠ anchor (phone changed it) → apply the phone's value;
- missing/stale anchor → degrade to Objects-wins (worst case: a dropped
  phone edit — staleness, never a wrong write).

Chosen over strict `If-Match`/412 OCC because remindd's 412 recovery is
unobserved; the merge assumes nothing about client behavior. `If-Match`
still gates resource existence (404 for vanished resources); 412 remains
protocol-correct for ETag mismatch on preconditional creates.

## 6. Outbound change detection

Stateless (ADR 0002): ctag = snapshot `revision`; ETag = content hash of the
deterministic render. When ctag changes, iOS re-queries, diffs ETags, and
refetches mismatched resources. No stored sync state exists that could
diverge — no split brain is possible. Deletions propagate two ways: absence
from query results (query path) and **RFC 6578 tombstones** in
sync-collection (§7).

**Occurrence generation:** when serving a calendar-query, the adapter first
submits `generateRepeatingOccurrences { throughDate: today }` through the
normal command path — bounded exactly like the web client (today,
`REPEATING_BATCH_LIMIT`). Without this, repeating work silently degrades on
the phone. "Today" is computed in the token's stored timezone (ADR 0003).

## 7. sync-collection

iOS 27's remindd syncs incrementally via sync-collection (observed; it
sends `sync-token`, `sync-level 1`, wants `getetag` + `getcontenttype`).
Serve all members + new sync-token when the token differs; **include
tombstones (404-status responses) for anchor-known deleted resources** —
validated on-device: without tombstones, deleted items never leave the
phone (new items arrived, deleted ones stayed). Never emit tombstones on an
initial (empty-token) sync (RFC 6578 §3.4). Tombstone source = the anchor
table minus live resources; entries are pruning-able once every sync-token
ever issued is older than the deletion revision (in practice: keep N
revisions of tombstones, size-bounded).

## 8. Protocol rules validated on-device (the unforgiving list)

1. **Real XML parsing, not regexes.** iOS decorates elements with inline
   namespace declarations (`<A:href xmlns:A="DAV:">`); the prototype's
   regex missed every href and served empty multistatuses — remindd
   silently ingested nothing. Use a namespace-aware XML parser
   (e.g. `fast-xml-parser` vendored or equivalent) for all REPORT bodies
   and PROPPATCH/PROPFIND requests.
2. **CRLF everywhere.** LF-only iCalendar bodies are never ingested.
3. **Advance `DTSTAMP`/`LAST-MODIFIED` on every outbound change** (render
   time), and exclude them from the ETag content hash inputs _or_ accept
   that a no-op re-render changes the ETag — choose the former: hash the
   field-relevant properties only, so unchanged to-dos keep stable ETags
   while changed ones still carry fresh stamps. (Observed: remindd ignored
   body updates whose stamps hadn't advanced.)
4. **GET/HEAD is a live fetch path** for remindd (observed plain GETs after
   ETag diffs) — serve body + ETag there, not just in reports.
5. **ETag discipline:** strong ETag on every GET/PROPFIND/REPORT/multiget
   result; on PUT return the **new** ETag, never echo the client's.
6. **207-direct well-known** (no redirects), **VTODO-only component-set**
   on every list, **PROPPATCH → 207 no-op** — the classic three.
7. **Anonymous probe then Basic:** 401 + `WWW-Authenticate` on every
   CalDAV path; `OPTIONS` answers anonymously.
8. **calendar-query must not filter out dateless VTODOs** (RFC 4791 §9.9).

## 9. Integrations UI (Settings → Integrations)

New tab in the existing Settings dialog:

- Token list: label, created, last-used (throttled: ≤1 DO write per token
  per hour), timezone, Space scope, revoke button.
- Create flow: label + timezone (defaulting to the browser's IANA zone) +
  Space scope (**All Spaces** by default or exactly one live Space) → token
  shown once (`objcal_` + 43 base64url chars, stored
  SHA-256-hashed) → copy → connect instructions (server
  `objects.chrismin13.com`, username anything, password = token).
- Connect-time **feature matrix** (from #6, amended by this session):

  **Syncs (both directions):** to-dos in the Inbox, Project, and Area
  lists — create, edit, complete, reopen (not canceled), move between
  lists; title, notes, due date, one alert per to-do, tags; Occurrences as
  plain to-dos; Trash on delete (recoverable in Objects).

  **Doesn't sync:** creating/deleting/renaming lists (iOS limit +
  by-design); repeat-rule creation/edits (Objects-only); "This Evening"
  flag; Deadline; checklist; flagged, priority, sub-reminder indentation,
  note images; location-based alerts; reopening canceled to-dos;
  permanently emptying Trash from the phone.

- No error/last-sync surfacing in v1 — named follow-up after real failures
  accumulate.

## 10. Storage additions (inside the Workspace DO)

SQLite tables beside the existing `meta`/`chunks`/`receipts`:

```sql
CREATE TABLE caldav_tokens (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, hash TEXT NOT NULL,
  time_zone TEXT NOT NULL, space_id TEXT,
  created_at TEXT NOT NULL, last_used_at TEXT
);
CREATE TABLE caldav_anchors (
  resource TEXT PRIMARY KEY, to_do_id TEXT NOT NULL,
  served TEXT NOT NULL   -- JSON: last-served field values (merge base)
);
CREATE TABLE caldav_tombstones (
  resource TEXT PRIMARY KEY, revision INTEGER NOT NULL
);
```

Token verification, anchor updates, tombstone writes, and all
`WorkspaceChange` submission happen inside `transactionSync` on the DO that
already owns the workspace — no cross-DO coordination exists.

## 11. Inbound parser requirements (iCalendar)

Must accept, all observed from a real device: `DUE;VALUE=DATE`,
floating `DUE:...T...`, `DUE;TZID=...` **with an embedded VTIMEZONE
block** (ignore the block, read the wall time), absolute-UTC VALARM
triggers, Apple proximity alarms (ignore), `PERCENT-COMPLETE`,
`X-APPLE-SORT-ORDER` and arbitrary `X-*` (ignore), folded lines (unfold
before parsing), LF-terminated input (tolerate on parse — never emit).

## 12. Test plan

- **Unit (workerd, `tests/workspace/`):** VTODO render determinism (same
  to-do → same bytes → same ETag; DTSTAMP excluded per §8.3); field
  mapping table both directions; three-way merge cases (echo PUT, contested
  field, missing anchor); tombstone emission (never on empty-token sync);
  parser corpus from the captured iOS bodies (in this session's evidence:
  completion PUT, timed-alert PUT with VTIMEZONE, location-alarm PUT,
  echo-PUT with decorations).
- **Integration:** full simulated-client sequence in the smoke-test
  pattern (`scripts/proto-caldav-smoke.sh` is the template — extend with
  attribute-carrying hrefs and tombstone cases); DO round trip: CalDAV PUT
  → snapshot contains exactly the equivalent of the web client's change.
  Cover All-Spaces backward compatibility, single-Space list and Inbox
  membership, scoped Inbox create/MOVE, and 404 isolation for guessed
  cross-Space resource URLs.
- **On-device acceptance (manual, once):** connect; create/edit/complete/
  move/reopen; alert fires at-due; delete → Trash; web edit propagates ≤1
  poll; token revoke kills the account.

## 13. Rollout

1. Implement on a branch; land behind no flag (the endpoint is inert
   without a minted token).
2. Deploy; mint a token; on-device acceptance pass (§12).
3. ✅ Prototype teardown completed: worker `objects-caldav-proto`, custom
   domain `caldav-proto.chrismin13.com`, and branch
   `prototype/ios-caldav-stub` were deleted. No prototype routes remain;
   `/.well-known/*` is retained for the production CalDAV route.
4. Follow-ups (issues): sync-status/error surfacing in Integrations;
   Space-prefix list names after lived experience; revisit MKCALENDAR when
   cloudflare/workerd#6877 ships.

## Appendix A: Evidence index (this session)

- VALARM validation: both `TRIGGER:PT0S` and `TRIGGER;RELATED=END:PT0S`
  fire at-due on floating DUE — outbound form chosen: `TRIGGER:PT0S`.
- Completion inbound shape (captured PUT): `STATUS:COMPLETED` +
  `COMPLETED:20260815T155520Z` + `PERCENT-COMPLETE:100`.
- Timed reminder inbound shape (captured PUT): `DTSTART;TZID=` +
  `DUE;TZID=` + embedded `VTIMEZONE` + absolute `TRIGGER;VALUE=DATE-TIME`
  VALARM with `X-WR-ALARMUID`.
- Multiget href bug (§8.1), tombstone requirement (§7), GET fetch path
  (§8.4), DTSTAMP rule (§8.3), CRLF rule (§8.2) — all reproduced and
  verified fixed on-device against the live prototype.
- Raw prototype evidence was retired with the debug Worker and
  `prototype/ios-caldav-stub` branch after production acceptance.
