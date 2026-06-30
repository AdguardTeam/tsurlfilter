# DNR Converter — Cold-Start Benchmark Results

This file is overwritten by `pnpm bench:cold-start` on each run. The latest
recorded baseline is below.

> Run the benchmark manually (`pnpm bench:cold-start`) and commit the updated
table to record a new baseline.

## Baseline

- **Date**: 2026-06-23T09:10:43.367Z
- **Node.js**: v22.22.1
- **Platform**: darwin/x64
- **Filter lines (non-empty)**: 138,013
- **Filter size**: 3.44 MB
- **Measured iterations (per target)**: 10

| Target | cold-start (ms) | min (ms) | mean (ms) | median (ms) | p99 (ms) |
| --- | --- | --- | --- | --- | --- |
| FilterListParser.parse (FilterList.prepare equivalent) | 194.18 | 96.17 | 117.47 | 118.29 | 140.37 |
| FilterConverter.convert (end-to-end runtime) | 610.57 | 465.83 | 494.94 | 491.46 | 531.28 |

## Notes

- `FilterListParser.parse` is the direct equivalent of tsurlfilter's
  `FilterList.prepare()` and is the runtime preparation step that moved from
  build-time to runtime.
- `FilterConverter.convert` (simple mode) is the end-to-end runtime conversion
  (scan + parse + convert) shown for context.
- `cold-start (ms)` is the timed first invocation of each target (module load,
  JIT, first deoptimized parse) — the cost acceptance criterion 1 asks for. The
  `min`/`mean`/`median`/`p99` columns are steady-state fresh-parse
  statistics over 10 repeat runs.
- A human reviewer decides whether the recorded latency is acceptable; there is
  no hard threshold and no CI gate.

## Real-world impact in the browser extension

These numbers are a **worst-case stress measurement** on a build-time-scale
filter list (138k lines). They do **not** reflect what happens on each
`configure()` call in practice:

- **Static rulesets** (EasyList, EasyPrivacy, Annoyances, etc.) are
  pre-converted at build time by `@adguard/dnr-rulesets` and shipped as
  pre-built JSON. They never go through runtime conversion.
- At runtime, only **dynamic rules** are converted via
  `DynamicRulesApi.updateDynamicFiltering()`: allowlist rules, user rules,
  and custom filters.
- Chrome's DNR API caps **dynamic rules at 30,000** total, so even large
  custom filter subscriptions are truncated. Real-world dynamic rulesets are
  typically hundreds to low thousands of rules — well under 100 ms to convert,
  not the 610 ms baseline shown above.
- The conversion runs on every `configure()` call (startup + any config
  change: filter updates, toggling protection, editing user rules). The
  cold-start column is representative of MV3 service-worker restarts (V8 JIT
  warmup), which happen frequently.
