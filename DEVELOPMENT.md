# Development

This guide covers the development workflow, environment setup, and common tasks
for contributing to the `tsurlfilter` monorepo.

## Prerequisites

- **Node.js**: v22 or later (use [nvm](https://github.com/nvm-sh/nvm) to
  manage versions)
- **pnpm**: v10.33.4 (see [pnpm installation](https://pnpm.io/installation))
- **Git**: latest stable version
- **OS**: macOS or Linux (some commands may not work on Windows without WSL)

## Getting Started

### Clone the Repository

The canonical development repository is private. The public repository is a
read-only mirror.

```bash
git clone https://github.com/AdGuardSoftwareLimited/ext-tsurlfilter.git
cd ext-tsurlfilter
```

### Install Dependencies

```bash
pnpm install
```

This installs dependencies for all packages in the monorepo. Shared dependency
versions are managed via [pnpm catalogs](https://pnpm.io/catalogs) in
`pnpm-workspace.yaml`.

### Building Packages

Package manifests are versionless in source. Before local builds, inject
temporary versions derived from each package's latest changelog heading:

```bash
node scripts/inject-package-versions.mjs
```

(There is no `--dev` flag: the script stamps every package from its own
`CHANGELOG.md` when called with no arguments, and a specific package with
`--package <name> --version <version>` for release builds. CI uses the shared
`set-dev-version` action for the same per-package dev stamping.)

Do not commit the injected `version` fields.

There are two ways to build:

**1. Via Lerna (from the monorepo root)** — builds the package and all its
workspace dependencies automatically:

```bash
# Build all packages
npx lerna run build

# Build a specific package with its dependencies
npx lerna run build --scope=@adguard/dnr-converter
```

Lerna + Nx respect the dependency tree and cache build outputs.

**2. From the package directory** — builds only that package (dependencies must
already be built):

```bash
pnpm build
```

## Testing Unmerged Changes in the Browser Extension

Every **same-repository** PR that touches one of the six
browser-extension-consumed packages (the same `BRIDGED_PACKAGES` set the bridge
workflows publish, see `devex-bridge.yml`) is automatically published to the
internal Artifact Keeper npm registry by the `devex-bridge.yml` workflow, with
head-scoped versions `<next-patch>-dev.pr<N>.<shortsha>`. Fork PRs get no
builds (the publish jobs are gated to same-repo PRs). The PR gets a comment
with the exact versions once publishing finishes.

To build the browser extension against them:

1. Create your branch in `AdGuardSoftwareLimited/browser-extension` as usual
   (e.g. `feature/AG-12345-…`) with whatever changes you need — CHANGELOG
   entries, source adaptations, etc.
2. From an up-to-date tsurlfilter checkout, pin the dev builds:

   ```bash
   node scripts/use-dev-builds.mjs --pr <N> --registry https://ak.int.agrd.dev/npm/npm-internal --extension /path/to/browser-extension
   ```

   (The `--registry` flag is optional — the tool defaults to the same AK path —
   but pass it explicitly so it cannot drift from the workflow's
   `ARTIFACT_KEEPER_URL`.) This points the six packages at the AK tarballs via
   `pnpm.overrides` (dependencies stay untouched) and refreshes
   `pnpm-lock.yaml`.
3. Commit `package.json` and `pnpm-lock.yaml`. The extension's regular CI
   builds the branch — installable builds are in the CI run's Artifacts
   (`dev-builds`, `chrome-dev-crx`).

After every push to the tsurlfilter PR the dev builds are republished under a
new head-scoped version, so re-run the same command (from the pushed checkout,
or with `--head <short-sha>` from the comment) and commit the refreshed
`package.json` / `pnpm-lock.yaml`. The tool resolves the coherent set for the
checkout head: if any package's build for that head is missing on AK (a publish
leg failed), it fails loudly instead of mixing builds from different heads.

A branch pinned to dev builds must never be merged. Before marking the
extension PR ready (once the real versions are released, or if testing is
abandoned), restore registry dependencies:

```bash
node scripts/use-dev-builds.mjs --remove --extension /path/to/browser-extension
```

Closing or merging the tsurlfilter PR deletes its dev versions from AK
(`devex-bridge-cleanup.yml`), after which pinned branches stop resolving; the
`devex-bridge-sweep.yml` GC is the safety net if a close event was missed.

### Requirements

The three bridge workflows (`devex-bridge.yml`, `devex-bridge-cleanup.yml`,
`devex-bridge-sweep.yml`) all require the org-scoped `ARTIFACT_KEEPER_URL`
variable (base URL of the Artifact Keeper instance, e.g. `https://ak.int.agrd.dev`)
and the `ARTIFACT_KEEPER_API_KEY` secret — the same pair the shared
`deploy-to-ak-npm.yml` workflow uses. The npm registry URL is derived as
`${ARTIFACT_KEEPER_URL}/npm/npm-internal`. If the URL variable is unset it
resolves to an empty string and every job fails loudly rather than publishing
to an empty registry URL — including the sweep, which additionally validates
that its `AK_REGISTRY` value is an http(s) URL.

On the **developer side**, running `use-dev-builds.mjs` (or any `npm view`
against the AK registry) needs the same registry reachability: the AK host is
internal, so you must be on the internal network (VPN) and, if AK enforces
read auth, have an npm token acceptable to AK. A cold run against an unroutable
host fails with `ENOTFOUND`/`E401` — that is expected.

### If Something Goes Wrong

The recovery paths below are the documented ways to converge after a bridge,
cleanup or sweep failure — the same commands the Slack failure alerts point at:

- **A bridge run failed** (no dev builds for the last push): push again, or
  *Re-run all jobs* on the failing run. Re-running only the failed jobs more
  than a day later trips the `retention-days: 1` artifact expiry (the
  version-record / tarball artifacts the publish jobs download are gone), so
  prefer **Re-run all jobs** or a new push.
- **A close cleanup failed** (or you suspect orphaned dev versions): re-dispatch
  *devex-bridge-cleanup.yml* with `pr-number = <N>` — it is idempotent and only
  writes what the close event was supposed to. If the dispatch itself fails,
  the periodic `devex-bridge-sweep.yml` GC is the always-on safety net.
- **The sweep failed** (GC safety net broken): fix the issue and re-run it, or
  dispatch *devex-bridge-sweep.yml* with `pr-number = <N>` for a targeted pass;
  the scheduled run retries every 6h.
- **Dev pins stop resolving in the extension**: the dev versions were deleted
  (cleanup ran), so run `use-dev-builds.mjs --remove --extension <path>` or
  re-pin from the current checkout head. There is nothing to un-publish by
  hand.

## Development Workflow

### Branch Strategy

- Create feature branches from `master`
- Use branch names with the pattern: `feature/AG-1234`, `fix/AG-1234`,
  `enhance/AG-1234` — where `AG-XXX` is the task number
- Open a pull request when ready for review

### Code Style

Each package has its own ESLint configuration (most use `airbnb-typescript`
base). See per-package linter configs for specific formatting rules.

### Linting

```bash
# Lint all packages
pnpm lint

# Lint a specific package (from its directory)
pnpm lint:code   # ESLint only
pnpm lint:types  # TypeScript type checking only
```

### Running Tests

```bash
# Run tests in all packages
npx lerna run test

# Run tests in a specific package (from its directory)
pnpm test
```

For `@adguard/tsurlfilter` and `@adguard/tswebextension`, build first, then
run the full validation:

```bash
pnpm build
pnpm test:prod   # lint + smoke tests + full test suite (no cache)
```

## CI Checks and `test:prod`

Every package that is published or tested in CI exposes a `test:prod` script
that is the single entry point for verifying a package is healthy. It runs the
same ordered set of checks regardless of the package:

```text
lint → test:smoke (where applicable) → test:ci
```

- **`lint`** — runs `lint:code` (ESLint) and `lint:types` (TypeScript) and,
  where configured, `lint:md` (markdownlint).
- **`test:smoke`** — imports the built package from ESM, CJS, and TypeScript
  to verify that the published exports resolve correctly.
- **`test:ci`** — runs the full Vitest suite and writes JUnit XML output for
  CI reporting.

Not every package needs all three steps — packages with no unit tests (e.g.
`@adguard/api`, `@adguard/eslint-plugin-logger-context`) define `test:prod` as
`pnpm lint` only. The key rule is: **every package must have `test:prod`**, and
its Dockerfile stage must call it.

Each package's Docker test stage invokes `pnpm test:prod`. The `build.yml`
matrix computes affected packages through a **transitive** walk of `workspace:`
dependencies, so a change in `@adguard/agtree` automatically triggers the
`test-tsurlfilter` job without extra workflow conditions.

## Common Tasks

### Adding or Updating a Shared Dependency

Shared dependency versions are managed via pnpm catalogs in
`pnpm-workspace.yaml`. To update a common dependency:

1. Edit the version in the `catalog:` section of `pnpm-workspace.yaml`.
2. Run `pnpm install` to update the lockfile.
3. Verify affected packages still build and pass tests.

### Adding a New Internal Dependency

Use `workspace:^` for cross-package references:

```json
{
  "dependencies": {
    "@adguard/agtree": "workspace:^"
  }
}
```

### Releasing a Package

Package versions live in changelogs, not manifests. Local builds use
`scripts/inject-package-versions.mjs` (no args — stamps every package from its
changelog); CI and release builds pass the selected package and an explicit
release version. See [DEPLOYMENT.md](DEPLOYMENT.md) for the release process.

### Clean Reinstall

```bash
# Remove all node_modules across the monorepo
pnpm clean

# Or clean and reinstall in one step
pnpm reinstall   # (alias: pnpm ri)
```

### Working with Sample Extensions

Source code is in `packages/examples/`. Build them with:

```bash
npx lerna run build --scope tswebextension-mv2
npx lerna run build --scope tswebextension-mv3
npx lerna run build --scope adguard-api-example
npx lerna run build --scope adguard-api-mv3-example
```

Built extensions are output to each example's `build/` directory and can be
loaded as unpacked extensions in the browser. Use
[test pages](https://testcases.agrd.dev) to validate filtering.

### Running Benchmarks

Each benchmark is run from its own directory under `packages/benchmarks/`:

```bash
cd packages/benchmarks/agtree-benchmark
pnpm start
```

### IDE Setup (VS Code)

Create a `tsurlfilter.code-workspace` file in the monorepo root:

```json
{
    "folders": [
        { "path": "packages/logger" },
        { "path": "packages/css-tokenizer" },
        { "path": "packages/agtree" },
        { "path": "packages/tsurlfilter" },
        { "path": "packages/dnr-converter" },
        { "path": "packages/tswebextension" },
        { "path": "packages/dnr-rulesets" },
        { "path": "packages/adguard-api" },
        { "path": "packages/adguard-api-mv3" },
        { "path": "packages/examples/adguard-api" },
        { "path": "packages/examples/adguard-api-mv3" },
        { "path": "packages/examples/tswebextension-mv2" },
        { "path": "packages/examples/tswebextension-mv3" }
    ]
}
```

Recommended extensions are listed in `.vscode/extensions.json`.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Build fails with workspace dependency errors

**Solution**: Ensure workspace dependencies are built first. Use Lerna to build
a package with its dependencies:

```bash
npx lerna run build --scope=<package-name> --include-dependencies
```

### Issue: Mismatched `zod` versions inflate bundle size

**Solution**: All packages must use the same `zod` version, managed via pnpm
catalogs in `pnpm-workspace.yaml`. Do not pin a different version in individual
packages. Duplicate versions get bundled separately, increasing the final bundle
size.

### Issue: Git pre-commit hook modifies `package.json`

This is expected. The pre-commit hook strips the `packageManager` field from
`package.json` before committing and restores it afterward.

### Issue: Linking packages to non-pnpm projects

**Solution**: Use `--shamefully-hoist` to create a flat `node_modules`
structure compatible with other package managers:

```bash
pnpm install --shamefully-hoist
```

For pnpm-based projects, use [`pnpm link`](https://pnpm.io/cli/link).

## Docker CI

CI builds and tests run inside Docker using a multi-stage `Dockerfile` at the
repo root. Each package has a dedicated `--target` stage for builds and tests.

### Local Verification

```bash
# Run the full cache verification suite
bash scripts/verify-docker-cache.sh --skip-cold

# Or build a specific target directly
docker buildx build --build-arg TEST_RUN_ID=local-$(date +%s) \
  --target test-tswebextension-output --output type=local,dest=output .
```

### How It Works

- **Layer caching**: the `deps` stage is cached until `package.json` /
  `pnpm-lock.yaml` change; the `source` stage is cached until source code
  changes.
- **`TEST_RUN_ID`**: a build arg that busts only test-stage caches so CI always
  re-runs tests while reusing build layers.
- **`test:ci` scripts**: per-package scripts that produce JUnit XML output for
  CI reporting.

## Additional Resources

- [README.md](README.md) — Project overview and package listing
- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [Lerna Commands](https://lerna.js.org/docs/api-reference/commands) — Lerna CLI
  reference
- [pnpm Catalogs](https://pnpm.io/catalogs) — Shared dependency version
  management
