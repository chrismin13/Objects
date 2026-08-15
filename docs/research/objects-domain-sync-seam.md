# Research: What Objects' domain and sync layer offers a second client

Answers [wayfinder ticket #4](https://github.com/chrismin13/Objects/issues/4) for the iOS Reminders / CalDAV effort (map: #1). All claims cite file + line from `main` at the time of writing; line numbers are approximate guides, the file + symbol is the anchor.

---

## 1. Does the to-do Schedule carry a time component or date-only?

**Date-only.** `Schedule` is a four-way union (`shared/workspace/model.ts:7`):

```ts
type Schedule =
  | { kind: "inbox" }
  | { kind: "anytime" }
  | { kind: "someday" }
  | { kind: "scheduled"; date: IsoDate; evening: boolean };
```

- `date` is an `IsoDate` — `YYYY-MM-DD`, validated calendar-strict by `isIsoDate` (`shared/workspace/dates.ts:17`). Validation enforces this on every save (`validateSchedule`, `workspace.ts:1175`): a scheduled item without a real calendar date and a boolean `evening` is rejected.
- **No time-of-day on the Schedule.** The coarse `evening: boolean` is the only intra-day distinction — a UI grouping flag ("this evening"), not a time.
- **Time-of-day lives in a separate, optional `Reminder`** (`model.ts:14`): `{ at: IsoDateTime; sentAt: IsoDateTime | null }`.

**CalDAV mapping consequences** (input for the sync-engine ticket, #6):

- `DUE;VALUE=DATE:20260129` ↔ `{ kind: "scheduled", date: "2026-01-29" }` is a direct, lossless-enough mapping — the same conclusion the iOS-requirements research reached from the client side (iOS sends date-only dues as `VALUE=DATE` and both forms must round-trip distinctly).
- **The `evening` flag has no CalDAV carrier.** Outbound it's dropped (an evening to-do renders as a plain date). Inbound `VALUE=DATE` must map to `evening: false`. One-way loss, acceptable.
- **⚠️ Gotcha — `Reminder.at` is fake-UTC wall time.** Reminder times are constructed as `` `${date}T${time}:00.000Z` `` (`workspace.ts:472`, and occurrence creation at `:682`), i.e. the user's *local wall-clock* time with a `Z` suffix bolted on — not a real UTC instant. A VALARM↔Reminder mapping must treat the time-of-day as local wall time and ignore the `Z`, or reminders shift by the timezone offset. Also note `assignToDoSchedule` (`workspace.ts:565`): when a schedule date moves and the reminder's date matched the old schedule date, the reminder rides along — so inbound date changes should go through schedule changes and let the domain move the reminder, rather than setting both independently.

## 2. What the revisioned-command pipeline requires of a new client

The full write path, as the web client uses it:

1. **Client stages a mutation.** It diffs its last-known document against the edited one into a `WorkspaceDelta` — per-JSON-path `{path, before, after}` operations plus explicit `orderings` for array positions (`createWorkspaceDelta`, `sync.ts`) — and wraps it: `WorkspaceSyncCommand { expectedRevision, mutationId, document, changes }` (`sync.ts`). `mutationId` is a client-generated string (≤200 chars); `document` is the *fully materialized* next document.
2. **The DO applies it atomically.** `WorkspaceDO.save` (`worker/workspace-do.ts:52`) runs inside `ctx.storage.transactionSync`, so read-resolve-write is serialized by the DO's single-threaded runtime and atomic on disk.
3. **Idempotency.** Every accepted mutation writes a row into the DO's `receipts` table keyed by `mutationId`. A replayed mutationId returns the *original* acknowledgement (revision, snapshot, conflicts) without reapplying (`workspace-do.ts:60`). `resolveSyncCommand` also short-circuits when `sync.lastMutationId === command.mutationId` (`sync.ts`, `resolveSyncCommand`).
4. **Revision CAS.** If `expectedRevision` ≠ the DO's current revision and the command carries no delta, the save returns `{status:"conflict", snapshot}` — the client re-bases and retries. With a delta, the server **merges** instead (below).
5. **Delta merge = per-path three-way merge, not timestamp LWW.** `applyWorkspaceDelta` (`sync.ts`) walks each operation against the server's current document:
   - server value already equals `after` → no-op (idempotent convergence);
   - server value ≠ `before` → a `local-change-kept` conflict is recorded, and the delta's `after` is **still applied** — the incoming write wins at that path, with the conflict surfaced for the UI;
   - **hard guards beat writes:** operations touching a permanently-deleted entity are skipped (`permanent-deletion-kept`), operations on entities that no longer exist are skipped (`remote-removal-kept`), deletion markers are union-merged and never lost, and occurrences/capture-receipts/calendar sources are deduplicated (`deduplicateRemoteWork`).
6. **Full re-validation on every save.** The resulting document is shape-validated (`validateSyncDocument`) and then rule-validated by reconstructing a whole `Workspace` and calling `validate()` (`workspace.ts:1090`) — referential integrity (locations point at real containers, tags exist, dates are real), plus size caps: document ≤ 2 MB, command ≤ 5 MB (`workspace-do.ts:10`). A rejected command leaves the stored snapshot untouched — **the failure mode is staleness, never corruption**, exactly the invariant the map demands.

So a new client must: generate unique mutationIds, hold a recent snapshot to know `expectedRevision`, and submit either a delta-based command (merge semantics) or a delta-less command whose `expectedRevision` matches exactly (CAS semantics). It never bypasses validation or the tombstone guards.

## 3. The cleanest seam for the CalDAV adapter

**There is already a precedent second client: the HTTP capture path.** `/api/tasks` (`worker/index.ts`) → `WorkspaceDO.capture` → `captureIntoSnapshot` (`shared/workspace/http-capture.ts`). It does exactly the right dance inside `transactionSync`:

1. read the current snapshot;
2. rebuild a `Workspace` from it (`createWorkspace`) and run a **typed `WorkspaceChange`** — `change({type:"captureToDo", ...}`) — so all domain rules, ordering, and side-effects apply;
3. commit via `resolveSyncCommand(current, { expectedRevision, mutationId: "capture-<submissionId>", document })` and, if it resolves, `writeSnapshot` + `writeReceipt`.

**Recommendation: the CalDAV inbound path copies this shape, server-side, in the DO.** Concretely:

- A new DO method (e.g. `applyChanges(changes: WorkspaceChange[])` or a dedicated `caldav` entry point) that reads the snapshot, constructs `createWorkspace(current.document, …)`, applies the mapped `WorkspaceChange`s, and commits through `resolveSyncCommand` with a namespaced mutationId (`caldav-<uuid>`). Because the whole thing sits inside `transactionSync` on the single-threaded DO, `expectedRevision` always matches — no retry loop, no interleaving with web saves.
- The adapter **never hand-edits the document**; it speaks `WorkspaceChange`s and gets validation, ordering, occurrence maintenance, and tombstone guards for free. Rejected changes leave the VTODO stale until iOS re-syncs — the good failure mode.
- Idempotency for iOS PUT retries falls out of the receipts table if the adapter derives its mutationId deterministically (e.g. from the resource URL + the client's ETag / a sync-token), the way capture derives it from `submissionId`.
- Undo tokens are per-`Workspace`-instance in-memory state (`workspace.ts:523`) — meaningless across DO requests; server-side changes simply don't pass undo labels (capture already ignores them).

**The `WorkspaceChange` vocabulary the Reminders mapping needs** (`workspace.ts:100-225`): `createToDo` (title, notes, location, schedule, reminderAt, deadline, tags, checklist), `updateToDo` (id + `ToDoChanges` = `Partial<Pick<ToDo, "title"|"notes"|"location"|"schedule"|"reminder"|"deadline"|"tags">>`), `reorderToDos`, `completeToDo` / `cancelToDo` / `reopenToDo`, `trashToDo` / `restoreToDo` (⚠️ `permanentlyDeleteToDo` requires a confirmation string and creates a permanent-deletion tombstone — the adapter should stop at Trash, matching the web client's reversible model), `snoozeReminder`. Note **`outcome` is deliberately not in `ToDoChanges`** — completion flows through the dedicated verbs so `completedAt`/logbook side-effects run.

**Routing note for the spec:** `wrangler.jsonc` currently sets `run_worker_first: ["/api/*", "/auth/*"]`; everything else (including `/.well-known/caldav`) is served by the SPA assets layer. The CalDAV paths must be added to `run_worker_first` or discovery will never reach the Worker.

## 4. Where per-field last-write-wins is computed

It isn't, in the timestamp sense — **there are no per-entity `updatedAt` fields and no field-level clocks.** Granularity is the JSON path, and the arbiter is the delta merge in `applyWorkspaceDelta` (§2.5): whoever submits later wins a contended path, with a recorded conflict; tombstones and removals always win. `WorkspaceDelta`'s `before` values are the three-way merge's "base".

For the CalDAV layer this means: per-field merge between an iOS edit and a concurrent web edit *would* fall out for free **if** the adapter submitted deltas — but the capture-style path (full document, no delta, inside `transactionSync`) is simpler and gives whole-command atomicity, since no other write can interleave. Under that design, "conflict" reduces to what the *adapter* chooses to check at the CalDAV protocol level: `If-Match` on PUT maps to "does the to-do's current state still match what iOS based its edit on", which is sync-engine policy (#6), not pipeline mechanics.

## 5. Reading current state efficiently (VTODO rendering + outbound change detection)

- **The only read is `WorkspaceDO.load()` → the full snapshot** (revision + entire document, reconstructed from ≤50 KB SQLite chunks). No per-collection or per-entity reads. The document is capped at 2 MB, so a full read per CalDAV request is viable at this scale; rendering VTODOs = projecting `toDos` + their `projects` (list-per-Project) out of one `load()`.
- **Change detection has no per-entity history to lean on.** The DO keeps only the latest snapshot — no revision history, no entity `updatedAt` — and `sync.updatedAt` is document-level. So:
  - **ctag = the snapshot `revision`.** Any web or CalDAV write bumps it; iOS's `getctag` compare tells it *that* something changed.
  - **ETag per resource = a content hash of the VTODO projection** (the exact bytes the adapter would render). No shadow table needed: when ctag differs, iOS re-queries, compares ETags against its cache, and refetches only mismatched resources. Content-hash ETags also make no-op inbound PUTs (iOS echoing our own data back) converge to no-ops naturally — the delta merge's "already equals `after`" path.
  - **Deletions:** iOS detects a removed reminder by absence from the query results — no tombstone protocol needed server-side for outbound. (Inbound trash should map to `trashToDo`, not hard delete.)
- No push/webhook exists; iOS polls on its own schedule. Everything above is stateless except the receipts table.

## Summary for the sync-engine ticket (#6)

The domain layer is already shaped for a second client: date-only Schedules map cleanly onto `DUE;VALUE=DATE`; typed `WorkspaceChange`s give the adapter a validated, side-effect-correct write vocabulary; the capture path is a working template for a server-side client inside the DO; and revision-as-ctag + content-hash-ETag gives stateless outbound sync. The open design questions this research hands to #6: VALARM↔Reminder mapping under the fake-UTC wall-time convention, `If-Match`/precondition policy at the CalDAV layer, mutationId derivation for PUT idempotency, and whether MKCALENDAR-created lists become Projects or are rejected.

 — research session for ticket #4, branch `research/objects-domain-seam` (throwaway, not for merge).
