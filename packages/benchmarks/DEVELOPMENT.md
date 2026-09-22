# Development

This guide covers the development workflow for benchmarks, which are now
**co-located** inside the libraries they measure as `test/**/*.bench.ts`.

## Prerequisites

- **Node.js**: v22 or later
- **pnpm**: v10 (managed via the monorepo root)
- **Playwright**: required for browser benchmarks (`pnpm bench:browser`),
  Chromium and Firefox

## Getting Started

### Clone the Repository

The benchmarks live inside the `tsurlfilter` monorepo:

```bash
git clone https://github.com/AdguardTeam/tsurlfilter.git
cd tsurlfilter
```

### Install Dependencies

From the **monorepo root**:

```bash
pnpm install
```

## Available Benchmarks

| Package | Benchmark file(s) | What it measures |
|---------|-------------------|------------------|
| `agtree` | `test/parser.bench.ts`, `test/converter.bench.ts` | AGTree parse/convert vs `agtree-v2`, over a small inline rule set |
| `agtree` | `test/parse-fixture.bench.ts` | Full filter-list parse vs `agtree-v4` over `test/fixtures/ag-base.txt` |
| `agtree` | `test/converter-fixture.bench.ts` | Whole-list and per-rule conversion vs `agtree-v4` over `test/fixtures/ubo-filters.txt` (Node + Chromium/Firefox) |
| `css-tokenizer` | `test/tokenizer.bench.ts` | Tokenizer vs `css-tree`, `@csstools/*`, `parse-css`, `csslex` |
| `tsurlfilter` | `test/engine/*.bench.ts` | Engine startup (network/cosmetic/engine) vs `tsurlfilter-v3`, engine init vs `tsurlfilter-v6`; request matching over the committed request corpus |

All benchmarks use Vitest 5's `test(({ bench }) => …)` context-fixture API and
`bench.compare()` for A/B comparisons.

## Running Benchmarks

From a package directory:

```bash
pnpm bench          # Node
pnpm bench:browser  # Chromium and Firefox (Playwright provider) — where available
```

`pnpm bench:browser` requires a browser project: `agtree` and `css-tokenizer`
have one, `tsurlfilter` does not (its benches import `node:fs`).

To run every package's benchmarks from the monorepo root:

```bash
npx lerna run bench
```

Results are printed to the console and written as JSON under `.vitest/bench/`.

### Build Before Benchmarking

Benchmarks that compare the **current** package against a published baseline —
`packages/agtree/test/parse-fixture.bench.ts` and
`packages/agtree/test/converter-fixture.bench.ts` (vs `agtree-v4`), and
`packages/tsurlfilter/test/engine/engine-init.bench.ts` (vs `tsurlfilter-v6`) —
import the current package through its built `dist/` bundle via the package
`exports` map, so they measure the built code and not the TypeScript sources.
Build the package under test before running those benchmarks:

```bash
cd packages/<package>
pnpm build
```

Package manifests are versionless in source, so a local build also needs
temporary version injection first (do not commit the injected fields):

```bash
node scripts/inject-package-versions.mjs
```

See [Building Packages](../../DEVELOPMENT.md#building-packages) for details.

## Development Workflow

### Linting

Benchmark files are covered by each package's own lint setup (ESLint,
TypeScript type checking, and markdownlint):

```bash
cd packages/<package>
pnpm lint
```

### Version Aliases

Benchmarks compare the current version of a package against older published
versions using npm-alias dev dependencies:

- `agtree-v2` — older `@adguard/agtree` release (legacy parser benches)
- `agtree-v4` — last published 4.x `@adguard/agtree` release (fixture benches)
- `tsurlfilter-v3` — older `@adguard/tsurlfilter` release (legacy engine benches)
- `tsurlfilter-v6` — last published 6.x `@adguard/tsurlfilter` release (engine-init bench)

Keep these aliases up to date when new major versions are released. The
published baselines used by the full-list A/B benches (`agtree-v4`,
`tsurlfilter-v6`) are pinned exactly (`4.2.1`, `6.0.3`) so comparisons stay
stable across dependency updates.

## Common Tasks

### Adding a New Benchmark

1. Add a `*.bench.ts` file under the package's `test/**` tree, authored with
   the Vitest 5 context-fixture API.
2. Ensure it is picked up by the package's `test.benchmark.include` glob
   (`test/**/*.bench.ts`).
3. If it imports fixtures via `node:fs`, or imports the current implementation
   from `src`, it is Node-only and must be excluded from the browser project —
   add it to that project's `test.benchmark.exclude` (see agtree's
   `vitest.bench.config.ts`, which excludes `converter.bench.ts` from the
   browser project); otherwise `pnpm bench:browser` collects it and dies on the
   import in Chromium/Firefox. Prefer Vite's `?raw` fixture imports (with the
   ambient `declare module '*?raw'` typing in `typings/`) when the benchmark
   should also run in the browser.
4. Measure the current implementation as its BUILT bundle, not as source: import
   the package by its own name (`@adguard/agtree`) so its `exports` map resolves
   to `dist/`, and list both the package and the baseline in that project's
   dependency optimizer — `deps.optimizer.ssr` for Node, Vite's
   `optimizeDeps.include` for the browser (Vitest 5 has no
   `deps.optimizer.web`). Set `force: true` in both so a rebuilt `dist` is
   re-bundled on every run instead of being measured from the optimizer cache.
   Serving the current code from `src` while the baseline runs as an optimized
   published bundle deoptimizes cross-module calls and inflates the current
   timings by roughly 10x. Build before benching: `pnpm build`.

### Updating Results

There is no committed results file. Benchmark output comes from Vitest's
built-in reporters (console + JSON under `.vitest/bench/`).

The old standalone packages' `RESULTS.md` files were the repo's only recorded
performance history; committing a condensed baseline or a reference JSON for
significant runs is a planned follow-up so future numbers have something to
compare against.

## Scope notes

- **Engine startup vs request matching.** The co-located `tsurlfilter` benches
  measure both engine construction (`Engine.createSync`/`createAsync`,
  `NetworkEngine`, `CosmeticEngine`) and the request-matching hot path
  (`matchRequest`/`match` over the committed 27,969-request corpus, in
  `engine-match.bench.ts`). Corpus loading and engine construction happen
  outside the timed region, so only the match calls are measured. The
  correctness counts (4667/8776/1754) are still asserted in
  `packages/tsurlfilter/test/engine/start-engine.test.ts`.

- **Prior-version A/B aliases.** `tsurlfilter-v3` resolves against the published
  `@adguard/agtree` 3.x (via the root `pnpm.overrides` entry
  `"@adguard/tsurlfilter@3>@adguard/agtree"`), not the workspace agtree v5, so
  its `./serializer`/`./deserializer` imports keep working.

- **Source vs built-package imports.** The legacy inline benches import the
  current implementation from source (`../src/...`) while comparators run as
  prebuilt dist, so Node runs print Vitest's module-runner export-getter
  warning; browser benches already run native ESM. The full-list A/B benches
  (`parse-fixture.bench.ts`, `converter-fixture.bench.ts`,
  `engine-init.bench.ts`) import the current package from its **built** `dist/`
  bundle via the package `exports` map so it competes as an optimized bundle —
  build first (see "Build Before Benchmarking").

- **Node-only benches and the browser project.** `tsurlfilter` has no browser
  project (its benches import `node:fs`); `agtree` excludes
  `converter.bench.ts` from its browser project via `test.benchmark.exclude` for
  the same reason. The fixture-based benches (`converter-fixture.bench.ts`,
  `parse-fixture.bench.ts`) do not have that problem: they import the BUILT
  package and a `?raw` fixture, so the same files run unchanged in Node,
  Chromium and Firefox.

- **Forced dependency optimization.** The `agtree` benchmark projects set
  `force: true` (node `deps.optimizer.ssr` and the browser `optimizeDeps`), so a
  rebuilt `dist` is never measured stale: Vite re-pre-bundles `@adguard/agtree`
  and `agtree-v4` on every bench run instead of trusting its optimizer cache.

- **Bounded iterations.** Engine builds take ~200-400 ms each, so their
  `bench.compare` calls cap `iterations`/`warmupIterations` (tinybench defaults
  to 64 + 16) to keep the whole test well under the bench-mode 60s timeout.

- **Inline fixtures vs real corpora.** The legacy `agtree` and `css-tokenizer`
  benches run a small inline corpus (8 representative rules / a repeated CSS
  sample) chosen to cover the main syntax classes (comments, network/exception
  rules, element hiding, extended CSS, scriptlets, CSS injection,
  `$removeparam`). The full-list A/B benches use real committed corpora
  instead: the AdGuard Base filter list snapshot at
  `packages/agtree/test/fixtures/ag-base.txt` (mirrored at
  `packages/tsurlfilter/test/resources/ag-base.txt`), which the parser bench
  feeds line-by-line (164,325 lines) and the engine bench indexes (143,149
  rules), and the uBO list at `packages/agtree/test/fixtures/ubo-filters.txt`
  (~10.9k lines — ~2k blank, ~2.7k comments/directives, ~6.1k filtering rules,
  of which ~3.8k are converted), because conversion cost is dominated by rules
  that need rewriting rather than by line count. The larger CSS/request corpora
  of the deleted standalone packages remain a follow-up.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Playwright not installed

**Solution**: Install the Chromium and Firefox browsers:

```bash
pnpm exec playwright install chromium firefox
```

## Additional Resources

- [AGENTS.md](AGENTS.md) — AI agent instructions for benchmarks
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
