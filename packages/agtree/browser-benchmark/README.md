# AGTree Browser Benchmark

1. Install Playwright browsers with their dependencies:

```sh
yarn playwright install --with-deps
```

1. Run the benchmark:

```sh
npx ts-node benchmark.ts
```

> [!NOTE]
> Do not execute with `tsx` otherwise it may break browser-context codes.
> See https://github.com/privatenumber/tsx?tab=readme-ov-file#does-it-have-any-limitations

Benchmark results will be printed to the console. It may take some time to complete.
