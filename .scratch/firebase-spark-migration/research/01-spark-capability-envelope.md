# Firebase Spark Feasibility Report

**Scope:** Firebase Hosting, Google Authentication, Firestore, Security Rules, emulators, custom domains, CLI, and GitHub CI/CD without a billing account.  
**Current as of:** 2026-07-25.

## Conclusion

A production, static, offline-capable PWA can run on Firebase Spark with:

- Classic Firebase Hosting
- An owned custom domain and automatic HTTPS
- Google sign-in through Firebase Authentication
- One Firestore database
- Client-side offline persistence and synchronization
- Security Rules
- Local emulators
- GitHub Actions deployments and PR previews

The main constraints are hard service cutoffs, no managed backups, and no server-side Firebase runtime. Cloud Functions, Cloud Run, Firebase App Hosting, managed Firestore export/import, TTL, PITR, backups, restores, and clones require billing/Blaze.

## Capability Matrix

| Capability                         | Spark without billing | Important constraint                                                        |
| ---------------------------------- | --------------------: | --------------------------------------------------------------------------- |
| Classic Firebase Hosting           |                   Yes | 10 GB stored content and 10 GB/month transfer                               |
| Custom domain and SSL              |                   Yes | Domain registration is external; certificate provisioning can take 24 hours |
| Google Authentication              |                   Yes | Abuse/rate protections still apply                                          |
| Firestore                          |                   Yes | Exactly one free database and fixed quotas                                  |
| Firestore offline sync             |                   Yes | Web persistence is opt-in; conflicts are last-write-wins                    |
| Firestore Security Rules           |                   Yes | Queries must conform to Rules; Rules have complexity limits                 |
| Local Emulator Suite               |                   Yes | Not fully production-equivalent                                             |
| Firebase CLI                       |                   Yes | Commands remain subject to each product's plan restrictions                 |
| GitHub PR previews                 |                   Yes | Public URLs connected to the real backend                                   |
| GitHub production deploys          |                   Yes | Requires deployment credentials                                             |
| Cloud Functions                    |         No deployment | Local emulation works; production deployment requires Blaze                 |
| Firebase App Hosting               |                    No | Requires Blaze                                                              |
| Cloud Run/dynamic Hosting rewrites |                    No | Paid Google Cloud service                                                   |
| Managed Firestore export/import    |                    No | Explicitly requires Blaze                                                   |
| Firestore TTL/PITR/backups         |                    No | Billing must be enabled                                                     |

## Hosting

Classic Firebase Hosting is available on Spark for static assets and SPAs. It includes a global CDN and Firebase-provided `web.app` and `firebaseapp.com` domains.

The current dedicated Hosting quota page states:

- 10 GB of Hosting storage
- 10 GB/month CDN transfer
- 2 GB maximum per individual file
- Quotas are shared across all sites and preview channels in the project
- Up to 36 Hosting sites per project

At 10 GB stored content, Spark blocks new deployments until older releases are deleted. At 10 GB/month transfer, Firebase offers a short grace period and then disables the sites until the next month or an upgrade to Blaze. Spark does not generate overage charges.  
Source: https://firebase.google.com/docs/hosting/usage-quotas-pricing  
Multisite limit: https://firebase.google.com/docs/hosting/multisites

Spark also blocks hosting certain executable formats, including `.exe`, `.dll`, `.bat`, `.apk`, and `.ipa`. This does not affect a normal PWA.  
Source: https://firebase.google.com/docs/hosting/faq-and-troubleshooting

### Releases and previews

Every deploy creates a release and stored version. Retained versions count toward the 10 GB project storage quota. Release retention can be adjusted per channel.

Preview channels:

- Are public to anyone who knows the URL
- Use the real Firebase backend
- Expire after seven days by default
- Can be configured for up to 30 days from deployment
- Are scheduled for deletion within 24 hours after expiry
- Are beta and have no SLA

The live channel never expires.  
Sources:

- https://firebase.google.com/docs/hosting/manage-hosting-resources
- https://firebase.google.com/docs/hosting/test-preview-deploy

## Custom Domain

Spark supports custom domains with automatically provisioned and renewed SSL certificates.

Constraints include:

- A custom domain can connect to only one Hosting site
- Firebase recommends no more than 20 subdomains per apex domain because of certificate-minting limits
- DNS verification and certificate provisioning can each take up to 24 hours
- The ownership TXT record should remain in DNS so Firebase can renew certificates

Source: https://firebase.google.com/docs/hosting/custom-domain

## Google Authentication

Firebase's pricing-plan documentation classifies social sign-in, including Google sign-in, as a no-cost Authentication feature usable in production on Spark. Registered user accounts are documented as unlimited. New account creation is limited to 100 accounts/hour per source IP, with additional abuse protections that can change without notice.

Sources:

- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/limits

Authentication state persists across browser closure by default on web. ID tokens last one hour and are refreshed through refresh tokens. Refresh tokens normally remain valid until the user is disabled/deleted, a major account change occurs, or tokens are revoked.

Sources:

- https://firebase.google.com/docs/auth/web/auth-state-persistence
- https://firebase.google.com/docs/auth/admin/manage-sessions

For redirect-based Google sign-in on a Firebase Hosting custom domain, configure that custom domain as `authDomain`. This keeps the authentication helper on the same domain and avoids modern browser third-party-storage restrictions. Popup sign-in is another option, subject to popup blockers.  
Source: https://firebase.google.com/docs/auth/web/redirect-best-practices

### Identity Platform distinction

The documented Spark limits of 3,000 Tier-1 DAU/day and 2 Tier-2 DAU/day explicitly apply to **Firebase Authentication with Identity Platform**, not ordinary Firebase Authentication. Do not apply those figures to basic Google sign-in unless the project has been upgraded to Identity Platform.  
Source: https://firebase.google.com/docs/auth/limits

## Firestore

Spark provides exactly one free Firestore database per project:

| Resource          |  Spark quota |
| ----------------- | -----------: |
| Stored data       |        1 GiB |
| Reads             |   50,000/day |
| Writes            |   20,000/day |
| Deletes           |   20,000/day |
| Outbound transfer | 10 GiB/month |

Daily quotas reset around midnight Pacific time. Exceeding them does not incur charges on Spark; operations fail until the relevant quota resets or billing is enabled.

Important hard limits include:

- 1 MiB maximum document size
- 100 maximum subcollection depth
- 20 maximum nested map/array depth
- 10 MiB maximum API request size
- 200 composite indexes without billing
- 200 single-field configurations without billing
- 40,000 index entries per document

Source: https://firebase.google.com/docs/firestore/quotas

### Blaze-only Firestore operations

Billing is required for:

- Additional databases beyond the single free database
- TTL deletes
- Point-in-time recovery data
- Backup data
- Restore operations
- Clone operations
- Managed export and import

Sources:

- https://firebase.google.com/docs/firestore/quotas
- https://firebase.google.com/docs/firestore/manage-data/export-import

This means Spark has no managed disaster-recovery mechanism. An application-level export written by the client is possible, but it consumes reads and is not an atomic database snapshot.

## Offline Editing

Firestore supports cached reads, queries, listeners, and queued writes. When connectivity returns, local changes synchronize with the backend. For multiple changes to the same document, conflict resolution is last-write-wins.

On web:

- Persistence is disabled by default
- Persistent cache support is limited to documented browsers, currently Chrome, Safari, and Firefox
- Persistent cache is not automatically cleared between sessions
- Sensitive data should only be persisted after obtaining user trust or consent

Transactions fail while offline because they require current server state. Batched writes can be queued and executed offline.

Sources:

- https://firebase.google.com/docs/firestore/manage-data/enable-offline
- https://firebase.google.com/docs/firestore/manage-data/transactions

For Objects, offline updates should therefore use idempotent writes or batched writes rather than requiring transactions. If edit conflicts matter, store explicit revisions, operation records, or timestamps instead of relying solely on document-level last-write-wins.

## Security Rules

Firestore mobile and web clients are protected by Security Rules. Rules should verify authentication, ownership, permitted field changes, and document shape.

Queries are not post-filtered by Rules. A query must prove that every possible result is allowed, so query structure and indexes must align with the authorization model.

Server SDKs bypass Firestore Security Rules and use IAM. That distinction matters if a server is added later.  
Sources:

- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/firestore/security/rules-query
- https://firebase.google.com/docs/firestore/security/rules-structure

Relevant Rules limits include:

- 10 `get()`, `exists()`, or `getAfter()` calls for single-document requests and queries
- 20 calls for multi-document reads, transactions, and batched writes, while retaining the 10-call limit per operation
- 1,000 evaluated expressions per request
- 20 function-call depth
- 256 KB source ruleset
- 250 KB compiled ruleset
- No recursive or cyclical function calls

Source: https://firebase.google.com/docs/firestore/quotas

## Emulators

The Local Emulator Suite supports Hosting, Authentication, Firestore, and Security Rules without Blaze. The Authentication Emulator can mock Google and other third-party providers.

The documented prerequisites are:

- Firebase CLI 8.14 or newer
- Node.js 16 or newer
- Java JDK 11 or newer for Java-based emulators

`firebase emulators:exec` is intended for CI. Emulator data can be imported, exported, or automatically exported on shutdown.  
Source: https://firebase.google.com/docs/emulator-suite/install_and_configure

Limitations include:

- Firestore emulator data is cleared at shutdown unless exported
- Compound-index requirements are not enforced
- Not all production size and transaction limits are enforced
- Transaction locking and timing can differ from production
- Authentication Emulator tokens are unsigned and must never be accepted in production

Sources:

- https://firebase.google.com/docs/emulator-suite/connect_firestore
- https://firebase.google.com/docs/emulator-suite/connect_auth

Emulator tests should be supplemented by a limited production smoke test because successful emulator queries do not prove that every required composite index exists.

## CLI and GitHub CI/CD

The Firebase CLI can initialize, emulate, test, and deploy Hosting and Rules on Spark. The CLI itself does not require billing; the target product determines whether a command is permitted.  
Source: https://firebase.google.com/docs/cli

The official Hosting GitHub integration:

- Creates a preview channel for each pull request
- Comments the preview URL on the PR
- Updates the same preview URL on subsequent commits
- Can deploy to the live channel after merge
- Requires repository administrator access during setup
- Creates a Firebase service account
- Stores its JSON key as an encrypted GitHub secret
- Writes GitHub Actions workflow files

Source: https://firebase.google.com/docs/hosting/github-integration

Because previews use the real backend, preview builds must not use permissive production Rules or assume the URL is private.

The generated integration uses a long-lived service-account JSON key. For a manually maintained workflow, Firebase now recommends Application Default Credentials for CI. GitHub OIDC/workload identity is preferable where available because it avoids a permanent key.  
Source: https://firebase.google.com/docs/cli#cli-ci-systems

## Expiration and Inactivity

Documented expiration behavior is limited to temporary resources and credentials:

- Live Hosting channels never expire
- Preview channels expire after seven days by default, configurable up to 30 days
- Auth ID tokens expire after one hour and are refreshed
- Emulator state disappears on shutdown unless exported

Firebase's current product documentation does not state that an otherwise valid Spark Hosting site, Firestore database, or Authentication user database is automatically deleted merely because the project is inactive. This is an absence of a documented inactivity policy, not a contractual permanence guarantee.

## Documentation Uncertainties

### Hosting transfer discrepancy

The dedicated Hosting quota page, updated 2026-07-10, says **10 GB/month**. Some generic Firebase pricing presentations have historically shown **360 MB/day**.

The dedicated, newer product quota page is the strongest operational source, so 10 GB/month is the best current figure. Until the generic pricing display is fully consistent, monitor the Firebase Hosting Usage dashboard rather than assuming either counter is purely informational.

Sources:

- https://firebase.google.com/docs/hosting/usage-quotas-pricing
- https://firebase.google.com/pricing

### Authentication DAU limits

The 3,000/2 DAU limits are clearly scoped to Authentication **with Identity Platform**. Firebase's pricing-plan documentation separately describes ordinary social sign-in as fully no-cost. The project should remain on basic Firebase Authentication unless an Identity Platform-specific feature is required.

## Architectural Implications

1. Use classic Firebase Hosting, not Firebase App Hosting.
2. Keep the application fully static and client-driven; no Firebase Functions or Cloud Run.
3. Use Google Authentication with the custom Hosting domain configured as `authDomain`.
4. Use one Firestore database with owner-scoped documents and strict Security Rules.
5. Enable persistent Firestore caching deliberately and warn users on shared devices.
6. Model offline writes without transactions; add revision metadata where last-write-wins is insufficient.
7. Keep read amplification low because 50,000 reads/day is the likely first scaling constraint.
8. Build a client-side export/import feature because Spark has no managed backups.
9. Run Authentication, Firestore, Hosting, and Rules emulators in CI, followed by a small production smoke test.
10. Expire PR previews promptly because they consume Hosting storage and access the real backend.
11. Monitor Hosting transfer and Firestore operations because Spark failures are hard cutoffs, not graceful paid overages.
