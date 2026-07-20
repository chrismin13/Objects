# 06 — Search, Navigation, and Calendar

**What to build:** Complete discovery and agenda behavior across the replacement application. Deliver Quick Find, searchable content, direct navigation, shareable links, and calendar events alongside scheduled work.

**Blocked by:** 04 — Main Interface and Interactions; 05 — Repeating To-dos and Projects.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Quick Find searches lists, special views, Spaces, Areas, Projects, Headings, Tags, active to-dos, Logbook, Trash, notes, checklists, and Repeating Templates.
- [ ] Search results are grouped and labeled clearly enough to distinguish active work, history, Trash, organization, tags, and templates.
- [ ] Quick Find supports keyboard movement, selection, opening, dismissal, and correct focus restoration.
- [ ] Direct links open lists, special views, Spaces, Areas, Projects, Headings, Tags, individual to-dos, and repetition management targets where applicable.
- [ ] Shared or externally opened links recover gracefully after sign-in and show a useful missing or inaccessible result instead of breaking navigation.
- [ ] Navigation history, sidebar selection, Space filtering, and inspector state remain coherent when moving between search results and normal lists.
- [ ] A user can create and edit manual calendar events.
- [ ] A user can import supported ICS events, with invalid or duplicate input handled clearly.
- [ ] Relevant calendar events appear beside to-dos and Projects in Today, Tomorrow, and Upcoming without being mistaken for actionable work.
- [ ] Repeat previews and Repeating Templates are discoverable from both Quick Find and their contextual links.
- [ ] Tests cover content indexing, stale results, keyboard-only search, deep-link recovery, inaccessible targets, ICS parsing, duplicate handling, dates, time zones, and combined agenda ordering.
- [ ] Visual and accessibility checks cover Quick Find, grouped results, agenda rows, missing-link states, long result text, mobile presentation, and focus behavior.

