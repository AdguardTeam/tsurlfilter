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
