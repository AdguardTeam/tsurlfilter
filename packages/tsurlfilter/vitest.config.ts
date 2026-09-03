import { playwright } from '@vitest/browser-playwright';
import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
    test: {
        testTimeout: 30000,
        setupFiles: [
            './test/setup/index.ts',
            './test/setup/custom-matchers/index.ts',
        ],
        watch: false,
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
