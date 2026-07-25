# Phase 0 spike results: GO

**Date:** 2026-07-25
**Location:** `~/Code/objects-cloudflare-spike` (throwaway, not part of the Objects repo)
**Verdict:** Both unknowns resolved. Vite+ beta is compatible with everything Objects needs, and the Durable Object port preserves the sync contract verbatim. Proceed to Phase 1.

## What was built

A scratch Vite+ app (`vp create vite:application`) with `@preact/preset-vite`, `@cloudflare/vite-plugin`, and a SQLite-backed `WorkspaceDO` Durable Object that imports the **real** `shared/workspace/` code from the Objects repo. Worker routes: `GET/POST /api/workspace` (load/save), `POST /api/tasks` (capture), auth stubbed via `x-owner` header. A minimal Preact client exercises the loop end-to-end in a browser.

## Validated

| Question                                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite+ 0.2.6 + Preact preset + Cloudflare Vite plugin compatible? | **Yes.** App renders, HMR works, both build. The npm override aliasing `vite` → `@voidzero-dev/vite-plus-core` makes plugin peer deps resolve to rolldown-powered Vite 8 by design.                                                                                                                                                                                                                                                    |
| Sync contract preserved on a Durable Object?                     | **Yes — 8/8 contract tests green, inside workerd:** first save → revision 1; retried mutation → acknowledged without advancing revision (older retry does not roll back newer saves); stale full save → `conflict` with current snapshot; stale delta save → reconciled with both changes present; invalid document → `rejected`, stored snapshot untouched; owners isolated; capture → 201 then duplicate → 200; bad time zone → 400. |
| Existing test suite migrates?                                    | **Yes — mechanical.** `repeating.test.ts` (8 tests) passes with a two-line change: `node:test` → vitest import. `node:assert/strict` runs unmodified in workerd via `nodejs_compat`. 16/16 total in ~0.6–2.5 s.                                                                                                                                                                                                                        |
| Bundle size vs. limits?                                          | **Worker upload: 180 KiB / 34.5 KiB gzip** — 1.1% of the 3 MB free-plan limit, with zero packing tricks. Client: 105 KiB / 27.5 KiB gzip as static assets (serving free and unlimited). The 2 MiB problem is gone by construction.                                                                                                                                                                                                     |
| `vp check` usable as the local CI gate?                          | **Yes.** Format + type-aware lint + typecheck in one pass, ~0.8 s, now fully green.                                                                                                                                                                                                                                                                                                                                                    |
| Local dev parity?                                                | **Yes.** `vp dev` runs the worker in real workerd; Durable Object SQLite state persists across dev-server restarts (better than `lakebed dev`, which wipes). `vite preview` equivalent available for built output.                                                                                                                                                                                                                     |
| SPA deep links?                                                  | **Yes**, after two documented config details (below).                                                                                                                                                                                                                                                                                                                                                                                  |

## Gotchas found (fold into the real migration)

1. **Assets delegation pattern:** with a Worker present, non-API routes must `return env.ASSETS.fetch(request)` and the assets config needs `"binding": "ASSETS"` — otherwise SPA deep links 404. The `not_found_handling: "single-page-application"` fallback lives in the assets layer, not the Worker.
2. **DO RPC types must be serializable:** a return type containing `unknown` makes the typed stub collapse to `never` (`Result<R>` resolves to `never` for non-serializable `R`). Use concrete return types on DO methods.
3. **vitest-pool-workers 0.18.x API** is the `cloudflareTest()` Vite plugin in a `vitest.config.ts` — not the older `defineWorkersConfig` from `/config`.
4. **Scaffold tsconfig** needs `"jsx": "react-jsx"` + `"jsxImportSource": "preact"`, `"node"` added to `types` (for `node:assert` in ported tests), and `worker-configuration.d.ts` generated via `wrangler types`.
5. **Vite+ gates dependency install scripts** (workerd, esbuild). Non-blocking: workerd's binary ships in its platform package; approval UI exists if needed.
6. **oxlint `prefer-vite-plus-imports`** auto-rewrites `vitest` imports to `vite-plus/test` on `--fix` — harmless, expect it during the test-suite codemod.

## Decisions confirmed (per the "least code to own" principle)

- **Storage: Durable Object per user** — confirmed by test results; the Lakebed save semantics ported almost line-for-line, and `transactionSync` gives atomicity the Lakebed mutation never explicitly had.
- **CI: local pipeline is complete today** (`vp check && vp test --run && vp build && wrangler deploy --dry-run`). Remote wrapper deferred to Phase 5.
- **Auth providers: defer to Phase 3**; WorkOS email + magic link first, socials are dashboard toggles.

## Reproduce

```sh
cd ~/Code/objects-cloudflare-spike
export PATH="$HOME/.vite-plus/bin:$PATH"
vp check && vp test --run && vp build
vp exec wrangler deploy --dry-run --outdir /tmp/spike-dryrun   # prints 34.46 KiB gzip
vp dev --port 5199                                             # browse http://localhost:5199
```
