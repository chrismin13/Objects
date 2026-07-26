# Objects

[objects.chrismin13.com](https://objects.chrismin13.com)

Objects is a polished, full-featured task manager inspired by Things 3, built with [Vite+](https://viteplus.dev) and deployed as a single [Cloudflare Worker](https://workers.cloudflare.com) with static assets.

The client is a Preact PWA; sync runs through an offline-first engine in `shared/` to a per-user SQLite-backed Durable Object; sign-in is hosted WorkOS AuthKit with sealed-cookie sessions.

Live app: [objects.chrismin13.com](https://objects.chrismin13.com). The Cloudflare-provided fallback is [objects.accounts-7ac.workers.dev](https://objects.accounts-7ac.workers.dev).

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
- An authenticated, retry-safe `POST /api/tasks` capture endpoint

## Authentication and privacy

Sign-in is hosted [WorkOS](https://workos.com) AuthKit (email, magic link, and social providers as enabled in the WorkOS dashboard). After sign-in the Worker seals the WorkOS user identity into its own httpOnly session cookie; every API request authenticates locally against that cookie, with no per-request calls to WorkOS.

Every workspace is owned by the immutable WorkOS user ID, which scopes the user's Durable Object and all local persistence keys. Email, name, and picture are treated only as profile data—not as authorization keys.

For local development, `vp dev` plus a WorkOS staging environment works end-to-end. To sign in as a throwaway user without touching WorkOS, mint a session cookie with the `.dev.vars` password (see `worker/auth.ts` for the seal format).

## Develop and inspect

```sh
vp install   # first run
vp dev       # Vite dev server + workerd; local Durable Object state persists across restarts
```

Validate and test:

```sh
vp check         # format + lint + typecheck
vp test --run    # full suite inside workerd
vp build         # client + worker bundles
vp exec wrangler deploy --dry-run   # validate upload + size
```

Local Durable Object state lives under `.wrangler/state` and survives restarts; production data is durable.

## Deploy

```sh
vp exec wrangler login   # once
vp exec wrangler deploy
```

Infrastructure is declared in `wrangler.jsonc`; secrets are managed with `wrangler secret put` and never committed. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the complete account setup, manual configuration, recovery, deployment, and verification runbook.

## Install as an app

Open the hosted app and use **Settings → App**, the browser’s **Install app** command, or **Share → Add to Home Screen** on iPhone and iPad. The PWA opens in a standalone window, exposes Today/Inbox/New to-do shortcuts where supported, accepts shared text and links on supporting mobile platforms, and caches its application shell for offline startup. Authentication, live sync, and uncached account data still require a network connection; private API and auth responses are deliberately excluded from the service-worker cache.

Notification permission is requested only from the Settings button. Reminders use persistent service-worker notifications so they work on mobile browsers as well as desktop browsers, and tapping a notification opens its task. The reminder timer itself runs while Objects is open. Reliable delivery after the app is fully closed would require a hosted Web Push scheduler, which is not built yet (Durable Object alarms are the natural fit on Cloudflare); browsers do not offer a portable, reliable local background timer.

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

Objects stores each account's portable Workspace in a private SQLite-backed Durable Object selected by the immutable WorkOS user ID. Client edits are sent as compact field-level changes. The Durable Object applies each change in one serialized transaction, records its mutation identity, and returns the merged Workspace. Retrying an old or uncertain mutation identity returns the current saved Workspace instead of applying that mutation twice.

The app keeps an account-scoped copy and pending-change queue in device storage. A local action appears immediately and remains available after a reload or temporary loss of the session. When the connection returns, Objects sends the pending changes in order. It does not cache private API or authentication responses in the service worker.

Multi-device conflicts follow one fixed rule. Changes to different fields are combined. If two devices changed the same field from the same older value, the later submitted local change is kept and Objects shows conflict feedback. If one device permanently deleted an item, the durable deletion marker always wins over a stale edit. Repeating Occurrences and capture receipts are also checked by their schedule or submission identity so concurrent retries create one result.

Data can be exported as one portable JSON backup from Settings at any time and imported into a fresh account without server-side migration tooling.

## Notes

Native Apple-only surfaces such as Siri, Apple Watch, widgets, Share Extensions, and Mail to Things cannot run inside a web app. Objects covers their portable workflows with a responsive web UI, natural-language capture, URL capture, reminders, and an authenticated endpoint.

Objects is an independent project and is not affiliated with or endorsed by Cultured Code. “Things” is a trademark of its respective owner.
