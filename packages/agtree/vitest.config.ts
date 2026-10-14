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
                },
            }),
            defineProject({
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
                        ],
                    },
                },
            }),
        ],
    },
});
