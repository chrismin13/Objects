# Firebase Spark Declarative Infrastructure Coverage

**Research date:** 2026-07-25  
**Constraints:** Firebase Spark, no Cloud Billing account attached, existing Cloudflare DNS zone, local development plus GitHub Actions. No resources were provisioned and no files were changed.

## Executive Summary

Most infrastructure can be reproducibly managed, but not through one pure Terraform/OpenTofu graph:

- Project creation, API enablement, Firebase enablement, Web App registration, Firestore, Hosting, Cloudflare DNS, service accounts, service identities, and IAM have Terraform provider resources.
- Spark-compatible Authentication provider configuration belongs in `firebase.json` and is deployed with Firebase CLI. Firebase's documented Terraform Authentication path requires Identity Platform and Blaze.
- Firebase Auth `authorizedDomains` is the primary automation gap. The Identity Toolkit API exposes the field, but official documentation does not confirm that mutating it works on an ordinary Spark Firebase Auth project.
- Hosting custom domains are Terraform-manageable, but Firebase computes the required DNS records asynchronously. Cloudflare reconciliation therefore needs at least two phases.
- Hosting owns certificate creation, renewal, and replacement. Spark supports only the `GROUPED` certificate type.
- Google WIF resources are declarative, but Google's official deployment-pipeline guide instructs users to verify that billing is enabled. Strict no-billing eligibility is therefore **uncertain**.
- GitHub Actions secrets can hold Cloudflare, HCP, or fallback Google credentials. Firebase web configuration is public by design and is not a secret.
- HCP Terraform Free is the only documented shared-state candidate considered here that does not itself require a Google or Cloudflare billing account. It supports Terraform directly; HCP-specific OpenTofu compatibility is not guaranteed by the vendors.
- GCS and Cloudflare R2 state are incompatible with strict no-billing. GitHub artifacts and caches are not state backends.

## Classification Definitions

| Classification                    | Meaning                                                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository configuration**      | Checked-in source is authoritative, such as `firebase.json`, rules, indexes, workflows, or IaC files.                                                                  |
| **Terraform/OpenTofu-manageable** | An official Terraform provider resource exists. Firebase officially documents Terraform, not OpenTofu; provider compatibility with OpenTofu must be pinned and tested. |
| **CLI-manageable**                | An official CLI or deterministic repository script using an official REST API can create or reconcile it.                                                              |
| **Unavoidable manual bootstrap**  | An authenticated human must establish the account, accept terms, or inject the first credential.                                                                       |
| **Unsupported**                   | It cannot meet strict Spark/no-billing or cannot serve the stated role.                                                                                                |
| **Uncertain**                     | An API/resource exists, but primary documentation does not establish eligibility under strict no-billing.                                                              |

## Coverage Matrix

| Resource or concern                        | Classification                                                                        | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google/Firebase account and Firebase Terms | **Unavoidable manual bootstrap**                                                      | A person must establish the account and accept the Firebase Terms. Firebase's [Terraform prerequisites](https://firebase.google.com/docs/projects/terraform/get-started) require user credentials to have accepted those terms.                                                                                                                                                                                                                                                                          |
| Google Cloud project                       | **Terraform/OpenTofu-manageable**, **CLI-manageable**                                 | `google_project` can create a project without setting `billing_account`. The [Firebase Terraform guide](https://firebase.google.com/docs/projects/terraform/get-started) identifies billing as required only for services that need Blaze. Project quota and IAM still apply.                                                                                                                                                                                                                            |
| No-billing invariant                       | **Repository configuration**, **CLI-manageable**                                      | IaC can omit billing association and CI can query project billing state before applying. Merely omitting `billing_account` does not prove that a separately modified existing project remains detached.                                                                                                                                                                                                                                                                                                  |
| API enablement                             | **Terraform/OpenTofu-manageable**, **CLI-manageable**                                 | Use `google_project_service` or `gcloud services enable`; Google documents API enablement through [Service Usage](https://cloud.google.com/service-usage/docs/enable-disable). Enabling an API does not make a Blaze-only service Spark-compatible.                                                                                                                                                                                                                                                      |
| Add Firebase to the project                | **Terraform/OpenTofu-manageable**, **CLI-manageable**                                 | `google_firebase_project` or `projects.addFirebase` performs the conversion. The [Firebase Management API workflow](https://firebase.google.com/docs/projects/api/workflow_set-up-and-manage-project) documents required permissions and the long-running operation without a billing prerequisite.                                                                                                                                                                                                      |
| Firebase Web App                           | **Terraform/OpenTofu-manageable**, **CLI-manageable**                                 | `google_firebase_web_app` registers the app. Its SDK configuration can be retrieved with `firebase apps:sdkconfig` or the Management API.                                                                                                                                                                                                                                                                                                                                                                |
| Firebase web configuration/API key         | **Repository configuration**                                                          | Firebase API keys identify the project but do not authorize access. Firebase explicitly states that restricted Firebase keys are [public by design and safe in checked-in configuration](https://firebase.google.com/docs/projects/api-keys).                                                                                                                                                                                                                                                            |
| Google Sign-In provider                    | **Repository configuration**, **CLI-manageable**                                      | `firebase init auth` writes `auth.providers.googleSignIn` to `firebase.json`; `firebase deploy --only auth` applies it. This is documented in [Configure Authentication providers using Firebase CLI](https://firebase.google.com/docs/auth/configure-providers-cli).                                                                                                                                                                                                                                    |
| OAuth brand display name and support email | **Repository configuration**, **CLI-manageable**                                      | The Firebase CLI Auth schema exposes `oAuthBrandDisplayName` and `supportEmail`.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Google authorized redirect URIs            | **Repository configuration**, **CLI-manageable**                                      | The same schema exposes `authorizedRedirectUris`. Firebase says a default Hosting domain is authorized automatically.                                                                                                                                                                                                                                                                                                                                                                                    |
| Firebase Auth authorized domains           | **Uncertain**                                                                         | This is distinct from Google provider redirect URIs. Identity Toolkit's [`Config`](https://cloud.google.com/identity-platform/docs/reference/rest/v2/Config) exposes `authorizedDomains`, and [`projects.updateConfig`](https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig) can PATCH it with an update mask. The Firebase CLI schema does not expose it. Primary docs do not establish whether the PATCH is accepted on an ordinary Spark `FIREBASE_AUTH` project. |
| Terraform-managed Firebase Auth            | **Unsupported** on Spark                                                              | Firebase's [Terraform guide](https://firebase.google.com/docs/projects/terraform/get-started#firebase-authentication) says `google_identity_platform_config` requires enabling Identity Platform and that this Terraform path requires Blaze and an associated Cloud Billing account.                                                                                                                                                                                                                    |
| Local deterministic Auth identities        | **Repository configuration**, **CLI-manageable**                                      | Auth Emulator configuration belongs in `firebase.json`. The [Authentication Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth) supports mock third-party identities and REST-based account setup.                                                                                                                                                                                                                                                                                   |
| Firestore database                         | **Terraform/OpenTofu-manageable**, **CLI-manageable**                                 | `google_firestore_database` or `gcloud firestore databases create` can create the Native-mode database; see [Manage Firestore databases](https://firebase.google.com/docs/firestore/manage-databases). The location is effectively irreversible and only one database receives Spark free quota.                                                                                                                                                                                                         |
| Firestore Security Rules                   | **Repository configuration**, **CLI-manageable**, **Terraform/OpenTofu-manageable**   | A checked-in rules file deploys through Firebase CLI. Alternatively, `google_firebaserules_ruleset` plus `google_firebaserules_release` can own it. A ruleset has no effect until released. See [Manage and deploy Security Rules](https://firebase.google.com/docs/rules/manage-deploy) and the [Firebase Terraform resource list](https://firebase.google.com/docs/projects/terraform/get-started#supported-resources).                                                                                |
| Firestore composite indexes                | **Repository configuration**, **CLI-manageable**, **Terraform/OpenTofu-manageable**   | `firestore.indexes.json` deploys through Firebase CLI; `google_firestore_index` provides Terraform ownership. See [Manage Firestore indexes](https://firebase.google.com/docs/firestore/query-data/indexing).                                                                                                                                                                                                                                                                                            |
| Firestore field overrides                  | **Repository configuration**, **CLI-manageable**, **Terraform/OpenTofu-manageable**   | Firebase index configuration can describe field overrides; Terraform can use `google_firestore_field`. Select one owner to avoid destructive drift.                                                                                                                                                                                                                                                                                                                                                      |
| Firebase Hosting site                      | **Terraform/OpenTofu-manageable**, **CLI-manageable**                                 | The beta [`google_firebase_hosting_site`](https://raw.githubusercontent.com/hashicorp/terraform-provider-google-beta/main/website/docs/r/firebase_hosting_site.html.markdown) resource creates or imports a site. Firebase CLI also exposes Hosting site commands. Adding Firebase creates a default site resource where available.                                                                                                                                                                      |
| Hosting behavior                           | **Repository configuration**, **CLI-manageable**                                      | Static directory, redirects, rewrites, headers, deploy targets, and emulator settings belong in `firebase.json` and `.firebaserc`; see [Firebase Hosting configuration](https://firebase.google.com/docs/hosting/full-config).                                                                                                                                                                                                                                                                           |
| Hosting files/releases                     | **CLI-manageable**                                                                    | Built content is deployed using Firebase CLI locally and in GitHub Actions. Terraform resources exist for low-level versions/releases, but Firebase CLI is the documented repository deployment workflow.                                                                                                                                                                                                                                                                                                |
| Hosting custom domain                      | **Terraform/OpenTofu-manageable**, **CLI-manageable** through REST                    | The beta [`google_firebase_hosting_custom_domain`](https://raw.githubusercontent.com/hashicorp/terraform-provider-google-beta/main/website/docs/r/firebase_hosting_custom_domain.html.markdown) resource creates the association and exports ownership, host, certificate, issues, and required DNS state. The [Hosting REST API](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites.customDomains) provides a scriptable alternative.                                       |
| Hosting certificate preference             | **Terraform/OpenTofu-manageable**                                                     | Set `cert_preference = "GROUPED"`. The provider documentation explicitly says Spark custom domains can use only `GROUPED`; Blaze can select other types.                                                                                                                                                                                                                                                                                                                                                 |
| Hosting certificate lifecycle              | **Unsupported** for independent management; Firebase-managed                          | Hosting creates, propagates, renews, and replaces the certificate. Certificate details are computed output, not an independently supplied certificate. See [Connect a custom domain](https://firebase.google.com/docs/hosting/custom-domain).                                                                                                                                                                                                                                                            |
| Cloudflare zone                            | **Existing resource**, **Terraform/OpenTofu-readable/importable**                     | The zone already exists and need not be recreated. IaC can look it up or import it, then own only task-specific DNS records. Cloudflare documents its [Terraform provider](https://developers.cloudflare.com/terraform/).                                                                                                                                                                                                                                                                                |
| Firebase-required Cloudflare DNS records   | **Terraform/OpenTofu-manageable**, **CLI-manageable**                                 | Use Cloudflare DNS resources or API calls for Firebase's computed TXT, A, AAAA, CNAME, and CAA records.                                                                                                                                                                                                                                                                                                                                                                                                  |
| DNS proxy state                            | **Terraform/OpenTofu-manageable**                                                     | Firebase validation records should be DNS-only. Cloudflare states that ownership-verification CNAMEs should not be proxied and that TXT records are always DNS-only in its [proxy-status documentation](https://developers.cloudflare.com/dns/proxy-status/). Firebase origin records should also begin DNS-only so Firebase can observe their actual targets.                                                                                                                                           |
| Firebase-to-Cloudflare handoff             | **Terraform/OpenTofu-manageable in phases**                                           | Create the custom domain with `wait_dns_verification = false`, obtain `required_dns_updates.desired`, create the Cloudflare records, then wait or verify in a later run. The record collection is computed after custom-domain creation, so using it as an initial `for_each` generally requires a second plan.                                                                                                                                                                                          |
| First Cloudflare API token                 | **Unavoidable manual bootstrap**                                                      | An authenticated operator creates the initial narrowly scoped token. Cloudflare says the secret is [shown only once](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/). Subsequent tokens can be created through the API.                                                                                                                                                                                                                                                    |
| Google deployment service account          | **Terraform/OpenTofu-manageable**, **CLI-manageable**                                 | `google_service_account` plus project/service-account IAM resources can define a least-privilege deployment identity.                                                                                                                                                                                                                                                                                                                                                                                    |
| Google-managed service identities          | **Terraform/OpenTofu-manageable**, sometimes automatic                                | `google_project_service_identity` materializes an API service identity where supported. The [provider documentation](https://raw.githubusercontent.com/hashicorp/terraform-provider-google-beta/main/website/docs/r/project_service_identity.html.markdown) warns that update and destroy are no-ops and import is unsupported.                                                                                                                                                                          |
| GitHub Actions workflow                    | **Repository configuration**                                                          | Workflow YAML, pinned actions, branch/environment constraints, and permissions are checked in. GitHub requires `id-token: write` to mint an OIDC token and recommends `contents: read` for checkout; see the [OIDC reference](https://docs.github.com/en/actions/reference/security/oidc).                                                                                                                                                                                                               |
| WIF pool and OIDC provider                 | **Terraform/OpenTofu-manageable**, **CLI-manageable**, **Uncertain** under no billing | `google_iam_workload_identity_pool` and `google_iam_workload_identity_pool_provider` exist, and `gcloud iam workload-identity-pools` can configure them. However, Google's [deployment-pipeline WIF guide](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines) explicitly instructs users to verify billing is enabled before enabling IAM, STS, and Service Account Credentials APIs.                                                                             |
| WIF trust policy                           | **Repository configuration**, conditionally Terraform/OpenTofu-manageable             | If WIF eligibility is later established, map and bind numeric `repository_id` and `repository_owner_id`, plus the production ref or environment. Google warns against relying only on reusable names; GitHub documents its [immutable and numeric OIDC claims](https://docs.github.com/en/actions/reference/security/oidc).                                                                                                                                                                              |
| Firebase CLI CI authentication             | **Repository configuration**, credential source **Uncertain**                         | Firebase recommends [Application Default Credentials](https://firebase.google.com/docs/cli#cli-ci-systems). WIF could supply ADC but has the billing uncertainty above.                                                                                                                                                                                                                                                                                                                                  |
| Service-account JSON key fallback          | **Terraform/OpenTofu-manageable**, **CLI-manageable**, secret bootstrap required      | A key can authenticate Google tooling without WIF, but it is long-lived. If Terraform creates it, its private material enters state. If used, it must be tightly scoped, stored as a GitHub environment secret, and rotated.                                                                                                                                                                                                                                                                             |
| `FIREBASE_TOKEN`                           | **CLI-manageable**, legacy                                                            | Firebase still supports `firebase login:ci`, but its [CLI documentation](https://firebase.google.com/docs/cli#cli-ci-systems) calls this less secure and no longer recommended.                                                                                                                                                                                                                                                                                                                          |
| GitHub Actions secrets                     | **CLI-manageable**, **Unavoidable manual bootstrap** for values                       | `gh secret set` and the [Actions Secrets REST API](https://docs.github.com/en/rest/actions/secrets) create or update encrypted secrets. Values are write-only; repository code can declare required names but cannot reconstruct them.                                                                                                                                                                                                                                                                   |
| Google Secret Manager                      | **Unsupported** under strict no billing                                               | Secret Manager's free allowance is part of Google Cloud Free Tier, and Google states that a [Cloud Billing account is required for Free Tier](https://cloud.google.com/free/docs/free-cloud-features#free-tier).                                                                                                                                                                                                                                                                                         |
| Local Terraform/OpenTofu state             | **Supported locally**, **Unsupported** for shared local/CI ownership                  | It costs nothing and needs no service, but provides no durable cross-run sharing or distributed coordination. State must not be committed because it can contain credentials and sensitive outputs.                                                                                                                                                                                                                                                                                                      |
| GCS state backend                          | **Unsupported** under strict no billing                                               | The [OpenTofu GCS backend](https://opentofu.org/docs/language/settings/backends/gcs/) provides locking and recommends object versioning, but requires a pre-existing bucket. Cloud Storage Free Tier itself requires a Cloud Billing account.                                                                                                                                                                                                                                                            |
| Cloudflare R2 state                        | **Unsupported** under strict no billing                                               | R2 requires an [R2 subscription and checkout](https://developers.cloudflare.com/r2/get-started/) and bills monthly usage above included allowances.                                                                                                                                                                                                                                                                                                                                                      |
| GitHub artifacts/cache as state            | **Unsupported**                                                                       | Artifacts have bounded retention and are immutable per upload; see [GitHub workflow artifacts](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts). They provide neither backend locking nor a stable mutable state address.                                                                                                                                                                                                                                          |
| HCP Terraform Free state                   | **Terraform-manageable**, **Unavoidable manual bootstrap**                            | [HCP Terraform Free](https://developer.hashicorp.com/terraform/cloud-docs/overview#free-organizations) includes remote state, remote/local execution, VCS integration, and up to 500 managed resources. It retains [historical state versions](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/state). An operator must create the account, organization, workspace, and initial token.                                                                                                  |
| HCP Terraform with OpenTofu                | **Uncertain**                                                                         | OpenTofu supports generic [TACOS remote backends](https://opentofu.org/docs/language/settings/backends/remote/), but neither HCP nor OpenTofu primary documentation promises HCP's full compatibility with OpenTofu.                                                                                                                                                                                                                                                                                     |

## Repository-Owned Configuration Shape

A candidate repository boundary could contain:

```text
infra/
  bootstrap.tf
  firestore.tf
  hosting.tf
  dns.tf
  identities.tf

firebase.json
.firebaserc
firestore.rules
firestore.indexes.json

.github/workflows/
  validate.yml
  deploy.yml
```

A schematic `firebase.json` ownership shape is:

```json
{
  "auth": {
    "providers": {
      "googleSignIn": {
        "oAuthBrandDisplayName": "Objects",
        "supportEmail": "operator@example.com",
        "authorizedRedirectUris": ["https://objects.example.com"]
      }
    }
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "dist",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "emulators": {
    "auth": {},
    "firestore": {},
    "hosting": {}
  }
}
```

This does **not** cover Firebase Auth `authorizedDomains`; `authorizedRedirectUris` is a different setting.

## Candidate Terraform/OpenTofu Resource Shape

This is a capability sketch, not executable configuration or an architecture selection:

```hcl
resource "google_project" "app" {
  project_id = var.project_id
  name       = var.project_name

  # Intentionally no billing_account.
}

resource "google_project_service" "required" {
  for_each = toset([
    "serviceusage.googleapis.com",
    "firebase.googleapis.com",
    "identitytoolkit.googleapis.com",
    "firestore.googleapis.com",
    "firebaserules.googleapis.com",
    "firebasehosting.googleapis.com",
  ])

  project            = google_project.app.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_firebase_project" "app" {
  provider = google-beta
  project  = google_project.app.project_id
}

resource "google_firebase_web_app" "app" {
  provider     = google-beta
  project      = google_project.app.project_id
  display_name = var.app_name
}

resource "google_firestore_database" "default" {
  project     = google_project.app.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"
}

resource "google_firebase_hosting_site" "app" {
  provider = google-beta
  project  = google_project.app.project_id
  site_id  = var.site_id
  app_id   = google_firebase_web_app.app.app_id
}

resource "google_firebase_hosting_custom_domain" "app" {
  provider = google-beta

  project               = google_project.app.project_id
  site_id               = google_firebase_hosting_site.app.site_id
  custom_domain         = var.custom_domain
  cert_preference       = "GROUPED"
  wait_dns_verification = false
}
```

Rules and indexes must have one owner:

```hcl
# Terraform ownership:
resource "google_firebaserules_ruleset" "firestore" {}
resource "google_firebaserules_release" "firestore" {}
resource "google_firestore_index" "indexes" {}
resource "google_firestore_field" "overrides" {}
```

Or:

```text
Firebase CLI ownership:
  firestore.rules
  firestore.indexes.json
  firebase deploy --only firestore
```

Mixing both ownership paths for the same concern creates drift and overwrite risk.

## Custom-Domain Reconciliation Shape

The documented outputs favor a staged process:

1. Create or import the Hosting site.
2. Create the Hosting custom-domain resource with `wait_dns_verification = false`.
3. Read `required_dns_updates.desired`.
4. Reconcile those records into the existing Cloudflare zone with DNS proxying disabled.
5. Re-run or poll until ownership, host, and certificate states become active.
6. Preserve Firebase-required TXT and CAA records for future certificate operation.

Cloudflare resources would be shaped approximately as:

```hcl
data "cloudflare_zone" "existing" {
  filter = {
    name = var.zone_name
  }
}

resource "cloudflare_dns_record" "firebase" {
  for_each = var.firebase_required_dns_records

  zone_id = data.cloudflare_zone.existing.zone_id
  name    = each.value.name
  type    = each.value.type
  content = each.value.content
  ttl     = 300
  proxied = false
}
```

The handoff should use separate phases or roots because Firebase determines record count, names, and values only after the custom-domain resource exists.

## Candidate CI Identity Shapes

### Conditional WIF Shape

If strict no-billing eligibility is established independently:

```hcl
resource "google_service_account" "deploy" {}

resource "google_iam_workload_identity_pool" "github" {}

resource "google_iam_workload_identity_pool_provider" "github" {
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com/"
  }

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.repository_id"    = "assertion.repository_id"
    "attribute.owner_id"         = "assertion.repository_owner_id"
    "attribute.ref"              = "assertion.ref"
  }

  attribute_condition = <<-CEL
    assertion.repository_id == "${var.github_repository_id}" &&
    assertion.repository_owner_id == "${var.github_owner_id}" &&
    assertion.ref == "refs/heads/main"
  CEL
}

resource "google_service_account_iam_member" "github_impersonation" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = var.github_principal_set
}
```

The corresponding workflow permission boundary is:

```yaml
permissions:
  contents: read
  id-token: write
```

This remains a candidate only because no-billing WIF eligibility is unproven.

### Key-Based Fallback Shape

If WIF cannot be used, the documented fallback is:

- Create a least-privilege deployment service account.
- Create one key outside normal recurring Terraform state, or accept that Terraform state will contain the private key.
- Store the JSON in a GitHub environment secret.
- Restrict the deployment job to the production branch/environment.
- Rotate and revoke the key on a defined schedule.

This is supported but materially weaker than short-lived federation.

## No-Cost State Shapes

### HCP Terraform Free

Candidate Terraform configuration:

```hcl
terraform {
  cloud {
    organization = "example"

    workspaces {
      name = "objects-firebase-production"
    }
  }
}
```

Properties established by official documentation:

- No-cost organization up to 500 managed resources.
- Remote state and locking/run coordination.
- Historical state versions.
- Local execution mode if GitHub Actions should run the provider commands itself.
- Manual account, workspace, and token bootstrap.

This is verified for Terraform. Treat OpenTofu support as uncertain.

### Local State

Local state is viable only if infrastructure application is intentionally operator-local. It cannot provide equivalent local and GitHub Actions ownership and should not be committed.

### Stateless API Scripts

A repository can avoid Terraform state by using idempotent scripts over Firebase Management, Hosting, Identity Toolkit, `gcloud`, and Cloudflare APIs. Such scripts must implement:

- Read-before-create behavior.
- Import/adoption detection.
- Drift reporting.
- Retry handling for long-running operations.
- Partial-failure recovery.
- Explicit deletion safeguards.

This avoids a state service but moves state reconciliation complexity into repository code.

## Principal Risks

1. **Spark Auth split:** Terraform-managed Authentication is definitively Blaze-only, while the Firebase CLI provider path is Spark-compatible.
2. **Authorized-domain gap:** Direct Identity Toolkit PATCH is documented, but ordinary Spark behavior is not. Full Auth automation cannot be claimed without provider confirmation or a disposable Spark test.
3. **WIF gap:** Resources and procedures exist, but Google's official pipeline guide requires billing verification. Do not assume WIF works in strict no-billing.
4. **Beta provider resources:** Firebase Terraform support and Hosting resources are beta. Pin provider versions and expect schema or behavior changes.
5. **Dual ownership:** Do not let Firebase CLI and Terraform simultaneously own the same rules, indexes, Auth settings, or Hosting resources.
6. **Asynchronous domain setup:** DNS records and certificate state are computed after custom-domain creation. One-shot planning is unreliable.
7. **Cloudflare proxy interference:** Proxying hides Firebase origin records and can prevent ownership or host-state validation. Start DNS-only.
8. **Certificate dependencies:** Removing Firebase ownership or CAA records can disrupt future certificate issuance or renewal.
9. **Firestore destruction:** Database location is a foundational choice, and accidental deletion is severe. IaC needs deletion protection or abandonment semantics.
10. **Secret leakage through state:** Service-account keys, provider tokens, and backend credentials can enter plan/state files. Supply them through environment variables or secret stores.
11. **Shared-state dependency:** HCP Terraform adds an external account and token. GCS, R2, and GitHub artifacts do not satisfy the same no-billing state requirements.
12. **Billing drift:** A repository that omits billing configuration does not automatically prevent an operator from linking a billing account later. CI should explicitly verify the project remains unbilled.
