# 08 — Offline and Multi-device Reliability

**What to build:** Make the replacement dependable across offline use, reconnects, session recovery, retries, and multiple signed-in devices. Preserve immediate local feedback while preventing lost updates, duplicate work, and the return of permanently deleted data.

**Blocked by:** 02 — Complete Basic To-do Lifecycle; 03 — Organization and Projects; 05 — Repeating To-dos and Projects; 07 — Settings, Appearance, and Portable Data.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] User changes appear immediately in the local Workspace while durable sync continues in the background.
- [ ] Pending changes survive temporary network failure, app suspension, reload, and authentication recovery where the platform permits.
- [ ] Retrying an acknowledged or uncertain mutation does not duplicate to-dos, Occurrences, checklist items, calendar events, or capture requests.
- [ ] Remote changes merge without silently overwriting unrelated local fields.
- [ ] Conflicting changes to the same field follow a documented deterministic rule and provide understandable feedback when user attention is needed.
- [ ] Permanent deletions use durable deletion markers so stale devices cannot recreate removed data.
- [ ] Checklist replacement, ordering, parent moves, Project Closure, settings, repetition materialization, and template state changes remain correct across devices.
- [ ] Repetition checks on several devices create each scheduled Occurrence only once.
- [ ] Partial server batches, malformed remote data, rejected ownership, stale versions, and interrupted acknowledgements recover safely.
- [ ] The installed PWA shell opens offline, explains unavailable data or pending sync clearly, and reconnects without requiring a destructive reset.
- [ ] Save, offline, retrying, recovered, conflict, and session-expired states are visible but do not unnecessarily block unrelated local work.
- [ ] Shared sync contract tests run against the in-memory adapter and the Lakebed adapter wherever the environment permits.
- [ ] Multi-client tests cover unrelated field edits, same-field conflicts, moves, completion, Trash, permanent deletion, checklist edits, repetition, capture retries, and long offline queues.

