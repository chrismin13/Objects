# Recover the Objects Interface Around the Workspace Engine

Status: ready-for-agent

## Problem Statement

The Workspace rewrite improved the internal domain model, repetition model, import path, sync behavior, and automated domain coverage, but it failed as a product replacement. The production-quality interface was replaced by a visually crude interface with weaker interactions, browser-native prompts, missing behavior, and confirmed functional defects. The rewrite was declared complete even though its visual and browser-level evidence was not reproducible and its most important acceptance condition—strict functional and visual parity—was not met.

The previous Objects interface is polished, familiar, dense, and dependable. Its to-do rows, sidebar, inspector, Magic Plus, dialogs, menus, responsive behavior, keyboard behavior, and Things-inspired visual language form the real product contract. However, its implementation combines manual rendering, global event handling, direct state mutation, lifecycle rules, persistence, focus behavior, navigation, and feedback inside a large imperative runtime. Restoring that complete implementation permanently would also restore the technical problems that motivated the rewrite.

Objects therefore needs a recovery approach that preserves the previous interface exactly while replacing its behavior and persistence underneath it. The repair must not attempt another broad visual rewrite. It must separate the valuable interface from the old runtime's technical debt, keep the useful Workspace and sync work from the rewrite, and make every claim of parity reproducible.

The rewrite is isolated on its own Git branch and stable Lakebed deployment. Production has been restored to the previous application and must remain unaffected throughout this work. There is no need to preserve rewrite-deployment data because the owner has a backup.

## Solution

Rebuild the rewrite branch around three one-way modules: the visual App, the pure Workspace, and Sync. The App owns presentation and interaction. Workspace owns domain behavior and derived results. Sync owns durable saving, offline queues, retries, merging, and Lakebed communication. The App depends on Workspace; persistence is supplied through Sync; neither Workspace nor Sync knows about the visual interface.

Discard the failed replacement presentation rather than polishing it. Restore the previous production interface as the exact starting implementation and visual reference. Temporary use of its imperative renderer and old state behavior is acceptable only to recover the product quickly on the isolated branch. No new product behavior will be added through that legacy path.

Establish a small bridge between the restored interface and Workspace. The bridge will translate user intent into Workspace changes and translate Workspace state and results into the view information and feedback the interface needs. Move one lifecycle area at a time across this bridge without changing the visible interface. Once all behavior and saving use Workspace and Sync, remove the old state engine and the bridge's compatibility responsibilities.

After behavioral migration is complete, modernize rendering one visible surface at a time. Reuse the established markup, CSS, tokens, icons, density, and interactions rather than redesigning them. Every surface must remain visually and behaviorally equivalent before the next surface is converted.

Use the public Workspace interface as the primary behavioral test seam. Use the complete running App as the visual and interaction test seam. Keep the existing sync-adapter contract as a narrow supporting seam. Browser workflows and captured comparisons—not a written checklist—will prove interface parity.

The repaired branch will remain separate from production. A future production cutover requires a separate explicit decision after the complete branch passes automated behavior, browser, visual, responsive, accessibility, persistence, and hosted verification and after the owner accepts the result.

## User Stories

1. As an Objects user, I want the rewrite branch to regain the previous application's visual quality, so that internal improvements do not make the product unpleasant to use.
2. As an Objects user, I want the previous interface treated as the product contract, so that a developer cannot replace it with a merely functional approximation.
3. As an Objects user, I want the rewrite repaired without changing production, so that my dependable application remains available during development.
4. As an Objects user, I want the rewrite available at its own stable address, so that I can inspect progress without risking production.
5. As an Objects user, I want the restored interface to use the same layout, density, typography, colors, icons, spacing, and hierarchy, so that it feels like Objects again.
6. As an Objects user, I want the desktop sidebar to look and behave as before, so that navigation remains familiar.
7. As an Objects user, I want to-do rows to preserve their compact presentation and useful metadata, so that lists remain easy to scan.
8. As an Objects user, I want Today grouping and This Evening presentation preserved, so that daily planning remains familiar.
9. As an Objects user, I want the inspector to preserve its established layout and editing flow, so that details do not feel like an administrative form.
10. As an Objects user, I want Magic Plus to preserve its placement, appearance, and behavior, so that rapid capture remains natural.
11. As an Objects user, I want Quick Find to preserve its established appearance and interaction, so that navigation remains fast.
12. As an Objects user, I want custom application dialogs instead of browser prompts, so that workflows look intentional and remain accessible.
13. As an Objects user, I want context menus to preserve their established visual style and choices, so that secondary actions remain predictable.
14. As an Objects user, I want Settings and Space settings to retain their established presentation, so that configuration remains understandable.
15. As an Objects user, I want light, dark, and system appearances to match the previous interface, so that the app retains its visual character.
16. As a mobile user, I want the previous drawers, scrims, headers, inspector presentation, and touch targets preserved, so that mobile use remains dependable.
17. As a keyboard user, I want all existing shortcuts and focus behavior preserved, so that the repair does not reduce efficiency.
18. As a touch user, I want swipe, long-press, selection, and drag behavior preserved, so that touch interaction remains deliberate.
19. As a screen-reader user, I want names, roles, states, feedback, and focus order to remain understandable, so that visual parity does not hide accessibility regressions.
20. As a user who prefers reduced motion, I want motion reduced without removing state feedback, so that the restored interface respects my preference.
21. As an Objects user, I want long titles, dense lists, empty views, errors, disabled actions, destructive actions, and undo states to remain readable, so that unusual states do not break the interface.
22. As an Objects user, I want every important current production workflow available on the branch, so that the repair does not repeat the earlier feature loss.
23. As an Objects user, I want to create to-dos from every supported list and Location, so that capture starts where I am working.
24. As an Objects user, I want inline capture and Magic Plus to create the same kind of to-do, so that entry paths remain consistent.
25. As an Objects user, I want unfinished quick entry recovered safely, so that temporary failures do not lose new work.
26. As an Objects user, I want natural-language dates, times, Deadlines, and Tags preserved, so that capture remains fast.
27. As an Objects user, I want reminder times interpreted in my local time zone, so that a reminder fires when I requested it.
28. As an Objects user, I want Schedule and Deadline to remain separate, so that starting and finishing dates keep their meaning.
29. As an Objects user, I want Today, This Evening, Tomorrow, Upcoming, Anytime, Someday, Inbox, Deadlines, Logbook, and Trash to remain complete, so that no standard view disappears.
30. As an Objects user, I want overdue scheduled work to remain visible in Today, so that missed work does not disappear.
31. As an Objects user, I want calendar events presented beside relevant work, so that my agenda remains complete.
32. As an Objects user, I want title, notes, Markdown preview, note search, Schedule, reminder, Deadline, Tags, sharing, and duplication available in the inspector, so that the restored inspector remains complete.
33. As an Objects user, I want to add, edit, complete, remove, and reorder checklist items, so that checklist functionality is fully restored.
34. As an Objects user, I want completing a to-do from its row, inspector, menu, keyboard, or bulk selection to have identical results, so that the lifecycle is predictable.
35. As an Objects user, I want completion, cancellation, reopening, undo, Logbook placement, Trash, restoration, and permanent deletion to retain their distinct meanings, so that history remains truthful.
36. As an Objects user, I want destructive actions presented through clear application dialogs, so that permanent changes are deliberate.
37. As an Objects user, I want single, toggle, range, and all-visible selection preserved, so that bulk work remains efficient.
38. As an Objects user, I want bulk scheduling, moving, tagging, completion, cancellation, Trash, and restoration preserved, so that I do not need to edit every to-do separately.
39. As an Objects user, I want drag operations and their keyboard alternatives preserved, so that direct manipulation remains optional rather than required.
40. As an Objects user, I want checklist, to-do, Heading, Project, and Space ordering preserved, so that list priority remains meaningful.
41. As an Objects user, I want Spaces, Areas, Projects, Headings, and Tags to retain their complete current lifecycle, so that organization remains dependable.
42. As an Objects user, I want a to-do to inherit its Location through its closest parent, so that the interface cannot show contradictory organization.
43. As an Objects user, I want inherited Tags to combine with direct Tags, so that filtering reflects context without copied data.
44. As an Objects user, I want Project Closure to require explicit Outcomes for remaining open to-dos, so that unfinished work is not silently hidden.
45. As an Objects user, I want restoring a Project to reopen only work changed by that Project Closure, so that earlier Outcomes remain correct.
46. As an Objects user, I want removing organization to preserve its contained work where the current product promises that behavior, so that structural changes are safe.
47. As an Objects user, I want existing deep links, capture links, share behavior, and installed-app shortcuts to open the correct target, so that automation remains dependable.
48. As an Objects user, I want the installed-app Today, Inbox, and New to-do shortcuts repaired, so that they no longer open the wrong destination or invalid capture.
49. As an Objects user, I want import, export, and external capture preserved, so that I retain control of my data and automation.
50. As an Objects user, I want offline changes, retry feedback, session recovery, and multi-device behavior preserved, so that interface restoration does not weaken reliability.
51. As an Objects user, I want permanent deletion to remain protected from stale-device recreation, so that deleted work stays deleted.
52. As an Objects user, I want repeat markers visible in normal rows, so that repeating work is recognizable without opening it.
53. As an Objects user, I want a compact Repeating entry beside Settings, so that repetition management is visible without using a large sidebar item.
54. As an Objects user, I want Active, Paused, and Stopped Repeating Templates easy to scan, so that routine status is clear.
55. As an Objects user, I want an Occurrence inspector to explain its Repeating Template and dates, so that the source of repeating work is clear.
56. As an Objects user, I want editing one Occurrence to remain local, so that one exception does not alter future work.
57. As an Objects user, I want editing a Repeating Template to affect future Occurrences only, so that existing work remains stable.
58. As an Objects user, I want future repeat previews in Upcoming, so that I can plan without creating actionable work early.
59. As an Objects user, I want fixed and after-completion repetition to keep their agreed meanings, so that routines advance correctly.
60. As an Objects user, I want Skip, Trash, completion, Pause, and Stop to remain distinct, so that repetition history is truthful.
61. As an Objects user, I want the focused repeat editor to use the established Objects visual language, so that the one substantial new interface still belongs in the product.
62. As an Objects user, I want repeating Projects and their copied contents to remain independent, so that changes do not leak between Occurrences.
63. As an Objects user, I want the branch interface restored before further architectural migration begins, so that visual recovery cannot be postponed behind invisible work.
64. As an Objects user, I want each behavior migration to leave the interface unchanged, so that architecture work does not become another redesign.
65. As an Objects user, I want visible differences recorded and justified, so that accidental regressions cannot be called improvements afterward.
66. As an Objects user, I want intentional corrections limited to clear mistakes, so that repair does not erase familiar behavior.
67. As an Objects user, I want production reference images preserved, so that future changes have an objective comparison target.
68. As an Objects user, I want browser workflows to prove important interactions, so that passing domain tests cannot hide broken controls.
69. As an Objects user, I want visual comparisons performed at desktop and mobile sizes, so that responsive regressions are detected.
70. As an Objects user, I want light and dark comparisons, so that one appearance cannot quietly degrade.
71. As an Objects user, I want browser-native prompts forbidden, so that the repaired interface cannot fall back to visually inconsistent shortcuts.
72. As an Objects user, I want the branch to remain separate until I accept it, so that a technical completion claim cannot trigger another premature cutover.
73. As a maintainer, I want the visual App to depend on Workspace through one intentional seam, so that business behavior does not spread through interface callers.
74. As a maintainer, I want Workspace independent from browser and Lakebed runtimes, so that lifecycle behavior remains deterministic and easy to test.
75. As a maintainer, I want Sync independent from presentation, so that saving behavior can change without rewriting the interface.
76. As a maintainer, I want memory and Lakebed adapters to satisfy the same sync interface, so that the persistence seam is real rather than hypothetical.
77. As a maintainer, I want UI intents translated into Workspace changes in one place, so that row, inspector, menu, keyboard, bulk, and drag paths cannot drift.
78. As a maintainer, I want Workspace results translated into feedback and view state in one place, so that presentation does not infer hidden lifecycle consequences.
79. As a maintainer, I want no new domain behavior added to the temporary legacy runtime, so that technical debt does not grow during recovery.
80. As a maintainer, I want the temporary bridge removed after migration, so that the final application has one production mutation path.
81. As a maintainer, I want the old state engine removed only after every caller crosses Workspace, so that removal does not create another feature gap.
82. As a maintainer, I want the large Workspace implementation split internally without widening its public interface, so that internal locality improves without burdening callers.
83. As a maintainer, I want the interface modernized one visible surface at a time, so that each change remains reviewable and reversible.
84. As a maintainer, I want the established CSS, markup, and interaction contracts reused during Preact conversion, so that modernization does not become redesign.
85. As a maintainer, I want old global listeners, selectors, manual HTML generation, and direct state mutation retired gradually, so that risk is controlled.
86. As a maintainer, I want the packed runtime removed or simplified after behavioral migration, so that debugging and navigation improve without endangering recovery.
87. As a maintainer, I want migration-only names removed after the repair stabilizes, so that permanent modules describe their real responsibilities.
88. As a maintainer, I want parity evidence generated by repeatable commands, so that another agent can verify it independently.
89. As a maintainer, I want test failures to identify the affected behavior or visual surface, so that regressions are easy to locate.
90. As a maintainer, I want the failed replacement presentation removed rather than left as a fallback, so that the codebase does not retain two competing interfaces.
91. As a maintainer, I want Web Awesome and SortableJS kept behind adapters, so that vendor behavior cannot bypass Workspace.
92. As a maintainer, I want dates, time zones, identity creation, and clocks supplied controllably at the test seams, so that tests remain deterministic.
93. As a maintainer, I want current production to remain the behavior and visual oracle throughout branch development, so that the target cannot drift.
94. As a maintainer, I want branch deployments to use their separate Lakebed configuration, so that testing cannot overwrite production.
95. As a maintainer, I want the repaired branch built and hosted after every completed milestone, so that local success matches the application under review.
96. As an Objects owner, I want the final cutover to require my explicit approval, so that the rewrite cannot replace production merely because its implementation tickets are closed.

## Implementation Decisions

- Keep production on the restored previous application throughout this specification.
- Perform all repair work on the isolated Workspace rewrite branch and its separate stable Lakebed deployment.
- Treat the previous production application at the pre-rewrite fixed point as the authoritative visual, interaction, and feature contract.
- Discard the failed replacement presentation. Do not improve it incrementally or keep it as an alternate renderer.
- Restore the previous client interface as the first repair milestone, including its markup, styling, tokens, icons, density, dialogs, menus, sidebar, rows, inspector, Magic Plus, responsive behavior, touch behavior, and keyboard behavior.
- Temporary restoration of the imperative renderer, old state engine, global listeners, selectors, and packed runtime is allowed only to recover a dependable interface on the isolated branch.
- Do not add new domain behavior to the temporary legacy runtime.
- Use three one-way modules: App for presentation and interaction, Workspace for domain behavior and derived results, and Sync for persistence coordination.
- Keep the dependency direction from App toward Workspace and from persistence coordination toward Sync adapters. Workspace and Sync must not import or depend on App presentation details.
- Keep Workspace pure and independent from DOM, Preact, Lakebed, environment, browser storage, and nondeterministic global clocks or identities.
- Keep Sync independent from presentation and supply Lakebed and in-memory adapters through the same interface.
- Introduce one bridge between the restored interface and Workspace. The bridge translates user intent into Workspace changes and Workspace documents and results into presentation-ready information.
- Keep the bridge small. It must not become another domain model or duplicate lifecycle rules.
- Route row, inspector, context-menu, keyboard, bulk, touch, and drag forms of the same intent through one bridge operation.
- Return explicit Workspace results and let App own feedback wording, dialogs, focus, animation, gestures, and presentation state.
- Migrate behavior underneath the restored interface by lifecycle area. Do not combine a behavioral migration with a broad visual change.
- Preserve the new domain meanings for To-do Location, Schedule, Today, Upcoming, Deadline, Outcome, Trash, Project Closure, Repeating Template, Occurrence, Skip, and Repeating Template states.
- Preserve the separate Repeating Template and Occurrence model. Do not restore the old mixed repetition model even temporarily as the source of truth.
- Keep the compact Repeating entry, Repeating management view, repeat markers, Occurrence explanation, previews, and focused repeat editor as the intended new user-facing additions.
- Build the new repetition surfaces using the restored interface's visual language and interaction patterns.
- Add a Workspace change for checklist reordering and expose it through the restored inspector interaction.
- Represent user-entered reminder times without accidentally treating local wall-clock values as UTC. Convert between local input and durable instants deliberately using the active time zone.
- Repair installed-app shortcuts and share/capture routing so every published URL matches the direct-navigation parser.
- Keep Web Awesome and SortableJS only behind internal adapters. Translate their results into user intent rather than direct state changes.
- Once every production mutation and derived read crosses Workspace, remove the old state-changing and persistence behavior.
- Once behavioral migration is complete, convert rendering one surface at a time to typed Preact while preserving the established markup, CSS, and interaction contract.
- Retire global listeners, selectors, manual HTML generation, and direct DOM mutation only when the corresponding Preact surface passes behavior and visual parity.
- Split the Workspace implementation internally by cohesive lifecycle area after correctness is stable, but retain one public Workspace interface and one behavioral test seam.
- Simplify or remove the packed runtime only after the App no longer depends on the legacy implementation.
- Remove migration-only names and temporary compatibility code after the final branch architecture is stable.
- Keep exactly one branch rendering path and one branch mutation path at the end of the repair.
- Do not perform a production cutover as part of this specification. A cutover requires a separate explicit decision and owner approval.

## Testing Decisions

- Use the public Workspace interface as the primary behavioral test seam. Test observable documents, derived views, results, validation, affected entities, undo behavior, and rejection behavior rather than private helpers or internal mutation order.
- Use the complete running App as the visual and interaction test seam. Exercise the same controls and workflows a user sees rather than relying on isolated render-module snapshots.
- Keep the shared sync-adapter contract as a narrow supporting seam for Lakebed and in-memory persistence behavior.
- Use deterministic example Workspaces containing empty, normal, dense, long-content, error, completed, canceled, trashed, logged, repeating, Project, Area, Heading, Tag, calendar, and multi-Space states.
- Capture authoritative production reference images before changing the restored interface.
- Compare the branch with production at desktop widths 1200 and 1440 and mobile widths 390 and 430 in light and dark appearance.
- Cover the sidebar, standard lists, grouped Today, This Evening, Project and Area views, rows, inspector, Quick Find, dialogs, menus, Settings, Space settings, selection toolbar, Repeating view, repeat editor, Logbook, Trash, calendar agenda, empty states, dense states, errors, offline feedback, and mobile drawers.
- Cover hover, pressed, selected, focus-visible, loading, saving, success, failure, recovered, conflict, undo, disabled, destructive, reduced-motion, and long-content states.
- Treat a material unexplained visual difference as a failed check. A written statement that a surface was reviewed is not evidence.
- Store comparison output or another reproducible artifact so a later agent and the owner can inspect what passed.
- Add browser workflows for navigation, inline capture, Magic Plus, inspector editing, Markdown, checklist lifecycle and ordering, scheduling, reminders, Deadline, Tags, completion, cancellation, reopening, undo, Logbook, Trash, restoration, permanent deletion, movement, selection, bulk actions, keyboard commands, touch gestures, and drag alternatives.
- Add browser workflows for Spaces, Areas, Projects, Headings, Tags, Project Closure, Quick Find, deep links, Settings, appearance, import/export, calendar, capture links, authenticated capture, Repeating management, repeat editing, Occurrence inspection, Skip, Pause, Resume, Stop, and repeating Projects.
- Test that row, inspector, context-menu, keyboard, bulk, touch, and drag callers produce the same Workspace change and observable result for the same user intent.
- Test checklist ordering through Workspace, Sync, and the real inspector interaction.
- Test reminder creation and editing across time zones and daylight-saving transitions, including the owner's normal time zone.
- Test all installed-app and share/capture URLs by opening the published URL and verifying the resulting view or capture state.
- Test the bridge only through the App and Workspace seams. Do not make its temporary internal mapping a permanent test contract.
- Keep current Workspace lifecycle, repetition, import, discovery, capture, sync, offline, and multi-device tests as prior art and extend them for confirmed defects.
- Keep the previous interface's small domain helpers as prior art only where they express established behavior missing from Workspace, such as checklist ordering and local wall-clock reminder handling.
- Run behavioral and browser checks throughout each migration area, not only after the complete migration.
- Run the full relevant suite and anonymous Lakebed build at the end of each milestone.
- Deploy every completed milestone to the rewrite branch's separate stable Lakebed deployment and verify its hosted interface and affected endpoints.
- Require explicit owner inspection and approval before proposing a production cutover.

## Out of Scope

- Changing production during repair work.
- Performing the final production cutover.
- Preserving the failed replacement presentation or offering a switch between old and failed interfaces.
- A broad redesign away from the previous Things-inspired interface.
- Adding new product features unrelated to restoring parity, the already agreed repetition improvements, or confirmed defect corrections.
- Permanently retaining two domain models, two mutation paths, two renderers, or a compatibility bridge.
- Rewriting the complete visual interface in one step.
- Refactoring the entire Workspace implementation before the user-facing interface is restored.
- Removing Web Awesome or SortableJS solely for architectural purity when their existing adapted behavior is valuable.
- Installing new third-party packages or adding a separate styling build pipeline.
- Native platform applications beyond the responsive PWA.
- Real-time collaboration, shared Workspaces, comments, assignments, or multi-user editing.
- Treating closed tickets, manual prose, or an agent's self-report as sufficient evidence of parity.
- Preserving known broken reminder, checklist-ordering, PWA-routing, prompt-based, or accessibility behavior merely because it exists in one implementation.

## Further Notes

- The authoritative domain vocabulary remains the root Objects glossary. Use To-do rather than Task in new product and engineering language except at a legacy compatibility edge that cannot yet change.
- The previous production application is intentionally both a temporary implementation source and a permanent product reference. Its visual result should be preserved; its mixed state, behavior, persistence, and rendering structure should not become the final architecture.
- The current rewrite's strongest assets are its Workspace domain model, repetition model, import path, sync behavior, and executable domain tests. Its presentation and its parity audit are not reliable foundations.
- Restoring temporary technical debt first is deliberate risk control. The safeguard is that no new behavior may enter through that path and the next required work moves behavior behind Workspace.
- The Workspace and complete App seams were explicitly agreed before publication. Sync remains a supporting adapter seam because production and tests genuinely require different adapters.
- The rewrite branch and production have independent Lakebed deployments. Every repair deployment must use the branch deployment configuration.
- The owner has a data backup and does not require rewrite-deployment data preservation.
- The original full Workspace rewrite specification remains useful as a feature inventory and domain record. This recovery specification replaces its presentation strategy, parity evidence, and cutover assumptions.
