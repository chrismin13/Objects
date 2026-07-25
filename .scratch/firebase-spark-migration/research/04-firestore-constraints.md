# Establish Firestore Persistence and Offline Constraints

**Research date:** 2026-07-25  
**Scope:** Cloud Firestore in Native mode, primarily Standard edition and the Firebase Web SDK as relevant to a task/workspace PWA. Only current Firebase and Google Cloud primary documentation was used. This report establishes constraints and implications without selecting an architecture.

## Executive Summary

Firestore can support a browser PWA that reads, writes, queries, and listens while offline, but its offline model is a synchronized cache and pending-write queue, not an independently authoritative local database.

Key constraints:

- Web persistent caching is disabled by default, supports Chrome, Safari, and Firefox, and is not automatically cleared between sessions.
- Cached query results can be stale or incomplete. Local writes appear immediately through latency-compensated listeners before server authorization or acknowledgement.
- Ordinary writes and full-SDK batched writes can queue offline. Transactions fail offline.
- Reconnected edits to the same document use last-write-wins semantics. Firestore does not provide application-level conflict detection or semantic merging.
- Security Rules can enforce authentication, ownership, field allowlists, field types, version values, immutable fields, and cross-document relationships, but they are bounded and are not a general-purpose validation runtime.
- Queries, indexes, and Security Rules must be designed together. Rules are not result filters.
- Trusted server libraries bypass Security Rules and use IAM. Any ownership or schema invariant enforced only by Rules does not constrain trusted-server writes.
- Spark provides 1 GiB storage, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB outbound transfer/month for one database. Backup, restore, PITR, TTL deletes, clone, and managed export/import require billing.
- The emulator is suitable for functional and Rules testing, but it does not reproduce production contention, composite-index requirements, or all service limits.

## Data And Request Limits

The current [Firestore quotas and limits](https://cloud.google.com/firestore/quotas) establish these hard limits for Standard edition:

| Resource                                                   |                                     Limit |
| ---------------------------------------------------------- | ----------------------------------------: |
| Databases per project                                      | 100 by default; support can increase this |
| Subcollection depth                                        |                                       100 |
| Collection ID                                              |                         1,500 UTF-8 bytes |
| Document ID                                                |                         1,500 UTF-8 bytes |
| Document name, including path                              |                                     6 KiB |
| Document size                                              |                    1 MiB, 1,048,576 bytes |
| Individual field name                                      |                               1,500 bytes |
| Field path                                                 |                               1,500 bytes |
| Individual field value                                     |     1 MiB minus 89 bytes, 1,048,487 bytes |
| Nested map/array field depth                               |                                        20 |
| API request size                                           |                                    10 MiB |
| Standard-edition query memory                              |                                   128 MiB |
| Transaction duration                                       |                               270 seconds |
| Transaction idle timeout                                   |                                60 seconds |
| Transaction lock deadline                                  |                                20 seconds |
| Field transforms on one document in one commit/transaction |                                       500 |

Collection and document IDs must be valid UTF-8, cannot contain `/`, cannot be exactly `.` or `..`, and cannot match `__.*__`. A task or workspace stored as one large document therefore has a strict 1 MiB ceiling, including field names and encoded values.

The 10 MiB transaction/request calculation includes affected document and index-entry sizes. Deleting a document in a transaction includes the index entries removed by that delete, as explained in the [transactions guide](https://cloud.google.com/firestore/docs/manage-data/transactions).

There is no published fixed write-per-second limit for one document. Google says the sustainable rate depends on workload, contention, and index fanout and should be load-tested. An indexed field that changes sequentially across a collection, such as a timestamp, imposes a documented 500 writes/second collection limit unless that field is exempted from indexing; new collections should follow the 500/50/5 traffic-ramp rule ([best practices](https://cloud.google.com/firestore/docs/best-practices)).

## Index Limits And Semantics

Firestore serves queries through indexes rather than collection scans. Basic automatic indexes are maintained for fields by default; unsupported compound queries fail with a link for creating the required manual index ([index overview](https://firebase.google.com/docs/firestore/query-data/index-overview)).

| Index resource                           | No billing |           Billing enabled |
| ---------------------------------------- | ---------: | ------------------------: |
| Manual/composite indexes per database    |        200 | 1,000, support-adjustable |
| Single-field configurations per database |        200 |                     1,000 |

Additional hard limits from the [quotas page](https://cloud.google.com/firestore/quotas):

| Index property                             |       Limit |
| ------------------------------------------ | ----------: |
| Index entries generated by one document    |      40,000 |
| Fields in one composite index              |         100 |
| Index-entry size                           |     7.5 KiB |
| Combined index-entry size for one document |       8 MiB |
| Indexed field value                        | 1,500 bytes |

Indexed values longer than 1,500 bytes are truncated; Google warns that queries involving truncated values can return inconsistent results. Large descriptions, embedded content, maps, and arrays should not be assumed safely queryable merely because they fit in a document.

Other semantics:

- A manual/composite index can contain at most one array field.
- Documents missing any indexed field are absent from that index and cannot be returned through a query using it.
- Automatic collection-group indexes are not maintained by default. Filtered or ordered collection-group queries need collection-group-scope indexes.
- Automatic indexing recursively indexes maps and creates entries for arrays. Large arrays/maps can approach 40,000 entries quickly.
- Index exemptions reduce storage and write amplification, but an exempt field can still appear in a manually defined index.
- Every document write synchronously updates affected indexes, so index fanout affects latency and contention.

## Query Constraints

The current Standard-edition query restrictions are documented in [query and filter data](https://cloud.google.com/firestore/docs/query-data/queries) and the [multiple-range-fields guide](https://cloud.google.com/firestore/docs/query-data/multiple-range-fields):

- A query is limited to 30 disjunctions after conversion to disjunctive normal form. This limit is fixed.
- `in` and `array-contains-any` support up to 30 comparison values, subject to the 30-disjunction limit.
- `not-in` supports up to 10 comparison values.
- `not-in` cannot be combined with `!=`.
- A disjunction can contain at most one `array-contains`.
- `array-contains` and `array-contains-any` cannot appear in the same disjunction.
- The sum of filters, explicit sort orders, and parent-path contribution is limited to 100 after normalization.
- A query can use range or inequality filters on at most 10 fields.
- A query combining inequalities on document fields with only equality constraints on `__name__` is unsupported.
- An inequality filter implies ordering by that field and excludes documents where the field is absent.
- An explicit `orderBy` also excludes documents that do not contain that field.
- Compound combinations generally require a matching composite index.
- Standard Core queries do not provide relational joins or arbitrary full-text search.

Security Rules further constrain valid query shapes. Rules evaluate the query's possible result set, not each stored result and not only the documents currently present. A query that could return one unauthorized document is rejected in full. Ownership or workspace constraints expressed in Rules generally need corresponding client query constraints ([secure queries](https://cloud.google.com/firestore/docs/security/rules-query)).

## Writes, Transactions, And Batches

### Ordinary writes

A write can replace a document, update selected fields through a field mask, delete fields, or apply transforms. An update mask leaves server fields outside the mask unchanged. Supported atomic transforms include server timestamp, numeric increment, array union, and array removal ([Write API](https://cloud.google.com/firestore/docs/reference/rest/v1/Write)).

The server `REQUEST_TIME` timestamp has millisecond precision. Multiple uses within one transaction receive the same timestamp.

### Transactions

Transactions provide serializable isolation by commit time. Reads must precede writes, writes are applied only after successful completion, and reads inside a transaction do not observe earlier writes from that same transaction ([contention and isolation](https://cloud.google.com/firestore/docs/transaction-data-contention)).

Mobile and web transactions always emulate optimistic concurrency with document-version preconditions, regardless of the database concurrency setting. If a read document changes, the SDK reruns the transaction function a finite number of times. Transaction callbacks therefore must be idempotent and must not directly mutate application/UI state.

Transactions:

- Are all-or-nothing.
- Can span multiple documents.
- Retry automatically through mobile/web SDKs after conflicts.
- Fail after finite retries under excessive contention.
- Fail when the client is offline.
- Fail at 10 MiB request size, 20-second lock deadline, 270-second total duration, or 60 seconds idle.

### Batched writes

Batched writes contain only writes, are atomic and ordered, and do not retry due to changed read documents. In the full Firestore mobile/web SDK they can be queued while offline; the commit promise remains unresolved until acknowledged. Firestore Lite does not buffer offline batches and fails them offline ([transactions and batches](https://cloud.google.com/firestore/docs/manage-data/transactions), [Web `WriteBatch`](https://firebase.google.com/docs/reference/js/firestore_.writebatch)).

Current primary documentation does not state a universal write-operation count per batch. Instead, it warns that a batch containing hundreds of documents can exceed transaction/request size because of document and index updates. The practical hard bounds are therefore the 10 MiB request limit, per-document transform limit, and Security Rules access-call limits. Bulk import workloads should use parallelized trusted-server writes or bulk-writer facilities rather than large client batches.

## Realtime Listeners

A listener first receives the current document or query state and then changes. A query listener's first snapshot reports all matching documents as `added`; that initial state may come from local cache and then be reconciled with the server ([listener semantics](https://cloud.google.com/firestore/docs/query-data/listen)).

Local writes invoke listeners immediately before transmission to the backend. Snapshot metadata exposes:

- `hasPendingWrites`: the document includes local writes not acknowledged by the backend.
- `fromCache`: the snapshot came from local cache and may be stale or incomplete.

Metadata-only events are omitted unless `includeMetadataChanges` is requested. A PWA cannot treat a listener callback alone as proof that a write was accepted.

Firestore automatically reconnects listeners and orders notifications according to committed database changes. The realtime pipeline's changelog provides strict commit ordering ([realtime queries at scale](https://cloud.google.com/firestore/docs/real-time_queries_at_scale)).

Listener billing is document-change based:

- Initial matching documents are reads.
- Added and updated result documents are reads.
- A document removed because it no longer matches is a read.
- A document removed because it was deleted is not an additional read.
- With persistence enabled, a disconnect longer than 30 minutes is billed like a new query on reconnection.
- Without persistence, every disconnect/reconnect is billed like a new query.
- Open connection time itself is not billed.

Source: [Firestore pricing, listening to query results](https://cloud.google.com/firestore/pricing#listening_to_query_results).

No current Standard-edition primary limit table publishes a fixed maximum listener count per browser client or database. Listener scale therefore remains a capacity and cost concern rather than a documented hard number. Listeners should be detached when unused.

## Web Offline Persistence

Firestore's [offline-data guide](https://cloud.google.com/firestore/docs/manage-data/enable-offline) states:

- Offline persistence supports Android, Apple, and web Core SDKs.
- Web persistence is disabled by default; memory cache is the default.
- Persistent web caching currently supports Chrome, Safari, and Firefox.
- Persistent cache is not automatically cleared between sessions.
- The client can read, write, query, and listen against cached data.
- Only data the application has used or received is cached; this is not an automatic replica of the database.
- A cache-origin query can be stale or incomplete.

Because persistence stores user data across sessions, Firebase recommends asking whether the user is on a trusted device before enabling it. The API additionally warns that clearing IndexedDB is not a secure overwrite and recommends not enabling persistence where cached disclosure between users is unacceptable ([Web Firestore API](https://firebase.google.com/docs/reference/js/firestore_)).

### Multi-tab behavior

Modern initialization supports:

- Persistent single-tab management, the persistent-cache default when no tab manager is supplied.
- Explicit persistent multi-tab management.
- Memory-only cache.

`PersistentMultipleTabManager` synchronizes SDK queries and mutations across tabs ([API reference](https://firebase.google.com/docs/reference/js/firestore_.persistentmultipletabmanager)). Legacy single-tab persistence fails with `failed-precondition` when another tab owns persistence; unsupported browsers fail with `unimplemented`.

Multi-tab synchronization does not turn tabs into independent authoritative replicas. They share the same browser persistence and pending mutation state.

### Cache size and eviction

For web persistent cache, [`PersistentCacheSettings`](https://firebase.google.com/docs/reference/js/firestore_.persistentcachesettings) specifies:

- Default approximate threshold: 40 MiB.
- Minimum configurable threshold: 1 MiB.
- `CACHE_SIZE_UNLIMITED` disables garbage collection.
- Once over threshold, the SDK attempts to remove data that has not been used recently.
- The threshold is approximate; the SDK does not guarantee the cache remains below it.

Evicted documents become unavailable to offline reads until fetched again online. A successful query performed previously does not guarantee its complete result set will remain cached indefinitely.

`clearIndexedDbPersistence()` removes cached documents and pending writes. It must run before Firestore starts or after termination. `terminate()` does not cancel pending writes; when persistent Firestore restarts, it resumes sending them. `waitForPendingWrites()` can wait for all writes queued before the call, but remains unresolved while offline.

Browser storage durability is ultimately subject to browser IndexedDB quotas, private-browsing behavior, user clearing, and operating-system storage pressure. Firebase does not document a durability guarantee against browser eviction.

## Conflict Resolution

The offline guide explicitly states that after reconnecting, Firestore synchronizes local changes and, for multiple changes to the same document, uses **last write wins** ([offline data](https://cloud.google.com/firestore/docs/manage-data/enable-offline)).

Consequences:

- Firestore does not expose built-in semantic conflict objects for ordinary offline writes.
- Two users editing one task document can overwrite each other's logical work.
- A local write can appear successful in the UI and later be superseded or rejected.
- Transactional compare-and-update cannot be initiated while offline.
- Atomic transforms such as increment and array union have server-defined transform semantics and are not equivalent to replacing a field with a locally computed value.
- Update masks can preserve fields outside the update, but this should not be interpreted as a general conflict-free merge model.

The documentation does not precisely define the offline last-write winner in terms of client clock, enqueue time, arrival order, or per-field versus per-document granularity. Commit ordering is server-defined, and client wall-clock timestamps should not be used as an assumed arbitration mechanism.

## Security Rules

### Expressiveness

Firestore Security Rules can inspect:

- `request.auth` and token claims.
- Existing document data through `resource.data`.
- The complete proposed post-write document through `request.resource.data`.
- Changed fields through `request.resource.data.diff(resource.data).affectedKeys()`.
- Other documents through `get()`, `exists()`, and atomic post-state through `getAfter()`.
- Query properties including `limit`, `offset`, and `orderBy`.
- Server request time through `request.time`.

Rules can distinguish `get`, `list`, `create`, `update`, and `delete`. Parent rules do not automatically apply to subcollections; each relevant path needs a rule. If overlapping match statements apply, any true `allow` grants access ([rules structure](https://cloud.google.com/firestore/docs/security/rules-structure)).

Custom functions have a single return expression, no loops, no external calls, and no recursion. Rules are therefore suitable for bounded declarative authorization and validation, not arbitrary application logic ([rule conditions](https://cloud.google.com/firestore/docs/security/rules-conditions)).

### Limits

| Rules constraint                                                 |                                       Limit |
| ---------------------------------------------------------------- | ------------------------------------------: |
| `get()`, `exists()`, `getAfter()` for one document/query request |                                          10 |
| Cross-document calls for multi-read, transaction, or batch       | 20 total, while each operation still has 10 |
| Nested `match` depth                                             |                                          10 |
| Nested matched path length                                       |                           100 path segments |
| Path capture variables                                           |                                          20 |
| Function arguments                                               |                                           7 |
| `let` bindings per function                                      |                                          10 |
| Recursive/cyclic calls                                           |                                           0 |
| Expressions evaluated per request                                |                                       1,000 |
| Rules source size                                                |                                     256 KiB |
| Compiled ruleset size                                            |                                     250 KiB |

Cross-document Rules reads can be billed even when the request is rejected. Some repeated accesses can be cached during evaluation and then do not count again.

The current limits table says function call depth is 20, while the current conditions guide still says total call-stack depth is 10. This is an official-documentation inconsistency. Planning should treat 10 as the conservative limit until verified against the deployed Rules compiler.

No wall-clock Rules execution timeout is published. The documented runtime bound is the 1,000-expression limit plus function and document-access limits.

## Schema And Version Validation

Firestore is schemaless at the database layer. Rules can provide a bounded schema gate for direct-client writes ([field controls](https://cloud.google.com/firestore/docs/security/rules-fields)):

- `keys().hasAll()` can require fields.
- `keys().hasOnly()` can reject unknown fields.
- `diff().affectedKeys().hasOnly()` can limit updateable fields.
- `is` can enforce scalar/container types.
- Existing and proposed values can be compared to preserve immutable identifiers or ownership.
- A `schemaVersion` field can be required and restricted to accepted values.

Limitations:

- Rules do not perform migrations or transform old data.
- Rules list/map type checks do not support generics such as “list of strings.”
- Every nested member must be checked explicitly if required.
- Accessing an absent field causes the expression to error and deny unless a defaulting `get()` pattern is used.
- Rules cannot allow some fields from one write while rejecting others; the entire document write is accepted or rejected.
- Reads are document-level. Rules cannot hide selected fields within an otherwise readable document.
- Server/Admin writes bypass these checks entirely.

Schema-version changes must account for installed PWAs that can remain offline with queued writes created under an older client schema. Tightening Rules can cause those writes to be rejected when the client eventually reconnects.

## Ownership And Workspace Enforcement

For direct-client authority, Rules can enforce ownership by requiring:

- Authentication for every private operation.
- On create, `request.resource.data.ownerId == request.auth.uid`.
- On update, existing ownership authorizes the caller and proposed ownership remains unchanged.
- On delete, existing `resource.data.ownerId` authorizes the caller.
- Workspace membership or role checks against a parent/membership document using `get()` or `exists()`.
- Query constraints that prove all possible results belong to an accessible user/workspace.

Role maps embedded in a workspace document can support bounded groups. Firebase recommends separate role documents for large or complex groups ([role-based access](https://firebase.google.com/docs/firestore/solutions/role-based-access)).

Architecturally relevant constraints:

- Parent-path authorization reads consume Rules call limits and may incur billed reads.
- Rules attached to a parent document do not secure its subcollections automatically.
- Security Rules are not filters, so workspace or owner query predicates are part of the authorization contract.
- Ownership must not rely solely on a client-supplied field unless Rules compare it with authenticated identity.
- Immutable ownership and role fields need explicit update protection.

## Direct-Client Versus Trusted-Server Authority

### Direct mobile/web client

Firebase ID-token and unauthenticated requests are authorized by Security Rules. Optional App Check enforcement adds app/device attestation. The client cannot safely hold service-account credentials.

Authority consists of:

- Firebase Authentication identity.
- Security Rules authorization and validation.
- Firestore transaction/precondition semantics.
- Optional App Check verification.

Offline local acceptance is provisional. The server still evaluates Rules when queued writes reach it.

### Trusted server

Firestore server libraries authenticate with Application Default Credentials and bypass Security Rules. They are authorized through IAM ([server security](https://cloud.google.com/firestore/docs/security/iam), [rule conditions](https://cloud.google.com/firestore/docs/security/rules-conditions)).

Consequently:

- Server code must independently enforce end-user identity, ownership, roles, schema versions, and business invariants.
- IAM controls the server principal's Firestore capabilities; it is not a replacement for per-user workspace authorization in application code.
- A trusted server can perform validations too complex for Rules, but remains subject to Firestore document, request, transaction, contention, and index limits.
- Rule-only invariants are not universal invariants if any trusted server, import, administrative process, or service account can write the same data.

REST is not inherently trusted-server authority. REST calls carrying Firebase ID tokens use Security Rules; REST calls carrying service-account OAuth tokens use IAM and bypass Rules ([REST authentication](https://cloud.google.com/firestore/docs/use-rest-api#authentication_and_authorization)).

## Emulator Fidelity

The Firestore emulator supports client libraries, Authentication-emulator integration, Security Rules execution, evaluation tracing, data clearing, and optional test-state import/export. It should only be used for local testing ([Firestore emulator](https://cloud.google.com/firestore/docs/emulator), [Firebase emulator connection](https://firebase.google.com/docs/emulator-suite/connect_firestore)).

Documented differences from production:

- Emulator transaction concurrency uses simplified locking rather than production optimistic/pessimistic behavior.
- Contended locks may take up to 30 seconds to release.
- It does not reproduce production transaction timeouts and size limits.
- It does not track composite indexes and executes any otherwise valid query.
- It does not enforce all production limits.
- Emulator data is not production-durable; the standalone emulator is in-memory.
- Persisted client IndexedDB can outlive an emulator reset and create misleading local results unless cleared or disabled.

Therefore emulator success cannot prove:

- Required composite indexes exist.
- A request remains below production size/index limits.
- Contention behavior is acceptable.
- Offline conflict resolution matches production timing.
- Spark quotas, App Check enforcement, or recovery procedures behave correctly.

At least a bounded real-project verification remains necessary for those properties, although no such verification was performed for this research task.

## Backups, Export, Import, And PITR

### Managed export/import

Managed export/import requires billing and, for Firebase projects, the Blaze plan ([export/import](https://cloud.google.com/firestore/docs/manage-data/export-import)).

Properties:

- Exports can include the whole database or selected collection groups.
- Exporting a collection group does not automatically include differently named subcollections.
- An export is not an exact snapshot at the operation start; it can include changes made while the export is running.
- Each exported document incurs a read operation, although these reads are not shown in the Firebase console usage panel.
- Export files live in Cloud Storage.
- Export data can be imported into another Firestore database or loaded into BigQuery.
- Exports do not contain index definitions.
- Imports rebuild indexes using the target database's current index definitions.
- Imports retain document IDs and overwrite existing documents with matching IDs.
- Documents not affected by the import remain in the database.
- Imports do not trigger Cloud Functions, but snapshot listeners receive import updates.

Operational limits:

| Managed operation                                  | Limit |
| -------------------------------------------------- | ----: |
| Export plus import requests per project per minute |    20 |
| Concurrent exports/imports                         |    50 |
| Collection-ID filters per request                  |   100 |

### Scheduled backups

Scheduled backups require billing. A backup is a consistent point-in-time copy containing document data and index configurations. It does not contain Security Rules or TTL policies and resides in the same location as the source database ([backups](https://cloud.google.com/firestore/docs/backups)).

A database can have:

- One daily schedule.
- One weekly schedule.
- Retention up to 14 weeks.

Backups restore data to a database, but Rules and TTL configuration must be managed separately. Deleting a source database does not automatically delete its backups.

### Point-in-time recovery

PITR is disabled by default, requires billing, and retains minute-granularity versions for up to seven days. Only one final document version per minute is retained. Regardless of PITR, historical reads are available at microsecond granularity for up to one hour, subject to `earliestVersionTime`; exporting those one-hour versions requires PITR ([PITR](https://cloud.google.com/firestore/docs/pitr)).

PITR can support stale reads, cloning, or timestamped export, but is not available on Spark.

## Spark Quotas And App Check

### Spark Firestore quota

For the single free database in a project:

| Resource          | Spark/free tier |
| ----------------- | --------------: |
| Stored data       |           1 GiB |
| Document reads    |      50,000/day |
| Document writes   |      20,000/day |
| Document deletes  |      20,000/day |
| Outbound transfer |    10 GiB/month |

Daily quotas reset around midnight Pacific time. Exceeding quota rejects further operations rather than automatically billing. TTL deletes, PITR, backups, restore, clone, named databases, and managed export/import require billing ([quotas](https://cloud.google.com/firestore/quotas), [pricing](https://cloud.google.com/firestore/pricing)).

Listener bootstrap/reconnect reads, Rules dependency reads, query/index reads, transaction retries, and rejected Rules dependency checks can consume quota.

### App Check

App Check itself is listed as a no-cost Firebase product and supports Cloud Firestore enforcement. For web, Firebase supports reCAPTCHA Enterprise score-based, invisible site keys ([web setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)).

Current behavior:

- Apps register a web domain/site key and receive expiring App Check tokens.
- Default token TTL is one hour; configurable range is 30 minutes to seven days.
- The SDK refreshes around half the TTL.
- Once Firestore enforcement is enabled, unverified requests are rejected.
- Enforcement can take up to 15 minutes to become active.
- App Check is app/device attestation, not user authentication or authorization.
- It prevents some but not all abuse and does not guarantee abuse elimination ([App Check overview](https://firebase.google.com/docs/app-check)).
- Firestore replay protection is not currently available; the standard-services replay-protection beta is currently limited to Firebase AI Logic ([enforcement](https://firebase.google.com/docs/app-check/enable-enforcement)).

reCAPTCHA Essentials is available without billing for up to 10,000 assessments per month. Above that, assessments fail unless billing is enabled. App Check creates an assessment when a browser refreshes its App Check token, so TTL and active-device count affect that quota ([reCAPTCHA billing](https://cloud.google.com/recaptcha/docs/billing-information)).

If Firestore App Check enforcement is active and token refresh fails after the free assessment allowance is exhausted, clients can eventually lose verified access even though Firestore's own Spark quota remains available.

## Explicit Unknowns And Documentation Gaps

- **Batch operation count:** Current official transaction, Commit API, and Web SDK documentation does not publish a universal maximum number of writes per atomic batch. The documented constraints are request size, index impact, transforms, and Rules calls.
- **Listener hard cap:** No current Standard-edition limit table gives a fixed maximum number of concurrent listeners per web client or database.
- **Last-write arbitration:** Official docs state last-write-wins for multiple changes to one document but do not specify arbitration in terms of client clock, enqueue time, network arrival, or exact per-field granularity.
- **Rules function depth:** The official limits table says 20; the current conditions guide says 10. Ten is the conservative planning bound.
- **Rules wall-clock runtime:** No execution-time limit in milliseconds is published; only expression, call, nesting, and size limits are documented.
- **Browser durability:** Firebase does not guarantee IndexedDB survival under browser quota eviction, user clearing, private mode, or OS storage pressure.
- **Objects deployment state:** This research did not inspect or alter Firebase project configuration, edition, billing status, Rules, indexes, App Check registration, quotas, or recovery configuration.
- **Emulator App Check fidelity:** The primary emulator documentation does not establish the Firestore emulator as a faithful test of production App Check enforcement or provider quota exhaustion.

## Architectural Implications Without A Decision

- Persistence granularity is also conflict granularity, listener payload granularity, authorization granularity, billing granularity, and the unit constrained by 1 MiB.
- Offline support requires an explicit pending/acknowledged/rejected UX state; a latency-compensated snapshot is not proof of commitment.
- Any operation requiring a read-dependent invariant cannot use a client transaction while offline.
- Cached lists must tolerate incompleteness and eviction. “Previously viewed” does not mean “guaranteed available offline.”
- Query shapes, indexes, and Security Rules form one contract and should be planned together.
- Versioned schemas must remain compatible with old installed clients and delayed offline write queues, or provide an intentional rejection/recovery path.
- Direct-client authority places all enforceable user invariants within Rules limits. Trusted-server authority moves those invariants into server code and IAM because server writes bypass Rules.
- App Check can reduce direct-client abuse but cannot replace Authentication, ownership Rules, server validation, or quota controls.
- Spark can support limited operation but does not provide managed recovery features. Backup/export/PITR requirements imply billing independently of ordinary read/write volume.
- Emulator-only validation cannot establish production index completeness, limit compliance, contention behavior, recovery behavior, or App Check behavior.
- Firestore's built-in last-write-wins behavior is not an application-level collaboration strategy. Any requirement for conflict visibility, merging, or history would need separate domain semantics, without implying which semantics should be chosen.
