# 07 — Settings, Appearance, and Portable Data

**What to build:** Complete application and Space settings, appearance, portable backup, external capture, and automation-facing entry points. Every entry path must create or change data through the same Workspace rules as the visual interface.

**Blocked by:** 03 — Organization and Projects; 05 — Repeating To-dos and Projects; 06 — Search, Navigation, and Calendar.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Application settings and Space settings use the replacement UI and preserve every important current option.
- [ ] Light, dark, and system appearance modes apply throughout the app and persist across reloads and sign-in recovery.
- [ ] A default Space controls new unfiled work where no more specific Location is supplied.
- [ ] Optional weekday-and-time launch rules select an opening Space, while launch-rule enablement and manual Space choice are remembered per device.
- [ ] The complete Workspace exports to understandable portable JSON, including repetition, history, Trash, settings, calendars, and required sync-safe identity data.
- [ ] Export followed by full import preserves all supported user-visible data and relationships.
- [ ] Full import replacement shows a clear summary and requires deliberate confirmation before current data is replaced.
- [ ] Capture links accept shared titles, text, URLs, notes, Location, tags, scheduling details, reminders, and deadlines where supplied.
- [ ] Authenticated HTTP capture applies the same validation, defaults, ownership checks, and Workspace behavior as visual capture.
- [ ] Shared text and URLs are recoverable after authentication or a temporary save failure without silently creating duplicates.
- [ ] Deep links and capture links have stable, documented shapes suitable for personal automation.
- [ ] Tests cover setting persistence, system-theme changes, device-specific launch behavior, complete export/import round trips, legacy imports, malformed data, account isolation, capture retries, and duplicate submission protection.
- [ ] Visual and accessibility checks cover both settings surfaces, destructive import confirmation, import summaries, appearance modes, and narrow mobile layouts.

