# Publish release — monorepo package

This document describes the publish pipeline for a **single package** of a
pnpm/Lerna monorepo (e.g. the `ext-tsurlfilter` workspace). For single-package
libraries, the org-level [`deploy-to-npm.yml`](https://github.com/AdGuardSoftwareLimited/actions/blob/master/.github/workflows/deploy-to-npm.yml)
workflow is used instead; this workflow exists because monorepo packages tag
as `<package>-v<version>` and each package has its own Docker
`build-<package>-output` / `test-<package>-output` targets.

This workflow is consumed by this repository's own `publish-release.yml`;
`DEPLOYMENT.md` documents the repo-specific parameters and per-package
topological publish order.

## Overview

`_publish-release-monorepo.yml` publishes one monorepo package:

1. **Parse** — reads `packages/<package>/CHANGELOG.md`, extracts the released
   version, and computes the tag `<package>-v<version>` and npm dist-tag
   (`latest`, or the prerelease channel like `alpha`/`beta`).
2. **Test and build** — injects temporary versions into all publishable
   manifests, runs the package's Docker `test-<package>-output` and
   `build-<package>-output` targets, verifies the produced `.tgz`, and uploads
   it as an Actions artifact.
3. **Publish** — publishes the `.tgz` to npm with OIDC trusted publishing,
   under the computed dist-tag.
4. **Tag** — creates the `<package>-v<version>` tag on the target ref **only
   after the npm publish has succeeded** (`force: false`, the shared
   `git-tag.yml` default, so an existing tag is never silently moved — a
   re-run of an already-released version fails instead of rewriting history).
5. **Mirror and release** — mirrors refs to the public repo and creates a
   GitHub Release with the changelog section and the package attached.
6. **Notify** — posts a Slack success message; a separate job alerts the
   channel when any leg of the unattended release fails.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `package` | string | *required* | Package directory name under `packages/`; also the tag prefix and `.tgz` base name (e.g. `agtree`) |
| `npm_package_name` | string | *required* | npm package name for the Slack notification (e.g. `@adguard/agtree`) |
| `target_repo` | string | *required* | Public mirror repo (e.g. `AdguardTeam/tsurlfilter`) |
| `ref` | string | `''` | Ref to publish (merge commit SHA). Leave empty for the triggering commit. |
| `team` | string | `extensions` | Team label for runner selection |
| `environment` | string | `npm` | GitHub environment for npm publish protection rules |
| `slack_channel` | string | `#adguard-extension-vcs` | Slack channel for release notifications |
| `dry_run` | boolean | `false` | Run `npm publish` with `--dry-run` (no registry contact). For CI testing. |

## Tag convention

Monorepo packages are tagged `<package>-v<version>`, **not** `v<version>`
(e.g. `agtree-v4.2.1`, `tsurlfilter-v6.0.2`). Each package keeps the history
of its own tags; the `parse-changelog` building block's hardcoded `v<version>`
tag output is ignored — the caller composes `<package>-v<version>` and only
uses `parse-changelog`'s `version`/`changelog`/prerelease outputs.

## Version injection

Publishable package manifests intentionally do not store versions. Before the
Docker build, the workflow runs the consumer repository's
`scripts/inject-package-versions.mjs`: the selected package receives the
version parsed from its changelog, while dependencies receive the latest
released versions from their own changelogs. The workflow verifies the packed
manifest version before uploading the tarball.

## Publishing order (monorepo packages)

`workspace:^` dependencies are rewritten to the injected changelog versions by
`pnpm pack`, so packages must be published **in topological order** so that
dependencies are always already on the registry. The order for
`ext-tsurlfilter` is documented in
[`DEPLOYMENT.md`](../../DEPLOYMENT.md#publishing-order) (single source of truth —
keep the diagram there, not duplicated here, so it cannot rot).

## GitHub Environment

The `publish` job uses the **`npm`** GitHub environment (input `environment`).

| Setting | Value |
| --- | --- |
| **Environment name** | `npm` |
| **Protection rules** | Prevent self-review; reviewers: `extensions` team |
| **Purpose** | Restricts who can publish to npm |

The environment must exist in the consumer repo **before** the first publish
runs — an environment auto-created by a first workflow run has no protection
rules. Provision it via `terraform-github` (`team_extensions.tf`, `npm`
environment with the `extensions` team as reviewer).

## Notifications

On success, a Slack notification is posted via the shared `slack` action from
the [`actions`](https://github.com/AdGuardSoftwareLimited/actions) repo,
controlled by the `slack_channel` input. Notification failures are
non-blocking.

## Troubleshooting

### "No released version found in CHANGELOG.md"

The selected package or one of its workspace dependencies has no normalized
release heading. Every publishable changelog must use bracket version headings
(`## [X.Y.Z] - date`). A `v` prefix (`## [v6.0.2]`) is not supported.

### npm publish fails with a 409

The version is already fully published and npm rejects re-publishing it. The
right recovery depends on what completed before the failure:

- **Partial publish** (npm publish succeeded but the tag or mirror leg failed
  transiently): do **not** bump the version. Re-run the failed jobs on the
  original run so the tag and GitHub Release complete for the already published
  version — a fresh dispatch would rebuild and die at this 409 without ever
  re-attempting the tag/release.
- **Nothing was published** (e.g. a genuine pre-publish failure): bump the
  version via the prepare workflow and release the new version.

### Tag already exists (git-tag fails)

The tag `<package>-v<version>` already points at the published commit. Tags are
created with `force: false` (never silently moved) and only **after** the npm
publish succeeds, so a re-run of an already-completed release fails at the tag
step instead of rewriting history. This is expected: the version is fully
released (npm + tag + GitHub Release). To ship the same change again, bump the
version via the prepare workflow. A `dry_run` re-run never hits this — under
`dry_run` the tag and mirror-and-release jobs are skipped entirely.

### Re-running a failed publish

Go to **Actions → Publish release → Run workflow** and trigger the caller with
`package`, an optional `ref` (leave empty for the merge commit / current
`master`), and optionally `dry_run: true` to validate the pipeline without
touching the registry.
