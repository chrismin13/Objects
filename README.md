# Objects

[objects.chrismin13.com](https://objects.chrismin13.com)

Objects is a polished, full-featured task manager inspired by Things 3 and built as a native [Lakebed](https://lakebed.dev) capsule.

It uses Lakebed’s Preact client, database API v1, live queries, mutations, hosted runtime, and first-party Google authentication. There are no OAuth keys, database credentials, runtime dependencies, or external services to configure.

Live app: [objects.lakebed.app](https://objects.lakebed.app)

## Features

- Inbox, Today, This Evening, Upcoming, Anytime, Someday, Logbook, and recoverable Trash with Empty Trash
- First-class Spaces with an All/Personal/Work sidebar pill, Space-scoped lists, launch-time schedules, and device-local manual selection
- Areas, projects, project headings, checklists, notes, tags, inherited tags, deadlines, and start dates
- Project scheduling across Today, Upcoming, Anytime, and Someday, including project deadlines, distinct completed/canceled states, unfinished-work resolution, and hierarchical Trash restoration
- Things-style Move destinations for Inbox, areas, projects, and headings, with inline project creation
- Repeating to-dos and projects with fixed or after-completion schedules, intervals, weekday selection, pausing, and editable templates
- Browser reminders with notification snoozing, calendar events, manual event entry, and `.ics` import
- Natural-language capture for phrases such as `tomorrow at 2pm`, `in 3 weeks`, `next Friday`, `this evening`, `someday`, `due tomorrow`, and `#tags`
- Things-style two-stage Quick Find across titles, tags, lists, notes, checklist items, Logbook records, Trash, headings, and special lists
- Tomorrow, Deadlines, Repeating, All Projects, and Logged Projects views
- Tag filtering and global tag management; multi-select with batch scheduling, moving, tagging, completion, cancellation, and Trash actions; drag scheduling between Upcoming days and This Evening; sidebar filing and list/heading/checklist ordering; duplication; completion undo; extended Markdown notes; project completion; and restoration
- Share/copy-link actions, deep links to individual to-dos, heading movement, and heading-to-project conversion
- Things-style Logbook timing: log completed to-dos and projects immediately, daily at midnight, or manually
- Responsive desktop/mobile layouts and light, dark, and system themes
- Installable PWA with standalone display and an offline application shell
- JSON backup and guarded import
- Stable URL capture and deep links for personal automation
- An authenticated, retry-safe `POST /api/tasks` Lakebed endpoint

## Authentication and privacy

Hosted users sign in through Lakebed Auth’s built-in Google flow. The client uses `useAuth()` and `<SignInWithGoogle />`; the server trusts only `ctx.auth`.

Every workspace is indexed by the immutable `ctx.auth.userId`. Queries filter by that value, and mutations re-check ownership before updates. Email, name, and picture are treated only as profile data—not as authorization keys. Lakebed keeps auth tokens bound to the exact app origin and clears private query caches on sign-out.

Local development supports Lakebed guest identities:

```sh
npx lakebed auth as alice
npx lakebed dev
```

To test isolated users in separate tabs, open:

```text
http://localhost:3000/?lakebed_guest=alice
http://localhost:3000/?lakebed_guest=bob
```

Guest identities are accepted only by the local UI. Hosted visitors are shown the Google sign-in screen.

## Develop and inspect

Run the capsule:

```sh
npx lakebed dev
```

Validate the build and inspect its local runtime:

```sh
npx lakebed build . --target anonymous --json
npx lakebed db list --port 3000
npx lakebed db dump --port 3000
npx lakebed logs --port 3000
```

Local Lakebed state is in memory and resets when the dev runtime restarts. Hosted data is durable.

## Deploy

For an owned deploy that can be updated from fresh clones:

```sh
npx lakebed auth login
npx lakebed deploy
```

The CLI writes `lakebed.json` with the deploy ID. Commit that file so future deployments update the same app. Hosted inspection remains private unless `--public-inspect` is explicitly supplied.

After the deploy is claimed, reserve a Lakebed hostname if desired:

```sh
npx lakebed domains add objects.lakebed.app
```

## Install as an app

Open the hosted app and use **Settings → App**, the browser’s **Install app** command, or **Share → Add to Home Screen** on iPhone and iPad. The PWA opens in a standalone window, exposes Today/Inbox/New to-do shortcuts where supported, accepts shared text and links on supporting mobile platforms, and caches its application shell for offline startup. Authentication, live sync, and uncached account data still require a network connection; private Lakebed API, auth, and storage responses are deliberately excluded from the service-worker cache.

Notification permission is requested only from the Settings button. Reminders use persistent service-worker notifications so they work on mobile browsers as well as desktop browsers, and tapping a notification opens its task. The reminder timer itself runs while Objects is open. Reliable delivery after the app is fully closed would require a hosted Web Push scheduler, which Lakebed capsules do not currently provide; browsers do not offer a portable, reliable local background timer.

## Automation links and HTTP capture

Open a capture link while signed in:

```text
/?capture=1&title=Call%20Maya&notes=Ask%20about%20the%20plan&when=tomorrow&tags=People,Focused
```

Capture links accept `title`, shared `text`, `url`, `notes`, `space`, `area`, `project`, `heading`, `tags`, `checklist`, `when`, `scheduledFor`, `evening`, `reminder`, and `deadline`. Location values are stable item IDs. `when` accepts `inbox`, `anytime`, `someday`, `today`, `tomorrow`, `this evening`, or a date in `YYYY-MM-DD` form. Objects adds a `submission` ID to browser capture links so a reload or temporary save failure does not create the same to-do twice.

Direct links use these stable shapes:

```text
/?open=view&view=today
/?open=space&id=SPACE_ID
/?open=area&id=AREA_ID
/?open=project&id=PROJECT_ID
/?open=heading&id=HEADING_ID
/?open=tag&id=TAG_ID
/?open=toDo&id=TODO_ID
/?open=repeatingTemplate&id=TEMPLATE_ID
```

Authenticated tools can send the same capture fields as JSON to `POST /api/tasks`. Send either an `Idempotency-Key` header or a `submissionId` JSON field. For relative dates such as `today` or `tomorrow`, also send an IANA `timeZone` field such as `Europe/Athens`, or the same value in an `X-Time-Zone` header. UTC is used when no time zone is supplied. Retry with the same idempotency value after a timeout or `409` response. The endpoint returns the existing to-do instead of creating a duplicate.

## Data model

Objects stores each account's portable Workspace in private, owner-scoped Lakebed rows. Client edits are sent as compact field-level changes. Lakebed applies each change as one transaction, records its mutation identity, and returns the merged Workspace. Retrying an old or uncertain mutation identity returns the current saved Workspace instead of running that mutation again.

The app keeps an account-scoped copy and pending-change queue in device storage. A local action appears immediately and remains available after a reload or temporary loss of the session. When the connection returns, Objects sends the pending changes in order. It does not cache private Lakebed API or authentication responses in the service worker.

Multi-device conflicts follow one fixed rule. Changes to different fields are combined. If two devices changed the same field from the same older value, the later submitted local change is kept and Objects shows conflict feedback. If one device permanently deleted an item, the durable deletion marker always wins over a stale edit. Repeating Occurrences and capture receipts are also checked by their schedule or submission identity so concurrent retries create one result.

Until an account has a matching migration marker, Objects rebuilds its retained legacy `workspaceChunks` or normalized rows and passes that data through the same tested importer as a manual backup. It safely merges replacement-only work, then saves the complete result through normal sync. The retained rows remain a read-only migration backup; the replacement renderer and mutation path never use them directly. Data can still be exported as one portable JSON backup from Settings at any time.

The final story-by-story evidence and cutover record is in [docs/replacement-parity-audit.md](docs/replacement-parity-audit.md).

## Notes

Native Apple-only surfaces such as Siri, Apple Watch, widgets, Share Extensions, and Mail to Things cannot run inside a web capsule. Objects covers their portable workflows with a responsive web UI, natural-language capture, URL capture, reminders, and an authenticated endpoint.

Objects is an independent project and is not affiliated with or endorsed by Cultured Code. “Things” is a trademark of its respective owner.
