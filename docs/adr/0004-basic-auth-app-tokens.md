# ADR 0004: CalDAV auth is app-specific tokens over HTTP Basic

The CalDAV endpoint authenticates with HTTP Basic, but never with the
user's primary credentials. Tokens are minted from the logged-in AuthKit
session in Settings → Integrations, stored as SHA-256 hashes in the
Workspace Durable Object (alongside a user-chosen label, creation time,
last-used time, and the IANA timezone used for adapter "today" math), shown
once at creation, and individually revocable — losing a phone revokes one
token without disturbing other devices. The Basic username field is ignored.
Token verification happens inside the DO, which every CalDAV request already
round-trips to.

Why Basic at all: iOS generic CalDAV accounts offer no alternative (OAuth is
out of scope by map decision), and WorkOS password verification was
considered and rejected — it couples the phone to the primary password,
breaks under MFA, and offers no clean revocation. Basic-over-HTTPS with
revocable scoped tokens gives iOS what it requires without weakening the
primary auth path, which stays WorkOS AuthKit only.
