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

/**
 * SSR dependency-optimizer options for the Node benchmark project.
 *
 * Vite's SSR dep optimizer honors `force` at runtime
 * (`environment.config.optimizeDeps.force`), but Vitest 5's
 * `DepsOptimizationOptions` type does not declare it. Keeping the object in a
 * variable still type-checks the declared options while letting the
 * runtime-supported `force` through.
 */
const SSR_OPTIMIZER_OPTIONS = {
    enabled: true,
    include: ['@adguard/agtree', 'agtree-v4'],
    force: true,
};

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
            // `force` re-bundles on every run so a rebuilt `dist` is never
            // measured stale through Vite's optimizer cache.
            defineProject({
                test: {
                    name: 'node',
                    include: [],
                    benchmark: {
                        include: ['test/**/*.bench.ts'],
                    },
                    deps: {
                        optimizer: {
                            ssr: SSR_OPTIMIZER_OPTIONS,
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
