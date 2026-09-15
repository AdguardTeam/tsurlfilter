// eslint-disable-next-line import/no-extraneous-dependencies
import { playwright } from '@vitest/browser-playwright';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig, defineProject } from 'vitest/config';

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
                    // against npm-alias baselines (`agtree-v4`). Pre-bundle both
                    // with esbuild so the in-project v5 `dist` is not served
                    // module-by-module (which deoptimizes cross-module calls and
                    // skews timings); this makes the node comparison
                    // apples-to-apples.
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
            defineProject({
                test: {
                    name: 'browser',
                    include: [],
                    // `converter.bench.ts` imports from `src` and therefore
                    // transitively requires `node:fs`
                    // (compatibility-table-data), so it cannot run in Chromium.
                    // The fixture-based benches import the built package instead
                    // and do run there.
                    benchmark: {
                        include: ['test/**/*.bench.ts'],
                        exclude: ['test/converter.bench.ts'],
                    },
                    // Pre-bundle both builds for the same reason as the node
                    // project above, so the in-project v5 `dist` is optimized
                    // exactly like the `agtree-v4` dependency.
                    deps: {
                        optimizer: {
                            web: {
                                enabled: true,
                                include: ['@adguard/agtree', 'agtree-v4'],
                            },
                        },
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
            }),
        ],
    },
});
