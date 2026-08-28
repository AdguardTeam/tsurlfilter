# Prepare release — monorepo package

This document describes the release-pr preparation workflow for a **single
package** of a pnpm/Lerna monorepo (e.g. the `ext-tsurlfilter` workspace). For
single-package libraries, the org-level
[`create-release-pr.yml`](https://github.com/AdGuardSoftwareLimited/actions/blob/master/.github/workflows/create-release-pr.yml)
is used instead; this workflow exists because a versionless monorepo releases
one `packages/<package>` changelog at a time and tags as
`<package>-v<version>`.

This workflow is consumed by this repository's own `prepare-release.yml`;
`DEPLOYMENT.md` documents the repo-specific parameters.

## Overview

`_prepare-release-monorepo.yml` opens a release PR for one monorepo package:

1. Validates the required workflow-dispatch `version` input.
2. Finalizes `packages/<package>/CHANGELOG.md`: moves the `[Unreleased]`
   entries into a dated `## [<version>] - <date>` heading and resets
   `[Unreleased]`.
3. Pushes branch `release-bump/<package>-v<version>` and opens a PR back to
   the calling branch.

Package manifests remain versionless. The publish workflow injects temporary
versions from package changelogs immediately before testing and packing.

After the PR is merged, the monorepo publish pipeline
([`publish-release-monorepo.yml`](publish-release-monorepo.md)) takes over.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `package` | string | *required* | Package directory name under `packages/` (e.g. `agtree`) |
| `version` | string | *required* | Version to release (e.g. `4.2.0`, `4.2.0-beta.1`) |
| `team` | string | `extensions` | Team label for runner selection |

## Prerequisites

- `packages/<package>/CHANGELOG.md` must contain a `## [Unreleased]` heading.
- The consume-repo must have an Octopass grant covering this workflow ref
  (`_prepare-release-monorepo.yml@*`), since the PR is created with the
  Octopass token. Without the grant the create-PR step fails with "no grant
  covers repository".

## Release process

| # | Who | Action |
| --- | --- | --- |
| 1 | Developer | Dispatch `prepare-release.yml` with the package name and release `version` |
| 2 | This workflow | Finalizes the changelog, pushes `release-bump/<package>-v<version>`, opens the release PR |
| 3 | Developer | Review and merge the release PR |
| 4 | Publish pipeline | Auto-fires on merge — see [`publish-release-monorepo.md`](publish-release-monorepo.md) |

### Version input semantics

`version` is required because package manifests intentionally do not store a
version. The value must match
`<M>.<m>.<p>[-<channel>.<N>]`, otherwise the workflow fails before any
Docker/git operation.

## Troubleshooting

### "Could not find [Unreleased] section in ..."

The changelog must contain an `## [Unreleased]` heading. The monorepo
changelog normalization (adding `[Unreleased]`, fixing `v`-prefixed headings)
must be merged before the first prepare run.

### "no grant covers repository" at the create-PR step

The Octopass grant for this workflow ref is missing. Contact Infra to add a
grant covering
`AdGuardSoftwareLimited/ext-tsurlfilter/.github/workflows/_prepare-release-monorepo.yml@*`.

### PR created for the wrong base

The PR base is `github.ref_name` at dispatch time. Dispatch from `master`.
