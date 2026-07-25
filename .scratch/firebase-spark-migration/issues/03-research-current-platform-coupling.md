# Inventory current platform coupling and portable seams

Type: research
Status: resolved
Blocked by: none

## Question

Inventory the current code and data contract to identify every Lakebed-coupled surface, every portable seam, the five server operations and their authorization/consistency semantics, the workspace synchronization and offline guarantees, the PWA and build machinery, and the existing JSON export/import contract. Record facts needed to judge feature scope, persistence, migration compatibility, and toolchain replacement without proposing implementation yet.

## Answer

### Inventory result

The application's behavioral core is already portable. `shared/workspace/` owns the `WorkspaceDocument`, validation and named changes, interface conversion, delta creation and reconciliation, the offline sync client, capture parsing, and both current and legacy import logic without importing Lakebed, DOM, or Node APIs. Lakebed is the transport, identity, persistence, endpoint, and deployment shell around that core.

The complete direct coupling surface is:

- `server/index.ts` imports `lakebed/server` and owns the capsule declaration, database schema, authentication boundary, five operations, PWA response bodies, chunked storage, and retained-Lakebed migration.
- `client/index.tsx` imports Lakebed authentication (`useAuth`, `SignInWithGoogle`, `signOut`) and mounts the portable sync client behind a Lakebed adapter.
- `client/workspace/lakebed-adapter.tsx` imports `useQuery` and `useMutation`; `client/workspace/lakebed-adapter-core.ts` is transport-neutral apart from its names and serialized Lakebed gateway contract.
- The embedded service worker in `server/index.ts` discovers `/___lakebed` assets and excludes dynamic `/___lakebed/` and `/storage/` requests from its cache. No application code uses Lakebed object storage.
- `lakebed.json` binds the repository to deploy `dep_rarwdUj4I9LZJWoX`.
- `scripts/build-runtimes.mjs`, `scripts/check-build-artifact.mjs`, the four generated runtime files, and `docs/runtime-packaging.md` exist to satisfy Lakebed's 2 MiB anonymous deployment artifact limit. The build script may locate `esbuild` inside the `npx lakebed` cache, and the artifact guard reads `.lakebed/artifacts/Objects.anonymous.json`.
- Repository completion commands and production ownership in `AGENTS.md` are Lakebed-specific operational coupling rather than application behavior.

There are no `lakebed/client` or `lakebed/server` imports outside the three runtime files above, and no Lakebed imports under `shared/`.

### Current persistence shape

The authoritative replacement store is one full `WorkspaceDocument` per authenticated owner, serialized as JSON and split into 50,000-character rows. The document is limited to 2,000,000 serialized characters; an incoming serialized sync command is limited to 5,000,000 characters. Metadata stores the revision, last mutation identity, sync timestamp, and part count as strings. Mutation receipts are separate rows keyed by owner and mutation identity.

The schema also retains two older Lakebed representations solely for automatic cutover: normalized per-entity tables plus metadata, and older workspace chunks. Reads assemble either legacy representation, run it through the portable importer, merge it into the replacement snapshot once per `(updatedAt, mutationId)` source identity, and expose the prepared snapshot. The client then persists that merge as one normal sync command. Current replacement content wins for same-ID entities, retained settings are the cutover source of truth except replacement launch rules and quick draft, permanent deletions remain durable, and migration is idempotent.

### Five server operations

| Operation                                       | Authorization and input                                                                                                                                                                                                             | Result and consistency semantics                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `replacementWorkspace` query                    | Requires `ctx.auth.userId`; owner identity is derived only from auth and is never accepted from the client.                                                                                                                         | Returns serialized `{ ownerIdentity, snapshot, migrationReport, migrationRequired }`. It reads the replacement snapshot and retained legacy state and may return an in-memory merged migration candidate, but performs no write.                                                                                                                                                                                           |
| `saveReplacementWorkspace` mutation             | Requires `ctx.auth.userId`; accepts one serialized `WorkspaceSyncCommand`, rejects non-object JSON and commands over 5,000,000 characters.                                                                                          | Looks up an owner-scoped mutation receipt, resolves the command against the latest prepared snapshot, writes replacement chunks and metadata, then records the receipt. All work is expressed inside one Lakebed mutation; the code has no additional transaction primitive. A known mutation is acknowledged idempotently against the current snapshot while retaining its original conflict list.                        |
| `manifest` `GET /manifest.webmanifest` endpoint | Public, no input.                                                                                                                                                                                                                   | Returns the fixed web manifest with a one-hour public cache lifetime. It does not touch data.                                                                                                                                                                                                                                                                                                                              |
| `serviceWorker` `GET /sw.js` endpoint           | Public, no input.                                                                                                                                                                                                                   | Returns the fixed service worker with `no-cache` and root scope. It does not touch data.                                                                                                                                                                                                                                                                                                                                   |
| `captureTask` `POST /api/tasks` endpoint        | Requires an authenticated Lakebed request and derives the owner from `ctx.auth.userId`. Accepts JSON; `Idempotency-Key` supplies `submissionId` only when the body omits it, and `X-Time-Zone` supplies a time zone after the body. | Reads the latest prepared owner snapshot, validates and captures one to-do, then writes the full next snapshot. A repeated submission is deduplicated by a `CaptureReceipt`; success is `201`, duplicate success is `200`, validation is `400`, and a detected revision conflict is `409`. The read/modify/write is in an endpoint handler with no explicit transaction or compare-and-swap primitive in application code. |

The query, mutation, and capture endpoint isolate data by the opaque authenticated user ID, not email or display name. Manifest and service-worker endpoints are intentionally public.

### Synchronization contract

`WorkspaceSyncAdapter` is the replacement boundary: `load(): snapshot | null`, `save(command): acknowledged | conflict | rejected`, and an optional invalidation subscription. A snapshot is `{ revision, document }`; a command contains `expectedRevision`, a mutation ID of at most 200 characters, the proposed document, and normally a field/order delta.

Server-independent synchronization behavior is:

- A save with the expected revision advances the revision by one, stamps `sync.lastMutationId` and `sync.updatedAt`, validates both document shape and domain rules, and returns the complete acknowledged snapshot.
- A stale full-document command without a delta returns `conflict` and the current snapshot. A stale delta command is reconciled against the current document.
- Independent field changes merge. If both devices changed the same path, the submitted local change is kept and reported as `local-change-kept`.
- Permanent-deletion markers prevent stale devices from recreating deleted entities. Edits beneath remotely removed keyed entities keep the removal. Concurrent ordering uses the submitted complete local order followed by remote-only entries.
- Repeating occurrences are deduplicated by template/date, HTTP captures by submission receipt, and calendar events by source UID, preferring the already-remote item where duplicates race.
- At most 40 conflicts are returned per acknowledgement. Malformed deltas and invalid reconstructed workspaces reject atomically at the resolver boundary.
- Mutation identities provide retry safety. The Lakebed store keeps receipts beyond the latest `sync.lastMutationId`, so retrying an older acknowledged mutation after later saves does not roll back later content.

### Offline and session guarantees

The portable sync client persists a version-1 local record containing the last base snapshot, ordered pending deltas, and rejected mutations. In the shipped client this record is in `localStorage` under `objects-workspace-interface-sync:<ownerIdentity>`. Staging is immediately optimistic, durable when local storage is available, and the queue flushes serially in creation order.

On startup, a stored snapshot and queue are recovered before the remote load is reconciled. Failed loads or saves retain visible optimistic content and pending changes with `offline` or `session-expired`; an interrupted acknowledgement is safe because the same mutation ID is retried. A successful recovery reports `recovered`. Remote conflicts cause the client to adopt the new base, rebuild all pending deltas over it, and retry. Rejected mutations leave the queue, remain recorded for feedback, and produce `conflict` status.

These guarantees have limits visible in the code:

- If local storage is disabled or over quota, the queue survives only in memory for that tab.
- There is no timer, exponential backoff, or direct online-event flush in the sync client. Retries occur on explicit `flush`, `refresh`, initialization, or adapter invalidation.
- The loop permits up to 100,000 pending attempts and defines no serialized local-queue quota.
- Private API and auth responses are deliberately excluded from the service-worker app cache. Offline workspace access therefore depends on auth having resolved and the owner-scoped local sync record being available, not on cached backend responses.
- Additional owner-scoped local UI state exists outside the sync record: active Space, whether launch rules are enabled, and an unfinished pending entry. Authentication recovery markers are tab-scoped in `sessionStorage`.

The relevant contract tests cover reload after replacement, interrupted acknowledgements, a 75-change offline queue, session expiry, order-only changes, account isolation, retry idempotency, permanent deletion, multi-device field/order reconciliation, and duplicate occurrence/capture/calendar handling. They exercise the portable in-memory and serialized adapter contracts, not `server/index.ts` through a running Lakebed instance.

### Domain and backup contracts

The durable domain format is `WorkspaceDocument` with `format: "objects-workspace"` and `version: 1`. It contains settings, Spaces, Areas, Projects, Headings, Tags, to-dos, Repeating Templates, Project Closures, calendar events, permanent-deletion markers, capture receipts, and sync metadata. IDs and parent relationships are explicit. `exportPortableBackup` serializes that complete document, and `parsePortableBackup` accepts it, resets imported sync metadata to revision zero, defaults missing capture receipts, and leaves final domain validation to the Workspace import operation. Full domain import is atomic and requires the exact `REPLACE WORKSPACE` confirmation in the domain API.

There are, however, two user-data JSON representations in the repository:

1. The currently shipped Settings action exports `ui.state`, an `InterfaceState` using the legacy `tasks`/`projects`/`areas` shape, to `objects-backup-YYYY-MM-DD.json`. Its import checks only that those three collections are arrays, asks for click confirmation, normalizes the state, and sends `replaceWorkspace: true` through the interface bridge. The bridge reconstructs and validates a `WorkspaceDocument`, clears Project Closures, permanent-deletion markers, and capture receipts, and preserves the current sync metadata before the normal sync save.
2. The portable domain API exports and imports `objects-workspace` v1 directly. It has round-trip tests but is not what the shipped Settings export handler currently downloads.

The parser also accepts retained legacy backups with `tasks`, `projects`, and `areas`. It repairs known old enums and relationships, creates a fallback Space when required, converts string tags to entities, converts old repetition into Repeating Templates and Occurrences, deduplicates repeated work, skips malformed individual legacy rows where safe, and produces a correction/skip/rejection report. A resulting invalid domain document rejects the whole replacement and restores the previous workspace.

This distinction is part of the existing self-service migration contract: existing downloaded Settings backups are legacy `InterfaceState` files even though the authoritative runtime model is `WorkspaceDocument` v1.

### PWA behavior

The manifest supplies standalone root scope, Today/Inbox/New-to-do shortcuts, SVG icons, and a GET share target that opens the application with shared title/text/URL parameters. The service worker:

- precaches the root shell, `/client.js`, manifest, favicon, and discovered Lakebed runtime assets;
- uses network-first navigation with the cached root as fallback;
- uses network-first static assets with cache fallback;
- never handles non-GET requests and excludes APIs, dynamic Lakebed requests, and storage URLs;
- deletes prior Objects caches on activation, claims clients, and supports explicit skip-waiting updates;
- handles push payload display and notification clicks, including snooze query parameters.

The client registers the worker only off localhost, removes workers and Objects caches during local development, exposes install and update state, checks for updates on focus/visibility, and supports local notification permission and display. There is no push subscription registration, persisted push token, or server reminder scheduler in the repository; the UI explicitly says closed-app delivery still requires one. Current reminder notifications are browser-side while Objects is running.

### Build and delivery machinery

Readable TypeScript remains the source of truth, but delivery is split into four generated files: a gzip/base64 interface runtime, gzip/base64 theme, gzip/base64 browser Workspace runtime, and minified server Workspace runtime. Browser loaders decompress packed modules through `DecompressionStream`, create Blob module URLs, and dynamically import them. The server entry re-exports only portable Workspace functions before minification.

The documented check sequence rebuilds all four generated files, runs every `tests/workspace/*.test.ts`, invokes `npx lakebed build . --target anonymous --json`, and enforces an Objects artifact ceiling of 2,080,000 bytes below Lakebed's 2,097,152-byte limit. This packaging is a platform delivery constraint, not part of the domain or synchronization contract.

### Facts later decisions must account for

- Provider replacement can occur behind `WorkspaceSyncAdapter`; the domain and offline queue do not require Lakebed.
- Owner identity must remain opaque, authenticated, and stable because remote rows and local queues are owner-scoped by it.
- Preserving current multi-device behavior means preserving revisioned idempotent saves, delta reconciliation, durable deletion markers, duplicate suppression, complete validation, and ordered offline replay, not merely storing the latest JSON document.
- Preserving self-service migration means accepting the shipped legacy Settings backup shape. Supporting only `objects-workspace` v1 would not accept the files users can currently download.
- The HTTP capture operation is the only authenticated non-Lakebed-client API surface. Manifest and service worker are static behavior despite currently being implemented as endpoints.
- PWA installability and offline shell behavior are independent from offline private-data persistence. Closed-app push reminders are not an existing complete product behavior.
- The runtime packing, Lakebed asset discovery, artifact guard, deployment binding, and Lakebed command workflow have no portable behavioral requirement, but their source modules and tests do.
