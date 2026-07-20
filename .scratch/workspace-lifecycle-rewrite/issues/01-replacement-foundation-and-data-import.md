# 01 — Replacement App Foundation and Data Import

**What to build:** Create the replacement application beside the current application. Establish the pure Workspace module as the single path for behavior, the sync boundary with Lakebed and in-memory adapters, the complete replacement data model, private authentication, and a safe importer for the current Objects JSON backup.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] The replacement runs beside the current application without changing the current production path.
- [ ] The replacement has one typed Preact entry point and a basic responsive shell that can be compared with the current application.
- [ ] The Workspace interface owns all replacement-domain reads, changes, derived results, validation, undo information, dates, and identity creation.
- [ ] Shared domain code has no browser, server, environment, or Lakebed runtime dependencies.
- [ ] The replacement data model can represent to-dos, Projects, Areas, Headings, Spaces, Tags, schedules, reminders, deadlines, outcomes, Trash, Logbook placement, Project Closures, Repeating Templates, Occurrences, settings, calendar events, sync metadata, and permanent-deletion markers.
- [ ] Production uses a Lakebed-backed sync adapter and tests use an in-memory adapter through the same contract.
- [ ] Google sign-in protects the replacement Workspace and every server read or write checks ownership.
- [ ] Loading, signed-out, unavailable-session, and failed-load states are clear and usable.
- [ ] The current portable JSON backup can be validated and imported into the replacement model, including legacy statuses, locations, repetition data, missing Spaces, and settings.
- [ ] Full replacement import requires an explicit confirmation and reports what was imported, corrected, skipped, or rejected.
- [ ] Automated tests prove Workspace determinism, adapter contract behavior, account isolation, malformed-import handling, and successful import of a representative current backup.

