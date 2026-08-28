# finalize-changelog

Helper script that finalizes a
[keep-a-changelog](https://keepachangelog.com/) `CHANGELOG.md` for a release.
It lives at `.github/actions/finalize-changelog/finalize-changelog.mjs` and is
invoked directly by
[`_prepare-release-monorepo.yml`](../workflows/_prepare-release-monorepo.yml)
(kept as a bare script, not a composite action, because it has exactly one
caller — the wrapper would be an untested artifact).

## What it does

1. Empties the `[Unreleased]` section, keeping the standard subsection
   template (`Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` /
   `Security`).
2. Moves the previously-unreleased entries under a new
   `## [<version>] - <YYYY-MM-DD>` heading, dropping empty subsections.
3. Exposes the new section as the `release_notes` output (multiline `$GITHUB_OUTPUT`
   heredoc syntax, suitable for a release PR body).

The script fails when the changelog has no `[Unreleased]` section, when the new
version heading cannot be found after the rewrite, or when the version was
already released (no duplicate heading).

## Environment

| Variable | Description |
| --- | --- |
| `CHANGELOG_PATH` | Path to the changelog file (e.g. `packages/agtree/CHANGELOG.md`) |
| `NEW_VERSION` | Version being released (e.g. `4.2.0`, `4.2.0-beta.1`) |
| `GITHUB_OUTPUT` | Step output file provided by the runner |
| `FINALIZE_DATE` | Optional `YYYY-MM-DD` to override "today" (deterministic tests) |

## Usage

```yaml
- name: Finalize changelog
  id: changelog
  shell: bash
  env:
    CHANGELOG_PATH: packages/agtree/CHANGELOG.md
    NEW_VERSION: 4.3.0
  run: node .github/actions/finalize-changelog/finalize-changelog.mjs
```

## Implementation

The rewrite is line-oriented text processing implemented in Node — Node is
guaranteed on GitHub Actions runners, and the logic is safer in JS than in
bash. Regression tests live in `tests/finalize-changelog.sh` (run by the
`workflows` validation job in [`build.yml`](../workflows/build.yml)).
