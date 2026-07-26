# Objects deployment runbook

This document is the complete operational record for deploying Objects from this repository. It covers account setup and manual configuration, not the historical platform migration.

## Current production identity

| Item                         | Value                                                      |
| ---------------------------- | ---------------------------------------------------------- |
| Canonical URL                | `https://objects.chrismin13.com`                           |
| Cloudflare fallback URL      | `https://objects.accounts-7ac.workers.dev`                 |
| Cloudflare Worker name       | `objects`                                                  |
| Cloudflare Worker account ID | `7aca962f0f68a70337f902201db6b961`                         |
| Cloudflare DNS zone          | `chrismin13.com`                                           |
| Cloudflare zone ID           | `7d097de252f1c7c917439866475c882b`                         |
| WorkOS client ID             | `client_01KYCD74DQYZY1A1B6V4NBGQBV`                        |
| Session cookie               | `objects_session`, httpOnly, Secure, SameSite=Lax, 30 days |

The IDs above are identifiers, not credentials. Wrangler normally discovers them from the authenticated account and `wrangler.jsonc`.

## What is code-defined and what is manual

`wrangler.jsonc` declares:

- Worker name and entry point;
- static asset binding and SPA fallback;
- Worker-first `/api/*` and `/auth/*` routing;
- one SQLite Durable Object binding and its `v1` migration;
- public WorkOS client ID;
- `objects.chrismin13.com` as a Workers custom domain.

The following are intentionally **not** in Git and must exist outside the repository:

- a Cloudflare account containing the `chrismin13.com` zone;
- a WorkOS account/environment with AuthKit configured;
- Cloudflare secrets `WORKOS_API_KEY` and `WORKOS_COOKIE_PASSWORD`;
- matching values in local `.dev.vars`;
- WorkOS callback URI allow-list entries;
- Cloudflare and WorkOS login sessions for administrators.

There is no Terraform/Pulumi layer. The application infrastructure is small enough that `wrangler.jsonc` plus the steps below are the infrastructure record.

## Accounts and free-plan guardrails

1. Create or use a Cloudflare account and keep it on the Workers Free plan. Do not enable a paid Workers plan or add a payment method merely for this app.
2. Add `chrismin13.com` as a Cloudflare zone and move the domain's authoritative nameservers to the pair Cloudflare provides.
3. Create a WorkOS account/environment. The current application uses AuthKit only; it does not require WorkOS organizations, directory sync, or paid add-ons.
4. Keep the repository in GitHub for source control. GitHub Pages is not used; the app itself is the root experience at `objects.chrismin13.com`.

Check usage in the Cloudflare dashboard periodically if the app gains more users. The architecture was selected to fit the Workers/Durable Objects free allowances, but quotas can change.

## WorkOS configuration

In the WorkOS dashboard:

1. Create/configure an AuthKit application.
2. Enable the desired login methods (the current production flow has already been verified through hosted AuthKit).
3. Record the environment's **client ID** in `wrangler.jsonc` as `WORKOS_CLIENT_ID`. This value is public.
4. Copy the WorkOS API key for the same environment. It becomes the secret `WORKOS_API_KEY`; never commit it.
5. Add these redirect URIs as needed:
   - `https://objects.chrismin13.com/auth/callback` — canonical production;
   - `https://objects.accounts-7ac.workers.dev/auth/callback` — fallback production URL;
   - `http://localhost:5173/auth/callback` — normal local Vite origin. If `vp dev` prints another origin, register that exact origin instead.

The Worker derives its callback URI from the incoming request origin. A new hostname therefore requires a matching WorkOS redirect URI before sign-in will work there.

Objects exchanges the one-time authorization code with WorkOS, then seals the returned user identity into its own cookie. Normal API requests do not call WorkOS. Rotating `WORKOS_API_KEY` does not invalidate existing Objects sessions; rotating `WORKOS_COOKIE_PASSWORD` signs everyone out.

## Local setup from a fresh clone

Install Vite+ once if `vp` is not available:

```sh
curl -fsSL https://vite.plus | bash
export PATH="$HOME/.vite-plus/bin:$PATH"
```

Install the lockfile-pinned dependencies:

```sh
vp install
```

Create `.dev.vars` (gitignored):

```dotenv
WORKOS_API_KEY=sk_...
WORKOS_COOKIE_PASSWORD=a-random-secret-at-least-32-characters-long
```

Generate a suitable cookie password with:

```sh
openssl rand -base64 32
```

Start the client and local workerd runtime:

```sh
vp dev
```

Local SQLite Durable Object state is under `.wrangler/state` and persists across dev-server restarts. Delete that directory only when intentionally resetting local data.

## First Cloudflare deployment from scratch

These steps assume the repository is complete but the Worker does not yet exist.

1. Authenticate Wrangler with the Cloudflare account that owns the zone:

   ```sh
   vp exec wrangler login
   ```

2. Run the exact local gate and build:

   ```sh
   vp exec wrangler types
   vp check
   vp test --run
   vp build
   ```

3. Ensure `objects.chrismin13.com` has no manually managed A, AAAA, or CNAME record. The `custom_domain` entry in `wrangler.jsonc` creates and owns the required DNS record. An old DNS record causes Cloudflare API error `100117` / HTTP `409`.

4. Create the Worker and Durable Object migration:

   ```sh
   vp exec wrangler deploy
   ```

5. Add both production secrets interactively:

   ```sh
   vp exec wrangler secret put WORKOS_API_KEY
   vp exec wrangler secret put WORKOS_COOKIE_PASSWORD
   ```

6. Deploy once more and verify using the commands below:

   ```sh
   vp build
   vp exec wrangler deploy
   ```

**Always run `vp build` before `wrangler deploy`.** The Cloudflare Vite plugin generates `dist/objects/wrangler.json`; deploying without rebuilding can use stale routes or bindings even when the root `wrangler.jsonc` was edited.

## Routine redeployment

Redeploying the same Worker does not erase Durable Object data. Keep the same Cloudflare account, Worker name (`objects`), Durable Object class (`WorkspaceDO`), binding, and migration history.

```sh
git pull --ff-only
export PATH="$HOME/.vite-plus/bin:$PATH"
vp install
vp exec wrangler types
vp check
vp test --run
vp build
vp exec wrangler deploy
```

Do not delete and recreate the Worker as a normal recovery technique. Deleting the Worker or changing Durable Object identity can orphan or destroy access to production workspaces.

## Verification

Public shell and PWA files:

```sh
curl -fsSI https://objects.chrismin13.com/
curl -fsSI https://objects.chrismin13.com/manifest.webmanifest
curl -fsSI https://objects.chrismin13.com/sw.js
```

Expected: all return 200; the manifest is `application/manifest+json`; `sw.js` is JavaScript, not SPA HTML.

Private routes must remain private:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://objects.chrismin13.com/api/me
curl -sS -o /dev/null -w '%{http_code}\n' https://objects.chrismin13.com/api/workspace
```

Expected without a cookie: `401` for both.

Auth redirect:

```sh
curl -sSI https://objects.chrismin13.com/auth/login | grep -i '^location:'
```

Expected: a WorkOS authorization URL whose `redirect_uri` is `https://objects.chrismin13.com/auth/callback`.

Finally, sign in in a browser, create a temporary to-do, reload, and confirm persistence. A session from the workers.dev hostname is not shared with the custom domain, so the first custom-domain test requires a fresh sign-in.

## Operations and diagnosis

```sh
vp exec wrangler secret list       # names only; Cloudflare never returns values
vp exec wrangler deployments list
vp exec wrangler versions list
vp exec wrangler tail              # live Worker logs
```

To roll traffic back to a known version shown by `versions list`:

```sh
vp exec wrangler versions deploy VERSION_ID@100% -y
```

A code rollback does not roll back Durable Object contents. The sync protocol is designed to keep stored Workspace documents forward-compatible; still, export a current JSON backup from **Settings → Data** before any risky storage/schema change.

## Secret and account recovery

- Lost WorkOS API key: issue a replacement in WorkOS and run `wrangler secret put WORKOS_API_KEY`.
- Lost cookie password: generate and set a replacement; all users must sign in again, but workspace data remains keyed by their stable WorkOS user ID.
- Lost local `.dev.vars`: recreate it from the two secret sources; it is intentionally not recoverable from Git or Cloudflare.
- Lost Cloudflare administrator access: recover the Cloudflare account that owns account ID `7aca962f0f68a70337f902201db6b961`. Deploying to another account creates different Durable Object storage and will appear empty.
- Lost WorkOS environment: restoring the same user IDs matters for access to existing Durable Objects. A new WorkOS environment usually issues different IDs, so imported JSON backup is the practical recovery path.

## Domain and GitHub Pages

`objects.chrismin13.com` is attached directly to the Worker through `custom_domain`; do not point it at the workers.dev URL with a CNAME. Cloudflare manages the DNS record and TLS certificate.

The old static marketing site was deleted from `docs/`. In GitHub repository settings, set **Pages → Build and deployment → Source** to **None** (or otherwise disable Pages) so GitHub does not attempt to republish it.
