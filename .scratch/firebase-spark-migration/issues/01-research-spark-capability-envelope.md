# Establish the Firebase Spark capability envelope

Type: research
Status: resolved
Blocked by: none

## Question

Using current official Firebase and Google Cloud documentation, which Hosting, Authentication, Firestore, Security Rules, emulator, custom-domain, CLI, and CI/CD capabilities are available with no billing account attached, what quotas and hard limits apply, which apparently relevant capabilities require Blaze, and what constraints must the destination design treat as non-negotiable?

## Answer

Research current as of 2026-07-25. This is a documentation-based capability envelope; no Firebase or Google Cloud resources were created.

### Result

The destination is feasible on Spark only as a static, direct-client application: Firebase Hosting serves the built application, Firebase Authentication supplies Google Sign-In, and the web client reads and writes one Cloud Firestore database under Security Rules. Local development and integration tests can use the Authentication, Firestore, and Hosting emulators. The design cannot depend on deployed server code, Cloud Storage for Firebase, App Hosting, paid Google Cloud services, managed Firestore recovery features, or automatic paid overage.

Spark is not a spend cap. For products with paid tiers, Spark supplies finite no-cost quota and then restricts or disables service instead of charging. Linking any Cloud Billing account automatically changes the project to Blaze and violates this map's constraint.

### Capability envelope

| Area                                  | Available without billing                                                                                                                                                                                                                          | Limits and design consequence                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firebase Hosting                      | Static and single-page hosting, global CDN, `web.app`/`firebaseapp.com` domains, custom domains, Firebase-managed TLS, redirects, rewrites to static content, headers, rollbacks of the live channel, and preview channels                         | Hosting storage is 10 GB across retained releases. At the limit, Spark cannot deploy until old releases are deleted. CDN data transfer is 10 GB/month; after a short grace period, Spark sites are disabled for the rest of the month. Spark blocks hosting certain executable file types, including `.exe`, `.dll`, `.bat`, `.apk`, and `.ipa`.                                                                              |
| Custom domain                         | Supported on Hosting with ownership verification and Firebase-managed certificates                                                                                                                                                                 | One custom domain connects to one Hosting site. Spark supports `GROUPED` certificates, not `PROJECT_GROUPED` or `DEDICATED`. DNS ownership and CAA records must remain present for certificate operation and renewal. Cloudflare records should begin DNS-only.                                                                                                                                                               |
| Hosting previews                      | Shareable preview URLs, CLI deploys, version cloning, and GitHub pull-request integration are available                                                                                                                                            | Preview channels are beta, public to anyone with the URL, use the real project backend, expire after 7 days by default, and can be set no later than 30 days from deployment. They are not isolated staging environments and preview rollback is unavailable.                                                                                                                                                                 |
| Firebase Authentication               | Google Sign-In and other social providers are no-cost Firebase features on Spark. Registered accounts are unlimited                                                                                                                                | General limits include 100 new accounts/hour/IP, 10 deletions/second, one batch-deletion request/second, and 10 configuration updates/second. Limits can change without notice and abuse protections can activate without warning. The destination needs only standard Google Sign-In; it does not need Identity Platform features.                                                                                           |
| Authentication with Identity Platform | Identity Platform can itself operate instrumentlessly on Spark                                                                                                                                                                                     | Spark Identity Platform is limited to 3,000 Tier-1 DAU/day and 2 Tier-2 DAU/day. Terraform's documented Identity Platform configuration path separately requires Blaze, so this availability does not make that Terraform path eligible. MFA, blocking functions, SAML/OIDC, multi-tenancy, and similar enterprise features are outside the destination requirement.                                                          |
| Cloud Firestore                       | Exactly one database receives free quota: 1 GiB stored data, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB/month outbound transfer                                                                                           | Daily quotas reset around midnight Pacific. Additional databases do not receive free quota. The app must remain below quota without relying on overage. TTL deletes, PITR, backups, restores, clones, and managed export/import require billing.                                                                                                                                                                              |
| Firestore Security Rules              | Rules can enforce authentication, ownership, field validation, immutable fields, allowed field sets, and query-compatible access; rules deploy through Firebase CLI                                                                                | `exists()`, `get()`, and `getAfter()` calls are limited to 10 for a single-document request or query, and 20 for multi-document reads, transactions, and batches while retaining the 10-per-operation limit. Other limits include nested `match` depth 10, path length 100, 20 captures, function depth 20, 7 arguments, 10 `let` bindings, no recursion, 1,000 expressions/request, 256 KB source, and 250 KB compiled size. |
| App Check                             | App Check is a no-cost Firebase product and supports Firestore enforcement for web apps using reCAPTCHA v3 or reCAPTCHA Enterprise                                                                                                                 | Enforcement must be enabled only after monitoring valid-token adoption. reCAPTCHA Enterprise without billing is capped at 10,000 assessments/month; `CreateAssessment` fails closed with `429` beyond that quota. Enterprise tokens default to a one-hour TTL and refresh around half-TTL, so traffic can consume roughly two assessments per continuously active browser-hour. Shorter TTLs consume quota faster.            |
| Local Emulator Suite                  | Authentication, Firestore, Hosting, and Security Rules testing can run locally and in CI. Auth supports mock third-party identities; emulator data can be imported/exported; `emulators:exec` starts services, runs a test command, and stops them | Use one explicit demo project ID and explicit emulator connections so accidental fallback cannot touch production. JDK 11 or newer is required for Java-based emulators. The Firestore emulator does not track compound indexes, does not reproduce all transaction behavior, and does not enforce every production limit, so emulator success is necessary but not proof of production compatibility.                        |
| Firebase CLI and CI/CD                | Repository-owned `firebase.json`, `.firebaserc`, rules, indexes, Auth provider configuration, Hosting config, emulator config, and workflow commands can be used locally and in GitHub Actions                                                     | The official Hosting GitHub setup creates a service account, uploads its long-lived JSON key as a GitHub secret, and writes workflows. Firebase recommends Application Default Credentials generally and treats `FIREBASE_TOKEN` as legacy. The strict-no-billing short-lived Google credential path remains unresolved, so deployment credentials require a later authority-boundary decision.                               |

### Quota and failure model

- Hosting storage includes retained versions from live and preview releases. Release-retention limits and preview cleanup are operational requirements, not optional housekeeping.
- Hosting data transfer exhaustion can take the entire production site offline until the next month. The design needs monitoring and a documented quota-exhaustion response; there is no Spark overage switch that preserves service without violating the billing constraint.
- Firestore reads include query results, listener updates, rule-dependent document reads, and at least one read for a query that returns no documents. Detailed read amplification, offline listener behavior, and document limits belong to the Firestore research ticket.
- Authentication abuse controls are intentionally variable. Account count being unlimited does not imply unlimited sign-in throughput.
- App Check protects against unauthorized clients but does not replace Authentication or Security Rules. Enterprise quota exhaustion can reject legitimate clients, so provider and TTL selection must account for the 10,000-assessment ceiling.

### Delivery constraints

- Production must be a static Firebase Hosting deployment. Hosting rewrites to Cloud Functions or Cloud Run cannot be used because those backends require billing.
- Preview URLs must not be treated as staging: they are public and use production Authentication and Firestore unless the application itself is configured otherwise. Given the map's one-production-environment rule, pull-request validation should primarily build and test against emulators; any hosted preview must be explicitly safe against production data.
- The same repository command can wrap build, emulator tests, rules validation, and Firebase CLI deployment locally and in CI. Credential acquisition may differ by environment, but the invoked validation/deployment behavior should not.
- CI must not blindly adopt `firebase init hosting:github`, because its generated long-lived service-account key conflicts with the preferred short-lived credential posture. The later authority-boundary decision must either prove WIF without billing or explicitly accept and constrain a key.

### Blaze-only or otherwise excluded

- Cloud Functions can be emulated on any plan, but production deployment requires Blaze.
- Firebase App Hosting requires Blaze.
- Since 2026-02-03, Cloud Storage for Firebase requires Blaze even for access to an existing default bucket. Spark bucket calls return `402` or `403`.
- Cloud Run, Pub/Sub, Secret Manager, and other paid Google Cloud products are unavailable as destination dependencies on Spark.
- Firestore paid overage, additional free databases, TTL processing, PITR, managed backups/restores, cloning, and managed export/import are unavailable.
- Hosting storage or transfer overage is unavailable; Spark restricts deploys or disables the sites instead.
- reCAPTCHA Enterprise usage above its instrumentless monthly quota requires billing; without billing, assessment creation fails rather than accruing charges.
- The Terraform-managed Authentication/Identity Platform path is excluded because Firebase's Terraform guide requires a Blaze project for it, even though an already-upgraded Identity Platform project has a limited instrumentless Spark tier.

### Non-negotiable destination constraints

1. Use Firebase Hosting, standard Google Sign-In, one Firestore database, Security Rules, and direct web SDK access; do not introduce a production server runtime.
2. Keep the Google Cloud project detached from every Cloud Billing account and verify that invariant in provisioning and release checks.
3. Design normal and worst-case usage below Hosting, Firestore, Authentication, and selected App Check provider quotas; document service behavior at each ceiling.
4. Store no user files in Cloud Storage for Firebase. Any retained JSON import/export flow must run client-side using browser file APIs and Firestore writes.
5. Treat Security Rules as the production authorization and validation boundary. Test them against deterministic emulator identities and stay within rule-access limits.
6. Use explicit emulator endpoints and a demo project ID locally and in CI. Do not allow local tests to fall through to production services.
7. Treat hosted preview channels as public views backed by production resources, not as staging. Prefer emulator-backed CI for pull requests.
8. Keep Hosting release retention bounded and monitor both Hosting transfer/storage and Firestore operation/storage usage.
9. Exclude any feature whose only documented implementation requires Functions, App Hosting, Storage, paid Google Cloud services, or paid Firestore operations.
10. Resolve CI identity before implementation; do not silently generate or commit a service-account key.

### Primary sources

- Firebase pricing plans and Spark shutdown behavior: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Firebase product pricing table: https://firebase.google.com/pricing
- Hosting usage, quotas, and pricing: https://firebase.google.com/docs/hosting/usage-quotas-pricing
- Hosting custom domains: https://firebase.google.com/docs/hosting/custom-domain
- Hosting preview behavior: https://firebase.google.com/docs/hosting/test-preview-deploy and https://firebase.google.com/docs/hosting/manage-hosting-resources
- Hosting GitHub integration: https://firebase.google.com/docs/hosting/github-integration
- Authentication limits: https://firebase.google.com/docs/auth/limits
- Google Sign-In for web: https://firebase.google.com/docs/auth/web/google-signin
- Authentication provider configuration with Firebase CLI: https://firebase.google.com/docs/auth/configure-providers-cli
- Firestore free quota and hard limits: https://firebase.google.com/docs/firestore/quotas
- Firestore pricing and managed export/import prerequisites: https://firebase.google.com/docs/firestore/pricing and https://firebase.google.com/docs/firestore/manage-data/export-import
- Security Rules behavior and limits: https://firebase.google.com/docs/rules/rules-behavior
- Emulator installation, CI, and persistence: https://firebase.google.com/docs/emulator-suite/install_and_configure
- Firestore emulator differences: https://firebase.google.com/docs/emulator-suite/connect_firestore
- Authentication emulator: https://firebase.google.com/docs/emulator-suite/connect_auth
- App Check overview and web providers: https://firebase.google.com/docs/app-check, https://firebase.google.com/docs/app-check/web/recaptcha-provider, and https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- reCAPTCHA quota behavior without billing: https://cloud.google.com/recaptcha/quotas
- Cloud Functions deployment plan requirement: https://firebase.google.com/docs/functions/get-started
- App Hosting plan requirement: https://firebase.google.com/docs/app-hosting/get-started
- Cloud Storage for Firebase billing requirement: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
