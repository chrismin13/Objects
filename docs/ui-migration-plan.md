# UI migration plan

This document is the parity contract for simplifying the Objects client. The application at commit `bb976b8` is the behavioral and visual baseline. No feature may be removed, substantially redesigned, or replaced with a weaker interaction without explicit product approval.

## Goals

- Preserve the current Things-inspired appearance and every documented workflow.
- Replace fragile, locally implemented interaction primitives with maintained, vendored libraries.
- Keep Preact as the application renderer and Lakebed as the runtime.
- Separate domain behavior from rendering so features can be tested independently.
- Delete the legacy imperative runtime only after the replacement passes the complete parity matrix.

Raw repository size is not a goal. Vendored, versioned upstream code is preferable to smaller but bespoke focus, keyboard, overlay, and drag-and-drop implementations.

## Restored baseline

The rewrite in `9cf5a2b` was reverted by `157bff4`. The restored version builds, is deployed, and is the source of truth for the inventory below.

Current client complexity establishes where libraries will have the greatest value:

- `client/objects.ts`: 3,716 lines
- Custom event listeners: 125
- Direct `innerHTML` replacements: 33
- Additional HTML insertion sites: 5
- Custom pointer/gesture event sites: 12
- Five separate style sources layered over the base client

## Library boundary

### Preact

Preact remains responsible for rendering, state subscriptions, component composition, and feature screens. It must not own hand-written focus trapping, overlay positioning, or drag mechanics.

### Web Awesome

Vendor a pinned official distribution and its license under `client/vendor/webawesome/`. Import only through relative paths. Start with the stable core components that replace complex behavior:

- Dialog for forms, confirmations, Quick Find, and Spaces settings
- Drawer for the mobile sidebar and mobile task inspector
- Dropdown and dropdown item for task, project, area, and heading context menus
- Popover and popup for anchored controls that are not menus
- Select and option for list, Space, project, area, recurrence, and settings choices
- Switch and checkbox for settings and recurrence controls
- Tooltip for unlabeled icon controls
- Progress ring for project progress if it can be themed to visual parity

Do not adopt Web Awesome's Pro combobox or depend on its planned toast. Quick Find remains an Objects feature using a normal search field and a small, typed result-list controller. Existing toasts remain until a stable replacement is proven.

The first Web Awesome change is a build spike. It must prove that Lakebed can bundle the vendored distribution, its relative chunks, styles, and any required assets without a CDN or runtime network dependency. Failure of that spike stops adoption before application code is changed.

### SortableJS

Vendor a pinned SortableJS build and license under `client/vendor/sortablejs/`. Use core Sortable plus MultiDrag where appropriate for:

- Task ordering within a section
- Moving tasks between project headings
- Scheduling tasks between Upcoming days and Today/This Evening
- Filing tasks by dropping on sidebar destinations
- Area, project, and heading ordering
- Checklist ordering
- Multi-selected task dragging

Every draggable collection must retain a non-pointer alternative: Move commands and explicit up/down controls where order matters. SortableJS must call typed domain actions; it must never mutate persisted state directly.

### Native controls

Keep native buttons, text fields, textareas, date/time inputs, links, and forms where the browser already supplies correct behavior. A library component is justified by interaction complexity, accessibility, or cross-device consistency—not merely by availability.

## Feature parity inventory

### Navigation and layout

- Desktop sidebar, content pane, and task inspector
- Responsive mobile layout, drawer, scrim, edge swipe, and back behavior
- All/Personal/Work Spaces pill, pinned Spaces, overflow switcher, and active-Space filtering
- Inbox, Today, Upcoming, Anytime, Someday, Logbook, and Trash
- Tomorrow, Deadlines, Repeating, All Projects, and Logged Projects
- Areas and nested projects with counts and progress rings
- Light, dark, and system appearance
- PWA install, offline shell, update prompt, and online/offline feedback

### To-dos

- Inline quick add and Magic Plus behavior
- Natural-language capture for dates, times, deadlines, and tags
- Inbox/Today/This Evening/Anytime/Someday scheduling
- Explicit start date, deadline, reminder, Space, area, project, and heading
- Notes with extended Markdown preview and in-note search
- Checklists with completion, add/remove, drag ordering, and keyboard ordering
- Tags, inherited area/project tags, filtering, creation, rename, and deletion
- Completion, completion undo, cancellation, duplication, sharing, copy link, Trash, permanent deletion, and restoration
- Deep links to individual to-dos

### Selection and direct manipulation

- Command/control-click, shift-range, select-all, swipe-to-select, and long-press/context menu
- Batch Today, Someday, move, tags, complete, cancel, Trash, and restore actions
- Task reordering, heading assignment, date scheduling, sidebar filing, and multi-drag
- Magic Plus dragging into lists and project heading creation zones
- Context menus for tasks, selections, headings, projects, and areas

### Projects, areas, and headings

- Create/edit/move/remove areas
- Create/edit/schedule/tag/duplicate/complete/cancel/restore/trash/delete projects
- Project completion resolution for unfinished to-dos
- Create/edit/move/archive/restore/delete/duplicate headings
- Convert a heading and its to-dos into a project
- Hierarchical project Trash and restoration
- Project and area tag filtering

### Repetition and Logbook

- Repeating to-dos and projects
- Fixed schedule and after-completion modes
- Daily, weekly, monthly, and yearly frequency; intervals and weekdays
- Next occurrence, reminder time, deadline offset, pausing, and template editing
- Materialization of recurring instances
- Immediate, daily-at-midnight, and manual Logbook policies
- Logged completed and canceled to-dos and projects

### Search, calendar, and capture

- Two-stage Quick Find across lists, special lists, Spaces, areas, projects, headings, tags, and active to-dos
- Continued search across notes, checklist items, Logbook, Trash, and repeating templates
- Keyboard navigation and selection in Quick Find
- Calendar events in Today, Tomorrow, and Upcoming
- Manual calendar event entry and `.ics` import
- JSON export and guarded full replacement import
- URL add/show/search automation and authenticated `POST /api/tasks`

### Spaces and launch rules

- Create, rename, recolor, pin, and delete Spaces
- Re-home child data safely when deleting a Space
- Default Space
- Device-local launch-rule enablement and remembered manual selection
- Per-rule Space, weekdays, start/end time, ordering, add, and delete
- Launch-time evaluation and fallback behavior

### Keyboard and accessibility

- Escape dismissal hierarchy
- Modal focus containment and focus return
- Quick Find with command/control-K, command/control-F, slash, and type-to-search
- New to-do, new list, view navigation, completion, cancellation, duplication, scheduling, repeat, move, Logbook, and new-heading shortcuts
- Keyboard-operable task rows, checklists, forms, menus, and confirmations
- Correct dialog, alert-dialog, menu, tab, complementary-region, list, and live-feedback semantics

## Target structure

```text
client/
  app/             typed state, synchronization, actions, selectors
  features/        tasks, lists, search, spaces, settings, calendar
  ui/              thin Preact adapters around library and native primitives
  theme/           Things-specific tokens and component overrides
  vendor/          pinned upstream distributions and licenses
  index.tsx        authentication and application composition only
```

Feature components may depend on `app/` and `ui/`. The domain layer must not import DOM, Preact, Web Awesome, or SortableJS. Vendor code must never import application code.

## Migration phases

### Phase 0: prove the libraries

1. Vendor only Dialog, Drawer, Dropdown, Select, Tooltip, and their transitive Web Awesome files.
2. Vendor SortableJS core and MultiDrag.
3. Add a private development-only component harness.
4. Verify anonymous Lakebed build, light/dark theming, keyboard operation, mobile touch, and offline loading.
5. Record exact upstream versions, source URLs, checksums, and licenses.

Exit gate: no production UI change and no CDN dependency. If Lakebed cannot bundle the distributions cleanly, evaluate another web-component distribution before changing application architecture.

### Phase 1: typed domain foundation

1. Define complete Task, Project, Area, Heading, Space, CalendarEvent, RepeatRule, and Settings types.
2. Move normalization, selectors, recurrence, natural-language parsing, Logbook policy, search indexing, and ChangeSet generation into pure modules.
3. Introduce named actions for every mutation currently performed inside event handlers.
4. Keep the existing UI mounted and route its behavior through the new actions incrementally.

Exit gate: serialized state and every existing workflow remain compatible; pure behavior tests cover scheduling, recurrence, completion, Trash, restoration, and remote merge rules.

### Phase 2: overlays and menus

Replace the highest-risk custom primitives first:

1. Confirmation and form modals with Dialog
2. Mobile sidebar and inspector with Drawer
3. Context menus with Dropdown
4. Anchored controls and tooltips with Popover/Tooltip
5. Selection controls with Select/Switch where visual parity is achievable

Exit gate: focus, Escape, outside click, focus return, nested overlay, keyboard menu, and mobile dismissal tests pass. The legacy modal and context-menu implementations can then be deleted.

### Phase 3: drag and ordering

Replace each drag domain separately with SortableJS adapters: checklist, same-section tasks, cross-heading tasks, Upcoming dates, sidebar filing, lists/headings, then MultiDrag. Persist only through typed actions and preserve keyboard alternatives.

Exit gate: mouse and touch movement, auto-scroll, cancel behavior, multi-selection, cross-list moves, and persistence after reload pass for every domain.

### Phase 4: declarative feature screens

Move one screen at a time to Preact: sidebar, task list, inspector, projects/areas, Quick Find, Spaces, settings, calendar, Logbook, and Trash. Keep the old renderer available behind a local flag until each screen reaches parity.

Exit gate: a screen is migrated only when its old/new visual comparison and its workflow checklist both pass. Do not combine unrelated screen migrations.

### Phase 5: remove the legacy runtime

Delete imperative rendering and obsolete CSS only after every parity row passes in both renderers. Consolidate tokens and styles last, when selectors used by the final component tree are known.

## Verification matrix

Each phase must pass:

- `npx lakebed build . --target anonymous --json`
- Desktop widths at 1200 and 1440 pixels
- Mobile widths at 390 and 430 pixels
- Light and dark appearance
- Pointer, touch-equivalent, and keyboard-only paths
- Empty, seed, dense, completed, repeating, and trashed data states
- Create/edit/reload persistence and remote live-query merge behavior
- No unexpected console errors or accessibility warnings
- Hosted sign-in surface plus authenticated local end-to-end flows

Before-and-after screenshots are required for the sidebar, every primary list, project view, open inspector, Quick Find, Spaces settings, application settings, selection toolbar, context menu, and mobile drawer.

## Change policy

- No feature removals are implicit in a refactor.
- No visual redesign is implicit in adopting a library.
- Library defaults must be themed to the existing Things-inspired UI, not vice versa.
- A replacement that cannot match an existing behavior remains behind the legacy implementation until resolved.
- Each pull request should migrate one primitive or one feature slice and include its parity evidence.
