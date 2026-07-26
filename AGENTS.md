# Objects — agent guide

Objects is a to-do PWA (Preact + TypeScript) deployed as a single Cloudflare Worker with static assets. See `DEPLOYMENT.md` for platform setup and operations.

## Layout

- `client/` — Preact UI. `client/index.tsx` is the entry (session check, boot screens, sync wiring). `client/objects.ts` is the interface runtime. `client/vendor/` holds pinned third-party bundles (see its README; do not edit).
- `worker/` — the Cloudflare Worker. `worker/index.ts` routes (`/api/workspace`, `/api/tasks`, `/api/me`, `/auth/*`); `worker/workspace-do.ts` is the per-user Durable Object owning workspace persistence; `worker/auth.ts` is WorkOS AuthKit sign-in with sealed-cookie sessions.
- `shared/` — pure TypeScript domain: workspace model, validation, delta sync, offline sync client, importers, interface bridge. No DOM, Node, env, or runtime imports.
- `tests/workspace/` — Vitest suite running inside workerd via `@cloudflare/vitest-pool-workers`.

## Commands

Everything runs through Vite+ (`vp`, install: `curl -fsSL https://vite.plus | bash`):

```sh
vp install        # dependencies (pnpm under the hood)
vp dev            # local dev: Vite dev server + workerd with local DO state (persists across restarts)
vp check          # format + lint + typecheck in one pass (the CI gate)
vp test --run     # full test suite inside workerd
vp build          # client (dist/client) + worker (dist/objects)
vp exec wrangler deploy              # deploy to production
vp exec wrangler deploy --dry-run    # validate + show upload size
vp exec wrangler types               # regenerate worker-configuration.d.ts after wrangler.jsonc changes
```

Local CI and remote CI run the identical commands: `vp exec wrangler types && vp check && vp test --run && vp build`.

## Platform facts

- One SQLite-backed Durable Object per user (`WORKSPACE_DO`); saves are `transactionSync`-atomic revisioned commands with idempotency receipts.
- Auth: hosted WorkOS AuthKit. `/auth/login` redirects, `/auth/callback` seals an Objects session cookie (iron-session). Sessions verify locally — no per-request WorkOS calls. API routes 401 without a session.
- Secrets: `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD` (production: `wrangler secret put`; local: `.dev.vars`, gitignored). `WORKOS_CLIENT_ID` is public, in `wrangler.jsonc` `vars`.
- Static assets serve free; `run_worker_first` routes only `/api/*` and `/auth/*` through the Worker. Non-API routes delegate to `env.ASSETS.fetch(request)` for the SPA fallback.
- `sw.js` is generated at build time (precache list + cache revision) by the `objectsPwa` plugin in `vite.config.ts`; the manifest is `public/manifest.webmanifest`.
- Production: https://objects.chrismin13.com. Cloudflare fallback: https://objects.accounts-7ac.workers.dev. See `DEPLOYMENT.md` for account setup, secrets, deploy, rollback, and recovery.

## Rules

- Domain logic lives in `shared/` and stays platform-free. UI state changes flow through the sync client → HTTP adapter → Durable Object.
- Never commit secrets. `.dev.vars` is gitignored. `worker-configuration.d.ts` is generated and gitignored — do not hand-edit it; rerun `wrangler types`.
- Vendored bundles in `client/vendor/` are pinned upstream artifacts; verify SHA-256 against the README if ever regenerated.
- Use the vocabulary in `CONTEXT.md` ("to-do", not "task").
