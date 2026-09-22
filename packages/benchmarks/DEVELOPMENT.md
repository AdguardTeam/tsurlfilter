# Development

This guide covers the development workflow for benchmarks, which are now
**co-located** inside the libraries they measure as `test/**/*.bench.ts`.

## Prerequisites

- **Node.js**: v22 or later
- **pnpm**: v10 (managed via the monorepo root)
- **Playwright**: required for browser benchmarks (`pnpm bench:browser`),
  Chromium only for now

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
| `agtree` | `test/converter-fixture.bench.ts` | Whole-list and per-rule conversion vs `agtree-v4` over `test/fixtures/ubo-filters.txt` (Node + Chromium) |
| `css-tokenizer` | `test/tokenizer.bench.ts` | Tokenizer vs `css-tree`, `@csstools/*`, `parse-css`, `csslex` |
| `tsurlfilter` | `test/engine/*.bench.ts` | Engine startup (network/cosmetic/engine) vs `tsurlfilter-v3`; request matching over the committed request corpus |

All benchmarks use Vitest 5's `test(({ bench }) => …)` context-fixture API and
`bench.compare()` for A/B comparisons.

## Running Benchmarks

From a package directory:

```bash
pnpm bench          # Node
pnpm bench:browser  # Chromium (Playwright provider) — where available
```

`pnpm bench:browser` requires a browser project: `agtree` and `css-tokenizer`
have one, `tsurlfilter` does not (its benches import `node:fs`).

To run every package's benchmarks from the monorepo root:

```bash
npx lerna run bench
```

Results are printed to the console and written as JSON under `.vitest/bench/`.

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

- `agtree-v2` — older `@adguard/agtree` release
- `agtree-v4` — last `@adguard/agtree` v4 release, the v5 comparison baseline
- `tsurlfilter-v3` — older `@adguard/tsurlfilter` release

Keep these aliases up to date when new major versions are released.

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
   import in Chromium. Prefer Vite's `?raw` fixture imports (with the ambient
   `declare module '*?raw'` typing in `typings/`) when the benchmark should
   also run in the browser.
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

- **Node-only benches and the browser project.** The older Node benches import
  the current implementation from source (`../src/...`) while comparators run as
  prebuilt dist, so Node runs print Vitest's module-runner export-getter
  warning; browser benches already run native ESM. `tsurlfilter` has no browser
  project (its benches import `node:fs` and `tsurlfilter-v3`); `agtree` excludes
  `converter.bench.ts` from its browser project via `test.benchmark.exclude` for
  the same reason. The fixture-based benches (`test/converter-fixture.bench.ts`)
  do not have that problem: they import the BUILT package and a `?raw` fixture,
  so the same file runs unchanged in Node and Chromium.

- **Forced dependency optimization.** The `agtree` benchmark projects set
  `force: true` (node `deps.optimizer.ssr` and the browser `optimizeDeps`), so a
  rebuilt `dist` is never measured stale: Vite re-pre-bundles `@adguard/agtree`
  and `agtree-v4` on every bench run instead of trusting its optimizer cache.

- **Bounded iterations.** Engine builds take ~200-400 ms each, so their
  `bench.compare` calls cap `iterations`/`warmupIterations` (tinybench defaults
  to 64 + 16) to keep the whole test well under the bench-mode 60s timeout.

- **Inline fixtures vs real corpora.** The `parser.bench.ts` / `converter.bench.ts`
  and `css-tokenizer` benches run a small inline corpus (8 representative rules /
  a repeated CSS sample) rather than the large filter-list / CSS corpora the
  deleted standalone packages downloaded; the inline sets were chosen to cover
  the main syntax classes (comments, network/exception rules, element hiding,
  extended CSS, scriptlets, CSS injection, `$removeparam`).
  `converter-fixture.bench.ts` is the exception: it converts the committed
  `packages/agtree/test/fixtures/ubo-filters.txt` (~10.9k lines — ~2k blank
  lines, ~2.7k comments/directives, and ~6.1k filtering rules, of which ~3.8k
  are actually converted), because conversion cost is dominated by rules that
  need rewriting rather than by line count. `tsurlfilter`'s fixtures live in
  that package's `test/resources/`; committing comparable corpora for the
  remaining benches is a follow-up.

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Playwright not installed

**Solution**: Install the Chromium browser:

```bash
npx playwright install chromium
```

## Additional Resources

- [AGENTS.md](AGENTS.md) — AI agent instructions for benchmarks
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
