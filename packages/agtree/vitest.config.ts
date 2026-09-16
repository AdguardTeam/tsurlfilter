// eslint-disable-next-line import/no-extraneous-dependencies
import { playwright } from '@vitest/browser-playwright';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig, defineProject } from 'vitest/config';

// Pre-bundling the compared bundles with esbuild changes how the module runner
// serves the in-project `dist`, so the benchmark-only optimizer must not leak
// into the regular unit-test path.
const isBench = process.argv.includes('bench');

export default defineConfig({
    test: {
        setupFiles: [
            './test/setup/custom-matchers/index.ts',
        ],
        watch: false,
        coverage: {
            include: [
                'src/**/*.ts',
            ],
        },
        benchmark: {
            include: ['test/**/*.bench.ts'],
        },
        // The `bench`/`bench:browser` scripts select these projects with
        // `--project "node*"` / `--project "browser*"`; in bench mode Vitest
        // appends ` (bench)` (and ` (chromium)` for the browser instance), so
        // wildcards keep the scripts independent of those internal suffixes.
        projects: [
            defineProject({
                test: {
                    name: 'node',
                    // Benchmarks compare the built `@adguard/agtree` bundle
                    // against `agtree-v4`. Pre-bundle both with esbuild so the
                    // in-project v5 `dist` is not served module-by-module
                    // (which deoptimizes cross-module calls and skews timings);
                    // this makes the node comparison apples-to-apples. Enabled
                    // only for bench runs to keep unit tests off this path.
                    deps: isBench
                        ? {
                            optimizer: {
                                ssr: {
                                    enabled: true,
                                    include: ['@adguard/agtree', 'agtree-v4'],
                                },
                            },
                        }
                        : undefined,
                },
            }),
            defineProject({
                // Vite's top-level dependency optimizer. Vitest 5 does not read
                // `deps.optimizer.web` for browser mode, so the include list
                // lives here to pre-bundle both parser builds (the in-project
                // v5 `dist` and the `agtree-v4` dependency) and keep the
                // browser comparison apples-to-apples.
                optimizeDeps: {
                    include: ['@adguard/agtree', 'agtree-v4'],
                },
                test: {
                    name: 'browser',
                    include: [],
                    // `converter.bench.ts` transitively imports `node:fs`
                    // (compatibility-table-data), so it cannot run in Chromium.
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
                            { browser: 'firefox' },
                        ],
                    },
                },
            }),
        ],
    },
});
