# ADR 0001: CalDAV endpoint lives in the existing Worker

iOS Reminders needs a CalDAV server to sync against, and iOS generic CalDAV
accounts speak HTTP Basic auth only (no OAuth). Rather than a separate sync
service, the CalDAV endpoint is served by the existing Cloudflare Worker —
`/.well-known/caldav`, `/principals/*`, and `/dav/*` routes alongside
`/api/*` and `/auth/*` (added to `run_worker_first`, which currently only
routes those two prefixes to the Worker).

Serving it ourselves costs nothing new (one Worker, no new services), keeps
HTTPS and the custom domain free, and makes Siri, widgets, and smart lists
work with zero client-side code because Reminders.app does the syncing. The
constraint that comes with it: Cloudflare's edge rejects `MKCALENDAR` with
501 before the request reaches any Worker (cloudflare/workerd#6877), so
creating lists from iOS is impossible — acceptable because containers are
web-app-only by decision. If Cloudflare allowlists MKCALENDAR, the limit
disappears with no code change.

Considered and rejected: a native iOS app (App Store/signing burden, scope
creep), shortcut-based capture (not sync), a third-party sync service (not
an open standard we control).
