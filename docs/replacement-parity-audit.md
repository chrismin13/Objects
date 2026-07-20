# Replacement parity audit

This is the final cutover record for the typed Workspace application. It maps all 130 parent-spec stories to evidence, records the side-by-side interface review, and defines what must be true before the legacy renderer can be removed.

## Result

The replacement is the only production rendering and mutation path. Workspace behavior is covered through the public Workspace, import, discovery, interaction, capture, sync, and offline-client seams. The retained legacy database rows remain read-only migration input until a replacement snapshot exists; they are not a runtime fallback.

## Evidence catalog

| Code | Executable evidence |
| --- | --- |
| W | `tests/replacement/workspace.test.ts` |
| T | `tests/replacement/todo-lifecycle.test.ts` |
| O | `tests/replacement/organization-projects.test.ts` |
| I | `tests/replacement/interactions.test.ts` |
| R | `tests/replacement/repeating.test.ts` |
| D | `tests/replacement/discovery.test.ts` |
| C | `tests/replacement/calendar-agenda.test.ts` |
| S | `tests/replacement/settings-capture.test.ts` |
| P | `tests/replacement/importer.test.ts` |
| Y | `tests/replacement/sync-adapter.test.ts` |
| F | `tests/replacement/offline-sync-client.test.ts` |
| L | Local browser run against the complete app at `localhost:3000` |
| V | Side-by-side browser run against the last full legacy revision at `localhost:3001` |
| H | Hosted verification against the existing Lakebed deployment |
| B | `npx lakebed build . --target anonymous --json` |

The executable suite is run with `node --experimental-strip-types --test tests/replacement/*.test.ts`. The final cutover run on 2026-07-20 passed all 100 tests. The final anonymous build passed with client bundle `sha256:f68e834dc5354d40b8743dab022dd8298d97f907320ac0ba9ad5f867bdbe0767`. Each test name states the behavior it proves; the table below uses the file codes above to keep 130 rows readable.

## All 130 user stories

| Story | Contract | Evidence |
| ---: | --- | --- |
| 1 | Important current workflows remain available | W, T, O, I, R, D, C, S, P, Y, F, L, H |
| 2 | Familiar Things-inspired visual character | V, L, H |
| 3 | Known visual and logical mistakes are corrected | W, T, O, R, S; intentional corrections below |
| 4 | One responsive desktop and mobile app | L at 1200, 1440, 390, and 430 |
| 5 | Light, dark, and system appearance | S, L |
| 6 | Appearance persists | S, Y, H |
| 7 | Google sign-in | L, H; `client/replacement/index.tsx` |
| 8 | Account isolation | Y, S, H |
| 9 | Loading, offline, and session-recovery screens | F, L, H |
| 10 | Offline app shell and reconnect | F, L, H |
| 11 | Capture from every standard Location | T, I, L |
| 12 | Magic Plus uses the current Location | T, I, L |
| 13 | Inline entry creates a normal to-do immediately | T, F, L |
| 14 | Unfinished quick entry recovers | T, F |
| 15 | Natural-language dates, times, deadlines, and Tags | T, S |
| 16 | Capture links accept shared text, URLs, and notes | S, H |
| 17 | Authenticated HTTP capture uses Workspace rules | S, Y, H |
| 18 | Markdown notes | T, L |
| 19 | Markdown preview and note search | T, L |
| 20 | Checklist lifecycle and order | T, Y, L |
| 21 | Complete Schedule choices | T, I, L |
| 22 | Today includes overdue work | W, T |
| 23 | Upcoming shows future work | T, R, C |
| 24 | Tomorrow shows the next day | T, C |
| 25 | Schedule and Deadline are separate | T, P |
| 26 | Reminders move sensibly with Schedule | T |
| 27 | Notification snooze updates through Workspace | T, L |
| 28 | Deadline states remain clear | T, L |
| 29 | Deadlines orders open to-dos and Projects | T |
| 30 | Calendar events share agenda views | C, L |
| 31 | Every completion entry path has the same result | I, T |
| 32 | Completion can be undone | T, L |
| 33 | Cancel remains distinct from complete | T, R |
| 34 | Completed and canceled work can reopen | T, O |
| 35 | Duplicated checklist items have independent identity | T, O |
| 36 | Share and deep-link copying | D, L |
| 37 | Trash preserves Outcome | T, O |
| 38 | Trashed to-dos restore | T, I |
| 39 | Permanent deletion requires confirmation | T, O |
| 40 | Empty active Space Trash requires confirmation | T, L |
| 41 | Immediate, daily, and manual Logbook policies | T, S |
| 42 | Manual logging | T, L |
| 43 | Logbook preserves completed and canceled Outcomes | T |
| 44 | Completed Projects remain discoverable | O, D |
| 45 | Heading Location is inherited | W, O |
| 46 | Project Location is inherited | W, O |
| 47 | Area Space is inherited | W, O |
| 48 | Only unfiled work stores a direct Space | W, O, P |
| 49 | Moving a Heading moves its effective children | O |
| 50 | Moving Projects and Areas updates effective Location | O, Y |
| 51 | Move dialog, drag, keyboard, context, and bulk agree | I, Y, L |
| 52 | To-dos reorder within and across sections | I, Y |
| 53 | Drag operations have keyboard alternatives | I, L |
| 54 | Single, toggle, range, and all selection | I, L |
| 55 | Bulk lifecycle changes use Workspace | I, Y |
| 56 | Effective Tags combine inherited and direct Tags | O, C |
| 57 | Tags can be created, renamed, and deleted | O, L |
| 58 | Tag changes update every use | O, D |
| 59 | Current lists filter by effective Tags | O, C, L |
| 60 | Quick Find finds Tags | D, L |
| 61 | Complete Project lifecycle | O, I, R |
| 62 | Projects contain Headings and to-dos | O, P |
| 63 | Project Closure requires explicit child Outcomes | O, Y |
| 64 | Project restore reopens only Closure changes | O |
| 65 | Project progress reflects active to-dos | O, L |
| 66 | Area lifecycle | O, L |
| 67 | Removing an Area preserves its work | O |
| 68 | Heading lifecycle and conversion | O, L |
| 69 | Deleting a Heading preserves its to-dos | O |
| 70 | Heading conversion keeps contents together | O |
| 71 | Templates and Occurrences are separate | R, P |
| 72 | Occurrences show a repeat marker | R, L |
| 73 | Occurrence inspector explains its Template and dates | R, L |
| 74 | Occurrence edits stay local | R |
| 75 | Template edits affect only future Occurrences | R |
| 76 | Template edit scope is explicit | R, L |
| 77 | Upcoming shows non-actionable previews | R, D, L |
| 78 | Due previews become Occurrences | R |
| 79 | Missed fixed dates materialize exactly once | R, Y |
| 80 | Damaged repetition is bounded | R |
| 81 | Fixed repetition continues with older open work | R |
| 82 | After-completion permits one open Occurrence | R, D |
| 83 | Completion advances from the completion day | R |
| 84 | Skip changes one Occurrence only | R |
| 85 | Skip logs a canceled Outcome | R |
| 86 | After-completion Skip advances from the Skip day | R |
| 87 | Trash does not act like Skip | R, T |
| 88 | Templates pause and resume | R, L |
| 89 | Pause leaves existing Occurrences unchanged | R |
| 90 | Stop retains read-only history | R, D |
| 91 | Stopped Templates are collapsed | R, L |
| 92 | Stopped Template deletion is separate and confirmed | R, L |
| 93 | Repeating sections are Active, Paused, and Stopped | R, L |
| 94 | Template rows explain type, rule, date, Space, and parent | R, L |
| 95 | Repeating has a compact Settings-adjacent entry | L |
| 96 | Repeating is reachable from search, inspector, and preview | D, R, L |
| 97 | Repeat scheduling uses a focused editor | R, L |
| 98 | Repeat editor has a live plain-English summary | R, L |
| 99 | Daily, weekly, monthly, and yearly intervals | R |
| 100 | Weekly repetition supports several weekdays | R |
| 101 | Both repetition modes are explained | R, L |
| 102 | Template reminder and Deadline defaults copy forward | R, P |
| 103 | Occurrence timing overrides stay local | R |
| 104 | Converting existing work keeps its first date | R |
| 105 | Templates can be created directly | R, L |
| 106 | Repeating Projects copy their full structure | R, P |
| 107 | Repeating Project identities are independent | R |
| 108 | Quick Find indexes every supported target | D |
| 109 | Quick Find has keyboard movement and selection | D, L |
| 110 | Direct links cover navigation and individual work | D, S, H |
| 111 | Space lifecycle | O, S, L |
| 112 | Deleting a Space moves its content | O |
| 113 | Default Space controls unfiled capture | S, O |
| 114 | Weekday-and-time launch rules | S |
| 115 | Launch enablement and manual Space are device-local | S |
| 116 | Manual and ICS calendar events | C, L |
| 117 | Complete portable JSON export | P, L, H |
| 118 | Current Objects backup imports | P, H |
| 119 | Full replacement import is deliberately confirmed | P, L |
| 120 | Saves are optimistic and retry-safe | F, Y, L |
| 121 | Multi-device changes merge unrelated fields | Y |
| 122 | Durable deletions beat stale devices | Y |
| 123 | Save failure and recovery feedback is visible | F, L |
| 124 | Existing keyboard commands are preserved | I, L |
| 125 | Escape dismisses the top overlay and restores focus | I, L |
| 126 | Names, roles, states, live feedback, and focus order | I, L |
| 127 | Drawers, swipes, long press, selection, drag, and touch targets | I, L at 390 and 430 |
| 128 | Reduced motion keeps state feedback | L with `prefers-reduced-motion: reduce` |
| 129 | Dense, long, empty, error, disabled, and destructive states remain readable | T, O, R, F, L |
| 130 | Hosted app matches the validated build | B, H |

## Side-by-side and state review

The last full legacy revision and the replacement were run together with separate local Lakebed servers. The review used the same browser, appearance preference, and viewport for both applications.

| Surface or state | What was checked | Result |
| --- | --- | --- |
| Desktop shell at 1200 and 1440 | Sidebar hierarchy, list header, row density, Magic Plus, long content, selection, inspector | Pass |
| Mobile shell at 390 and 430 | Real device viewport, sticky header, drawer, scrim, touch-safe controls, full-width inspector | Pass |
| Light and dark | Shell, rows, fields, dialogs, destructive states, selected states | Pass |
| Loading, empty, error, offline | Clear title, explanatory copy, retry or next action | Pass |
| Disabled, saving, success, retry, conflict, undo | Disabled semantics and visible live feedback | Pass |
| Hover, pressed, selected, focus-visible | Pointer feedback does not replace keyboard focus feedback | Pass |
| Dialogs and menus | Quick Find, settings, move, schedule, Tags, context menu, repeat editor | Pass |
| Repeating | Active, Paused, Stopped, preview, marker, editor, Template route | Pass |
| Dense and long content | Wrapping, truncation, scroll containment, no horizontal page overflow | Pass |
| Reduced motion | Animations collapse while state and focus feedback remain | Pass |

Keyboard-only checks covered navigation, Quick Find, inline entry, completion, selection, action dialogs, inspector editing, and Escape dismissal. Focus returned to the opener after the mobile drawer and overlays closed. Accessible snapshots exposed the expected complementary navigation, main region, dialogs, headings, named controls, checked and selected states, and live status feedback.

## Imported Workspace checks

The importer and retained-row migration tests check these facts independently of the source data layout:

- record counts for Spaces, Areas, Projects, Headings, Tags, to-dos, Repeating Templates, and calendar events;
- nearest-parent Location, Project and Area relationships, and inherited Space;
- open, completed, and canceled Outcomes separately from Trash and Logbook placement;
- application settings, launch rules, calendar events, Tags, and unfinished quick entry;
- repetition history, next dates, future previews, reminder defaults, Deadline defaults, and independent copied identities;
- checklist relationships and order;
- full export/import round trips and rejection of malformed or incomplete input.

### Real hosted Workspace audit

The owned deployment was exported before and after migration. The retained source contained 2 Spaces, 4 Areas, 5 Projects, 2 Headings, 79 to-do rows, 28 checklist rows, and 1 calendar event. Its tested importer accepted 76 to-dos, created 2 Repeating Templates, made 103 deterministic corrections, skipped 1 malformed to-do, removed 2 malformed checklist rows, and collapsed 2 duplicate Repeating occurrences in favor of their completed history. It rejected nothing.

The existing replacement snapshot contained one replacement-only Space and to-do. The cutover merge preserved them while importing the retained Workspace. Authenticated capture then added one verification to-do and receipt. The saved revision 12 contains:

| Data | Saved result |
| --- | ---: |
| Spaces | 3 |
| Areas | 4 |
| Projects | 5 |
| Headings | 2 |
| Tags | 0 |
| To-dos | 78 |
| Repeating Templates | 2 |
| Calendar events | 1 |
| Checklist items | 26 |
| Open / completed / canceled Outcomes | 51 / 26 / 1 |
| Trash / Logbook | 21 / 26 |

Workspace validation found no broken relationships or invalid state. A second import of the final portable JSON reported the same counts. Retained settings, the weekday launch rule, inherited Locations, repetition links, Outcomes, Trash, Logbook, and the calendar event were present. The migration marker records source update `2026-07-19T16:23:47.781Z` and source mutation `mutation-mrs09g6e-9txfd`, so the same retained data cannot be imported twice.

### Hosted cutover run

- Deployment: `https://rapid-orbit-30bc758cb5.lakebed.app`. The durable migration shipped at 09:44 UTC; the duplicate-occurrence importer correction shipped at 09:50 UTC on 2026-07-20.
- Google sign-in reached Lakebed Auth and completed in the user's signed-in browser. The hosted database recorded normal signed-in changes at revisions 9 and 10, followed by the one-time migration receipt at revision 11.
- The manifest and service worker returned HTTP 200 with the expected content types and cache rules. With network access disabled, a hosted reload returned the cached Objects session-check shell; restoring the network reloaded the hosted origin normally.
- An unauthenticated `POST /api/tasks` returned HTTP 401. A signed-in capture link created exactly one `cutover-verification-20260720` receipt and one matching to-do, then persisted revision 12 through the normal Workspace sync path.
- The persisted post-cutover portable backup is 38,951 bytes with SHA-256 `90f8e8668f6224b6a7667a93de686d37645dfeeafebd97c4eb1dd7ad42e3e2ee`. It is kept outside the repository because it contains private Workspace data.

## Intentional corrections from the legacy interface

These differences are accepted because they make behavior clearer without removing a feature:

- Organization creation actions are visible in the main view instead of being hidden behind one generic New List menu.
- Quick Find has a labeled control as well as its keyboard shortcut instead of relying on an icon alone.
- Repeating has a permanent compact entry beside Settings and a dedicated editor.
- The active Space is shown as a named pill, which avoids the legacy three-part switch becoming cramped as Spaces grow.
- Rows, dialogs, and mobile controls use larger touch targets and clearer selected, disabled, destructive, and focus-visible states.
- Loading, offline, session-expired, conflict, and recovered states use direct plain-language messages instead of leaving a partly mounted shell.
- The replacement uses native dialogs and form controls. Web Awesome was removed because the replacement no longer needs that runtime to provide the accepted behavior.
- During the one-time cutover, retained Workspace settings are authoritative. Replacement-only entities, quick draft text, and unique launch rules are preserved. This avoids guessing whether a value that looks like a default was deliberately chosen.

## Cutover rules

- `client/index.tsx` mounts only `ReplacementApp`.
- All user changes cross the Workspace or sync adapter seam.
- The old imperative renderer, old packed runtime, old component gallery, old theme files, and Web Awesome bundle are absent.
- SortableJS remains only behind `client/ui/sortable.ts` and reports drag intent back to Workspace.
- Until a matching migration marker exists, the old database tables are read-only migration input. Their data is reassembled, passed through the tested portable importer, and safely merged with replacement-only work; it is never rendered or mutated by the old application.
- The client persists the complete merged document through the normal sync mutation. The source update and mutation identity form one durable receipt, and all later reads and writes use the replacement snapshot store.
