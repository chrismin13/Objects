# 02 — Complete Basic To-do Lifecycle

**What to build:** Deliver the complete non-repeating to-do lifecycle through the Workspace interface and the replacement UI. This includes capture, editing, scheduling, reminders, deadlines, outcomes, Logbook rules, Trash, restoration, and all standard to-do views.

**Blocked by:** 01 — Replacement App Foundation and Data Import.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] A user can create a to-do from Inbox, Today, Anytime, Someday, an Area, a Project, or a Heading using inline entry and Magic Plus.
- [ ] Quick entry becomes a normal saved to-do immediately, recognizes supported natural-language dates, times, deadlines, and tags, and safely recovers unfinished text after a failed save or reload.
- [ ] The inspector supports title, Markdown notes and preview, searching inside notes, independent checklist items, Schedule, This Evening, reminder, Deadline, tags, sharing, duplication, and deep-link copying.
- [ ] Schedule is stored as Inbox, Anytime, Someday, or a date with optional This Evening placement; Today, Tomorrow, and Upcoming are derived rather than stored separately.
- [ ] Today includes overdue scheduled work, Upcoming shows future scheduled work, and the Deadlines view orders open to-dos and Projects by deadline.
- [ ] Reminder behavior remains sensible when Schedule changes, and notification snoozing updates the reminder through the same Workspace path.
- [ ] Complete, cancel, reopen, undo completion, duplicate, and manual logging produce explicit and consistent Workspace results.
- [ ] Immediate, daily, and manual Logbook policies work, and completed and canceled Outcomes remain distinct in history.
- [ ] Trash remains separate from Outcome; restore preserves the earlier Outcome, while permanent deletion and emptying the active Space's Trash require confirmation.
- [ ] Inbox, Today, This Evening, Tomorrow, Upcoming, Anytime, Someday, Deadlines, Logbook, and Trash have usable loading, empty, error, dense-content, and long-title states.
- [ ] Saves appear immediate, show failed-save feedback, and can be retried without duplicating the action.
- [ ] Behavioral tests cover every lifecycle change and every derived view through the Workspace interface, including malformed and rejected actions.

