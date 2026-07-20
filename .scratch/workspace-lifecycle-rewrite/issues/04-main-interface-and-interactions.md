# 04 — Main Interface and Interactions

**What to build:** Complete the typed Preact interface and preserve the current Things-inspired appearance and interaction set. Every row, inspector, menu, keyboard, bulk, touch, and drag action must express user intent through the same Workspace operations.

**Blocked by:** 02 — Complete Basic To-do Lifecycle; 03 — Organization and Projects.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] The replacement has one production rendering path with no manual legacy DOM rendering or direct state mutation.
- [ ] The desktop sidebar, Spaces pill, list headers, task rows, Magic Plus, inspector, selection toolbar, menus, dialogs, drawers, and feedback closely match the current application.
- [ ] Desktop and mobile layouts work at the target comparison widths, including mobile drawers, touch-safe controls, long titles, dense data, and narrow inspector presentation.
- [ ] A user can select one item, several items, a range, or all visible items.
- [ ] Bulk scheduling, moving, tagging, completion, cancellation, Trash, and restoration use the same Workspace behavior as single-item actions.
- [ ] Move dialogs, context menus, keyboard commands, and drag and drop support moving and reordering to-dos across compatible sections.
- [ ] Every important drag action has a keyboard alternative.
- [ ] Existing shortcuts for navigation, creation, scheduling, completion, cancellation, duplication, movement, repetition entry, Logbook, and Headings are preserved.
- [ ] Escape closes the highest active overlay and restores focus to the correct control.
- [ ] Touch drawers, swipes, long press, selection, and dragging remain dependable without unsafe accidental destructive actions.
- [ ] Controls expose correct accessible names, roles, states, focus order, focus containment, and live feedback; reduced motion is respected.
- [ ] Web Awesome and SortableJS are hidden behind internal UI adapters and cannot bypass Workspace behavior.
- [ ] Tests prove equivalent results for row, inspector, keyboard, menu, bulk, and drag entry paths, plus keyboard-only and touch workflows.
- [ ] Visual comparisons cover the main shell, standard views, Projects, Areas, inspector, overlays, selection, empty/error states, and light and dark appearances.

