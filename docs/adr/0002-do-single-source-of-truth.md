# ADR 0002: The Durable Object is the single source of truth for CalDAV

The CalDAV layer is an adapter, never a second storage. The per-user
Workspace Durable Object remains the only source of truth: the adapter reads
state via `WorkspaceDO.load()` and writes by submitting typed
`WorkspaceChange`s through the same revisioned-command pipeline the web
client uses (`resolveSyncCommand` inside `transactionSync`, with idempotency
receipts), copying the HTTP-capture precedent. The adapter never hand-edits
the workspace document and has no private write path.

Why: every domain rule — validation, ordering, occurrence maintenance,
tombstone guards, size caps — then applies to phone writes for free, and a
rejected or buggy inbound change simply leaves the VTODO stale on the phone
until iOS re-syncs. The failure mode of any sync bug is **staleness, never
corruption or data loss**. Outbound sync is equally stateless: ctag =
snapshot `revision`, per-resource ETag = content hash of the deterministic
VTODO render, deletions propagate via RFC 6578 tombstones derived from the
adapter's per-resource anchor table — no shadow copy of to-dos exists that
could diverge from the document.
