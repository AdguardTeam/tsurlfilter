# TSUrlFilter Benchmark

Benchmarks for measuring TSUrlFilter engine creation performance across different environments (Node.js and browsers)
using [tinybench](https://github.com/tinylibs/tinybench).

This benchmark measures:

- **TSUrlFilter v4** engine creation performance
- **TSUrlFilter v3** engine creation performance

The benchmark runs against multiple filter lists (EasyList, AdGuard Base List) in various environments
(Node.js, Chromium, Firefox, WebKit).

## Running the Benchmark

1. Build TSUrlFilter:

```sh
pnpm --filter @adguard/tsurlfilter... build
```

1. Install Playwright browsers with their dependencies:

```sh
pnpm playwright install --with-deps
```

1. Run the benchmark:

```sh
pnpm start
```

> [!NOTE]
> Do not execute with `tsx` otherwise it may break browser-context codes.
> See https://github.com/privatenumber/tsx?tab=readme-ov-file#does-it-have-any-limitations

The results will be displayed on the console and saved in [`RESULTS.md`][results].

> [!NOTE]
> The benchmark may take several minutes to complete as it runs tests across multiple browsers and filter lists.

## Output

The benchmark provides detailed performance metrics including:

- **Hz (ops/s)**: Operations per second
- **Mean/Min/Max**: Execution times in milliseconds
- **P75/P99/P995/P999**: Percentile measurements
- **RME**: Relative margin of error
- **Samples**: Number of benchmark iterations

[results]: ./RESULTS.md
