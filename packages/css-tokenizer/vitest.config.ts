/**
 * @file vitest configuration file
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { playwright } from '@vitest/browser-playwright';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
    test: {
        watch: false,
        coverage: {
            include: [
                'src/**/*.ts',
                // We can safely ignore the following files
                '!src/version.ts',
                '!src/common/types/**/*.ts',
                '!src/index.ts',
            ],
            thresholds: {
                global: {
                    branches: 90,
                    functions: 90,
                    lines: 90,
                    statements: 90,
                },
            },
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
