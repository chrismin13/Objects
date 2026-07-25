# Cloudflare + Vite+ as a Lakebed replacement

**Research date:** 2026-07-25
**Question:** Can Vite+ (VoidZero) and Cloudflare host Objects without the 2 MiB Lakebed deploy limit, and how does the work compare to the Firebase Spark plan in `.scratch/firebase-spark-migration/`?
**Constraints applied:** No existing-data migration required. Auth should be whatever is easiest on the platform (no Google sign-in requirement). CI must be runnable and debuggable locally, not only on a remote service.

## Executive summary

Cloudflare + Vite+ is a materially smaller migration than Firebase Spark, and it removes the 2 MiB ceiling by construction rather than by quota headroom:

- **One config file replaces the Terraform graph.** Everything Objects needs (Worker, static assets, D1/Durable Object bindings, custom domain, routes) is declared in a single checked-in `wrangler.jsonc` and applied by `wrangler deploy`. The Firebase plan needed Terraform/OpenTofu + HCP Terraform state + Firebase CLI + phased Cloudflare DNS reconciliation, with three documented uncertainty gaps (Auth authorized-domains PATCH, WIF without billing, beta provider resources). None of that exists here: the DNS zone is already on Cloudflare, so a custom domain is a `routes` entry, and Cloudflare creates the DNS records and certificates itself.
- **The 2 MiB problem disappears.** The Worker _script_ limit is 3 MB compressed (64 MB uncompressed) and applies only to server code. The entire client PWA ships as static assets: up to 20,000 files at 25 MiB each, served free and unlimited. `client/runtime/packed.ts`, `client/theme/packed.ts`, `client/workspace/runtime-packed.ts`, `server/workspace-runtime.ts` minification, `scripts/build-runtimes.mjs`, `scripts/check-build-artifact.mjs`, and the `DecompressionStream` blob-URL loaders all get deleted.
- **CI is local-first by design.** The pipeline is `vp check && vp test && vp build` + `wrangler deploy --dry-run`, identical locally and in any CI runner. Local dev runs the real Workers runtime (workerd) inside the Vite dev server, and the test suite can run inside workerd locally via the official Vitest integration. Remote CI becomes a thin wrapper over the same commands.
- **Auth is hosted and free at Objects' scale.** WorkOS AuthKit: first 1 million monthly active users free, official Cloudflare Workers support in `@workos-inc/node` since 2024, hosted sign-in UI with email/password, magic link, Google/GitHub/Microsoft, passkeys, and MFA toggleable from the dashboard — no self-built auth screens, no Identity Platform, no authorized-domain gap. Fully-local alternative if ever needed: Better Auth in-Worker on D1.

The main trade-offs: Vite+ is beta software (0.2.x); Durable Objects on the free plan are SQLite-backed only; and Cloudflare's free tier, like Firebase Spark, fails closed with hard daily caps rather than overage billing.

## Vite+ (VoidZero)

Status and licensing:

- Vite+ is the unified toolchain from VoidZero (Evan You's company): one `vp` CLI wrapping Vite 8 + Rolldown, Vitest, Oxlint, Oxfmt, tsdown, and the Vite Task runner. Core workflow: `vp dev`, `vp check`, `vp test`, `vp build`, plus `vp run` (cached task runner), `vp create`, and `vp migrate` for existing Vite projects.
- Beta as of mid-2026 (`vite-plus` npm at 0.2.6), **fully open source under MIT**. The original October 2025 announcement floated commercial licensing for larger orgs; the beta announcement and current docs state "fully open source under the MIT license." For Objects this is a non-issue either way (individual/small-scale use was always free).
- It manages the Node runtime and package manager, and claims compatibility with the existing Vite plugin ecosystem: "Vite plugins remain Vite plugins."
- Adoption signal: 1,300+ public repos depend on `vite-plus`; notably **Cloudflare's own `vinext`** (their Next.js-compatible framework) is built on it, so VoidZero↔Cloudflare alignment is active.

Compatibility with the Cloudflare Vite plugin: `@cloudflare/vite-plugin` 1.47.0 declares peer `vite: ^6.1.0 || ^7.0.0 || ^8.0.0` and `wrangler: ^4.114.0`. Vite+ beta is powered by Vite 8.1, inside the peer range. Preact works through the standard `@preact/preset-vite` plugin. Both compat points are low-risk but should be confirmed in a spike because Vite+ is pre-1.0 and explicitly lists "improving compatibility across Vite frameworks and plugins" as remaining 1.0 work.

Sources: https://voidzero.dev/posts/announcing-vite-plus, https://voidzero.dev/posts/announcing-vite-plus-beta, https://viteplus.dev/guide/why, https://viteplus.dev/guide/, https://www.npmjs.com/package/@cloudflare/vite-plugin, https://www.npmjs.com/package/vite-plus

## Cloudflare platform (what's new and relevant)

### Workers Static Assets — replaces the PWA hosting layer

- A Worker can serve a static asset directory directly; `assets.not_found_handling: "single-page-application"` gives SPA fallback, matching the current client router needs.
- **Requests to static assets are free and unlimited on all plans** (they do not consume the 100,000 requests/day free allowance). Limits: 20,000 files and 25 MiB per file on the free plan — the entire Objects client fits trivially, unpacked, with readable source maps.
- The existing PWA endpoints collapse into assets/routes: `manifest.webmanifest` becomes a static file (or a one-line Worker route), and the service worker becomes a static `/sw.js` at the root — no more embedding response bodies in `server/index.ts`.

Sources: https://developers.cloudflare.com/workers/static-assets/, https://developers.cloudflare.com/workers/platform/pricing/, https://developers.cloudflare.com/workers/platform/limits/

### Cloudflare Vite plugin — local dev in the real runtime

- `@cloudflare/vite-plugin` runs Worker code inside `workerd` (the production runtime) inside `vite dev`, via the Vite Environment API. D1/KV/DO/R2 bindings work locally with persistent local state; `vite preview` runs the production build in workerd before deploy.
- One `vite.config.ts` builds both halves of Objects: the Preact client and the API Worker, with HMR for the client and the real runtime for the server. This is the direct replacement for `npx lakebed dev`, minus the state-reset-on-restart behavior (local bindings persist to disk).

Sources: https://developers.cloudflare.com/workers/vite-plugin/, https://developers.cloudflare.com/workers/vite-plugin/tutorial/

### Custom domains — free, in-zone, no DNS choreography

- Because the Objects domain's DNS is already a Cloudflare zone: attach a custom domain in the dashboard or via `routes: [{ pattern, custom_domain: true }]` in `wrangler.jsonc`; Cloudflare creates the DNS records and issues/renews certificates automatically. No TXT/A/AAAA/CAA reconciliation phases, no proxy-state pitfalls, no 24-hour certificate waits — the entire Firebase "custom-domain reconciliation" section reduces to two lines of config.

Source: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

### Storage options for the workspace sync contract

Requirements (from the platform-coupling inventory): per-owner `WorkspaceDocument` up to 2,000,000 serialized chars, revision + compare-and-swap saves, durable mutation receipts, idempotent replay, and the HTTP capture endpoint. Options:

**Option A — one SQLite-backed Durable Object per user (best semantic fit).**
Each owner gets a `WorkspaceDO` instance addressed by user ID. A Durable Object is single-threaded, so the current "read latest → resolve delta → write chunks + receipt" sequence becomes naturally serialized — the compare-and-swap and idempotency semantics port almost verbatim, and SQLite storage gives real transactions. Storage: 2 MB max key+value / 2 MB max row (the existing 50,000-char chunking ports directly), 1 GB per object on free (10 GB paid), 5 GB account total on free. Free tier: 100,000 DO requests/day, 13,000 GB-s duration/day, 5M rows read/day, 100k rows written/day. Alarms could later run Repeating Template occurrence generation or push reminders server-side — something Lakebed never offered and Firebase Spark can't do without Functions.
Sources: https://developers.cloudflare.com/durable-objects/platform/limits/, https://developers.cloudflare.com/durable-objects/platform/pricing/

**Option B — one shared D1 database (simplest, most conventional).**
Tables: `workspace_chunks(owner, seq, text)`, `workspace_meta(owner, revision, last_mutation_id, updated_at, part_count)`, `mutation_receipts(owner, mutation_id, ...)`, `capture_receipts(...)`. CAS via `UPDATE ... WHERE owner = ? AND revision = ?` checking rows-changed; atomicity via `batch()`. Free tier: 5M rows read/day, 100k rows written/day, 500 MB/database, 5 GB/account, 10 databases, **2,000,000-byte max row** (coincidentally the same magnitude as the document cap — keep the 50k chunking; a 2M-char doc with multibyte UTF-8 would exceed one row). Includes Time Travel point-in-time recovery (7 days free) — a real backup story Spark lacks. Reads/writes are single-threaded per database, fine at Objects scale.
Sources: https://developers.cloudflare.com/d1/platform/limits/, https://developers.cloudflare.com/d1/platform/pricing/

**Ruled out:** Workers KV for the hot path (free tier is 1,000 writes/day; eventual consistency fights the CAS contract). R2 is useful later for user data-export blobs, not for sync.

Both A and B comfortably fit the current usage profile (one document per user, writes only on sync/capture). Option A is the cleaner port of the sync semantics; Option B is the more familiar SQL mental model and marginally simpler to inspect/debug with `wrangler d1 execute`.

### Auth options (chosen first)

1. **WorkOS AuthKit (hosted — selected).** Free up to 1M MAUs, then $2,500/mo per additional 1M — effectively free forever at Objects' scale. `@workos-inc/node` officially supports Cloudflare Workers (edge runtimes since March 2024). Integration shape: the client sign-in button redirects to the hosted AuthKit page; WorkOS redirects back to a Worker `/auth/callback` route; the Worker exchanges the code via `userManagement.authenticateWithCode`, seals the session (`iron-session`-style encrypted httpOnly cookie, Web Crypto compatible), and every subsequent request derives the owner identity from the WorkOS user ID — an opaque, stable ID that slots directly into the existing owner-scoped rows and localStorage keys. Providers (email/password, magic link, Google, GitHub, Microsoft, passkeys, MFA) are dashboard toggles; staging environments get WorkOS-managed default OAuth credentials, while production Google sign-in uses a Google OAuth client you register once (a console form, not IaC). **Local-CI trade-off:** WorkOS has no emulator, so local dev and CI talk to a staging environment over the network for real sign-in flows; offline tests stub the code exchange or inject a pre-sealed session cookie fixture. The auth surface is ~3 Worker routes (login redirect, callback, logout), so the stub boundary is tiny.
2. **Better Auth (self-hosted fallback)** — MIT, runs in-Worker with a built-in D1 adapter (native `D1Database` support since 1.5). Fully local and offline-testable, but you own the sign-in UI, password reset emails, and provider configs. Keep as the escape hatch if WorkOS ever becomes untenable.
3. **Hand-rolled OIDC** — strictly worse than both; ruled out.
4. Cloudflare Access is workforce SSO, not consumer auth — ruled out.

Sources: https://workos.com/pricing, https://workos.com/blog/launch-week-spring-2024-day-4-cloudflare-workers-edge-support, https://workos.com/docs/authkit, https://workos.com/changelog/default-oauth-credentials-for-staging-environments, https://github.com/better-auth/better-auth/pull/7519, https://better-auth.com/blog/1-5

### CI that runs locally

- The whole pipeline is local-first: `vp check` (format+lint+typecheck in one pass), `vp test` (Vitest; `@cloudflare/vitest-pool-workers` runs Worker-side tests inside workerd locally, against local D1/DO state), `vp build`, then `wrangler deploy --dry-run --outdir` to validate and measure the bundle, and `vite preview` to smoke-test the built app in workerd. Every step runs identically on a laptop; the existing `tests/workspace/*.test.ts` contract suite is pure TypeScript and carries over to Vitest unchanged.
- Remote CI, when wanted, is a choice between (a) Workers Builds — Cloudflare's git integration, builds on push with a per-version preview URL — or (b) a minimal GitHub Actions workflow that runs the same `vp`/`wrangler` commands with one `CLOUDFLARE_API_TOKEN` secret. Neither requires workload-identity federation, service-account keys, or state backends; debugging either means running the same commands locally. This directly answers the "remote CI gets messy" constraint: there is no CI-only logic to reproduce.

Sources: https://developers.cloudflare.com/workers/ci-cd/builds/, https://developers.cloudflare.com/workers/testing/vitest-integration/, https://developers.cloudflare.com/workers/platform/limits/ (`wrangler deploy --outdir --dry-run` for size checks)

### Free tier vs. Objects' profile

| Need                      | Free tier                                                       | Fit                                                    |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| PWA hosting               | Static assets free + unlimited requests, 25 MiB/file, 20k files | Trivial                                                |
| API requests              | 100,000/day, 10 ms CPU each                                     | Sync/capture only — ample                              |
| Worker script             | 3 MB compressed / 64 MB uncompressed                            | Server runtime minified is far under; no packing hacks |
| Storage (D1 or DO SQLite) | 5 GB account; 5M reads/day; 100k writes/day                     | One doc per user — ample                               |
| Custom domain + TLS       | Free, in-zone, automatic                                        | Already on Cloudflare DNS                              |
| Backups                   | D1 Time Travel 7 days (free); self-serve JSON export unchanged  | Better than Spark (no managed export)                  |

Hard caps fail closed (errors at the cap, reset midnight UTC) — same failure style as Spark, but the realistic ceilings (request count) are higher than Firestore's 50k reads/20k writes per day for this workload shape.

## Migration shape (what the work actually is)

Portable already (unchanged): all of `shared/workspace/` — document model, validation, delta sync, offline client, importers — plus the `tests/workspace` contract suite and the interface/theme source.

Rewritten at the seams:

1. `server/index.ts` (Lakebed schema/queries/mutations/endpoints) → a Worker entry implementing the same five operations (load, save, manifest, service worker, capture) over a `WorkspaceDO` or D1. The manifest/service-worker endpoints become static assets.
2. `client/workspace/lakebed-adapter.tsx` + `lakebed-adapter-core.ts` → an HTTP `WorkspaceSyncAdapter` against the Worker's load/save routes (the adapter contract already isolates this).
3. `client/index.tsx` auth imports → WorkOS redirect flow; sign-in UI becomes a link to the hosted AuthKit page plus a sealed-cookie session check against the Worker.
4. Build: delete all four `packed.ts` generators, `build-runtimes.mjs`, `check-build-artifact.mjs`, the 2,080,000-byte guard, and the `DecompressionStream` loaders. Replace with `vite.config.ts` + `wrangler.jsonc`.
5. Ops: `lakebed.json` binding and the `npx lakebed` workflow → `wrangler deploy` from any machine; optional Workers Builds or a thin GitHub Actions wrapper.

Repo-owned surface estimate: one `wrangler.jsonc`, one Worker entry file, ~3 auth routes plus a session helper, one storage module, one Vite config, CI YAML if remote CI is wanted. No `infra/` directory, no state backend, no provider pinning, no phased DNS applies. Manual bootstrap total: create the Cloudflare Worker, create the WorkOS account/app, paste two secrets (`wrangler secret put WORKOS_API_KEY`, client ID + cookie password), register one Google OAuth client if Google sign-in is wanted in production.

## Comparison with the Firebase Spark plan

| Axis                   | Firebase Spark (researched)                                                                          | Cloudflare + Vite+                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| IaC                    | Terraform/OpenTofu + HCP state + Firebase CLI split ownership; 3 documented no-billing uncertainties | `wrangler.jsonc` only; `wrangler deploy` applies everything                  |
| Document size          | Firestore 1 MiB doc limit excludes max workspace → forced re-chunking/app protocol                   | 2 MB rows (D1/DO); existing 50k chunking ports directly                      |
| Offline conflict model | Firestore LWW per document; needs revision metadata anyway                                           | Existing revision/CAS resolver ports unchanged                               |
| Auth                   | Google-only on Spark; authorized-domain automation gap; Identity Platform = Blaze                    | WorkOS hosted (free to 1M MAU), any provider; no OAuth-app setup for staging |
| Backups                | No managed export on Spark → build client export                                                     | D1 Time Travel 7 days free + existing self-serve export                      |
| Server compute         | None possible on Spark (Functions = Blaze)                                                           | Real Worker for capture/sync; DO alarms for future repeating/push            |
| CI credentials         | WIF uncertain without billing; SA-key fallback; token rotation                                       | One API token, or Workers Builds git integration                             |
| Local parity           | Emulator suite (Java-based, documented divergences)                                                  | workerd in `vite dev`; Vitest pool runs tests in workerd                     |
| Deploy size ceiling    | None relevant                                                                                        | None relevant (3 MB compressed server-only; assets unlimited)                |
| Free-tier failure mode | Hard cutoffs (50k reads/20k writes/10 GB transfer)                                                   | Hard cutoffs (100k req/day; 100k writes/day)                                 |

## Risks and unknowns

1. **Vite+ is 0.2.x beta.** Mitigation: it's a superset of Vite — ejecting to plain Vite 8 + the same Cloudflare plugin is a supported fallback (`vp migrate` is reversible in practice since the config stays standard `vite.config.ts`). The Cloudflare plugin pairing does not depend on Vite+ specifically.
2. **Plugin compat with rolldown-powered Vite 8.** Peer ranges include Vite 8 and Cloudflare builds on Vite+ itself (vinext), but `@preact/preset-vite` + `@cloudflare/vite-plugin` + `vite-plus` together should be smoke-tested first — this is the cheapest possible spike.
3. **Free-plan Durable Objects are SQLite-backed only** (KV-backed is paid) — irrelevant if Option A uses SQLite storage, which is the recommended backend anyway.
4. **WorkOS is an external dependency with no local emulator.** Auth flows in local dev/CI hit the hosted staging environment; offline or hermetic tests need the cookie-fixture stub. Session verification itself is local (sealed cookie), so only sign-in/refresh needs the network. If WorkOS is ever unavailable, signed-in users keep working offline (sessions are client-held), but new sign-ins pause.
5. **Hard free-tier caps fail closed**, same as Spark. The 100k requests/day Worker cap is the first realistic ceiling; paid plan is a flat $5/mo if ever needed.
6. **Not verified hands-on:** actual bundle size of the server runtime under Rolldown (expected well under 3 MB compressed), and Vite+ task-runner behavior for the `node --test` suite migration to Vitest. Both are spike-checkable in under an hour.

## Recommendation

Proceed to a spike: `vp create` a scratch app with `@preact/preset-vite` + `@cloudflare/vite-plugin` + one Durable Object, port `saveReplacementWorkspace` against it, and run the `tests/workspace` suite under `vp test`. That validates the only two real unknowns (Vite+ beta compat, storage fit) before committing. If the spike passes, Cloudflare + Vite+ replaces both the Firebase Terraform program and the Lakebed packing machinery with a single-config, locally-debuggable pipeline.
