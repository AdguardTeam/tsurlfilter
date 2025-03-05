/**
 * @file vitest configuration file
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vitest/config';

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
    },
});
