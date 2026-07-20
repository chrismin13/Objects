# Rewrite Objects Around a Deep Workspace Lifecycle

Status: ready-for-agent

## Problem Statement

Objects currently spreads the rules for to-dos, Projects, Areas, Headings, Spaces, repetition, scheduling, Trash, the Logbook, saving, and rendering across a large imperative client runtime. The same user action can enter through a row, inspector, keyboard shortcut, context menu, bulk action, or drag operation, and each path must remember the same hidden rules. This makes behavior easy to duplicate, difficult to test, and likely to drift.

The current client also mixes two rendering approaches. Preact creates a mostly fixed shell and some dialogs, while the legacy runtime manually creates HTML, changes the DOM, mutates Workspace state, saves changes, restores focus, and shows feedback. This prevents the visual interface, domain rules, and sync behavior from having clear seams.

Repeating work is especially confusing. A repeating item is stored beside normal work while also acting as a hidden template. Generated copies do not clearly show that they repeat, users cannot easily reach the Repeating view, template edits and Occurrence edits are hard to distinguish, and cancellation behavior differs between entry paths.

The app is still early, there are no other users, and the owner has a current data backup. A sweeping rewrite is acceptable. However, every important existing workflow must survive, and the Things-inspired appearance must remain as close as practical. Small visual or behavioral differences are welcome only when they correct a clear mistake or improve an awkward interaction. Missing important features is unacceptable.

## Solution

Replace the current client with one typed Preact application built around a deep Workspace domain module. Every production interaction that changes a to-do, Project, Area, Heading, Space, Repeating Template, Occurrence, or setting will cross the Workspace interface. The module will own lifecycle rules and return observable results; UI modules will own presentation, focus, gestures, dialogs, and feedback.

Create a deep sync module behind a real seam. A Lakebed adapter will be used in production and an in-memory adapter will be used in tests. The internal database structure may be replaced without preserving live row compatibility, but the new app must import the current JSON backup format and continue to export a portable backup.

Replace the hybrid imperative UI with a complete Preact visual interface. Preserve the current Things-inspired layout, density, sidebar, task rows, Magic Plus behavior, inspector, responsive design, mobile drawers, dialogs, keyboard behavior, and feature set. Keep Web Awesome and SortableJS behind internal adapters for the interaction behavior they already own.

Model a to-do's Location through inheritance rather than copied parent data. Model Schedule as one coherent fact, derive Today and Upcoming, separate Outcome from Trash, and make Project Closure explicit. Model Repeating Templates separately from the normal Occurrences they create. Give repeating work visible markers, a focused schedule editor, and a visible but compact entry point beside Settings.

Build the replacement beside the current app, using the current app as the behavior and visual comparison target. Do not ship a half-migrated production path. Perform one final cutover after the replacement passes functional, visual, accessibility, persistence, sync, and hosted verification, then remove the old runtime.

## User Stories

1. As an Objects user, I want every important current workflow to remain available after the rewrite, so that the rewrite does not reduce what I can do.
2. As an Objects user, I want the rewritten app to look and feel like the current Things-inspired app, so that the product remains familiar.
3. As an Objects user, I want small visual and logical mistakes corrected during the rewrite, so that parity does not preserve known flaws.
4. As an Objects user, I want one responsive application on desktop and mobile, so that the same data and behavior work everywhere.
5. As an Objects user, I want light, dark, and system appearance choices, so that the app fits my environment.
6. As an Objects user, I want my chosen appearance to persist, so that I do not have to set it repeatedly.
7. As an Objects user, I want to sign in with Google, so that my private Workspace follows my account.
8. As an Objects user, I want my data isolated from other accounts, so that my Workspace remains private.
9. As an Objects user, I want clear loading, offline, and session-recovery screens, so that I understand why the Workspace is unavailable.
10. As an Objects user, I want the installed app shell to work offline and recover when connectivity returns, so that the PWA remains dependable.
11. As an Objects user, I want to create a to-do quickly from the Inbox, Today, Anytime, Someday, a Project, an Area, or a Heading, so that capture starts where I am working.
12. As an Objects user, I want Magic Plus to create a to-do in the intended list or section, so that direct capture remains fast.
13. As an Objects user, I want inline quick entry to behave like a normal to-do immediately, so that typed work is not held in a fragile temporary state.
14. As an Objects user, I want unfinished quick entry recovered after a failed save or reload, so that newly captured work is not lost.
15. As an Objects user, I want natural-language dates, times, deadlines, and tags recognized while typing, so that capture remains fast.
16. As an Objects user, I want shared text, URLs, and notes accepted through capture links, so that I can send information into Objects from other apps.
17. As an Objects user, I want authenticated HTTP capture to create the same kind of to-do as the visual interface, so that different entry paths follow the same rules.
18. As an Objects user, I want to add notes with Markdown support, so that longer details remain readable.
19. As an Objects user, I want to preview Markdown and search within notes, so that long notes remain useful.
20. As an Objects user, I want to add, edit, complete, remove, and reorder checklist items, so that a to-do can contain smaller steps.
21. As an Objects user, I want to schedule a to-do for Today, This Evening, a future date, Anytime, Someday, or the Inbox, so that I control when it appears.
22. As an Objects user, I want Today to include open work scheduled for today or earlier, so that overdue work does not disappear.
23. As an Objects user, I want Upcoming to show open work scheduled for future dates, so that I can plan ahead.
24. As an Objects user, I want Tomorrow to show the next day's work, so that I can review the immediate future.
25. As an Objects user, I want a Schedule and Deadline to remain separate, so that I can distinguish when work starts from when it must finish.
26. As an Objects user, I want reminders to move sensibly when I reschedule a to-do, so that notifications do not point to the wrong day.
27. As an Objects user, I want to snooze a reminder from a notification, so that I can defer it without losing it.
28. As an Objects user, I want overdue deadlines and future deadlines displayed clearly, so that commitments remain visible.
29. As an Objects user, I want the Deadlines view to list open to-dos and Projects in deadline order, so that I can review commitments.
30. As an Objects user, I want calendar events beside relevant work in Today, Tomorrow, and Upcoming, so that plans and commitments share one agenda.
31. As an Objects user, I want to complete a to-do from its row, inspector, keyboard, context menu, or bulk selection with identical results, so that the action is predictable.
32. As an Objects user, I want to undo a recent completion, so that accidental completion is recoverable.
33. As an Objects user, I want to cancel a to-do without pretending it was completed, so that the Logbook remains truthful.
34. As an Objects user, I want to reopen completed or canceled work where allowed, so that changed plans are recoverable.
35. As an Objects user, I want to duplicate a to-do with independent checklist items, so that the copy can change safely.
36. As an Objects user, I want to share a to-do and copy a deep link to it, so that I can reference work outside Objects.
37. As an Objects user, I want to move a to-do to Trash without losing whether it was open, completed, or canceled, so that restoration preserves its Outcome.
38. As an Objects user, I want to restore a trashed to-do, so that accidental removal is recoverable.
39. As an Objects user, I want to delete a trashed to-do forever after confirmation, so that permanent deletion is deliberate.
40. As an Objects user, I want to empty Trash for the active Space after confirmation, so that permanent cleanup is controlled.
41. As an Objects user, I want completed and canceled work logged according to immediate, daily, or manual policy, so that the active lists stay as tidy as I prefer.
42. As an Objects user, I want to log completed work manually, so that I control when finished work leaves active lists.
43. As an Objects user, I want the Logbook to retain completed and canceled Outcomes, so that history remains accurate.
44. As an Objects user, I want completed Projects available in the Logbook and Logged Projects view, so that past outcomes remain discoverable.
45. As an Objects user, I want a to-do inside a Heading to inherit its Project or Area and Space, so that its Location cannot disagree with its parent.
46. As an Objects user, I want a to-do inside a Project to inherit its Area and Space, so that moving the Project moves its work automatically.
47. As an Objects user, I want a standalone to-do inside an Area to inherit its Space, so that moving the Area moves its work automatically.
48. As an Objects user, I want only unfiled work to have a direct Space, so that Location has one clear source.
49. As an Objects user, I want moving a Heading to move all of its to-dos automatically, so that the section remains intact.
50. As an Objects user, I want moving a Project or Area to update the effective Location of everything inside it, so that no child data becomes stale.
51. As an Objects user, I want to move one or many to-dos through the move dialog, drag and drop, keyboard commands, and context menus, so that filing works with my preferred input.
52. As an Objects user, I want to reorder to-dos within a section and across compatible sections, so that list order reflects my priorities.
53. As an Objects user, I want keyboard alternatives for every important drag operation, so that pointer use is not required.
54. As an Objects user, I want to select one, several, a range, or all visible to-dos, so that bulk work is efficient.
55. As an Objects user, I want bulk scheduling, moving, tagging, completion, cancellation, Trash, and restoration, so that repeated actions do not require opening every to-do.
56. As an Objects user, I want inherited Area and Project tags combined with direct to-do tags, so that filtering reflects context without copying tags.
57. As an Objects user, I want to create, rename, and delete tags, so that my vocabulary can evolve.
58. As an Objects user, I want tag changes reflected everywhere they are used, so that old names do not remain hidden.
59. As an Objects user, I want to filter current lists by one or more tags, so that I can focus on a smaller set of work.
60. As an Objects user, I want tags searchable through Quick Find, so that tag views are easy to reach.
61. As an Objects user, I want to create, edit, move, duplicate, complete, cancel, restore, trash, and permanently delete Projects, so that Project lifecycle behavior is complete.
62. As an Objects user, I want a Project to contain Headings and to-dos, so that larger outcomes can be organized.
63. As an Objects user, I want completing or canceling a Project to require an explicit Outcome for every remaining open to-do, so that unfinished work is not silently hidden.
64. As an Objects user, I want restoring a Project to reopen only the to-dos changed by that Project Closure, so that earlier completed work stays completed.
65. As an Objects user, I want a Project progress indicator based on its active to-dos, so that I can see how far the outcome has progressed.
66. As an Objects user, I want to create, edit, move, and remove Areas, so that ongoing responsibilities remain organized.
67. As an Objects user, I want removing an Area to keep its Projects and to-dos in the same Space, so that removing organization does not delete work.
68. As an Objects user, I want to create, edit, move, duplicate, archive, restore, delete, and convert Headings, so that sections can evolve with the work.
69. As an Objects user, I want deleting a Heading to keep its to-dos in the parent without that Heading, so that deleting organization does not delete work.
70. As an Objects user, I want converting a Heading to a Project to keep its to-dos together, so that growing work can become a separate outcome.
71. As an Objects user, I want a Repeating Template to be separate from its actionable Occurrences, so that the schedule is not confused with today's work.
72. As an Objects user, I want every generated Occurrence to show a quiet repeat marker in normal lists, so that I can recognize repeating work.
73. As an Objects user, I want an Occurrence inspector to show its plain-English repetition, current date, next date, and link to its Repeating Template, so that its source is clear.
74. As an Objects user, I want editing an Occurrence to change only that Occurrence, so that one exception does not alter the future schedule.
75. As an Objects user, I want editing a Repeating Template to affect future Occurrences only, so that existing work never changes unexpectedly.
76. As an Objects user, I want template editing to state clearly that changes apply to future Occurrences, so that edit scope is never hidden.
77. As an Objects user, I want future repetitions shown as previews in Upcoming, so that I can plan without filling the Workspace with future generated work.
78. As an Objects user, I want a preview to become a normal Occurrence when its date arrives, so that it becomes actionable at the right time.
79. As an Objects user, I want missed on-schedule dates to create their separate Occurrences when Objects next runs, so that scheduled work is not silently lost.
80. As an Objects user, I want damaged repetition data prevented from creating an unbounded number of items at once, so that recovery remains safe.
81. As an Objects user, I want on-schedule repetition to continue even if an earlier Occurrence remains open, so that fixed schedules remain fixed.
82. As an Objects user, I want after-completion repetition to allow only one open Occurrence at a time, so that the next cycle waits for the current one.
83. As an Objects user, I want completing an after-completion Occurrence to schedule the next one from the completion day, so that the interval reflects when I finished.
84. As an Objects user, I want to Skip one Occurrence without changing its Repeating Template, so that one exception does not end the routine.
85. As an Objects user, I want a skipped Occurrence recorded as canceled in the Logbook, so that history remains truthful.
86. As an Objects user, I want skipping an after-completion Occurrence to schedule the next one from the skip day, so that the routine does not become stuck.
87. As an Objects user, I want Trash to remain different from Skip, so that removing unresolved work does not silently advance an after-completion schedule.
88. As an Objects user, I want to pause a Repeating Template and resume it later, so that temporary breaks do not destroy the schedule.
89. As an Objects user, I want pausing a template to leave existing Occurrences unchanged, so that already created work remains stable.
90. As an Objects user, I want to stop a Repeating Template permanently while retaining it as read-only history, so that old Occurrences still have an understandable source.
91. As an Objects user, I want stopped templates collapsed by default, so that history does not clutter active repetition management.
92. As an Objects user, I want to delete a stopped template forever through a separate destructive action, so that historical removal is deliberate.
93. As an Objects user, I want the Repeating view divided into Active, Paused, and collapsed Stopped sections, so that schedule state is easy to scan.
94. As an Objects user, I want each template row to show whether it creates a to-do or Project, its plain-English schedule, next date, Space, and parent, so that I understand it without opening it.
95. As an Objects user, I want a compact Repeating icon beside Settings, so that repetition management is visible without taking a large sidebar row.
96. As an Objects user, I want the Repeating view also reachable from Quick Find, Occurrence inspectors, and Upcoming previews, so that relevant paths lead to it.
97. As an Objects user, I want a focused repeat schedule editor instead of cramped inspector controls, so that complex schedules remain understandable.
98. As an Objects user, I want the repeat editor to show a live plain-English summary, so that I can verify the rule before saving.
99. As an Objects user, I want daily, weekly, monthly, and yearly intervals, so that common routines remain supported.
100. As an Objects user, I want weekly repetition on several selected weekdays, so that weekday and weekend routines remain possible.
101. As an Objects user, I want both on-schedule and after-completion modes explained in plain language, so that I choose the correct behavior.
102. As an Objects user, I want a Repeating Template to define reminder and deadline defaults copied to new Occurrences, so that each cycle carries the intended timing.
103. As an Objects user, I want changing one Occurrence's reminder or deadline to remain local, so that future defaults stay unchanged.
104. As an Objects user, I want making an existing to-do repeat to create a separate template while using its scheduled date as the first Occurrence, so that the item does not disappear.
105. As an Objects user, I want to create a new Repeating Template directly from the Repeating view, so that a normal to-do is not required first.
106. As an Objects user, I want repeating Projects to create Project Occurrences with copied Headings and to-dos, so that recurring multi-step work remains supported.
107. As an Objects user, I want each copied checklist item, Heading, to-do, and Project to have an independent identity, so that changes never leak between Occurrences.
108. As an Objects user, I want Quick Find to search lists, special views, Spaces, Areas, Projects, Headings, tags, active to-dos, Logbook, Trash, notes, checklists, and Repeating Templates, so that everything remains discoverable.
109. As an Objects user, I want keyboard navigation and selection in Quick Find, so that search is fast without a pointer.
110. As an Objects user, I want direct links to lists, special views, Projects, Areas, tags, and individual to-dos, so that navigation can be automated and shared.
111. As an Objects user, I want to create, rename, recolor, pin, reorder, and delete Spaces, so that personal and work contexts remain separate.
112. As an Objects user, I want deleting a Space to move its content to a chosen remaining Space, so that no work is lost.
113. As an Objects user, I want a default Space for new unfiled work, so that capture has a predictable home.
114. As an Objects user, I want optional launch rules to select a Space by weekday and time, so that Objects opens in the right context.
115. As an Objects user, I want launch-rule enablement and manual Space selection remembered per device, so that each device can behave appropriately.
116. As an Objects user, I want to add calendar events manually and import ICS events, so that external commitments can appear in the agenda.
117. As an Objects user, I want to export the complete Workspace as portable JSON, so that I control my backup.
118. As an Objects user, I want to import my current Objects JSON backup into the rewritten app, so that the clean database replacement does not lose my data.
119. As an Objects user, I want full import replacement guarded by clear confirmation, so that accidental data replacement is difficult.
120. As an Objects user, I want saves to feel immediate and retry safely after temporary failure, so that editing remains responsive.
121. As an Objects user, I want changes from another signed-in device merged without silently overwriting unrelated fields, so that multi-device use remains safe.
122. As an Objects user, I want permanent deletions protected from being recreated by stale device data, so that deleted work stays deleted.
123. As an Objects user, I want visible feedback for save failure and recovery, so that sync problems are understandable.
124. As a keyboard user, I want existing navigation, creation, scheduling, completion, cancellation, duplication, movement, repetition, Logbook, and Heading shortcuts preserved, so that the rewrite does not reduce efficiency.
125. As a keyboard user, I want Escape to close the highest active overlay first and restore focus correctly, so that overlays remain predictable.
126. As a screen-reader user, I want correct names, roles, states, live feedback, and focus order, so that every workflow remains understandable.
127. As a touch user, I want reliable drawers, swipes, long press, selection, drag, and safe touch targets, so that the mobile interface remains usable.
128. As a user who prefers reduced motion, I want animations reduced without losing state feedback, so that the interface respects my system preference.
129. As an Objects user, I want long titles, dense data, empty views, errors, disabled actions, and destructive confirmations to remain readable, so that unusual states do not break the interface.
130. As an Objects user, I want the hosted app verified after deployment, so that local success matches the product I actually use.

## Implementation Decisions

- Replace the complete client implementation, including rendering, domain behavior, and sync coordination. Do not place a new visual interface on top of the old runtime.
- Build the replacement beside the current client and keep the current client available as a comparison target during development.
- Keep exactly one production rendering path and one production mutation path after final cutover.
- Remove the legacy runtime after parity is proven. Do not retain a permanent compatibility path.
- Treat the current app and its documented parity inventory as the product contract.
- Preserve all important functionality and the Things-inspired visual appearance. Accept differences only when they correct a mistake or deliberately improve an awkward interaction.
- Build a deep, pure Workspace domain module as the primary module for state changes and derived behavior.
- Keep the Workspace interface small and use it from every production caller and behavioral test.
- Keep dates, identity creation, and other nondeterministic inputs controllable at the Workspace seam so tests are stable.
- Return explicit observable results from Workspace changes, including success, rejected actions, affected items, undo information, and user-facing outcome categories. Do not make domain behavior depend on DOM side effects.
- Keep UI feedback wording, focus, dialogs, gestures, and visual state in Preact feature modules.
- Use Preact for all production rendering and state subscriptions.
- Keep Web Awesome behind internal UI adapters for dialogs, drawers, menus, selects, switches, checkboxes, tooltips, tags, progress indicators, dividers, disclosure, and suitable form actions.
- Keep SortableJS behind internal UI adapters for direct manipulation and translate its events into Workspace changes.
- Keep task rows, Magic Plus, sidebar composition, Quick Find behavior, the Spaces pill, and other product-defining interactions as Objects-owned visual modules.
- Use raw CSS or built-in Tailwind classes only; do not add a styling build pipeline or install packages.
- Keep all shared domain code free of DOM, Node, environment, and Lakebed runtime imports.
- Use a deep sync module with a real seam and two adapters: Lakebed for production and in-memory for tests.
- Keep the client responsive through optimistic local changes while sync runs in the background.
- Preserve field-safe multi-device merging, mutation acknowledgement, retry behavior, deletion protection, and checklist persistence.
- Allow the Lakebed database structure to be replaced cleanly because there are no other users and the owner has a backup.
- Do not require live migration of existing normalized rows.
- Import the current portable JSON backup format and export a portable complete backup from the new model.
- Use authenticated Lakebed queries for reads and mutations for user-driven writes. Keep authenticated HTTP capture as the external entry path.
- Apply the same Workspace rules to visual capture, URL capture, recovery, import, and authenticated HTTP capture.
- Model a to-do's Location through its closest parent. A Heading determines its Project or Area; a Project determines its Area and Space; an Area determines its Space; only unfiled work has a direct Space.
- Do not copy inherited parent identifiers onto a to-do when they can be derived.
- Model Schedule as one coherent value: Inbox, Anytime, Someday, or a scheduled date with optional This Evening placement.
- Derive Today and Upcoming from Schedule rather than storing them as separate buckets.
- Keep Deadline separate from Schedule.
- Keep Outcome as open, completed, or canceled.
- Model Trash separately from Outcome so restoration never reconstructs an earlier Outcome.
- Model Logbook placement separately from Outcome and preserve immediate, daily, and manual policies.
- Track which to-dos were changed by Project Closure so Project restoration reopens exactly those to-dos and no others.
- Model Repeating Templates separately from to-dos and Projects.
- Model every generated item as a normal Occurrence with a stable connection to its Repeating Template and scheduled date.
- Ensure materialization is idempotent: checking the same template and date more than once must create one Occurrence.
- Show future repeating work as previews in Upcoming and materialize it on its scheduled date.
- For on-schedule repetition, create every missed Occurrence and continue the schedule even when earlier Occurrences remain open.
- Process missed Occurrences in safe bounded batches without silently discarding scheduled dates.
- For after-completion repetition, allow one open Occurrence and schedule the next from the day the current one is completed or skipped.
- Keep Skip distinct from completion and Trash. Skip gives one Occurrence a canceled Outcome, records it in the Logbook, advances after-completion repetition, and never changes the template.
- Treat normal Occurrence edits as local. Require an explicit route to edit the Repeating Template for future Occurrences.
- Apply template content, Location, tags, checklist, reminder, Deadline, and other defaults only when creating a new Occurrence.
- Keep existing Occurrences unchanged when a template is edited, paused, stopped, restored, moved, or deleted.
- Make Pause reversible and stop creating Occurrences while paused.
- Make Stop permanent, keep the template as read-only history, and show stopped templates in a collapsed section.
- Keep permanent template deletion as a separate destructive action.
- Preserve direct creation of Repeating Templates and conversion of existing to-dos and Projects into repetition.
- When converting existing work, create a separate template and use the selected Schedule as the first Occurrence date.
- Give repeating Occurrences a quiet repeat marker in normal rows and a clear template connection in the inspector.
- Add a compact Repeating icon beside Settings rather than a large permanent sidebar row.
- Keep Repeating reachable from its icon, Quick Find, Occurrence inspectors, and Upcoming previews.
- Organize the Repeating view into Active, Paused, and collapsed Stopped sections.
- Use a focused schedule editor with a live plain-English summary on desktop and an appropriately large mobile presentation.
- Keep pause and stop actions in the Repeating Template inspector rather than mixing them into the schedule form.
- Preserve daily, weekly, monthly, yearly, multi-weekday, interval, reminder, Deadline, fixed-schedule, and after-completion behavior.
- Preserve repeating Projects and copy their Headings and to-dos into independent Project Occurrences.
- Preserve existing Space behavior, per-device launch rules, calendar events, search, selection, direct manipulation, settings, PWA behavior, URL automation, and accessibility requirements.
- Complete one final production cutover only after the complete parity matrix passes.
- Deploy the validated result to the existing Lakebed deployment, verify hosted behavior, then commit and push the complete task-scoped rewrite as required by the project workflow.

## Testing Decisions

- Use the deep Workspace interface as the main behavioral test seam. Production callers and tests must cross the same seam.
- Test observable Workspace results and derived views, not internal helper functions, private state layout, or implementation order.
- Prefer one high seam over many shallow seams. Add lower seams only for true adapters or visual behavior that cannot be observed through Workspace behavior.
- Use controllable dates and identity generation in behavioral tests so Schedule, repetition, reminders, Logbook policy, and undo are deterministic.
- Cover every lifecycle action through the Workspace seam: create, update, schedule, move, tag, complete, cancel, reopen, duplicate, Trash, restore, permanent deletion, checklist changes, and batch changes.
- Test that pointer, keyboard, inspector, context-menu, bulk, and drag callers produce the same Workspace change for the same user intent.
- Test Location inheritance through Heading, Project, Area, and Space moves, including deletion and restoration of parents.
- Test derived Today, This Evening, Tomorrow, Upcoming, Anytime, Someday, Inbox, Deadline, Logbook, Trash, tag, Project, Area, Heading, and Space views.
- Test Project Closure with already completed, newly completed, canceled, repeating, trashed, and restored child work.
- Test Outcome, Trash, and Logbook as separate facts, including restoration and permanent deletion.
- Test Repeating Template creation, conversion from existing work, template editing, Occurrence editing, pause, resume, stop, history, and permanent deletion.
- Test on-schedule repetition across daily, weekly, multiple weekdays, monthly, yearly, leap-year, month-end, interval, missed-date, overlapping-open, and bounded-recovery cases.
- Test after-completion repetition for completion, Skip, undo, open Occurrence protection, Trash, restoration, and schedule advancement.
- Test that fixed repetition creates every missed Occurrence exactly once and that repeated checks are idempotent.
- Test that template changes affect future Occurrences but never existing Occurrences.
- Test that copied Projects, Headings, to-dos, and checklist items receive independent identities.
- Test reminder and Deadline defaults copied from templates and local overrides on one Occurrence.
- Test the sync module through shared contract tests run against the in-memory and Lakebed adapters wherever the environment permits.
- Test sync change generation, acknowledgement, remote merge, queued changes, retries, tombstones, checklist replacement, malformed input, stale clients, and partial batches.
- Test current JSON backup import into the new Workspace model, including old repetition data, copied Location fields, old status spellings, missing Spaces, and legacy settings.
- Test portable export followed by full import as a round trip.
- Use browser-level tests at the complete App seam for authentication states, loading, session recovery, major navigation, every overlay, focus return, keyboard shortcuts, drag alternatives, mobile drawers, context menus, Quick Find, and hosted capture.
- Use browser-level tests for the Repeating icon, Repeating view sections, schedule editor summary, Occurrence marker, template link, previews, Pause, Stop, Skip, and mobile presentation.
- Use visual comparison at desktop widths 1200 and 1440 and mobile widths 390 and 430 in light and dark appearance.
- Capture comparison images for the sidebar, primary lists, Project and Area views, inspector, Quick Find, Repeating view, repeat editor, Spaces settings, application settings, selection toolbar, context menu, mobile drawer, empty states, dense states, Trash, and Logbook.
- Test hover, pressed, selected, focus-visible, loading, empty, error, disabled, success, destructive, undo, long-content, reduced-motion, and offline states.
- Test accessible names, roles, states, focus containment, focus return, dismissal order, live feedback, touch targets, and keyboard-only completion of every major workflow.
- Use the current small domain-test file and the broader tests visible in earlier repository history only as prior-art examples. Replace them with tests executed by the normal verification workflow; do not keep an uncalled test function as evidence.
- Run all relevant checks and `npx lakebed build . --target anonymous --json` before deployment.
- Deploy with `npx lakebed deploy` and verify the hosted app and affected HTTP endpoints before considering implementation complete.

## Out of Scope

- Removing an existing important feature to reduce rewrite effort.
- A broad visual redesign away from the current Things-inspired appearance.
- Keeping the legacy runtime as a permanent production fallback.
- Shipping a production interface where some screens use the old mutation path and others use the new one.
- Supporting other users or performing a live migration for unknown external Workspaces.
- Real-time collaboration, shared Workspaces, assignments, comments, or multi-user editing.
- Native macOS, iOS, iPadOS, Android, or Windows applications beyond the responsive PWA.
- Installing new third-party packages or adding a CSS, PostCSS, or Tailwind build pipeline.
- Arbitrary nested to-dos or deeper location nesting beyond Heading, Project, Area, and Space.
- Making future repetition previews completable before their scheduled date.
- Changing the meaning of current portable backup data without an import path.
- Reproducing known logical or visual mistakes when a clear correction can be made without removing functionality.

## Further Notes

- The domain language in the root glossary is authoritative for To-do, Project, Area, Heading, Space, To-do Location, Schedule, Today, Upcoming, Deadline, Outcome, Trash, Project Closure, Repeating Template, Occurrence, repetition modes, Skip, and template states.
- There are no ADRs in this area at the time this spec was written.
- The existing UI migration plan remains the detailed parity inventory and comparison checklist. Where it assumes incremental vertical slices, this spec replaces that delivery strategy with a complete parallel replacement and final cutover while preserving its product contract.
- The previous typed Preact rewrite was reverted because it omitted important behavior. This spec requires an exhaustive parity matrix and executable evidence before cutover.
- The current owner has a data backup and there are no other users, so a clean internal persistence replacement is acceptable.
- Official Things behavior is useful prior art for Repeating Templates, generated copies, fixed and after-completion schedules, reminders, deadlines, pause, resume, stop, and the Repeating special list. Objects deliberately improves discoverability with a visible compact Repeating icon and makes Skip explicit.
- The main testing seam was already agreed during the architecture discussion: lifecycle rules belong behind one deep Workspace interface used by production and tests.
