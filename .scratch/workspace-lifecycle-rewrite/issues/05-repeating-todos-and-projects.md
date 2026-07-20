# 05 — Repeating To-dos and Projects

**What to build:** Deliver the complete repetition model and user experience. Keep Repeating Templates separate from normal Occurrences, make repetition easy to recognize and manage, and support both repeating to-dos and repeating Projects without changing existing Occurrences unexpectedly.

**Blocked by:** 03 — Organization and Projects; 04 — Main Interface and Interactions.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Repeating Templates and generated Occurrences are separate domain records with stable links and scheduled dates.
- [ ] Normal rows show a quiet repeat marker, and the Occurrence inspector shows the rule summary, current date, next date, and a direct route to its template.
- [ ] Editing an Occurrence changes only that Occurrence; editing a template clearly applies only to future Occurrences.
- [ ] Upcoming shows non-actionable future previews which become normal Occurrences when due.
- [ ] On-schedule repetition supports daily, weekly, multiple weekdays, monthly, yearly, and interval rules; it creates every missed Occurrence exactly once in safe bounded batches even when earlier Occurrences remain open.
- [ ] After-completion repetition allows one open Occurrence and schedules the next from the completion or Skip day.
- [ ] Skip cancels and logs one Occurrence, advances an after-completion schedule, and never changes the template; Trash does not act like Skip.
- [ ] Templates can be created directly or from existing to-dos and Projects, using the chosen scheduled date as the first Occurrence date.
- [ ] Template content, Location, tags, checklist, reminder, Deadline, and other defaults are copied only when a new Occurrence is created.
- [ ] Pause is reversible and leaves existing Occurrences unchanged; Stop is permanent, leaves read-only history, and permanent deletion is a separate confirmed action.
- [ ] A visible compact Repeating icon sits beside Settings and opens a view with Active, Paused, and collapsed Stopped sections.
- [ ] Template rows show item type, plain-English schedule, next date, Space, and parent; Repeating is also reachable from Quick Find, Occurrence inspectors, and previews.
- [ ] The focused repeat editor works on desktop and mobile, explains fixed and after-completion modes, and shows a live plain-English summary before saving.
- [ ] Repeating Projects produce independent Project, Heading, to-do, and checklist identities for every Occurrence.
- [ ] Deterministic tests cover rule boundaries, month ends, leap years, missed dates, idempotency, damaged input, local overrides, template edits, undo, pause, resume, stop, deletion, conversion, and repeating Project copies.

