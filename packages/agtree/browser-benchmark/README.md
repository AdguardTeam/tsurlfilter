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

The results will be displayed on the console and saved in [`RESULTS.md`][results].

> [!NOTE]
> Please be aware that the benchmark may take several minutes to complete.

[results]: ./RESULTS.md
