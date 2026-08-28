# Deployment

This repository publishes **10 npm packages** from a pnpm/Lerna monorepo. The
release pipeline is implemented in this repository's own monorepo workflows
(`_prepare-release-monorepo.yml`, `_publish-release-monorepo.yml`) and their
thin callers; this page documents the repo-specific parameters.

## Release workflow docs

- [Prepare release (monorepo package)](.github/docs/prepare-release-monorepo.md)
- [Publish release (monorepo package)](.github/docs/publish-release-monorepo.md)

## Packages

Each package is a separate directory under `packages/`, published
independently as its own npm package and tagged `<tag prefix>-v<version>`.

| Directory | npm package | tgz | Tag prefix |
| --------- | ----------- | --- | ---------- |
| `packages/logger` | `@adguard/logger` | `logger.tgz` | `logger` |
| `packages/css-tokenizer` | `@adguard/css-tokenizer` | `css-tokenizer.tgz` | `css-tokenizer` |
| `packages/agtree` | `@adguard/agtree` | `agtree.tgz` | `agtree` |
| `packages/tsurlfilter` | `@adguard/tsurlfilter` | `tsurlfilter.tgz` | `tsurlfilter` |
| `packages/dnr-converter` | `@adguard/dnr-converter` | `dnr-converter.tgz` | `dnr-converter` |
| `packages/dnr-rulesets` | `@adguard/dnr-rulesets` | `dnr-rulesets.tgz` | `dnr-rulesets` |
| `packages/tswebextension` | `@adguard/tswebextension` | `tswebextension.tgz` | `tswebextension` |
| `packages/adguard-api` | `@adguard/api` | `adguard-api.tgz` | `adguard-api` |
| `packages/adguard-api-mv3` | `@adguard/api-mv3` | `adguard-api-mv3.tgz` | `adguard-api-mv3` |
| `packages/eslint-plugin-logger-context` | `@adguard/eslint-plugin-logger-context` | `eslint-plugin-logger-context.tgz` | `eslint-plugin-logger-context` |

Package manifests intentionally have no `version` field. Each version is
derived from the package changelog and injected temporarily by
`scripts/inject-package-versions.mjs` before testing and packing.

## Release process

1. **Prepare**: dispatch `prepare-release.yml` with the package name and required
   `version` input. It finalizes the package's `CHANGELOG.md`, pushes
   `release-bump/<package>-v<version>` and opens the release PR.
2. **Merge**: review and merge the release PR into `master`.
3. **Publish**: `publish-release.yml` auto-fires on the merged
   `release-bump/<package>-v<version>` PR — Docker test + build → npm publish →
   tag `<package>-v<version>` (created only after the publish succeeds) →
   mirror to `AdguardTeam/tsurlfilter` + GitHub Release → Slack.

There is no version-increment workflow. Start the next release by dispatching
`prepare-release.yml` with the next version.

For a dry-run of the publish pipeline without touching the registry, dispatch
`publish-release.yml` with `dry_run: true`.

## Scheduled automation

- `update-companiesdb.yml` regenerates the tswebextension companies database
   every Tuesday at 11:00 UTC and pushes meaningful changes to `master` through
   Octopass `protected-push` (the commit avoids `[skip ci]` so `mirror.yml`
   still syncs the update to the public repo). Failures are reported to Slack.
- `publish-stable-dnr-rulesets.yml` builds and publishes `@adguard/dnr-rulesets`
   every hour from supported `stable/dnr-rulesets-*` branches. Versions use
   `<major>.<minor>.<UTC timestamp>` and are injected only for that build, and
   publish under the per-line `stable-<line>` dist-tag (never `latest`).
   Failures are reported to Slack.
  - **Prerequisite — each supported branch must be on the current CI** (root
    `Dockerfile` with a `dnr-rulesets-auto-build-output` target +
    `scripts/inject-package-versions.mjs` in the branch tip). The workflow
    checks branch readiness per line and skips lines whose branch has not been
    migrated yet, so the hourlies neither fail nor spam Slack during the
    backport window (see the workflow's `resolve-lines` job).
  - **Branch protection required**: with `environment: ''` this pipeline
    publishes to npm hourly straight from the tip of each `stable/dnr-rulesets-*`
    branch, so push access to those branches is effectively npm publish access
    (bypassing the `npm` environment review that gates normal releases).
    Provision branch protection for `stable/dnr-rulesets-*` in terraform-github
    (teams with push rights are the only gate on the unattended path).

## Publishing order

`workspace:^` dependencies are rewritten to real versions by `pnpm pack`, so
packages must be published in **topological order**:

```text
logger, css-tokenizer, eslint-plugin-logger-context
  -> agtree
    -> tsurlfilter
      -> dnr-converter, dnr-rulesets
        -> tswebextension
          -> adguard-api, adguard-api-mv3
```

`@adguard/dnr-converter` also has a peer dependency on the external
`@adguard/re2-wasm` (published from `ext-re2-wasm`, Wave 4A/4B) — consumed from
the npm registry at install time, not built in this repo.

## GitHub Environment

The `npm` environment (protects npm publishing with the `extensions` team as
reviewer) is provisioned via `terraform-github`. GitHub npm OIDC trusted
publishing matches the **caller workflow** identity, so register each package's
publisher for the workflow that actually invokes `deploy-to-npm.yml`:

- **Nine normal packages** — register the trusted publisher for this repo's
  `publish-release.yml` (which calls the monorepo publish engine) and restrict
  it to the `npm` environment.
- **`@adguard/dnr-rulesets`** — register the trusted publisher for
  `publish-stable-dnr-rulesets.yml`, **not** `publish-release.yml`: the
  unattended hourly stable path calls the shared `deploy-to-npm.yml` directly
  and never passes through `publish-release.yml`. Register it **without** the
  `npm` environment restriction so the unattended hourlies are accepted;
  normal DNR releases via `publish-release.yml` still use the protected GitHub
  `npm` environment. Getting this identity wrong fails OIDC validation on the
  first scheduled run.

## External setup checklist

The repository configuration alone does not make publishing and mirroring
operational. Before enabling the workflows, verify:

- **Approve outside-collaborator / fork PR runs** in repository Settings >
  Actions > fork pull request workflows ("Require approval for all outside
  collaborators", or the stricter variant): the PR CI runs PR-controlled
  Docker builds and PR-modified steps of `build.yml` on the persistent
  self-hosted team-extensions runners, so requiring approval on fork PRs is a
  hard trust-boundary prerequisite (see the `build.yml` header).
- Octopass grants cover `_prepare-release-monorepo.yml`,
  `_publish-release-monorepo.yml`, `mirror.yml`, and `protected-push` from this
  repository.
- The nine normal npm packages trust `AdGuardSoftwareLimited/ext-tsurlfilter`,
  workflow `publish-release.yml`, with the `npm` environment restriction.
  `@adguard/dnr-rulesets` trusts workflow `publish-stable-dnr-rulesets.yml`
  with **no** environment restriction (see "GitHub Environment" above).
- `AdguardTeam/tsurlfilter` exists as the public mirror, its workflows are
  disabled by the shared mirror action, and the previous Bitbucket mirror is
  disabled.
- One push to `master` successfully mirrors branches, tags, and notes to the
  public repository.
