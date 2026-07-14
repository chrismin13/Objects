# Objects

[objects.chrismin13.com](https://objects.chrismin13.com)

Objects is a polished, full-featured task manager inspired by Things 3 and built as a native [Lakebed](https://lakebed.dev) capsule.

It uses Lakebed’s Preact client, database API v1, live queries, mutations, hosted runtime, and first-party Google authentication. There are no OAuth keys, database credentials, runtime dependencies, or external services to configure.

Live app: [objects.lakebed.app](https://objects.lakebed.app)

## Features

- Inbox, Today, This Evening, Upcoming, Anytime, Someday, Logbook, and Trash
- Areas, projects, project headings, checklists, notes, tags, inherited tags, deadlines, and start dates
- Project scheduling across Today, Upcoming, Anytime, and Someday, including project deadlines and hierarchical Trash restoration
- Things-style Move destinations for Inbox, areas, projects, and headings, with inline project creation
- Repeating to-dos and projects with fixed or after-completion schedules, intervals, weekday selection, pausing, and editable templates
- Browser reminders with notification snoozing, calendar events, manual event entry, and `.ics` import
- Natural-language capture for phrases such as `tomorrow at 2pm`, `in 3 weeks`, `next Friday`, `this evening`, `someday`, `due tomorrow`, and `#tags`
- Quick Find across titles, notes, checklist items, tags, headings, completed items, and special lists
- Tomorrow, Deadlines, Repeating, All Projects, and Logged Projects views
- Tag filtering, drag-and-drop ordering, duplication, completion undo, extended Markdown notes, project completion, and restoration
- Share/copy-link actions, deep links to individual to-dos, heading movement, and heading-to-project conversion
- Things-style Logbook timing: log completed to-dos and projects immediately, daily at midnight, or manually
- Responsive desktop/mobile layouts and light, dark, and system themes
- Installable PWA with standalone display and an offline application shell
- JSON backup and guarded import
- URL capture through `/?title=Call%20Maya%20tomorrow`
- An authenticated `POST /api/tasks` Lakebed endpoint

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

## Data model

Objects stores each serialized user workspace across ordered rows in the `workspaceChunks` table. The composite `by_owner_part` index makes reads bounded, ordered, and private while keeping every value below Lakebed’s 64 KiB hosted limit. Writes run in Lakebed transactions and are serialized per deploy.

The workspace document is capped at 750 KB—below Lakebed’s 1 MiB hosted state limit—and can be exported from Settings at any time.

## Notes

Native Apple-only surfaces such as Siri, Apple Watch, widgets, Share Extensions, and Mail to Things cannot run inside a web capsule. Objects covers their portable workflows with a responsive web UI, natural-language capture, URL capture, reminders, and an authenticated endpoint.

Objects is an independent project and is not affiliated with or endorsed by Cultured Code. “Things” is a trademark of its respective owner.
