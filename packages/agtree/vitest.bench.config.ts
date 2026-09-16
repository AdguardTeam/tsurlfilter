/**
 * @file Benchmark-only Vitest configuration.
 *
 * Kept separate from `vitest.config.ts` so the dependency optimizer (which
 * pre-bundles the built `@adguard/agtree` package and the `agtree-v4` baseline)
 * is never applied to ordinary unit tests: `pnpm test` must work right after
 * installation, before `dist` exists. Benchmarks require a built package, so
 * run `pnpm build` before `pnpm bench` / `pnpm bench:browser`.
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { playwright } from '@vitest/browser-playwright';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
    test: {
        watch: false,
        // The `bench`/`bench:browser` scripts select these projects with
        // `--project "node*"` / `--project "browser*"`; in bench mode Vitest
        // appends ` (bench)` (and ` (chromium)` for the browser instance), so
        // wildcards keep the scripts independent of those internal suffixes.
        projects: [
            // Node benchmarks: compare the built `@adguard/agtree` bundle
            // against the npm-alias baseline (`agtree-v4`). Pre-bundle both
            // with esbuild so the in-project v5 `dist` is not served
            // module-by-module (which deoptimizes cross-module calls and skews
            // timings); this makes the node comparison apples-to-apples.
            defineProject({
                test: {
                    name: 'node',
                    include: [],
                    benchmark: {
                        include: ['test/**/*.bench.ts'],
                    },
                    deps: {
                        optimizer: {
                            ssr: {
                                enabled: true,
                                include: ['@adguard/agtree', 'agtree-v4'],
                            },
                        },
                    },
                },
            }),
            // Browser benchmarks. `converter.bench.ts` imports from `src` and
            // therefore transitively requires `node:fs`
            // (compatibility-table-data), so it cannot run in Chromium. The
            // fixture-based benches import the built package instead and do run
            // there.
            defineProject({
                test: {
                    name: 'browser',
                    include: [],
                    benchmark: {
                        include: ['test/**/*.bench.ts'],
                        exclude: ['test/converter.bench.ts'],
                    },
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        headless: true,
                        instances: [
                            { browser: 'chromium' },
                        ],
                    },
                },
                // Vitest 5 has no `deps.optimizer.web`: the browser Vite server
                // aggregates each project's Vite `optimizeDeps.include`.
                // `force` re-bundles on every run so a rebuilt `dist` is never
                // measured stale through Vite's optimizer cache.
                optimizeDeps: {
                    include: ['@adguard/agtree', 'agtree-v4'],
                    force: true,
                },
            }),
        ],
    },
});
