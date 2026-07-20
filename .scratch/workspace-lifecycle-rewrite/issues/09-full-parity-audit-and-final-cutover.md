# 09 — Full Parity Audit and Final Cutover

**What to build:** Prove that the replacement keeps the current application's important behavior and visual character, correct any remaining gaps, migrate the real Workspace, switch production to the replacement, and remove the legacy runtime only after the complete replacement is verified.

**Blocked by:** 01 — Replacement App Foundation and Data Import; 02 — Complete Basic To-do Lifecycle; 03 — Organization and Projects; 04 — Main Interface and Interactions; 05 — Repeating To-dos and Projects; 06 — Search, Navigation, and Calendar; 07 — Settings, Appearance, and Portable Data; 08 — Offline and Multi-device Reliability.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] A written parity matrix maps every important current workflow and all 130 parent-spec user stories to executable evidence in the replacement.
- [ ] The current and replacement applications are compared side by side for behavior, wording, keyboard use, focus, touch behavior, responsive layout, and appearance.
- [ ] Visual comparisons pass at desktop widths 1200 and 1440 and mobile widths 390 and 430 in light and dark modes for every screen and state named in the parent specification.
- [ ] Loading, empty, error, offline, disabled, destructive, undo, success, dense, long-content, hover, pressed, selected, focus-visible, and reduced-motion states are checked.
- [ ] Keyboard-only, screen-reader, and touch-only completion of every major workflow is verified, including overlay dismissal and focus return.
- [ ] The imported real backup is checked for record counts, relationships, outcomes, Trash, Logbook, settings, calendars, tags, inherited Locations, repetition history, and future schedules.
- [ ] Any accepted behavior or appearance difference is recorded as an intentional correction; no important missing feature is accepted as a harmless difference.
- [ ] The normal automated checks and anonymous Lakebed build pass with the replacement selected.
- [ ] Production is switched in one cutover so no screen continues using the legacy rendering or mutation path.
- [ ] The legacy runtime and temporary comparison-only wiring are removed after the cutover succeeds.
- [ ] The application is deployed to the existing Lakebed deployment and the hosted UI, authentication, persistence, capture endpoint, import/export, offline recovery, and major workflows are verified.
- [ ] A post-cutover portable backup is created and checked before the work is considered complete.
- [ ] The final task-scoped changes are committed and pushed only after local and hosted verification succeeds.

