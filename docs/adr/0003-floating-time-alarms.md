# ADR 0003: Alerts sync in floating time — no timezone is ever stored

Objects Reminders carry a time-of-day as fake-UTC wall time
(`${date}T${time}:00.000Z` — local clock digits with a `Z` bolted on), and
Schedules are date-only. The CalDAV mapping follows that convention exactly:
a timed to-do renders `DUE:20260129T090000` — RFC 5545 **floating time**, no
`Z`, no `TZID` — plus a relative at-due VALARM (`TRIGGER:PT0S`); inbound,
floating or TZID-qualified DUE/DTSTART times are read as local wall time and
the `Z`/`TZID` is ignored. The phone resolves the wall hour against its own
clock; no timezone is stored on any to-do.

A stored-timezone design (convert server-side) was considered and rejected:
that is the server-push apps' pattern, not Objects', and UTC-conversion bugs
of exactly that shape are documented in the wild (Tududi's midnight-alarm
bug; date-only DUE serialized as UTC shifting the day). Validated on-device:
both relative trigger forms fire at-due on iOS 27, and floating DUE renders
clean local times (a UTC DUE, by contrast, is displayed with an explicit
"GMT" annotation). One wall-clock dependency remains: the adapter must know
the user's timezone to compute "today" (Occurrence generation, evening
grouping) — stored once per integration token, never per to-do.
