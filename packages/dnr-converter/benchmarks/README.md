# DNR Converter — Cold-Start Benchmark (HITL)

> **This is a standalone, manually-run benchmark. It is NOT part of the test
> suite and is NOT wired into CI.** It exists to give a human reviewer a recorded
> baseline for the runtime cost of filter-list preparation after the
> build-time-to-runtime parsing migration (see PRD User Story 5 / AG-53262).

## What it measures

The runtime filter-list preparation entry point on a 100k+ line filter list is
measured two ways, and both are reported for each target:

1. **Cold-start (first invocation)** — the timed very first run of the target
   in the process. This is where module load, JIT compilation, and first
   deoptimized-parse cost live. This is the cold-start time acceptance criterion
   1 asks for; it is a single sample, so treat it as an upper-bound indicator.
2. **Steady-state fresh-parse** — min/mean/median/p99 over 10 repeat runs taken
   after the first invocation, for repeatable steady-state context.

The two measured targets are:

1. **`FilterListParser.parse`** — the dnr-converter/agtree equivalent of
   tsurlfilter's `FilterList.prepare()` (raw filter text → AST). This is the
   preparation step that moved from build-time to runtime.
2. **`FilterConverter.convert`** (simple mode) — the end-to-end runtime
   conversion (scan + parse + convert) for context.

## How to run

Requires Node.js >= 22 and a built `@adguard/agtree` (run `pnpm build` at the
repo root, or `npx lerna run build --scope=@adguard/agtree`, first).

From the `packages/dnr-converter` directory:

```bash
# Download EasyList + EasyPrivacy (>100k lines combined) and benchmark them:
pnpm bench:cold-start

# Or point at a local filter file for offline repeatability:
pnpm bench:cold-start /path/to/filter.txt
```

For more stable numbers, run with `--expose-gc` so the script can force garbage
collection between iterations:

```bash
node --expose-gc --import tsx benchmarks/cold-start-benchmark.ts
```

## Output

The script prints a metrics table to the console and overwrites
`benchmarks/RESULTS.md` with the recorded baseline (date, Node/platform, line
count, size, a cold-start column, and min/mean/median/p99 steady-state columns
per measured target). Commit `RESULTS.md` to keep the baseline in the repo.

---

# DNR Converter — VLQ Source-Map Size Benchmark (HITL)

> **This is a standalone, manually-run benchmark. It is NOT part of the test
> suite and is NOT wired into CI.** It exists to give a human reviewer a
> recorded size comparison between the current compact JSON source-map format
> and a base64 VLQ encoding, so the stale "use VLQ" TODO (User Story 8) can be
> resolved with a documented decision.

## What it measures

It builds a real source map by scanning + converting a 100k+ line filter list
(EasyList + EasyPrivacy), then measures the serialized byte size of:

1. **Current JSON format** — `JSON.stringify` of
   `[[declarativeRuleId, sourceRuleIndex, filterId], ...]`.
2. **Base64 VLQ format** — each triple encoded as one comma-separated base64 VLQ
   segment, mirroring the source-map "mappings" format.

It reports the triple count, both sizes, the absolute savings, and the
percentage reduction, then writes `benchmarks/vlq-results.md`.

## How to run

Requires Node.js >= 22 and a built `@adguard/agtree` (run `pnpm build` at the
repo root, or `npx lerna run build --scope=@adguard/agtree`, first).

From the `packages/dnr-converter` directory:

```bash
# Download EasyList + EasyPrivacy (>100k lines combined) and benchmark them:
pnpm bench:vlq

# Or point at a local filter file for offline repeatability:
pnpm bench:vlq /path/to/filter.txt
```

## Decision

A human reviewer uses the recorded savings to decide whether to adopt VLQ
(custom codec, reduced debuggability, schema change) or drop it with a
documented note in `src/ruleset/source-map.ts`. There is no CI gate.
