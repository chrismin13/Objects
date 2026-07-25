# Establish Firestore persistence and offline constraints

Type: research
Status: resolved
Blocked by: none

## Question

Using current official documentation, establish the Firestore and Security Rules constraints relevant to Objects: document and request limits, write atomicity, transactions and batches, query/index requirements, offline persistence and conflict behavior, multi-tab behavior, rule expressiveness and limits, schema/version validation, ownership enforcement, emulator fidelity, backup/export options, and any Spark-specific quotas. Identify facts that distinguish direct-client and trusted-server designs.

## Answer

Research current as of 2026-07-25. This is documentation research only; no Firebase resources were created.

### Result

Firestore can provide authenticated realtime storage, optimistic client transactions, atomic batches, and durable web offline writes on Spark, but it does not reproduce the current Objects contract automatically. Its native same-document offline conflict policy is last-write-wins, transactions fail while offline, documents are limited to 1 MiB, and Security Rules cannot run the portable TypeScript validator or generically validate every member of nested lists and maps.

A direct-client design can enforce authentication, owner isolation, an allowed top-level schema, field types, immutable fields, revision preconditions, and bounded cross-document invariants in Security Rules. It cannot make arbitrary client code trusted or enforce the complete Objects domain and merge behavior unless that behavior is reducible to the Rules language and its request limits. A trusted server could run the existing resolver and validator, but server client libraries bypass Security Rules and require their own IAM/application authorization; the Spark capability envelope provides no eligible production server runtime.

### Storage, request, and Spark limits

| Constraint           | Current documented limit                                                              | Consequence for Objects                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free database        | Exactly one database per project receives free quota                                  | Production must use that database; an additional hosted staging database is not free.                                                                                         |
| Stored data          | 1 GiB                                                                                 | Documents, field names, metadata, automatic indexes, and composite indexes all consume storage.                                                                               |
| Operations           | 50,000 document reads/day; 20,000 writes/day; 20,000 deletes/day                      | Quotas reset around midnight Pacific. Spark has no paid overage path without violating the no-billing constraint.                                                             |
| Outbound transfer    | 10 GiB/month                                                                          | Full-workspace reads and listeners consume transfer as well as reads.                                                                                                         |
| Document             | 1 MiB (1,048,576 bytes); a field value is at most 1 MiB minus 89 bytes                | The existing 2,000,000-character workspace ceiling cannot be represented as one Firestore document. A full-workspace representation must lower its ceiling or span documents. |
| API request          | 10 MiB                                                                                | A transaction or batch spanning chunks still has a total request ceiling, including affected document and index data.                                                         |
| Nested maps/arrays   | Depth 20                                                                              | The current model must remain under this depth if stored as native Firestore fields.                                                                                          |
| Transaction          | 270 seconds total, 60 seconds idle, 20-second lock deadline; all reads precede writes | Large client-side reconciliation must complete within these bounds and may be rerun.                                                                                          |
| Field transforms     | 500 on one document per commit or transaction                                         | Transform-heavy representations cannot exceed this per-document limit.                                                                                                        |
| Indexes on Spark     | 200 composite indexes and 200 single-field configurations                             | Index exemptions count as field configurations.                                                                                                                               |
| Per-document indexes | 40,000 entries and 8 MiB total; one entry at most 7.5 KiB                             | Large arrays/maps can multiply index entries beyond the document's own size. Opaque or unqueried payload fields need to be considered separately from queryable metadata.     |
| Indexed field value  | 1,500 bytes before truncation                                                         | Querying a large serialized workspace string is unsafe; values over the limit are truncated in indexes and queries can be inconsistent.                                       |

TTL deletes, PITR, managed backup data, restores, clones, and managed export/import require billing. The quota page lists managed export/import request limits, but the export/import guide explicitly requires billing, Blaze, and a Cloud Storage bucket, so those limits do not make the feature Spark-eligible.

### Atomicity and concurrency

Firestore offers two atomic operation forms:

- A transaction reads one or more documents and then writes. If any read document changes concurrently, the client library reruns the entire transaction against current data. No writes become visible until a successful commit, failures apply nothing, and Firestore guarantees serializable isolation by commit time.
- A batched write performs only writes across one or more documents. The entire batch succeeds or fails atomically, each operation counts separately toward usage, and mobile/web batches can queue while offline.

Web and mobile transactions always emulate optimistic concurrency with document-version write preconditions, regardless of the database's configured concurrency mode. They fail while the client is offline and may invoke the transaction callback multiple times, so callbacks must not directly mutate UI state or consume one-shot mutation identities. After finite contention retries, Firestore returns `ABORTED`.

These primitives can protect a stored revision and atomically update a bounded set of documents, but neither primitive supplies Objects' merge policy. That policy would still have to be computed before commit or inside a rerunnable transaction callback. A non-transactional full-document write supplies no compare-and-swap semantics.

Security Rules can use `getAfter()` to inspect post-batch or post-transaction document state before commit and require related writes to occur together. This is bounded by rule-dependent document access limits: 10 calls for a single-document request or query, and 20 for a transaction, batch, or multi-document read while retaining the 10-call limit for each operation. Exceeding a limit returns permission denied. Dependent document reads also consume read quota, including when a rule rejects a request.

### Offline and multi-tab behavior

Firestore's web SDK can read, query, listen to, and write cached data offline. Writes queue and synchronize after reconnect. For multiple pending changes to the same document, the documented conflict policy is last-write-wins. This differs from Objects' path-level reconciliation, durable deletion precedence, ordering merge, and duplicate suppression.

Web persistence details are:

- Memory cache is the default and does not survive a page session. Persistent IndexedDB cache is opt-in on web and supported only in Chrome, Safari, and Firefox.
- Persistent cache is not automatically cleared between sessions. Firebase specifically warns applications handling sensitive data to confirm that the device is trusted before enabling it.
- Persistent cache defaults to single-tab management. The current modular SDK can explicitly use `persistentMultipleTabManager()` to share IndexedDB persistence across tabs. The older `enablePersistence()` single-tab API fails with `failed-precondition` when multiple tabs compete.
- Snapshot listeners and document reads use the cache while network access is disabled; writes remain queued until networking returns.
- A document listener emits an immediate current snapshot and then subsequent changes. Metadata can distinguish local pending writes from server-acknowledged state, but an emitted local snapshot is not itself proof of server acceptance.

Firestore persistence therefore can replace some local durability plumbing, but not the current merge semantics. Keeping the existing sync client over Firestore would also mean deliberately coordinating two offline queues; replacing it with Firestore persistence would accept Firestore's conflict behavior unless an additional revision/reconciliation protocol remains.

Listener usage matters on Spark. A listener consumes reads when documents enter or update in the result and when a changed document leaves it. With persistence enabled, reconnect after more than 30 minutes is charged like a new query; without persistence, every disconnect/reconnect is charged like a new query. Queries have a minimum one-read charge even when empty, and rule-dependent reads add quota consumption.

### Queries and indexes

Firestore requires an index for every query. Basic single-field indexes are automatic; unsupported compound queries fail with an error that identifies the missing index. Composite indexes and field exemptions can be checked into the repository and deployed with Firebase CLI.

Security Rules are not result filters. A collection query is allowed only when its constraints prove that every possible result satisfies the read rule. For owner-field authorization, a collection query must include the corresponding owner constraint; otherwise the entire query fails even when all currently stored documents happen to belong to the caller. Rules can separately constrain `get` and `list`, inspect query `limit`, `offset`, and `orderBy`, and require a maximum result limit. Collection-group queries require Rules version 2, an explicit recursive collection-group rule, and appropriate collection-group indexes.

An owner-in-path model can authorize direct document access by matching `request.auth.uid` to the captured owner path without a dependent document read. A shared collection with an owner field can also be secured, but list queries must carry a matching owner constraint and their indexes must support it.

### Security Rules validation envelope

Rules can inspect `request.auth`, existing `resource.data`, and complete post-write `request.resource.data`. They can compare old and new state, use `keys().hasAll()` and `hasOnly()` for required and allowed fields, use `diff().affectedKeys()` for immutable/allowed updates, enforce scalar/map/list types with `is`, compare numbers and strings, and read bounded related documents through `get`, `exists`, and `getAfter`.

This supports owner, format/version, revision, immutable-ID, top-level allowed-field, and basic type checks. It does not provide a database schema by itself: Firestore is schemaless, so every required restriction must be encoded in Rules.

The important validation limits for the Objects model are:

- Custom functions contain a single return expression, cannot loop or call external services, and cannot recurse.
- Rules cannot import or execute `shared/workspace` TypeScript.
- `list` and `map` type checks have no generics. Rules can prove that a field is a list but cannot express "every element is a valid to-do" with a generic element validator or loop. Individual known positions can be checked, which is not sufficient for arbitrary workspace collections.
- Cross-entity invariants require bounded document access and expressions. The evaluator permits at most 1,000 expressions per request.
- Other hard limits are nested match depth 10, path length 100 segments, 20 path captures, function-call depth 20, 7 function arguments, 10 `let` bindings, no recursive calls, 256 KB source, and 250 KB compiled ruleset size.
- Reads are document-level: Rules cannot hide selected fields within an otherwise readable document. Differently protected data must live in a separate document.

An opaque serialized JSON chunk is especially limited under direct writes: Rules can validate ownership, chunk identity, string type/size, revision metadata, and an atomic manifest relationship, but cannot inspect the JSON's internal domain structure. Native maps expose fields to Rules, but arbitrary nested arrays still cannot receive complete generic validation.

### Direct client versus trusted server

| Concern                | Mobile/web direct client                                                                                                                                        | Trusted server client                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorization boundary | Every request is evaluated by Security Rules using Firebase Auth; App Check can separately reject requests before Rules evaluation when enforcement is enabled. | Server libraries bypass Security Rules and authenticate with Application Default Credentials; IAM and application code become the boundary. |
| Concurrency            | Optimistic version preconditions; transaction callback may rerun and fails offline.                                                                             | Uses Firestore's built-in transaction behavior and configured database concurrency mode; Standard defaults to pessimistic.                  |
| Domain validation      | Only what Security Rules can express within language, access-call, expression, and size limits is authoritative. Client TypeScript is bypassable.               | Arbitrary trusted code can run the existing complete validator and resolver before committing.                                              |
| Offline edits          | SDK queues ordinary/batched writes and provides optional persistent cache; same-document conflicts are last-write-wins.                                         | A remote server is not available offline; clients still need a local queue/protocol.                                                        |
| Owner isolation        | Can be encoded directly in document paths/fields and Rules.                                                                                                     | Must be rechecked in server code because Rules are bypassed.                                                                                |
| Spark eligibility      | Supported and is the documented viable architecture.                                                                                                            | No eligible production Firebase/Google server runtime exists under the map's no-billing constraint.                                         |

### Emulator fidelity and test obligations

The Firestore emulator evaluates Security Rules, exposes request-by-request rule traces and rule coverage, provides a database flush endpoint, and supports import/export fixtures for `emulators:start` and `emulators:exec`. A `demo-` project ID is safer because any non-emulated product call fails instead of reaching live resources. Auth-dependent rules require the same project ID across emulators and application configuration.

It is not production-equivalent:

- It does not implement every production transaction behavior; concurrent document locks can take up to 30 seconds to release.
- It does not track composite indexes and executes any otherwise valid query, so missing production indexes are invisible locally.
- It does not enforce every production size/transaction limit and can accept writes production rejects.
- The Emulator Suite UI has reduced support for named databases, and implicitly created named emulator databases use open rules.
- Firebase documents an upcoming Java 21 requirement for the Firestore emulator.

Rules unit tests and emulator integration tests are necessary, but the design also needs static checks against documented limits, checked-in index definitions, and narrow production smoke tests that prove indexes, Rules, and request sizes.

### Recovery and export boundary

Spark has no provider-managed database backup, PITR, clone, restore, or export/import path. Emulator exports are development fixtures, not production backups. Objects' browser-generated JSON export remains the only Spark-compatible user recovery and migration mechanism identified by this research. A complete recovery design must therefore make that client-side export independently readable and test its round trip; it cannot rely on an operator restoring Firestore.

### Constraints for later decisions

1. A single full workspace document cannot preserve the current 2,000,000-character ceiling; the persistence decision must choose a lower bound or a multi-document representation.
2. Native Firestore last-write-wins is not equivalent to the current synchronization contract. Retaining current behavior requires an explicit revision/reconciliation protocol rather than assuming offline persistence solves conflicts.
3. Full trusted domain validation is unavailable in direct-client Spark. The security decision must identify the smaller invariant set Rules enforce authoritatively and which domain behavior remains client-enforced, or reject feature/data shapes that require stronger trust.
4. Ownership should be provable from `request.auth.uid` and the target path or required owner query constraint without trusting a caller-supplied unrelated identity.
5. Large opaque payloads and unqueried nested content should not be assumed safely indexable; index exemptions, entry limits, and Rules visibility are representation constraints.
6. Transactions provide online compare-and-swap and serializable commits, not offline execution. Batched/ordinary writes provide offline queueing, not read-dependent reconciliation.
7. Read amplification from listeners, reconnects, empty queries, and rule-dependent documents must fit the fixed Spark quota.
8. Client-side JSON export is the production recovery mechanism because all managed Firestore recovery/export features are Blaze-only.

### Primary sources

- Firestore quotas and hard limits: https://firebase.google.com/docs/firestore/quotas
- Transactions and batched writes: https://firebase.google.com/docs/firestore/manage-data/transactions
- Transaction contention and serializability: https://firebase.google.com/docs/firestore/transaction-data-contention
- Web offline persistence and multi-tab configuration: https://firebase.google.com/docs/firestore/manage-data/enable-offline
- Realtime listeners: https://firebase.google.com/docs/firestore/query-data/listen
- Query and listener read accounting: https://firebase.google.com/docs/firestore/pricing
- Index requirements and deployment: https://firebase.google.com/docs/firestore/query-data/indexing
- Security Rules conditions and direct/server distinction: https://firebase.google.com/docs/firestore/security/rules-conditions
- Security Rules field and type validation: https://firebase.google.com/docs/firestore/security/rules-fields
- Query authorization behavior: https://firebase.google.com/docs/firestore/security/rules-query
- Firestore emulator capabilities and differences: https://firebase.google.com/docs/emulator-suite/connect_firestore
- Managed export/import billing requirement: https://firebase.google.com/docs/firestore/manage-data/export-import
