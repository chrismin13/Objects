# Wayfinder: Specify the Firebase Spark destination

## Destination

Produce an execution-ready design for moving Objects from Lakebed to Firebase Spark, with no unresolved architectural, infrastructure, security, data, delivery, migration, validation, rollback, or cutover decisions. This map plans the move only: it creates no provider resources and changes no application behavior.

## Notes

- Keep Firebase on Spark with no billing account attached; reject any required capability that depends on Blaze.
- Allow manual work only for unavoidable account login, consent, and credential bootstrap. Everything repeatable afterward should be represented in repository-owned code or configuration.
- Use the existing owned domain with Cloudflare DNS.
- Target one production environment plus local Firebase emulators; do not create a standing staging environment.
- Support equivalent local and GitHub Actions workflows through the same repository-owned commands.
- Use Google sign-in in production and deterministic Firebase Auth Emulator identities locally.
- Retain the current visual interface and portable domain model, while explicitly deciding which product behaviors remain.
- Preserve installability and offline edits, but permit the synchronization implementation to change.
- Existing users migrate through self-service JSON export and import rather than account linking.
- Use the vocabulary in `CONTEXT.md`, especially "to-do" rather than "task."
- Planning only. Do not provision infrastructure, modify application code, migrate data, or deploy anything while resolving this map.

## Decisions so far

- The Spark destination is viable only as a static direct-client system: Firebase Hosting, standard Google Sign-In, one Firestore database, Security Rules, optional App Check, and local emulators are available without billing. Production Functions, App Hosting, Cloud Storage for Firebase, paid Google Cloud services, Firestore managed recovery/export features, and all automatic overage are excluded. Hosting previews are public and use the real backend, so they are not staging. ([research](issues/01-research-spark-capability-envelope.md))
- Declarative infrastructure coverage is broad but necessarily split: Terraform/OpenTofu can own most provider resources, Firebase CLI must own Spark Authentication and deployable Firebase config, Hosting owns certificates, and Cloudflare DNS follows Hosting's computed records. Authorized-domain PATCH behavior and Google WIF remain unproven without billing; HCP Terraform Free is the only verified shared-state candidate that does not itself require Google or Cloudflare billing. ([research](issues/02-research-declarative-infrastructure-coverage.md))
- The behavioral core is already portable behind `WorkspaceSyncAdapter`; Lakebed coupling is confined to identity, transport/storage, five server operations, PWA response delivery, deployment metadata, and size-driven runtime packaging. Current compatibility requires revisioned idempotent delta sync, owner-scoped offline replay, and acceptance of the shipped legacy `InterfaceState` Settings backup, which differs from the domain's `objects-workspace` v1 format. ([research](issues/03-research-current-platform-coupling.md))
- Firestore supplies direct-client atomic commits, realtime listeners, and optional persistent offline writes, but its 1 MiB document limit excludes the current maximum workspace, same-document offline conflicts are last-write-wins, and Security Rules cannot execute the domain validator or generically validate nested collections. Spark has no managed production backup/export, so preserving current sync and recovery requires explicit application protocols within Rules and quota limits. ([research](issues/04-research-firestore-constraints.md))

## Not yet specified

- Feature-scope decisions may expose feature-specific persistence, validation, or migration questions.
- The exact execution-ticket breakdown cannot be finalized until the architecture, infrastructure, and cutover decisions are resolved.

## Out of scope

- Implementing, provisioning, deploying, or migrating as part of this Wayfinder map.
- A visual redesign or wholesale interface rewrite.
- Attaching a billing account or relying on Blaze-only services.
- Production anonymous identities or transparent Lakebed-to-Firebase account linking.
- A permanent hosted staging environment.
- Purchasing or transferring a domain; the plan uses the domain already owned and its existing Cloudflare DNS zone.
