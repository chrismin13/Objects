# Rollout plan: Lakebed → Cloudflare + Vite+

**Date:** 2026-07-25
**Inputs:** `research/01-cloudflare-and-viteplus-option.md`, `../firebase-spark-migration/` (comparison baseline)
**Constraints:** No automated data migration (users re-create accounts; existing self-serve JSON export/import covers anyone who wants their data). Auth is WorkOS AuthKit. CI must run and be debuggable locally; remote CI is a thin wrapper.

## End result (target state)

Objects served from **objects.chrismin13.com** as one Cloudflare Worker deployment:

- **Client PWA** — normal Vite build shipped as Workers Static Assets: unpacked, readable, source-mapped. Serving is free and unlimited. `manifest.webmanifest` and `sw.js` are plain static files; offline shell, installability, and share target behave exactly as today.
- **API** — Worker routes implementing today's five operations: workspace `load`, workspace `save` (revisioned, idempotent, delta-reconciled), `POST /api/tasks` capture, plus auth routes. Manifest and service worker stop being endpoints.
- **Data** — one SQLite-backed Durable Object per user (`WorkspaceDO`). The single-threaded object ports the current CAS/idempotency/receipt semantics almost verbatim; existing 50k chunking carries over; alarms open the door to server-side Repeating Template generation and push reminders later (impossible on both Lakebed-anonymous and Firebase Spark).
- **Auth** — WorkOS hosted AuthKit; sealed httpOnly session cookie; WorkOS user ID is the opaque owner key everywhere (rows, localStorage, receipts). Providers are dashboard toggles.
- **Toolchain** — `vp dev` (real workerd runtime + HMR client), `vp check`, `vp test` (including the existing `tests/workspace` contract suite via the Cloudflare Vitest pool), `vp build`, `wrangler deploy`. Same commands locally and in CI.
- **Deleted** — all `lakebed/*` imports; `client/runtime/packed.ts`, `client/theme/packed.ts`, `client/workspace/runtime-packed.ts`, minified `server/workspace-runtime.ts`; `scripts/build-runtimes.mjs`; `scripts/check-build-artifact.mjs`; the `DecompressionStream` blob-URL loaders; the 2,080,000-byte guard; `lakebed.json`; `docs/runtime-packaging.md`; the Lakebed workflow in `AGENTS.md`.
- **Cost** — $0/month (Cloudflare free tier + WorkOS free to 1M MAU). No billing account attached anywhere.
- **Repo-owned infra** — one `wrangler.jsonc`, one `vite.config.ts`, one optional CI YAML. Manual bootstrap total: WorkOS account, Cloudflare Worker, two `wrangler secret put` calls, one Google OAuth client form if Google sign-in is wanted in production.

**User-visible change at cutover:** sign up again on the new site (any provider WorkOS offers); to keep existing data, import the JSON backup downloaded from the old site beforehand. Everything else — interface, offline behavior, sync, capture URL scheme — looks and works the same.

## Phases

### Phase 0 — Spike (go/no-go, ~half a day, throwaway) — **DONE: GO**

Results: `research/02-spike-results.md`. All compatibility questions answered positively; sync contract preserved (8/8 contract tests in workerd); test-suite port is a two-line mechanical change; worker bundle is 34.5 KiB gzip (1.1% of the free limit); local dev runs real workerd with persistent state. Decision locked: Durable Object per user.

### Phase 1 — Skeleton deploy (same repo, new branch) — **DONE**

Branch `cloudflare-migration`. `vite.config.ts`, `wrangler.jsonc`, `vitest.config.ts`, `tsconfig.json`, `package.json` created; Worker entry with `/api/workspace` load/save, `/api/tasks` capture, ASSETS delegation with SPA fallback. Deployed to https://objects.accounts-7ac.workers.dev and verified live (load/save/capture round-trip, deep links, 34.5 KiB gzip, 4 ms startup).

### Phase 2 — Server port (the core) — **DONE**

`worker/workspace-do.ts` ports `replacementWorkspace`/`saveReplacementWorkspace`/capture semantics onto SQLite-backed storage with `transactionSync` atomicity (legacy migration intentionally dropped). Full test suite runs in workerd via `@cloudflare/vitest-pool-workers`: **123/123 green in ~1.9 s.** `runtime-packaging.test.ts` deleted with its subject; two source-grep tests moved to `?raw` imports; one TZ-dependent assertion pinned to UTC (workerd); 50 pre-existing type errors in the domain core fixed properly (repo had no tsconfig before); one-time oxfmt pass applied repo-wide. Manifest + service worker move to static assets in Phase 4 with the client.

### Phase 3 — Auth — **DONE (server side)**

WorkOS AuthKit integrated: `/auth/login` → hosted AuthKit, `/auth/callback` exchanges the code (one WorkOS network call) and seals an Objects session cookie with iron-session, `/auth/logout` clears it, `/api/me` reports identity. All API routes are session-gated; the WorkOS user ID is the owner key. Design choice: after sign-in, sessions verify **fully locally** — no JWKS or per-request WorkOS calls, so tests mint valid sessions offline (9 auth tests; 132/132 green). Deployed and verified: login redirect, 401 gating, callback validation all live. Client sign-in UI swap lands in Phase 4. Production Google sign-in remains a WorkOS dashboard toggle + one Google OAuth client form, if wanted.

### Phase 4 — Client port — **DONE**

`client/index.tsx` runs on WorkOS sessions (`/api/me`), direct imports replace all four gzip/blob-URL runtime loaders, and `client/workspace/http-adapter.tsx` implements `WorkspaceSyncAdapter` over the Worker routes (refresh-on-focus/online/visibility for invalidation, per the behavior note). Deleted: `server/`, `scripts/`, all `packed.ts` files and loaders, `lakebed.json`, `docs/runtime-packaging.md`. Vendored SortableJS/WebAwesome decoded to plain files (SHA-256 verified against the vendor README). `shared/state.ts` created for the legacy interface types the dialogs assumed (they typechecked as `any` under Lakebed). Manifest is `public/manifest.webmanifest`; `sw.js` is generated per build by the `objectsPwa` Vite plugin with hashed precache + cache revision. Verified end-to-end locally in a browser: sign-in → boot → natural-language capture → DO sync → reload persistence. Deployed; `sw.js`, manifest, bundle, and 401 gating verified in production. `lakebed-adapter-core.ts` renamed to `adapter-core.ts` with export renames; test-suite codemod absorbed it.

**Follow-up noted:** 80 lint warnings in legacy client code catalogued for a cleanup pass (unbound-method, unused vars, sort-compare); `migrationCommandForQuery` in adapter-core is dead code retained for its test coverage until Phase 5 cleanup.

### Phase 5 — Pipeline — **MOSTLY DONE**

Local pipeline is the gate: `vp check && vp test --run && vp build` (+ `wrangler deploy --dry-run` for size). AGENTS.md and README.md rewritten for the new toolchain. Remaining: remote CI wrapper (GitHub Actions or Workers Builds) and the Phase 5 cleanup items (dead migration helpers, warning pass).

### Phase 6 — Cutover and retire

1. Add `routes: [{ pattern: "objects.chrismin13.com", custom_domain: true }]`; deploy. Same-zone change — Cloudflare re-points DNS and issues the cert itself, no record choreography. (The `docs/` GitHub Pages landing currently on that hostname is superseded by the app.)
2. Verify production: fresh sign-up, sync, offline, capture, backup import of a real legacy JSON file.
3. Keep the Lakebed deployment live (untouched at objects.lakebed.app) as rollback for ~2 weeks. Rollback is a DNS/route flip, instant, since the zone is already on Cloudflare.
4. Announce/window for existing users to download their JSON backup and import it on the new site.
5. Retire: terminate the Lakebed deploy, remove `lakebed.json`, delete remaining Lakebed docs, final `AGENTS.md` rewrite.

## Open decisions (resolve in flight)

| Decision                  | Options                                                     | When          |
| ------------------------- | ----------------------------------------------------------- | ------------- |
| Storage                   | **A: Durable Object per user (recommended)** / B: shared D1 | Phase 0 spike |
| Live invalidation         | Refresh-on-focus (ship) / DO WebSocket (later)              | Phase 4       |
| Remote CI                 | GitHub Actions wrapper / Workers Builds / both              | Phase 5       |
| Production Google sign-in | Register OAuth client / email+magic-link only               | Phase 3       |
| Vite+ vs plain Vite 8     | Vite+ (try) / Vite 8 (fallback)                             | Phase 0 spike |

## What this rollout is NOT

- No Terraform, state backend, or `infra/` directory anywhere.
- No phased DNS reconciliation or certificate waits.
- No data-migration pipeline, dual-write period, or backfill.
- No changes to `shared/workspace/` — the domain, sync resolver, and contract tests carry over untouched.
- No visual redesign.
